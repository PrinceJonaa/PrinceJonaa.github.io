import MusicTempo from './vendor/music-tempo.esm.js';

// MIT-licensed BeatRoot / music-tempo (killercrush), locally bundled, never a network request.
// Its numerical tempo is a beat-hypothesis, NOT a ground-truth BPM or a DAW grid.
export const BEATROOT_VERSION='beatroot-mit-local-v0.1.0';
const MIN_BPM=55,MAX_BPM=210;
const finite=x=>Number.isFinite(x)&&x>0;
export function extractBeatRootPulse(samples,sampleRate,{maxSeconds=24}={}){
 if(!(samples instanceof Float32Array) || !finite(sampleRate) || samples.length<sampleRate*4)
  return {status:'unavailable',reason:'At least four seconds of decoded mono audio required'};
 if(!(sampleRate>=8000&&sampleRate<=48000)|| !(maxSeconds>0&&maxSeconds<=24))
  return {status:'unavailable',reason:'Unsupported sample rate or window budget'};
 const bounded=samples.subarray(0,Math.min(samples.length,Math.floor(maxSeconds*sampleRate)));
 // Keep the 46ms FFT / 10ms hop behavior close to the verified 44kHz reference.
 const frameSize=Math.max(256,Math.min(2048,2**Math.round(Math.log2(sampleRate*2048/44100))));
 const hopSize=Math.max(64,Math.round(sampleRate/100));
 try{
  const tracker=new MusicTempo(bounded,{bufferSize:frameSize,hopSize,
   timeStep:hopSize/sampleRate,minBeatInterval:60/MAX_BPM,maxBeatInterval:60/MIN_BPM});
  // Upstream returns a toFixed() string. Convert it explicitly before scoring.
  const bpm=Number(tracker.tempo),beats=tracker.beats||[];
  if(!finite(bpm)||bpm<MIN_BPM||bpm>MAX_BPM||beats.length<4)
   return {status:'unavailable',reason:'No sufficiently bounded and repeated pulse'};
  const secondBpm=+(bpm/2).toFixed(2);
  const doubled=+(bpm*2).toFixed(2);
  const alternatives=[];
  if(secondBpm>=MIN_BPM)alternatives.push({bpm:secondBpm,label:'half-time feel',relationship:'half-time'});
  if(doubled<=MAX_BPM)alternatives.push({bpm:doubled,label:'double-time feel',relationship:'double-time'});
  return {status:'experimental',version:BEATROOT_VERSION,bpm:+bpm.toFixed(2),
   beats:beats.length,sampleRate,windowSeconds:+(bounded.length/sampleRate).toFixed(2),
   alternatives,method:'MIT BeatRoot (onset event clustering + beat tracking)',
   precision:'uncalibrated, not independently verified'};
 }catch(error){
  return {status:'unavailable',reason:'Beat tracker could not establish a stable pulse'};
 }
}
export function summarizeBeatRootWindows(results,{maxCandidates=5}={}){
 const usable=(results||[]).filter(x=>x?.status==='experimental'&&finite(x.bpm));
 if(!usable.length)return {status:'unavailable',candidates:[],reason:'No BeatRoot section produced a pulse'};
 const clusters=[];
 for(const x of usable){
  let c=clusters.find(y=>Math.abs(y.bpm-x.bpm)<4);
  if(!c){c={bpm:x.bpm,samples:[],score:0};clusters.push(c);}
  c.samples.push(x);c.bpm=c.samples.reduce((sum,s)=>sum+s.bpm,0)/c.samples.length;
  c.score=c.samples.length;
 }
 clusters.sort((a,b)=>b.score-a.score||b.samples.reduce((sum,s)=>sum+s.beats,0)-a.samples.reduce((sum,s)=>sum+s.beats,0));
 const candidates=clusters.slice(0,Math.min(6,maxCandidates)).map(c=>({
  bpm:+c.bpm.toFixed(2),windowVotes:c.score,
  sampleFrames:c.samples.reduce((sum,s)=>sum+s.beats,0),
  halfTime:c.bpm/2>=MIN_BPM?+(c.bpm/2).toFixed(2):null,
  doubleTime:c.bpm*2<=MAX_BPM?+(c.bpm*2).toFixed(2):null
 }));
 const lead=candidates[0];
 return {status:'review',method:BEATROOT_VERSION,primaryCandidate:lead.bpm,
  candidates,windowsEvaluated:results?.length||0,
  windowsWithPulse:usable.length,
  sectionAgreement:lead.windowVotes===usable.length?'consistent':
   lead.windowVotes>=2?'partial':'single-reading',
  warning:'Unverified beat-grid estimate; ½ / 2× / triplet meter may differ from publisher session BPM',
  manuallyConfirmed:false,autoApplied:false};
}
export function relateBeatRoot(primary,beatRoot){
 const original=primary?.bpm,estimated=beatRoot?.primaryCandidate;
 if(!finite(original)||!finite(estimated))return 'unavailable';
 if(Math.abs(original-estimated)<=2)return 'similar';
 const ratio=estimated/original;
 if(Math.abs(ratio-2)<.04)return 'double-time';
 if(Math.abs(ratio-.5)<.025)return 'half-time';
 if(Math.abs(ratio-1.5)<.04)return 'three-to-two';
 if(Math.abs(ratio-2/3)<.03)return 'two-to-three';
 return 'different-pulse';
}
