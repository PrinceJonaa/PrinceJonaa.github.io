import {detectTempo,computeChroma,rankKeys,computeSpectrogram,computeQuality,onsetCurve} from './engine.js';
import {ENGINE_VERSION} from './config.js';
const filters=new Map();
export function resample(samples,sourceRate,targetRate=11025){
 if(sourceRate<=targetRate)return {samples,sampleRate:sourceRate};
 const ratio=sourceRate/targetRate,phases=64,taps=32,cutoff=.45/ratio,key=sourceRate+':'+targetRate;
 let bank=filters.get(key);
 if(!bank){bank=[];for(let phase=0;phase<phases;phase++){const coeff=new Float64Array(taps);let sum=0;for(let j=0;j<taps;j++){const x=j-(taps/2-1)-phase/phases;const sinc=x===0?2*cutoff:Math.sin(2*Math.PI*cutoff*x)/(Math.PI*x);const window=.5+.5*Math.cos(Math.PI*x/(taps/2));coeff[j]=Math.abs(x)<taps/2?sinc*window:0;sum+=coeff[j];}for(let j=0;j<taps;j++)coeff[j]/=sum;bank.push(coeff);}filters.set(key,bank);}
 const output=new Float32Array(Math.floor(samples.length/ratio));
 for(let i=0;i<output.length;i++){const position=i*ratio,center=Math.floor(position),coeff=bank[Math.min(phases-1,Math.round((position-center)*phases))];let value=0;for(let j=0;j<taps;j++)value+=(samples[Math.max(0,Math.min(samples.length-1,center+j-(taps/2-1)))]||0)*coeff[j];output[i]=value;}
 return {samples:output,sampleRate:targetRate};
}
export function analyzeCapability(capability,input){
 const ranges=input.ranges||[],diagnostics={engineVersion:ENGINE_VERSION,resampler:'32-tap windowed-sinc / 64 fractional phases',analysisChannel:'strongest sampled-energy channel',scores:'raw similarity/autocorrelation; not probabilities'};
 if(capability==='waveform'){
  const peaks=new Float32Array(input.buckets);for(let b=0;b<input.buckets;b++)for(const channel of input.channels)for(let j=0;j<input.per;j++)peaks[b]=Math.max(peaks[b],Math.abs(channel[b*input.per+j]||0));
  return {type:'result',result:{peaks,method:input.method},ranges:[],diagnostics:{...diagnostics,method:input.method}};
 }
 if(capability==='levels')return {type:'result',result:computeQuality(input.channels[0],input.channels[1]||null,input.sampleRate),ranges,diagnostics};
 const windows=(input.windows||[]).map(w=>({...w,...resample(w.samples,w.sampleRate)}));
 if(!windows.length)return {type:'unavailable',reason:'No usable audio in these sampled ranges. Try Deep analysis or set a manual value.',ranges,result:capability==='tempo'?{bpm:null,alternatives:[],beats:[]}:null,diagnostics};
 if(capability==='tempo'){
  const sections=[],scores=new Map(),beats=[];
  for(const w of windows){const local={start:0,end:w.samples.length/w.sampleRate},onsets=onsetCurve(w.samples,w.sampleRate,local);let energy=0,onsetEnergy=0;for(const x of w.samples)energy+=x*x;for(const x of onsets.values)onsetEnergy+=x*x;
   const hasPulse=onsets.values.length>=30&&energy>0&&Math.sqrt(onsetEnergy/onsets.values.length)/Math.sqrt(energy/w.samples.length)>.005;
   const tempo=hasPulse?detectTempo(w.samples,w.sampleRate,[local]):{bpm:null,alternatives:[],beats:[]};
   sections.push({start:w.start,end:w.end,bpm:tempo.bpm,score:tempo.alternatives[0]?.score||0});
   if(tempo.bpm)for(const c of tempo.alternatives)scores.set(c.bpm,(scores.get(c.bpm)||0)+c.score);
   beats.push(...tempo.beats.map(t=>t+w.start));
  }
  const alternatives=[...scores].map(([bpm,score])=>({bpm,score:score/windows.length})).sort((a,b)=>b.score-a.score||a.bpm-b.bpm).slice(0,5);
  const bpm=alternatives[0]?.score>.04?alternatives[0].bpm:null,readings=sections.map(s=>s.bpm).filter(Number.isFinite);
  const variable=readings.some(v=>bpm&&Math.min(Math.abs(v-bpm),Math.abs(v*2-bpm),Math.abs(v/2-bpm))>4);
  return {type:bpm?'result':'unavailable',reason:bpm?null:'No steady tempo found. Try tap tempo or a manual BPM.',result:{bpm,alternatives:bpm?alternatives:[],sections,beats:bpm?beats:[],variable,rangePreference:'none',thresholds:{pulseToRms:.005,aggregateAutocorrelation:.04}},ranges,diagnostics};
 }
 if(capability==='key'){
  const vectors=[],evidence=[];
  for(const w of windows){const chroma=computeChroma(w.samples,w.sampleRate,[{start:0,end:w.samples.length/w.sampleRate}]),ranked=rankKeys(chroma);const mean=chroma.reduce((a,b)=>a+b,0)/12,contrast=mean>0?(Math.max(...chroma)-Math.min(...chroma))/Math.max(...chroma):0;
   const usable=w.samples.length>=4096&&contrast>.12&&ranked.length>0;
   evidence.push({start:w.start,end:w.end,keys:usable?ranked.slice(0,3):[],reason:usable?null:'Insufficient tonal contrast',contrast});if(usable)vectors.push(chroma);
  }
  if(!vectors.length)return {type:'unavailable',reason:'No usable tonal estimate. Choose a key manually; percussive or very short audio may not establish one.',result:{keys:[],chroma:null,evidence},ranges,diagnostics};
  const chroma=Array.from({length:12},(_,i)=>vectors.reduce((sum,v)=>sum+v[i],0)/vectors.length),keys=rankKeys(chroma).slice(0,5);
  const disagreement=new Set(evidence.flatMap(e=>e.keys.length?[e.keys[0].key]:[])).size>1,ambiguous=(keys[0].score-keys[1].score)<.025||disagreement;
  return {type:'result',result:{keys,chroma,evidence,ambiguous,disagreement,thresholds:{tonalContrast:.12,closeSimilarityGap:.025}},ranges,diagnostics};
 }
 if(capability==='spectrum'){
  const w=windows[0];if(w.samples.length<2048)return {type:'unavailable',reason:'This range is too short for the spectrum window.',ranges,diagnostics};
  const result=computeSpectrogram(w.samples,w.sampleRate,{start:0,end:w.samples.length/w.sampleRate});result.start=w.start;result.end=w.end;
  return {type:'result',result,ranges:ranges.slice(0,1),diagnostics};
 }
 throw new Error('Unknown analysis capability');
}
