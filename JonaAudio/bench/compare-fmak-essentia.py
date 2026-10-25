#!/usr/bin/env python3
"""Optional independent Essentia HPCP key extraction on real full FMAK songs.

AGPL Essentia runs in temporary CI Python environment; it is NOT embedded
into JonaAudio's web app. Published FMAK keys remain fixed ground truth.
"""
import json,re,subprocess
from pathlib import Path
import numpy as np
import essentia
import essentia.standard as es

ROOT=Path('JonaAudio/bench/fixtures/FMAK')
ENHARMONIC={'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'}
def normalize(value):
    if not value:return None
    v=re.match(r'^([A-G][#b]?)[ ]+(major|minor)$',str(value).strip(),re.I)
    if not v:return None
    return ENHARMONIC.get(v[1],v[1])+':'+v[2].lower()
def decode(file):
    result=subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error',
       '-i',str(file),'-ac','1','-ar','44100','-f','f32le','pipe:1'],
       capture_output=True,check=True,timeout=100)
    return np.frombuffer(result.stdout,dtype='<f4').copy()
def main():
    manifest=json.loads((ROOT/'selection.json').read_text())
    result=[]
    for track in manifest['tracks']:
        source=decode(ROOT/track['filename'])
        if len(source)<44100*50:raise RuntimeError('Too short for full-song benchmark')
        item={'id':track['id'],'genre':track['genre'],'reference':track['key'],
              'license':track['license'],'seconds':round(len(source)/44100,1)}
        for profile in ('edma','bgate'):
            key,mode,strength=es.KeyExtractor(sampleRate=44100,hpcpSize=36,profileType=profile)(source)
            hypothesis=str(key)+' '+str(mode)
            item[profile]={'key':hypothesis,'match':normalize(hypothesis)==normalize(track['key']),
                           'strengthNotProbability':round(float(strength),4)}
        result.append(item)
        print(track['id'],'expert',track['key'],'Essentia edma',item['edma']['key'],
              'bgate',item['bgate']['key'],flush=True)
    stats={}
    for genre in ('all','Hip-Hop','other'):
        subset=[x for x in result if genre=='all' or (x['genre']=='Hip-Hop' if genre=='Hip-Hop' else x['genre']!='Hip-Hop')]
        stats[genre]={'count':len(subset),
                      'edmaExact':sum(x['edma']['match'] for x in subset),
                      'bgateExact':sum(x['bgate']['match'] for x in subset)}
    payload={'schema':1,'reference':'FMAK expert song-level key labels, originals licensed individually',
       'engine':'Essentia Python KeyExtractor HPCP 36 bins (AGPL, CI research only)',
       'notes':'Full-length source audio analyzed; artist audio not redistributed. Group includes many hip-hop tracks by one performer.',
       'summary':stats,'rows':result}
    (ROOT/'essentia-key-results.json').write_text(json.dumps(payload,indent=2)+'\n')
    print('ESSENTIA FULL-SONG KEY',json.dumps(stats),flush=True)
if __name__=='__main__':main()
