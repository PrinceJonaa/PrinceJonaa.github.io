#!/usr/bin/env python3
"""Optional *local only* comparison: librosa / Essentia. No network or audio uploads.

Usage:
 python3 JonaAudio/bench/reference-engines.py /private/corpus.json /private/comparison.json --librosa --essentia

The input manifest is {"schema":1,"tracks":[{"id":"track-01","path":"/private/beat.wav"}]}.
No key labels, filenames or raw audio are copied into output. Outputs are independent
method estimates, NOT ground truth. Missing dependencies are recorded as unavailable.
"""
import argparse,json,subprocess,sys
from pathlib import Path
import numpy as np

MAJOR=np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
MINOR=np.array([6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
ROOTS=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B']
def rank_chroma(chroma):
 chroma=np.asarray(chroma,dtype=float)
 if chroma.shape!=(12,) or not np.isfinite(chroma).all() or np.linalg.norm(chroma)<1e-10:return []
 chroma=chroma/np.linalg.norm(chroma)
 results=[]
 for profile,scale in [(MAJOR,'major'),(MINOR,'minor')]:
  for root in range(12):
   p=np.roll(profile,root)
   results.append({'key':ROOTS[root]+' '+scale,'score':round(float(np.dot(chroma,p)/np.linalg.norm(p)),6)})
 return sorted(results,key=lambda x:-x['score'])[:5]

def decode_segment(path,start,length,sr):
 command=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-ss',str(max(0,start)),
          '-i',str(path),'-t',str(length),'-ac','1','-ar',str(sr),'-f','f32le','pipe:1']
 data=subprocess.run(command,capture_output=True,timeout=90,check=True).stdout
 return np.frombuffer(data,dtype='<f4').copy()

def get_duration(path):
 command=['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(path)]
 result=subprocess.run(command,capture_output=True,text=True,timeout=15,check=True)
 return float(result.stdout.strip())

def sample_positions(duration,length,sections):
 latest=max(0,duration-length)
 return [latest*k/(sections-1) if sections>1 else latest/2 for k in range(sections)]

def librosa_key_estimates(chunks,sr,include_hpss=False):
 import librosa
 entries={'version':librosa.__version__}
 for method in ('stft','cqt','cens'):
  vectors=[]
  for audio in chunks:
   if len(audio)<sr*3:continue
   if method=='stft':chroma=librosa.feature.chroma_stft(y=audio,sr=sr,n_fft=4096,hop_length=512)
   elif method=='cqt':chroma=librosa.feature.chroma_cqt(y=audio,sr=sr,hop_length=512,n_chroma=12)
   else:chroma=librosa.feature.chroma_cens(y=audio,sr=sr,hop_length=512,n_chroma=12)
   vectors.append(np.mean(chroma,axis=1))
  entries['chroma_'+method]={'candidates':rank_chroma(np.mean(vectors,axis=0))} if vectors else {'status':'unavailable'}
 if include_hpss:
  vectors=[]
  for audio in chunks:
   stft=librosa.stft(audio,n_fft=2048,hop_length=512)
   harmonic,_=librosa.decompose.hpss(stft,margin=(2.5,2.5))
   only=librosa.istft(harmonic,hop_length=512,length=len(audio))
   chroma=librosa.feature.chroma_cqt(y=only,sr=sr,hop_length=512,n_chroma=12)
   vectors.append(np.mean(chroma,axis=1))
  entries['hpss_cqt']={'candidates':rank_chroma(np.mean(vectors,axis=0))} if vectors else {'status':'unavailable'}
 return entries

def essentia_estimates(path,positions,length):
 import essentia
 import essentia.standard as es
 methods=[]
 # Essentia KeyExtractor/RhythmExtractor2013 require 44.1 kHz input.
 for profile in ('edma','bgate'):
  predictions=[]
  for pos in positions:
   y=decode_segment(path,pos,length,44100)
   if len(y)<44100*3:continue
   key,mode,strength=es.KeyExtractor(sampleRate=44100,hpcpSize=36,
                                    profileType=profile)(y)
   predictions.append({'key':str(key)+' '+str(mode),'strength':float(strength)})
  methods.append({'method':'essentia-key-'+profile,'sections':predictions,
                  'caveat':'Section vote; no consensus key is presumed ground truth.'})
 center=positions[len(positions)//2]
 audio=decode_segment(path,center,min(45,length*2),44100)
 if len(audio)>44100*8:
  try:
   bpm,ticks,confidence,estimates,intervals=es.RhythmExtractor2013(method='multifeature')(audio)
   methods.append({'method':'essentia-rhythm2013','bpm':float(bpm),
                   'confidence':float(confidence),'ticksCount':len(ticks)})
  except Exception as e:methods.append({'method':'essentia-rhythm2013','status':'error','reason':str(e)[:150]})
 return {'version':getattr(essentia,'__version__','unknown'),'methods':methods}

def main():
 parser=argparse.ArgumentParser(description='Compare audio locally. No uploads, no network APIs.')
 parser.add_argument('manifest');parser.add_argument('output')
 parser.add_argument('--librosa',action='store_true');parser.add_argument('--essentia',action='store_true')
 parser.add_argument('--hpss',action='store_true')
 parser.add_argument('--seconds',type=float,default=12);parser.add_argument('--sections',type=int,default=3)
 args=parser.parse_args()
 if not args.librosa and not args.essentia:parser.error('Choose --librosa and/or --essentia')
 if not (3<=args.seconds<=24 and 1<=args.sections<=5):parser.error('Use 3-24 second segments and 1-5 sections')
 manifest_path=Path(args.manifest).expanduser().resolve()
 manifest=json.loads(manifest_path.read_text())
 if manifest.get('schema')!=1 or not isinstance(manifest.get('tracks'),list):parser.error('Invalid manifest')
 rows=[]
 for track in manifest['tracks']:
  try:
   id=track['id'];path=Path(track['path']).expanduser()
   if not path.is_absolute():path=manifest_path.parent/path
   if not path.is_file():raise ValueError('Source unavailable')
   dur=get_duration(path);positions=sample_positions(dur,args.seconds,args.sections)
   row={'id':id,'segments':[{'start':round(t,2),'seconds':args.seconds} for t in positions],
        'sourceSeconds':round(dur,2)}
   if args.librosa:
    try:
     chunks=[decode_segment(path,t,args.seconds,11025) for t in positions]
     row['librosa']=librosa_key_estimates(chunks,11025,args.hpss)
    except ImportError:row['librosa']={'status':'unavailable','reason':'Install librosa locally'}
    except Exception as exc:row['librosa']={'status':'error','reason':str(exc)[:180]}
   if args.essentia:
    try:row['essentia']=essentia_estimates(path,positions,args.seconds)
    except ImportError:row['essentia']={'status':'unavailable','reason':'Essentia not installed locally; no results invented'}
    except Exception as exc:row['essentia']={'status':'error','reason':str(exc)[:180]}
   rows.append(row)
   print('Compared:',id,flush=True)
  except Exception as exc:rows.append({'id':track.get('id','invalid'),'status':'error','reason':str(exc)[:180]})
 report={'schema':1,'kind':'jonaaudio-local-reference-comparison',
   'provenance':'librosa features / optional Essentia. Outputs are estimates, not verified session keys.',
   'privacy':'Read local audio only. Report stores IDs and metadata, not audio or filenames.',
   'methodology':'Bounded distributed sections; resampling by installed FFmpeg; section and tempo estimates need musical review.',
   'results':rows}
 output=Path(args.output).expanduser();output.parent.mkdir(parents=True,exist_ok=True)
 output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print('Saved:',output,flush=True)
if __name__=='__main__':main()
