#!/usr/bin/env python3
"""Download CC BY 4.0 WaivOps hip-hop examples with source-traceable tempo labels.

The examples are *drum loops*, NOT full songs and NOT labeled with a musical key.
Use a separate held-out split; do not train on its answers. No third-party API keys.
"""
import hashlib
import json
import re
import urllib.request
from pathlib import Path
import argparse

SOURCES = {
 "trap": {
   "repo": "patchbanks/WaivOps-HH-TRP",
   "doi": "10.5281/zenodo.15734094",
   "description": "hip-hop trap/drill/trapsoul/cloud rap drum loops",
   "names": [
    "110bpm_hh_trp_id_01_000180.mp3",
    "115bpm_hh_trp_id_01_000678.mp3",
    "122bpm_hh_trp_id_01_002090.mp3",
    "128bpm_hh_trp_id_01_003019.mp3",
    "135bpm_hh_trp_id_01_004513.mp3",
    "140bpm_hh_trp_id_01_005898.mp3",
    "142bpm_hh_trp_id_01_006363.mp3",
    "145bpm_hh_trp_id_01_006875.mp3",
    "148bpm_hh_trp_id_01_007214.mp3",
    "150bpm_hh_trp_id_01_007953.mp3",
    "152bpm_hh_trp_id_01_008400.mp3",
    "155bpm_hh_trp_id_01_008570.mp3",
    "158bpm_hh_trp_id_01_009305.mp3",
    "162bpm_hh_trp_id_01_009977.mp3",
    "165bpm_hh_trp_id_01_010639.mp3",
   ],
 },
 "boom-bap": {
   "repo": "patchbanks/WaivOps-HH-LFBB",
   "doi": "10.5281/zenodo.7523435",
   "description": "lo-fi hip-hop and boom-bap drum loops",
   "names": [
    "79bpm_hh_lfbb_mid_012_15.mp3",
    "79bpm_hh_lfbb_mid_012_16.mp3",
    "80bpm_hh_lfbb_mid_010_06.mp3",
    "81bpm_hh_lfbb_mid_006_07.mp3",
    "81bpm_hh_lfbb_mid_011_03.mp3",
    "81bpm_hh_lfbb_mid_012_02.mp3",
   ],
 },
}
# Fixed split before algorithm experiments: the held-out tracks must not guide
# parameter selection. Each family contributes to both splits.
HELDOUT_TRAP={1,3,5,7,9,11,13}
HELDOUT_BOOM={1,3,5}
MAX_BYTES=3_000_000

def sha(blob):
    return hashlib.sha256(blob).hexdigest()

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--output',default='JonaAudio/bench/fixtures/WaivOps')
    args=p.parse_args()
    out=Path(args.output)
    out.mkdir(parents=True,exist_ok=True)
    tracks=[]
    for group,details in SOURCES.items():
        for index,filename in enumerate(details['names']):
            match=re.fullmatch(r'(\d{2,3})bpm_[a-z0-9_]+\.mp3',filename)
            if not match: raise ValueError(f'Invalid published BPM filename {filename}')
            bpm=int(match[1])
            source=f'https://raw.githubusercontent.com/{details["repo"]}/main/examples/{filename}'
            request=urllib.request.Request(source,headers={
                'User-Agent':'JonaAudio-open-license-regression/1.0'})
            with urllib.request.urlopen(request,timeout=45) as response:
                blob=response.read(MAX_BYTES+1)
            if not 5000<len(blob)<MAX_BYTES: raise RuntimeError('Unexpected source audio size '+filename)
            if not (blob.startswith(b'ID3') or (blob[0]==0xff and blob[1]&0xe0==0xe0)):
                raise RuntimeError('Unexpected MP3 audio header '+filename)
            dest=out/filename
            dest.write_bytes(blob)
            split=('held-out' if index in (HELDOUT_TRAP if group=='trap' else HELDOUT_BOOM)
                   else 'development')
            tracks.append({
                'id':filename.removesuffix('.mp3'),
                'file':filename,'genreGroup':group,'split':split,
                'bpm':bpm,'key':None,'labelBasis':'producer tempo encoded in official source filename',
                'sourceRepo':details['repo'],'sourceUrl':source,
                'sha256':sha(blob),'bytes':len(blob),'license':'CC BY 4.0',
                'sourceDoi':details['doi']
            })
            print('Saved',group,filename,bpm,'BPM',split,flush=True)
    assert len(tracks)==21 and len({x['sha256'] for x in tracks})==len(tracks), 'Missing or duplicate source recordings'
    manifest={
        'schema':1,'dataset':'WaivOps hip-hop drum loops','license':'CC BY 4.0',
        'scope':'Actual rhythm-heavy loop excerpts; NOT full songs, NOT musical key ground truth',
        'source':'WaivOps/Patchbanks example audio distributed on official GitHub repositories',
        'method':'Original MP3 bytes saved unchanged; tempo parsed from official example filename, not guessed by JonaAudio',
        'splitRule':'Fixed development/held-out index split, determined before algorithm evaluation',
        'tracks':tracks
    }
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    credit="""# WaivOps hip-hop tempo benchmark

Source creator: WaivOps, a crowdsourced music project managed by Patchbanks.
The original files come from the example directories of:
- [WaivOps HH-TRP (trap and drill)](https://github.com/patchbanks/WaivOps-HH-TRP), DOI 10.5281/zenodo.15734094
- [WaivOps HH-LFBB (lo-fi and boom bap)](https://github.com/patchbanks/WaivOps-HH-LFBB), DOI 10.5281/zenodo.7523435

**License: Creative Commons Attribution 4.0 International (CC BY 4.0).**
License: https://creativecommons.org/licenses/by/4.0/

Source files are the original, unchanged MP3 demo recordings published in each repository's examples folder.
The only derived elements are the test split, annotations extracted from official filenames,
SHA-256 checksums, and analysis outputs. No AI or human re-annotation of the musical key
was made: drum-only loops do not supply usable musical key ground truth.

This is a **rhythm-focused benchmark**, NOT a dataset of complete songs or a full-song
key benchmark. The declared BPM follows official file naming and MIDI/loop production,
and half/double/triple pulses can be musically plausible even if not the source BPM.
"""
    (out/'CREDITS.md').write_text(credit)
    print('DONE',len(tracks),'CC BY files',sum(x['bytes'] for x in tracks),'bytes',flush=True)

if __name__=='__main__':
    main()
