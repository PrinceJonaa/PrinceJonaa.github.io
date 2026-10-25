// Local, deterministic beat-grid and metrical decision evidence.
// Thresholds frozen before the independent, creator-separated FSLD evaluation.
// A recommendation is not a confirmed session tempo or a manual correction.
export const TEMPO_DECISION_VERSION='metrical-evidence-selective-v0.1.0';
const MIN=55,MAX=210;
const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const round=x=>+x.toFixed(2);
const tolerance=bpm=>Math.max(2,Math.min(3,0.018*bpm));
function near(a,b){return valid(a)&&valid(b)&&Math.abs(a-b)<=tolerance(b);}
function evidence(name,bpm,primary,half){
 return {source:name,bpm:valid(bpm)?round(bpm):null,
  supports:near(bpm,half)?'half-time':near(bpm,primary)?'normal':'different-pulse'};
}
export function decideTempo({beatRoot,originalBpm=null,flux=null}={}){
 const root=beatRoot?.primaryCandidate;
 const base={version:TEMPO_DECISION_VERSION,status:'abstain',suggestedBpm:null,
  suggestionType:null,calibratedProbability:null,autoApplied:false,
  alternateBpm:null,reasonCodes:[],evidence:[],
  note:'Musical metrical level may remain ambiguous even if onset tracking is precise.'};
 if(beatRoot?.status!=='review'||!valid(root)||root<MIN||root>MAX)
  return {...base,reasonCodes:['NO_TRACKED_PULSE']};
 const primary=round(root),half=primary/2>=MIN?round(primary/2):null;
 const fluxCandidates=(flux?.candidates||[]).filter(x=>valid(x?.bpm)).slice(0,3);
 // Only the strongest independent spectral-flux candidate is a vote.
 const measured=[
  evidence('original-onset',originalBpm,primary,half),
  evidence('spectral-flux-top',fluxCandidates[0]?.bpm,primary,half)
 ];
 const present=measured.filter(x=>valid(x.bpm));
 const normalVotes=present.filter(x=>x.supports==='normal').length;
 const halfVotes=half===null?0:present.filter(x=>x.supports==='half-time').length;
 const voteWindows=Number(beatRoot.windowsWithPulse)||0;
 const lead=beatRoot.candidates?.[0];
 const sourceBeats=Number(lead?.sampleFrames)||0;
 const windowsValid=Number(beatRoot.windowsEvaluated)||0;
 const coherent=beatRoot.sectionAgreement==='consistent'||
  beatRoot.sectionAgreement==='partial'&&Number(lead?.windowVotes)>=2;
 const observationAdequate=sourceBeats>=8&&voteWindows>=1&&windowsValid>=1;
 const suggestions={...base,alternateBpm:half,
  evidence:measured,sectionAgreement:beatRoot.sectionAgreement||'unknown',
  observedBeatCount:sourceBeats,availableWindows:voteWindows};
 if(!observationAdequate)
  return {...suggestions,reasonCodes:['INSUFFICIENT_BEAT_OBSERVATIONS']};
 if(beatRoot.sectionAgreement==='single-reading'&&voteWindows>1)
  return {...suggestions,reasonCodes:['SECTIONS_DISAGREE']};
 // Half-time needs both independently represented onset estimators agreeing.
 if(halfVotes===2&&normalVotes===0&&half!==null){
  return {...suggestions,status:'recommend',suggestedBpm:half,
   suggestionType:'half-time',reasonCodes:['TWO_HALF_TIME_MEASUREMENTS',
    'BEATROOT_METRICAL_OCTAVE']};
 }
 if(halfVotes>0)
  return {...suggestions,reasonCodes:[
   halfVotes===1?'SINGLE_HALF_TIME_SIGNAL':'COMPETING_METRICAL_SIGNALS']};
 if(normalVotes>0){
  return {...suggestions,status:'recommend',suggestedBpm:primary,
   suggestionType:'normal',reasonCodes:['BEATROOT_AND_OTHER_PULSE_AGREE']};
 }
 // A single repetitive loop can hide the underlying intended half-time grid.
 if(coherent&&voteWindows>=2&&sourceBeats>=16){
  return {...suggestions,status:'recommend',suggestedBpm:primary,
   suggestionType:'normal',reasonCodes:['MULTI_WINDOW_BEAT_TRACK_AGREEMENT',
    'ALTERNATIVE_ONSETS_DIFFER']};
 }
 return {...suggestions,reasonCodes:['NO_INDEPENDENT_METER_SUPPORT']};
}
export function describeTempoDecision(decision){
 if(decision?.status==='recommend')return 'Suggested: '+decision.suggestedBpm+' BPM ('+
  (decision.suggestionType==='half-time'?'half-time':'normal pulse')+
  '; unverified — select to use)';
 return decision?.alternateBpm!=null?
  'Tempo ambiguous — compare BeatRoot and '+decision.alternateBpm+
  ' BPM half-time. Select by ear.':
  'No trustworthy automatic BPM decision; tap or enter the tempo.';
}
