#!/usr/bin/env python3
"""Local research comparators for BPM on independently labeled WaivOps loops.

Optional librosa and Essentia are NOT included in production browser code.
No network/audio upload; this script reads original licensed files in fixture folder.
"""
import argparse, json, subprocess, warnings
from pathlib import Path
import numpy as np

def decoded(path,sr):
    command=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-i',str(path),
             '-ac','1','-ar',str(sr),'-f','f32le','pipe:1']
    result=subprocess.run(command,check=True,capture_output=True,timeout=60)
    y=np.frombuffer(result.stdout,dtype='<f4').copy()
    return y

def librosa_tempo(y,sr):
    import librosa
    # Standard beat tracker and non-DP autocorrelation tempo are different baselines.
    onset=librosa.onset.onset_strength(y=y,sr=sr,hop_length=256)
    tracker,beats=librosa.beat.beat_track(onset_envelope=onset,sr=sr,hop_length=256,start_bpm=120,trim=False)
    tracker=float(np.asarray(tracker).ravel()[0])
    estimates=librosa.feature.tempo(onset_envelope=onset,sr=sr,hop_length=256,aggregate=None)
    return {'beat_tracker':round(tracker,2) if np.isfinite(tracker) else None,
            'beat_frames':len(beats),
            'tempo_median':round(float(np.median(estimates)),2) if len(estimates) else None,
            'librosa_version':librosa.__version__}

def essentia_tempo(path):
    import essentia, essentia.standard as es
    # Source length is short; Essentia's "multifeature" estimates a single global BPM.
    y=decoded(path,44100)
    bpm,ticks,confidence,estimates,intervals=es.RhythmExtractor2013(method='multifeature')(y)
    return {'bpm':round(float(bpm),2),'confidence_value_uncalibrated':round(float(confidence),4),
            'beats':len(ticks),'version':getattr(essentia,'__version__','unknown')}

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--folder',default='JonaAudio/bench/fixtures/WaivOps')
    p.add_argument('--essentia',action='store_true',help='Also run local AGPL Essentia Python package when installed')
    args=p.parse_args()
    folder=Path(args.folder)
    manifest=json.loads((folder/'manifest.json').read_text())
    output=[]
    for track in manifest['tracks']:
        result={'id':track['id'],'referenceBpm':track['bpm'],
                'group':track['genreGroup'],'split':track['split']}
        try:
            audio=decoded(folder/track['file'],22050)
            with warnings.catch_warnings():
                warnings.simplefilter('ignore')
                result['librosa']=librosa_tempo(audio,22050)
        except ImportError:
            result['librosa']={'status':'not-installed'}
        except Exception as exc:
            result['librosa']={'status':'error','reason':str(exc)[:200]}
        if args.essentia:
            try:result['essentia']=essentia_tempo(folder/track['file'])
            except ImportError:result['essentia']={'status':'not-installed'}
            except Exception as exc:result['essentia']={'status':'error','reason':str(exc)[:200]}
        output.append(result)
        print(track['id'],'label',track['bpm'],'librosa',result['librosa'].get('beat_tracker'),
              'essentia',result.get('essentia',{}).get('bpm'),flush=True)
    summary={}
    for field in ['librosa.beat_tracker','librosa.tempo_median','essentia.bpm']:
        metrics={}
        for split in ['development','held-out','all']:
            entries=[r for r in output if split=='all' or r['split']==split]
            x=[r for r in entries if isinstance((r.get(field.split('.')[0]) or {}).get(field.split('.')[1]),(float,int))]
            exact=sum(abs(r[field.split('.')[0]][field.split('.')[1]]-r['referenceBpm'])<=1 for r in x)
            three=sum(abs(r[field.split('.')[0]][field.split('.')[1]]-r['referenceBpm'])<=3 for r in x)
            metrics[split]={'available':len(x),'withinOne':exact,'withinThree':three}
        summary[field]=metrics
    report={'schema':1,'source':'WaivOps CC BY 4.0 labels','methods':'external local-only references; no production dependency',
            'notes':'Optional Essentia package uses AGPL. A correct BPM on one labeled loop does not prove accuracy on full songs.',
            'summary':summary,'rows':output}
    target=folder/'reference-engine-results.json'
    target.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(summary,indent=2),flush=True)
if __name__=='__main__':main()
