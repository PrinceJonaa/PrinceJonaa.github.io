#!/usr/bin/env python3
"""Probe authoritative FSLD schema and archive Range accessibility (read-only).

Never download the 8.8GB archive. Do not assume licenses from dataset-level terms.
Print structure, masked examples (no personal profile info) and the count of
available verified BPMs before choosing test songs.
"""
import io,json,urllib.request,zipfile
from collections import Counter
from remotezip import RemoteZip
BASE='https://zenodo.org/records/3967852/files/'
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'JonaAudio-research-audit/1.0'})
 with urllib.request.urlopen(req,timeout=120) as stream:return stream.read()

def main():
 raw=get(BASE+'annotations.zip?download=1')
 print('Downloaded expert annotation ZIP bytes',len(raw),flush=True)
 with zipfile.ZipFile(io.BytesIO(raw)) as z:
  names=[i.filename for i in z.infolist() if i.filename.lower().endswith('.json')]
  print('annotation JSON files',len(names),'example paths',names[:4],flush=True)
  forms=Counter();samples=[]
  for filename in names:
   try:item=json.loads(z.read(filename))
   except Exception:continue
   if isinstance(item,dict):
    forms[tuple(sorted(item.keys()))]+=1
    if len(samples)<3:samples.append({'file':filename,'keys':list(item.keys()),'values':{k:str(v)[:140] for k,v in item.items()}})
  print('Common expert shapes',forms.most_common(4),'examples',samples,flush=True)
 print('Opening FSLD 8.8GB ZIP via HTTP Range (not bulk downloading)',flush=True)
 with RemoteZip(BASE+'FSL10K.zip?download=1',timeout=160) as zip:
  archive=zip.namelist()
  print('Central-directory entries',len(archive),'first',archive[:10],flush=True)
  meta=[x for x in archive if x.lower().endswith('metadata.json')]
  print('metadata.json matches',meta,flush=True)
  if len(meta)!=1:raise RuntimeError('Expected exactly one dataset metadata JSON')
  data=zip.read(meta[0])
  print('Metadata JSON byte count',len(data),'sha-free, JSON structure only',flush=True)
  metadata=json.loads(data)
  print('Metadata type and items',type(metadata).__name__,len(metadata),flush=True)
  if isinstance(metadata,dict):
   for k,v in list(metadata.items())[:3]:
    print('Example metadata keys for sound',k,list(v) if isinstance(v,dict) else type(v).__name__,flush=True)
    if isinstance(v,dict):
     print('License/creator/BPM example',{field:str(v.get(field))[:160] for field in v if any(x in field.lower() for x in ('license','creator','author','user','bpm','tempo','annotation','tag'))},flush=True)
  wavs=[x for x in archive if x.lower().endswith('.wav')]
  print('WAV entries',len(wavs),'example',wavs[:3],flush=True)
if __name__=='__main__':main()
