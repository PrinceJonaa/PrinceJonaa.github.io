#!/usr/bin/env python3
"""Fetch a small set of complete, individually CC BY-licensed FMAK songs for CI.

FMAK key labels are expert annotations. Audio remains ephemeral; not committed
or uploaded as CI artifacts. Artist licenses are checked before any extraction.
"""
import hashlib,json,re
from pathlib import Path
from remotezip import RemoteZip

ROOT=Path('JonaAudio/bench/fixtures/FMAK')
DOI='10.5281/zenodo.10719860'
SOURCE='https://zenodo.org/records/10719860/files/000-019.zip?download=1'
MAX_SONG_BYTES=20_000_000

def main():
    audit=json.loads((ROOT/'license-audit.json').read_text())
    songs=audit['candidates']
    assert audit['annotationDoi']==DOI and len(songs)>=8
    # Prioritize seven representative hip-hop tracks from one artist and five
    # rock/folk songs from separate artists. Do NOT claim artist-independent hip-hop.
    hip=sorted((r for r in songs if r['genre']=='Hip-Hop'),key=lambda x:x['trackId'])[:8]
    other=sorted((r for r in songs if r['genre']!='Hip-Hop'),
                 key=lambda x:(x['genre'],x['trackId']))[:5]
    choices=hip+other
    ROOT.mkdir(parents=True,exist_ok=True)
    with RemoteZip(SOURCE,timeout=120) as z:
        names=z.namelist()
        print('Archive contains',len(names),'entries; sample',names[:9],flush=True)
        lookup={}
        for name in names:
            tail=Path(name).stem
            if re.fullmatch(r'\d{4,7}',tail):
                lookup.setdefault(int(tail),[]).append(name)
        matched=[]
        for item in choices:
            paths=lookup.get(item['trackId'],[])
            if len(paths)!=1:
                print('No unique file for',item['trackId'],'in archive',len(paths),flush=True)
                continue
            name=paths[0]
            info=z.getinfo(name)
            if info.file_size>MAX_SONG_BYTES or info.file_size<100_000:continue
            audio=z.read(name)
            if not (audio.startswith(b'ID3') or audio[0]==255 and audio[1]&0xe0==0xe0):
                raise RuntimeError('Unrecognized audio bytes '+name)
            local=ROOT/(str(item['trackId'])+'.mp3')
            local.write_bytes(audio)
            matched.append({
                'id':'FMAK-'+str(item['trackId']),
                'trackId':item['trackId'],
                'filename':local.name,
                'key':item['key'],
                'license':item['audioLicense'],
                'genre':item['genre'],
                'artist':item['artist'],
                'title':item['title'],
                'originalBytes':len(audio),
                'sha256':hashlib.sha256(audio).hexdigest(),
                'sourceZipEntry':name,
                'sourceArchive':SOURCE
            })
            print('Full licensed song',item['trackId'],item['genre'],item['key'],
                  item['audioLicense'],len(audio),'bytes',flush=True)
    if len(matched)<5:raise RuntimeError('Insufficient actual licensed full-song audio, no benchmark claim')
    selection={
        'schema':1,'dataset':'FMAK 1.0 full-song licensed audio',
        'annotationDoi':DOI,'source':'FMAK expert keys and original FMA CC BY artist licenses',
        'scope':'Full-length audio read and analyzed locally in CI; never committed as GitHub source',
        'selection':'First archive only, representative genres; hip-hop sample mostly one artist',
        'tracks':matched
    }
    (ROOT/'selection.json').write_text(json.dumps(selection,ensure_ascii=False,indent=2)+'\n')
    print('READY',len(matched),'full-length licensed key-labeled music recordings',flush=True)

if __name__=='__main__':main()
