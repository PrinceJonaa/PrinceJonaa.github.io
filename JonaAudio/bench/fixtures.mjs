import {KEYS} from '../engine.js';
import {scaleMask} from '../tuning-model.js';

export const SAMPLE_RATE=11025;
const beatSecs=.5;
const midiToHz=midi=>440*Math.pow(2,(midi-69)/12);
const seededNoise=n=>{const x=Math.sin((n+17)*12.9898)*43758.5453;return (x-Math.floor(x))*2-1;};

// These recordings are synthetic labels, not human-confirmed musical key ground truth.
// The independent "challenge" recipes differ in voicing, rhythm and tuning, but share code.
export function synthKeyFixture(root,mode,variant='development') {
 const rate=SAMPLE_RATE,duration=4.25,length=Math.round(rate*duration),data=new Float32Array(length);
 const scale=scaleMask(root,mode==='minor'?'natural-minor':'major');
 const chords=variant==='challenge'?[0,5,3,0]:[0,3,4,0];
 const cents=variant==='challenge'?21:0;
 const voicing=variant==='challenge'?[0,4,2]:[0,2,4];
 const tonicWeight=variant==='challenge'?1.2:1.35;
 for(let bar=0;bar<chords.length;bar++) {
  const degree=chords[bar],start=Math.round(bar*rate),end=Math.min(length,Math.round((bar+1)*rate));
  for(let i=start;i<end;i++) {
   const t=i/rate,u=(i-start)/rate;
   const envelope=Math.min(1,u*16)*Math.min(1,(1-u)*14);
   for(let j=0;j<3;j++){
    const pc=scale[(degree+voicing[j])%7];
    const octave=variant==='challenge'?48:60;
    const midi=octave+pc+(j===0?-12:0)+(variant==='challenge'&&j===2?12:0);
    const hz=midiToHz(midi)*Math.pow(2,cents/1200);
    const weight=(j===0?tonicWeight:.82)*.067*envelope;
    for(let harmonic=1;harmonic<=3;harmonic++)data[i]+=weight/harmonic*Math.sin(2*Math.PI*hz*harmonic*t);
   }
  }
 }
 if(variant==='challenge')for(let beat=0;beat<8;beat++){
  const start=Math.round(beat*beatSecs*rate);
  for(let j=0;j<Math.round(.11*rate)&&start+j<length;j++){
   const decay=Math.exp(-j/(rate*.023)),t=j/rate;
   data[start+j]+=.15*decay*Math.sin(2*Math.PI*(68-28*t)*t)+.019*decay*seededNoise(start+j);
  }
 }
 return {id:KEYS[root]+'-'+mode+'-'+variant,label:KEYS[root]+' '+mode,variant,samples:data,sampleRate:rate,duration};
}

export function* syntheticKeyCorpus() {
 for(let root=0;root<12;root++)for(const mode of ['major','minor'])
  for(const variant of ['development','challenge'])yield synthKeyFixture(root,mode,variant);
}

export function synthTempoFixture(bpm,{duration=12,accent=true}={}) {
 const rate=SAMPLE_RATE,data=new Float32Array(Math.round(duration*rate)),beat=60/bpm;
 for(let time=0,index=0;time<duration;time+=beat,index++){
  const start=Math.round(time*rate),length=Math.round(.08*rate);
  for(let i=0;i<length&&start+i<data.length;i++) {
   const t=i/rate,env=Math.exp(-t*42),frequency=index%4===0&&accent?220:140;
   data[start+i]+=.36*env*Math.sin(2*Math.PI*frequency*t);
  }
 }
 return {id:bpm+'-bpm',bpm,samples:data,sampleRate:rate,duration};
}
