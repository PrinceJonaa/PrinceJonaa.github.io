import {KEYS,detectTempo,computeChroma,rankKeys,computeSpectrogram,computeQuality,onsetCurve} from './engine.js';
import {ENGINE_VERSION} from './config.js';
import {resample} from './resample.js';
import {analyzePeakKey,compareKeyFamilies,PEAK_ENGINE_VERSION} from './harmonic-key.js';
import {estimateBassEvidence,compareBassToKeys,BASS_EVIDENCE_VERSION} from './bass-evidence.js';
import {spectralFluxCandidates,compareTempoFamilies,FLUX_TEMPO_VERSION} from './tempo-crosscheck.js';
import {buildTempoHypotheses} from './tempo-hypotheses.js';
export {resample} from './resample.js';
import {prepareRegion} from './sample-dsp.js';
import {rankCandidates} from './sample-candidates.js';
export function analyzeCapability(capability,input){
 if(capability==='region-audio')return {type:'result',result:prepareRegion(input),ranges:input.ranges||[]};
 if(capability==='suggestions')return {type:'result',result:{...rankCandidates(input.features,input.duration,input.settings),features:input.features},ranges:[{start:0,end:input.duration}]};
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
  // A different onset representation is evaluated only in Verify mode. Do not
  // silently change the BPM, beat markers, or an artist's manually confirmed grid.
  let fluxEvidence=null,tempoComparison=null,tempoHypotheses=null;
  if(input.analysisMode==='verify'){
   const measured=windows.map(w=>({start:w.start,end:w.end,...spectralFluxCandidates(w.samples,w.sampleRate)}));
   const weighted=new Map();
   for(const m of measured)if(m.status==='experimental')
    for(const c of m.candidates)weighted.set(c.bpm,(weighted.get(c.bpm)||0)+c.score);
   const ranked=[...weighted].map(([pulse,score])=>({bpm:pulse,score:+(score/windows.length).toFixed(4)}))
    .sort((a,b)=>b.score-a.score||a.bpm-b.bpm);
   const candidates=[];
   for(const c of ranked){if(!candidates.some(prev=>Math.abs(prev.bpm-c.bpm)<4))candidates.push(c);if(candidates.length===6)break;}
   fluxEvidence={method:FLUX_TEMPO_VERSION,candidates,scores:'uncalibrated',
    sections:measured.map(({start,end,status,candidates})=>({start,end,status,candidates:candidates.slice(0,3)}))};
   tempoComparison=compareTempoFamilies({bpm},fluxEvidence);
   tempoHypotheses=buildTempoHypotheses({bpm},fluxEvidence);
  }
  return {type:bpm?'result':'unavailable',reason:bpm?null:'No steady tempo found. Try tap tempo or a manual BPM.',
    result:{bpm,alternatives:bpm?alternatives:[],sections,beats:bpm?beats:[],variable,fluxEvidence,tempoComparison,tempoHypotheses,
      rangePreference:'none',thresholds:{pulseToRms:.005,aggregateAutocorrelation:.04}},ranges,diagnostics};
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
  // Verify computes a SECOND, bounded spectral-peak profile. Quick remains baseline speed.
  // Both profiles share FFT and key templates; agreement is not independent validation.
  let peakEvidence=null,keyComparison=null,bassEvidence=null,bassComparison=null;
  if(input.analysisMode==='verify'){
   const peaks=windows.map(w=>({start:w.start,end:w.end,...analyzePeakKey(w.samples,w.sampleRate,[{start:0,end:w.samples.length/w.sampleRate}],{maxFrames:24})}));
   const usable=peaks.filter(p=>p.status!=='unavailable');
   if(usable.length){
    const frames=usable.reduce((acc,p)=>acc+p.frames,0);
    const profile=Array.from({length:12},(_,pc)=>usable.reduce((acc,p)=>acc+p.chroma[pc]*p.frames,0)/frames);
    peakEvidence={keys:rankKeys(profile).slice(0,5),chroma:profile,
     sections:peaks.map(({start,end,keys,status,reason,tuningCents,activePitchClasses,frames})=>({start,end,keys:keys.slice(0,2),status,reason,tuningCents,activePitchClasses,frames})),
     method:PEAK_ENGINE_VERSION,scores:'uncalibrated'};
   }else peakEvidence={keys:[],chroma:null,sections:peaks.map(({start,end,status,reason})=>({start,end,status,reason})),method:PEAK_ENGINE_VERSION};
   keyComparison=compareKeyFamilies(keys,peakEvidence);
   // Separate low-frequency note distribution. Bass pitch support is not a key label.
   // Keep bounded work per region and never automatically rerank the original key.
   const bassSegments=windows.map(w=>({start:w.start,end:w.end,
     ...estimateBassEvidence(w.samples,w.sampleRate,[{start:0,end:w.samples.length/w.sampleRate}],{maxFrames:16})}));
   const useful=bassSegments.filter(e=>e.status==='experimental');
   if(useful.length){
    const totals=new Float64Array(12);
    for(const e of useful)for(const note of e.notes)totals[note.pitchClass]+=note.weight*e.frames;
    const overall=totals.reduce((a,b)=>a+b,0);
    const notes=Array.from(totals,(weight,pitchClass)=>({pitchClass,note:KEYS[pitchClass],
      weight:overall>0?+(weight/overall).toFixed(4):0}))
      .filter(n=>n.weight>.015).sort((a,b)=>b.weight-a.weight).slice(0,6);
    bassEvidence={status:'experimental',notes,method:BASS_EVIDENCE_VERSION,
      sections:bassSegments.map(({start,end,status,notes,reason})=>({start,end,status,notes:notes?.slice(0,3)||[],reason})),
      caveat:'Measured low notes do not prove a tonic; kick drums can confound the estimator.'};
    bassComparison=compareBassToKeys(keys,bassEvidence);
   }else bassEvidence={status:'unavailable',method:BASS_EVIDENCE_VERSION,
     reason:'No usable low-register note evidence',notes:[]};
  }
  return {type:'result',result:{keys,chroma,evidence,ambiguous,disagreement,peakEvidence,keyComparison,bassEvidence,bassComparison,
   thresholds:{tonalContrast:.12,closeSimilarityGap:.025}},ranges,
   diagnostics:{...diagnostics,verification:input.analysisMode==='verify'?'bounded spectral-peak cross-check (experimental)':'baseline quick'}};
 }
 if(capability==='spectrum'){
  const w=windows[0];if(w.samples.length<2048)return {type:'unavailable',reason:'This range is too short for the spectrum window.',ranges,diagnostics};
  const result=computeSpectrogram(w.samples,w.sampleRate,{start:0,end:w.samples.length/w.sampleRate});result.start=w.start;result.end=w.end;
  return {type:'result',result,ranges:ranges.slice(0,1),diagnostics};
 }
 throw new Error('Unknown analysis capability');
}
