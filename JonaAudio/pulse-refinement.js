import {onsetCurve} from './engine.js';

// Refines onset autocorrelation peaks between discrete hop lags.
// This adds resolution; it does NOT resolve half-time, polyrhythm or swing.
// Scores aren't probabilities and must not be silently promoted to session BPM.
export const PULSE_REFINEMENT_VERSION='fractional-lag-onset-v0.1.0';
function correlation(values,lag){
 let numerator=0,left=0,right=0;
 for(let i=lag;i<values.length;i++){
  const a=values[i],b=values[i-lag];
  numerator+=a*b;left+=a*a;right+=b*b;
 }
 return left>1e-12&&right>1e-12?numerator/Math.sqrt(left*right):0;
}
export function fractionalPulseCandidates(samples,sampleRate,segment,{minBpm=55,maxBpm=210}={}){
 if(!samples?.length||!(sampleRate>0)||!segment)
  return {status:'unavailable',candidates:[],reason:'No input to refine'};
 const {values,hop}=onsetCurve(samples,sampleRate,segment);
 if(values.length<60)return {status:'unavailable',candidates:[],reason:'Not enough onset samples'};
 const low=Math.max(3,Math.floor(60*sampleRate/(hop*maxBpm))-2);
 const high=Math.min(values.length>>1,Math.ceil(60*sampleRate/(hop*minBpm))+2);
 const scores=new Float64Array(high+2);
 for(let lag=low;lag<=high+1;lag++)scores[lag]=correlation(values,lag);
 const peaks=[];
 for(let lag=low+1;lag<high;lag++){
  const left=scores[lag-1],mid=scores[lag],right=scores[lag+1];
  if(mid<=left||mid<right||mid<.035)continue;
  const curvature=left-2*mid+right;
  const offset=Math.abs(curvature)>1e-10?
   Math.max(-.5,Math.min(.5,.5*(left-right)/curvature)):0;
  const refinedLag=lag+offset,bpm=60*sampleRate/(hop*refinedLag);
  if(bpm<minBpm||bpm>maxBpm)continue;
  // Peak prominence reduces broad autocorrelation shoulder ties.
  const contrast=Math.max(0,mid-.5*(scores[Math.max(low,lag-2)]+scores[Math.min(high+1,lag+2)]));
  peaks.push({bpm:+bpm.toFixed(2),score:+mid.toFixed(5),
    prominence:+contrast.toFixed(5),lag:+refinedLag.toFixed(3)});
 }
 peaks.sort((a,b)=>b.score-a.score||b.prominence-a.prominence);
 const candidates=[];
 for(const item of peaks){
  if(!candidates.some(x=>Math.abs(x.bpm-item.bpm)<3))candidates.push(item);
  if(candidates.length===6)break;
 }
 return {status:candidates.length?'experimental':'unavailable',
  version:PULSE_REFINEMENT_VERSION,candidates,frames:values.length,
  limitation:'Fractional-lag autocorrelation only; tempo grid, meter and half/double interpretations remain unverified'};
}
export function aggregateRefinedPulse(sections){
 const valid=(sections||[]).filter(s=>s.status==='experimental');
 if(!valid.length)return {status:'unavailable',candidates:[],sections:sections||[]};
 // Cluster evidence across windows without selecting an arbitrary 1-BPM-lag bin.
 const votes=[];
 for(const section of valid)for(const c of section.candidates.slice(0,5))
  votes.push({...c,source:section.start,weight:c.score/(section.candidates[0]?.score||1)});
 const clusters=[];
 for(const v of votes.sort((a,b)=>b.weight-a.weight)){
  let target=clusters.find(c=>Math.abs(c.bpm-v.bpm)<4);
  if(!target){target={bpm:v.bpm,votes:[],score:0};clusters.push(target);}
  target.votes.push(v);target.score+=v.weight;
  target.bpm=target.votes.reduce((a,b)=>a+b.bpm*b.weight,0)/target.votes.reduce((a,b)=>a+b.weight,0);
 }
 clusters.sort((a,b)=>b.score-a.score||a.bpm-b.bpm);
 return {status:'experimental',method:PULSE_REFINEMENT_VERSION,
  candidates:clusters.slice(0,6).map(c=>({bpm:+c.bpm.toFixed(2),score:+c.score.toFixed(4),windowVotes:c.votes.length})),
  sections,interpretation:'Uncalibrated onset periodicity, not a validated DAW tempo or meter'};
}
