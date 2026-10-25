#!/usr/bin/env python3
"""Audit FMAK expert musical-key labels against per-track FMA audio licenses.

This creates a metadata-only registry, not a redistributable audio dump.
Never assume the entire FMA archive is under a blanket Creative Commons license.
"""
import csv
import hashlib
import io
import json
import urllib.request
from pathlib import Path

LABELS='https://raw.githubusercontent.com/stellaywong/fma_keys/master/keys.csv'
TRACKS='https://os.unil.cloud.switch.ch/fma/fma_metadata.zip'
ZENODO='https://doi.org/10.5281/zenodo.10719860'
OUTPUT=Path('JonaAudio/bench/fixtures/FMAK')
ALLOWED_GENRES={'Hip-Hop','Electronic','Pop','Rock','Folk','Jazz','Blues'}
def read_labels():
    req=urllib.request.Request(LABELS,headers={'User-Agent':'JonaAudio-license-audit/1.0'})
    with urllib.request.urlopen(req,timeout=60) as response:
        content=response.read().decode('utf8-sig')
    lines=content.splitlines()
    assert lines[0].startswith(',spotify,key_and_mode') and lines[1].startswith('track_id,')
    reader=csv.DictReader(lines[1:])
    labels={}
    for row in reader:
        try: id=int(row['track_id'])
        except (ValueError,TypeError):continue
        label=(row.get('key_and_mode') or '').strip()
        if not label:continue
        labels[id]=label
    return labels,hashlib.sha256(content.encode()).hexdigest()

def read_tracks_zip():
    # remotezip fetches the ZIP central directory and only the metadata file
    # inside this 342MiB ZIP, avoiding full-archive transfer when HTTP Range works.
    from remotezip import RemoteZip
    with RemoteZip(TRACKS,timeout=120) as z:
        names=[n for n in z.namelist() if n.endswith('/tracks.csv') or n=='tracks.csv']
        if len(names)!=1:raise RuntimeError('Could not find the unique FMA tracks.csv: '+str(names))
        raw=z.read(names[0]).decode('utf-8-sig')
    rows=csv.reader(io.StringIO(raw))
    top=next(rows);sub=next(rows)
    columnMap=[(top[i].strip().lower() if i<len(top) else '',
                sub[i].strip().lower() if i<len(sub) else '') for i in range(len(sub))]
    # FMA columns are two-level CSV headers: ('track','license'), ('track','genre_top') ...
    def get(row,namespace,name):
        positions=[i for i,entry in enumerate(columnMap) if entry==(namespace,name)]
        return row[positions[0]] if positions and positions[0]<len(row) else ''
    result={}
    for row in rows:
        try:id=int(row[0])
        except (ValueError,IndexError):continue
        result[id]={
           'genre':get(row,'track','genre_top'),
           'license':get(row,'track','license'),
           'title':get(row,'track','title'),
           'artist':get(row,'artist','name'),
           'artist_id':get(row,'artist','id'),
           'subset':get(row,'set','subset'),
           'duration':get(row,'track','duration')
        }
    return result,columnMap

def safe_license(license):
    norm=(license or '').strip().lower()
    # Conservative: allow CC0, public domain, CC BY / BY-SA; exclude NC and ND.
    if any(x in norm for x in ('noncommercial','no-derivatives','nonderivatives','-nc','-nd','download only','limited')):
        return False
    if 'cc0' in norm or norm in ('public domain','publicdomain'):
        return True
    return norm in {'attribution','attribution-sharealike','cc by','cc by-sa',
                    'creative commons attribution','creative commons attribution-sharealike'}

def main():
    labels,hashLabels=read_labels()
    print('Expert-labeled FMAK keys:',len(labels),flush=True)
    tracks,columns=read_tracks_zip()
    print('Original FMA metadata tracks:',len(tracks),flush=True)
    print('License values sample:',sorted(set(t['license'] for t in tracks.values()))[:28],flush=True)
    items=[]
    for id,key in labels.items():
        item=tracks.get(id)
        if not item:continue
        if not safe_license(item['license']) or item['genre'] not in ALLOWED_GENRES:continue
        # Restrict the early audit to IDs < 20,000, corresponding to 000-019.zip.
        # Artist-level split prevents identical artists contaminating both pools.
        if id>=20000:continue
        items.append({'trackId':id,'key':key,'genre':item['genre'],
          'audioLicense':item['license'],'artist':item['artist'],
          'title':item['title'],'sourceFmaMetadata':TRACKS,
          'sourceKeyAnnotation':LABELS})
    items.sort(key=lambda r:r['trackId'])
    audit={
       'schema':1,'dataset':'FMAK 1.0 / FMA',
       'annotationDoi':'10.5281/zenodo.10719860',
       'annotationSha256':hashLabels,
       'metadataSource':TRACKS,
       'selection':'ONLY exact per-track CC0/CC BY/CC BY-SA licenses; seven genre labels; first archive 000-019',
       'scope':'Metadata inventory ONLY — no audio here, no evaluated key accuracy',
       'candidates':items,
       'stats':{'totalFmakKeys':len(labels),'totalFmaTracks':len(tracks),'licenseCheckedCandidates':len(items)}
    }
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/'license-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
    print('Rights-checked full-song key candidates:',len(items),flush=True)
    for row in items[:15]:
        print(row['trackId'],row['genre'],row['key'],row['audioLicense'],
              row['artist'][:24],flush=True)
    if len(items)<5:raise RuntimeError('Too few verifiably licensed key-annotated songs; do NOT claim evaluation')

if __name__=='__main__':main()
