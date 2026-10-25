import {fft} from './engine.js';

// This is a second *onset representation*, not an independently trained tempo model.
// Spectral flux catches some transients that RMS envelope differences miss.
export const FLUX_TEMPO_VERSION='spectral-flux-tempo-experimental-0.1.0';
const FRAME=1024,HOP=256,MIN_BPM=55,MAX_BPM=210;
const window=Float32Array.from({length:FRAME},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(FRAME-1)));

export function spectralFluxCandidates(samples,sampleRate,{maxFrames=1800}={}){
 if(!samples?.length||!Number.isFinite(sampleRate)||sampleRate<=0)
  return {status:'unavailable',candidates:[],reason:'No audio to estimate tempo'};
 const first=Math.ceil(100*FRAME/sampleRate),last=Math.min(FRAME/2-1,Math.floor(5000*FRAME/sampleRate));
 if(first>=last||samples.length<FRAME+HOP*30)
  return {status:'unavailable',candidates:[],reason:'Too little audio for spectral flux'};
 const count=Math.min(maxFrames,Math.floor((samples.length-FRAME)/HOP)+1);
 const frame=new Float32Array(FRAME),previous=new Float32Array(last-first+1),raw=new Float32Array(count);
 for(let step=0;step<count;step++){
  const pos=step*HOP;
  for(let i=0;i<FRAME;i++)frame[i]=samples[pos+i]*window[i];
  const mag=fft(frame);
  let sum=0;
  for(let bin=first;bin<=last;bin++){
   const compressed=Math.log1p(mag[bin]*.15);
   const delta=Math.max(0,compressed-previous[bin-first]);
   if(step>0)sum+=delta;
   previous[bin-first]=compressed;
  }
  raw[step]=sum/(last-first+1);
 }
 const onset=new Float32Array(count);
 for(let i=0;i<count;i++){
  let local=0,n=0;
  for(let j=Math.max(0,i-8);j<=Math.min(count-1,i+8);j++){local+=raw[j];n++;}
  onset[i]=Math.max(0,raw[i]-.5*local/n);
 }
 let norm=0;for(const v of onset)norm+=v*v;
 if(norm<1e-7)return {status:'unavailable',candidates:[],reason:'Insufficient distinct onsets'};
 const scored=[];
 for(let bpm=MIN_BPM;bpm<=MAX_BPM;bpm++){
  const lag=Math.round(60*sampleRate/(HOP*bpm));
  if(lag<2||lag>=count/2)continue;
  let sum=0;for(let k=lag;k<count;k++)sum+=onset[k]*onset[k-lag];
  scored.push({bpm,score:sum/norm});
 }
 scored.sort((a,b)=>b.score-a.score);
 const candidates=[];
 for(const item of scored){
  if(!candidates.some(p=>Math.abs(item.bpm-p.bpm)<4))candidates.push({bpm:item.bpm,score:+item.score.toFixed(4)});
  if(candidates.length===6)break;
 }
 return {status:candidates.length?'experimental':'unavailable',candidates,frames:count,
  version:FLUX_TEMPO_VERSION,scores:'uncalibrated spectral-flux autocorrelation'};
}

export function compareTempoFamilies(primary,secondary){
 const bpm=primary?.bpm??null,alt=secondary?.candidates?.[0]?.bpm??null;
 if(!Number.isFinite(bpm)||!Number.isFinite(alt))
  return {status:'unavailable',primary:bpm,flux:alt,reason:'Insufficient tempo evidence'};
 const ratio=alt/bpm;
 let relation='different-pulse';
 if(Math.abs(alt-bpm)<=2||Math.abs(ratio-1)<.025)relation='near-same';
 else if(Math.abs(ratio-2)<.045)relation='double-time';
 else if(Math.abs(ratio-.5)<.025)relation='half-time';
 else if(Math.abs(ratio-1.5)<.045)relation='three-to-two';
 else if(Math.abs(ratio-2/3)<.03)relation='two-to-three';
 const strongAlternatives=(secondary?.candidates||[]).filter(c=>c.score>=secondary.candidates[0].score*.8)
  .map(c=>c.bpm);
 return {status:relation==='near-same'?'agreement':'review',relation,primary:bpm,flux:alt,
  strongAlternatives,ratio:+ratio.toFixed(3),
  reason:relation==='near-same'?'Two onset profiles suggest similar BPM; this is not ground truth':
  'Competing onset profiles imply different pulse subdivisions; confirm against a beat grid'};
}
