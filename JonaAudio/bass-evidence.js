import {fft,KEYS} from './engine.js';
import {parseKey} from './tuning-model.js';

// Intentionally low-cost and descriptive: bass-note evidence is NOT tonic detection.
// Drum fundamentals and dominant bass passing tones can produce false root suggestions.
export const BASS_EVIDENCE_VERSION='low-register-pitch-v0.1.0';
const FRAME=4096,HOP=2048;
const hann=Float32Array.from({length:FRAME},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(FRAME-1)));
const midiHz=m=>440*Math.pow(2,(m-69)/12);
const pc=m=>(m%12+12)%12;

export function estimateBassEvidence(samples,sampleRate,segments,{maxFrames=72}={}){
 if(!samples?.length||!Number.isFinite(sampleRate)||sampleRate<=0||maxFrames<1)
  return {status:'unavailable',reason:'No analyzable audio',notes:[],frames:0,version:BASS_EVIDENCE_VERSION};
 const votes=new Float64Array(12),frame=new Float32Array(FRAME);
 let frames=0,considered=0,rejected=0;
 for(const part of segments||[]){
  const begin=Math.max(0,Math.floor((part.start||0)*sampleRate));
  const end=Math.min(samples.length,Math.floor((part.end??samples.length/sampleRate)*sampleRate));
  const available=Math.max(0,Math.floor((end-begin-FRAME)/HOP)+1);
  const stride=Math.max(1,Math.ceil(available/Math.max(1,maxFrames-considered)));
  for(let at=begin;at+FRAME<=end&&considered<maxFrames;at+=HOP*stride){
   considered++;
   let energy=0;
   for(let i=0;i<FRAME;i++){const v=samples[at+i]*hann[i];frame[i]=v;energy+=v*v;}
   if(energy/FRAME<1e-9){rejected++;continue;}
   const magnitude=fft(frame),binHz=sampleRate/FRAME;
   let peak=0;
   for(let b=Math.ceil(42/binHz);b<Math.min(magnitude.length,Math.floor(290/binHz));b++)peak=Math.max(peak,magnitude[b]);
   if(peak<1e-4){rejected++;continue;}
   const candidates=[];
   for(let midi=29;midi<=60;midi++){
    const frequency=midiHz(midi);
    if(frequency<42||frequency>260)continue;
    let strength=0,first=0,harmonicSupport=0;
    for(const [harmonic,weight] of [[1,1],[2,.47],[3,.27]]){
     const center=Math.round((frequency*harmonic)/binHz);
     if(center<2||center+1>=magnitude.length)continue;
     const value=Math.max(magnitude[center-1],magnitude[center],magnitude[center+1]);
     if(harmonic===1)first=value;
     else harmonicSupport+=value;
     strength+=weight*Math.sqrt(value/peak);
    }
    // Discourage higher-octave subharmonic aliases with weak actual fundamentals.
    strength*=.7+.3*Math.min(1,first/(peak+.0001));
    candidates.push({midi,strength,harmonicSupport});
   }
   candidates.sort((a,b)=>b.strength-a.strength);
   const best=candidates[0],runner=candidates.find(c=>Math.abs(c.midi-best.midi)>1);
   if(!best||best.strength<.26||runner&&best.strength/Math.max(.0001,runner.strength)<1.045){rejected++;continue;}
   votes[pc(best.midi)]+=Math.min(2,best.strength);
   frames++;
  }
  if(considered>=maxFrames)break;
 }
 const total=votes.reduce((a,b)=>a+b,0);
 if(frames<3||total<=0)return {status:'unavailable',reason:'Insufficient stable low-register note evidence',notes:[],frames,rejected,version:BASS_EVIDENCE_VERSION};
 const notes=Array.from(votes,(value,pitchClass)=>({pitchClass,note:KEYS[pitchClass],weight:+(value/total).toFixed(4)}))
  .filter(x=>x.weight>.015).sort((a,b)=>b.weight-a.weight).slice(0,6);
 return {status:'experimental',method:'FFT low-register harmonic salience, uncalibrated',
  notes,frames,rejected,version:BASS_EVIDENCE_VERSION,
  warning:'Bass-note distribution, not verified key or tonic. Kick transients and passing notes may dominate.'};
}

export function compareBassToKeys(keys,bass){
 if(bass?.status!=='experimental'||!bass.notes?.length)return {status:'unavailable',reason:'No reliable bass-note evidence'};
 const ranked=(keys||[]).filter(c=>parseKey(c.key)).map(candidate=>{
  const tonic=parseKey(candidate.key).tonic;
  return {key:candidate.key,tonicNote:KEYS[tonic],
   observedWeight:bass.notes.find(n=>n.pitchClass===tonic)?.weight??0};
 });
 return {status:'review',candidates:ranked,leadingBassNotes:bass.notes.slice(0,3).map(x=>x.note),
  caveat:'Root support is not proof; never automatically promote or relabel the key.'};
}
