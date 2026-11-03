#!/usr/bin/env python3
"""Reproducibly acquire a NEW source/creator-separated FSLD tempo test.

Expert BPM annotations and the audio license are checked per sound. HTTP Range
reads only the chosen WAV ZIP members (not the 8.8 GB FSL10K archive).
Audio stays in CI scratch; only metadata and aggregate measurements are saved.
Selection is hash-ordered and *fixed before evaluating the new selector*.
"""
import collections,hashlib,io,json,re,urllib.request,zipfile
from pathlib import Path
from remotezip import RemoteZip

BASE='https://zenodo.org/records/3967852/files/'
TARGET=Path('JonaAudio/bench/fixtures/FSLD')
BINS=((55,85),(85,115),(115,145),(145,175),(175,210.01))
PER_BIN_PER_SPLIT=3
MAX_FILE=11_000_000
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'JonaAudio-creator-separated-benchmark/1.0'})
 with urllib.request.urlopen(req,timeout=120) as response:return response.read()
def checked_license(url):
 s=str(url or '').strip().lower().replace('https://','http://').rstrip('/')
 if re.fullmatch(r'http://creativecommons.org/licenses/by/(3.0|4.0)',s):return 'CC BY'
 if re.fullmatch(r'http://creativecommons.org/publicdomain/zero/(1.0)',s):return 'CC0'
 return None
def valid_bpm(value):
 try:v=float(value)
 except (TypeError,ValueError):return None
 return v if 55<=v<=210 else None
def stable(*values):
 return hashlib.sha256('|'.join(map(str,values)).encode()).hexdigest()
def main():
 TARGET.mkdir(parents=True,exist_ok=True)
 raw=fetch(BASE+'annotations.zip?download=1')
 expert=collections.defaultdict(list)
 with zipfile.ZipFile(io.BytesIO(raw)) as archive:
  for name in archive.namelist():
   match=re.search(r'/sound-(\d+)\.json$',name)
   if not match:continue
   try:annotation=json.loads(archive.read(name))
   except (json.JSONDecodeError,UnicodeDecodeError):continue
   if str(annotation.get('discard')).lower() not in ('false','0'):continue
   bpm=valid_bpm(annotation.get('bpm'))
   if bpm is not None:expert[int(match[1])].append(bpm)
 print('Individual expert annotated sound IDs',len(expert),flush=True)
 with RemoteZip(BASE+'FSL10K.zip?download=1',timeout=180) as archive:
  meta_candidates=[x for x in archive.namelist() if x.endswith('metadata.json')]
  if len(meta_candidates)!=1:raise RuntimeError('Unexpected FSL metadata layout')
  metadata=json.loads(archive.read(meta_candidates[0]))
  wav={}
  for member in archive.infolist():
   if not member.filename.lower().endswith('.wav'):continue
   match=re.match(r'(\d+)(?:_|\.)',Path(member.filename).name)
   if match and 50000<member.file_size<=MAX_FILE:
    wav.setdefault(int(match[1]),member.filename)
  candidates=[]
  reasons=collections.Counter()
  for ident,labels in expert.items():
   if len(labels)<2 or max(labels)-min(labels)>1:
    reasons['no-expert-consensus']+=1;continue
   md=metadata.get(str(ident))
   if not isinstance(md,dict) or ident not in wav:
    reasons['no-audio-metadata']+=1;continue
   license_type=checked_license(md.get('license'))
   if not license_type:
    reasons['restrictive-or-unknown-audio-license']+=1;continue
   uploader=str(md.get('username') or '').strip()
   if not uploader:reasons['no-creator']+=1;continue
   bpm=sum(labels)/len(labels)
   bin_number=next((i for i,(low,high) in enumerate(BINS) if low<=bpm<high),None)
   if bin_number is None:continue
   candidates.append({'sourceId':ident,'creator':uploader,
    'creatorDigest':stable('creator',uploader)[:18],
    'sourcePack':str(md.get('pack_name') or md.get('pack') or ''),
    'license':md['license'],'licenseType':license_type,
    'expertBpm':round(bpm,2),'expertCount':len(labels),
    'genre':str(md.get('tags') or [])[:160],
    'durationLabel':'not verified until decoded','bin':bin_number,
    'archiveEntry':wav[ident],'file':str(ident)+'.wav',
    'sourcePage':'https://freesound.org/s/'+str(ident)+'/',
    'sortHash':stable('JonaAudio-tempo-external-v1',ident)})
  print('Consensus licensed creator candidates',len(candidates),'exclusions',dict(reasons),flush=True)
  # First select candidates by precommitted hash, no DSP results ever used.
  buckets={(bin,split):[] for bin in range(len(BINS)) for split in ('development','evaluation')}
  taken_creators=set()
  for row in sorted(candidates,key=lambda r:r['sortHash']):
   if row['creatorDigest'] in taken_creators:continue
   bin=row['bin']
   # Hash author, not song, to prevent creator leakage across development/eval.
   pref='development' if int(stable('partition',row['creatorDigest'])[:2],16)%2==0 else 'evaluation'
   slots=buckets[bin,pref]
   if len(slots)>=PER_BIN_PER_SPLIT:continue
   row['split']=pref;slots.append(row);taken_creators.add(row['creatorDigest'])
  # Distinct producers in all partitions, no fixed pack or genre prior.
  picked=[r for bucket in buckets.values() for r in bucket]
  print('Selected per BPM bin / creator-separated split',
    {str(key):len(value) for key,value in buckets.items()},flush=True)
  if len(picked)<20 or len([x for x in picked if x['split']=='evaluation'])<8:
   raise RuntimeError('Too few independent creator/consensus licensed recordings. No benchmark claim.')
  for i,row in enumerate(sorted(picked,key=lambda x:(x['split'],x['bin'],x['sortHash']))):
   source=archive.read(row['archiveEntry'])
   if len(source)>MAX_FILE:raise RuntimeError('Source WAV exceeds bounded limit')
   (TARGET/row['file']).write_bytes(source)
   row['sha256']=hashlib.sha256(source).hexdigest()
   row['bytes']=len(source)
   print('Acquired creator-separated sound',i+1,'id',row['sourceId'],
    'expert BPM',row['expertBpm'],'split',row['split'],'license',row['licenseType'],
    'bytes',len(source),flush=True)
  stripped=[{k:v for k,v in row.items() if k not in ('sortHash','genre')}
             for row in picked]
  manifest={'schema':1,'dataset':'Freesound Loop Dataset, expert BPM consensus',
   'doi':'10.5281/zenodo.3967852','license':'per-file CC0 or CC BY 3/4',
   'groundTruth':'Two or more expert annotations agree within 1 BPM; average fixed before analysis',
   'partition':'Unique original uploader across all files and split; deterministic SHA256 sorted',
   'caveat':'These are independent, creator-separated real LOOPS, not complete songs.',
   'counts':{'selected':len(stripped),'development':sum(x['split']=='development' for x in stripped),
    'evaluation':sum(x['split']=='evaluation' for x in stripped)},
   'sources':stripped}
  (TARGET/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
  print('FSLD FIXED SOURCE READY',manifest['counts'],flush=True)
if __name__=='__main__':main()
