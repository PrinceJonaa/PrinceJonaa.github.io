// This is an interpretation helper, not a beat tracker. It never selects an
// automatically trusted BPM. The input hypotheses come from independent onset
// representations but may share sampling artifacts and rhythmic subdivisions.
export const TEMPO_HYPOTHESES_VERSION='metrical-alternatives-v0.1.0';
const TRANSFORMS=[
 {ratio:1,label:'as-detected'},
 {ratio:.5,label:'half-time'},
 {ratio:2,label:'double-time'},
 {ratio:1/3,label:'third-time'},
 {ratio:3,label:'triple-time'}
];
function within(candidate,a){return Math.abs(candidate-a)<1.25;}
export function buildTempoHypotheses(primary,flux,{minBpm=55,maxBpm=210}={}){
 const original=Number.isFinite(primary?.bpm)?primary.bpm:null;
 const candidates=(flux?.candidates||[]).filter(v=>Number.isFinite(v.bpm)&&v.bpm>0).slice(0,6);
 if(!Number.isFinite(original)&&!candidates.length)
  return {status:'unavailable',originalBpm:null,direct:[],metricalAlternatives:[]};
 const direct=[];
 const addDirect=(bpm,source)=>{
  if(bpm<minBpm||bpm>maxBpm||direct.some(x=>within(x.bpm,bpm)))return;
  direct.push({bpm:+bpm.toFixed(2),source,verified:false});
 };
 if(Number.isFinite(original))addDirect(original,'original-estimate');
 for(const c of candidates)addDirect(c.bpm,'spectral-flux');
 const metricalAlternatives=[];
 for(const c of candidates){
  for(const transform of TRANSFORMS.slice(1)){
   const bpm=+(c.bpm*transform.ratio).toFixed(2);
   if(bpm<minBpm||bpm>maxBpm||direct.some(x=>within(x.bpm,bpm))||
     metricalAlternatives.some(x=>within(x.bpm,bpm)))continue;
   metricalAlternatives.push({
    bpm,fromBpm:c.bpm,relationship:transform.label,
    source:'spectral-flux',verified:false
   });
  }
 }
 // Keep the plausible intervals visible instead of manufacturing a consensus.
 // Multiple hypotheses in a range are not extra independent confirmations.
 return {status:'review',originalBpm:original,direct,
  metricalAlternatives:metricalAlternatives.slice(0,18),
  version:TEMPO_HYPOTHESES_VERSION,
  warning:'Many candidates can be produced by subdivisions; this is recall, not calibrated precision. Confirm tempo against downbeats or the original session grid.'};
}
export function shortTempoGuide(state,{max=4}={}){
 if(state?.status!=='review')return 'No usable pulse alternatives';
 const direct=state.direct.filter(c=>c.source!=='original-estimate').slice(0,max).map(c=>c.bpm);
 const derived=state.metricalAlternatives.slice(0,max).map(c=>c.bpm+' ('+c.relationship+')');
 return [
  direct.length?'Other pulse estimates: '+direct.join(' / '):null,
  derived.length?'Metrical interpretations: '+derived.join(' / '):null,
  'Unverified — tap against the downbeat'
 ].filter(Boolean).join(' · ');
}
