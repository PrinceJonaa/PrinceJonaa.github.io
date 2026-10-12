import {state,dispatch,resolveValues} from './store.js';
import {defaultTuning,setupFromKey,scaleMask,validateTuning,tuningSummary} from './tuning-model.js';
export const tuningTarget=(track,scopeId=null)=>scopeId?track?.regions.find(r=>r.id===scopeId):track||null;
export function resolveTuning(track=null,scopeId=null){
 const target=tuningTarget(track,scopeId),saved=target?.tuningSetup||(!track?state.standaloneTuning:null),settings=saved||defaultTuning();
 const ref=settings.reference|| (track?{trackId:track.id,scopeId}:null),refTrack=ref?state.tracks.find(t=>t.id===ref.trackId):null,refTarget=tuningTarget(refTrack,ref?.scopeId);
 const values=resolveValues(refTrack,ref?.scopeId),inherited=!!ref&&(ref.trackId!==track?.id||ref.scopeId!==scopeId);
 const source=values.keySource==='candidate-choice'?'candidate-choice':values.keySource==='manual'?'manual':'estimated';
 let setup=settings;
 if(settings.followsEffectiveKey){const base=setupFromKey(values.key,inherited?'inherited':source);setup=base?{...settings,...base,reference:settings.reference,referenceHz:settings.referenceHz,referenceHzOrigin:settings.referenceHzOrigin,spellingPreference:settings.spellingPreference}:{...settings,tonic:null,mode:'custom',allowedPitchClasses:[],setupOrigin:inherited?'inherited':'manual'};}
 const referenceLabel=refTrack?refTrack.name+(ref?.scopeId?` · ${refTarget?.start??'?'}–${refTarget?.end??'?'} s`:' · whole track'):ref?'Reference source missing':null;
 const stale=!!ref&&(!refTrack||!refTarget||(ref.sourceRevision!=null&&ref.sourceRevision!==refTrack.sourceRevision)||(ref.scopeRevision!=null&&ref.scopeRevision!==(ref?.scopeId?refTarget.regionRevision:0)));
 const result={setup,reference:ref,referenceValues:values,referenceTrack:refTrack,referenceTarget:refTarget,referenceLabel,referenceOrigin:values.keySource,stale,scope:scopeId?`region ${target?.start??'?'}–${target?.end??'?'} s`:track?'whole track':'no audio reference',available:setup.allowedPitchClasses.length>0};
 result.summary=tuningSummary(setup,{target:track?.name||'Manual setup',scope:result.scope,referenceLabel,referenceOrigin:values.keySource,stale});return result;
}
export function editTuning(track,scopeId,change){
 const current=resolveTuning(track,scopeId),setup=structuredClone(current.setup),target=tuningTarget(track,scopeId),saved=target?.tuningSetup||(!track?state.standaloneTuning:null);
 switch(change.type){
  case 'root': {
   if(!Number.isInteger(change.tonic)||change.tonic<0||change.tonic>11)return {error:'Choose a tonic.'};
   setup.tonic=change.tonic;setup.rootSpelling=null;if(setup.mode!=='custom'){setup.allowedPitchClasses=scaleMask(setup.tonic,setup.mode);setup.startingScale={tonic:setup.tonic,mode:setup.mode,rootSpelling:null};}setup.setupOrigin='manual';setup.followsEffectiveKey=false;break;
  }
  case 'custom':if(setup.mode!=='custom')setup.startingScale={tonic:setup.tonic,mode:setup.mode,rootSpelling:setup.rootSpelling};setup.mode='custom';setup.setupOrigin='manual';setup.followsEffectiveKey=false;break;
  case 'scale': {
   const tonic=change.tonic??setup.tonic,mode=change.mode??setup.mode;
   if(!Number.isInteger(tonic)||tonic<0||tonic>11||!['major','natural-minor'].includes(mode))return {error:'Choose a tonic and a major or natural minor scale.'};
   setup.tonic=tonic;setup.mode=mode;setup.rootSpelling=null;setup.allowedPitchClasses=scaleMask(tonic,mode);setup.startingScale={tonic,mode,rootSpelling:null};setup.setupOrigin='manual';setup.followsEffectiveKey=false;break;
  }
  case 'note': {
   if(!Number.isInteger(change.pc)||change.pc<0||change.pc>11)return {error:'Choose one of the twelve pitch classes.'};
   if(setup.mode!=='custom')setup.startingScale={tonic:setup.tonic,mode:setup.mode,rootSpelling:setup.rootSpelling};
   setup.mode='custom';setup.allowedPitchClasses=change.allowed?[...new Set([...setup.allowedPitchClasses,change.pc])]:setup.allowedPitchClasses.filter(pc=>pc!==change.pc);setup.setupOrigin='manual';setup.followsEffectiveKey=false;break;
  }
  case 'reference': {
   const refTrack=state.tracks.find(t=>t.id===change.trackId),refTarget=tuningTarget(refTrack,change.scopeId);if(!refTrack||!refTarget)return {error:'Choose an available source and scope.'};
   setup.reference={trackId:refTrack.id,scopeId:change.scopeId||null,sourceRevision:refTrack.sourceRevision,scopeRevision:change.scopeId?refTarget.regionRevision:0};
   // Explicit references retain existing manual decisions until Use reference key is chosen.
   setup.followsEffectiveKey=saved?saved.followsEffectiveKey!==false:true;break;
  }
  case 'local': setup.reference=null;setup.followsEffectiveKey=saved?saved.followsEffectiveKey!==false:true;break;
  case 'use-reference': {
   const base=setupFromKey(current.referenceValues.key,current.referenceValues.keySource==='candidate-choice'?'candidate-choice':current.referenceValues.keySource==='manual'?'manual':'estimated');
   if(!base)return {error:'No key is available for that scope. Analyze the reference or choose a scale manually.'};
   Object.assign(setup,base,{reference:setup.reference?{...setup.reference,sourceRevision:current.referenceTrack.sourceRevision,scopeRevision:current.reference?.scopeId?current.referenceTarget.regionRevision:0}:null,referenceHz:current.setup.referenceHz,referenceHzOrigin:current.setup.referenceHzOrigin,spellingPreference:current.setup.spellingPreference,followsEffectiveKey:true});break;
  }
  case 'candidate': {
   const base=setupFromKey(change.key,'candidate-choice');if(!base)return {error:'This candidate cannot provide a major/minor note set.'};
   Object.assign(setup,base,{reference:setup.reference,referenceHz:current.setup.referenceHz,referenceHzOrigin:current.setup.referenceHzOrigin,spellingPreference:current.setup.spellingPreference,followsEffectiveKey:false});break;
  }
  case 'spelling':setup.spellingPreference=change.value;break;
  case 'reference-hz':if(!Number.isFinite(change.value)||change.value<20||change.value>20000)return {error:'Enter a reference frequency between 20 and 20,000 Hz.'};setup.referenceHz=change.value;setup.referenceHzOrigin='user-chosen';break;
  case 'assume-440':setup.referenceHz=440;setup.referenceHzOrigin='assumed';break;
  default:return {error:'Unknown tuning edit.'};
 }
 const valid=validateTuning(setup);if(!valid)return {error:'This tuning setup is invalid.'};
 const applied=dispatch({type:'tuning',trackId:track?.id??null,regionId:scopeId,setup:valid});return applied?{applied:true}:{error:'The selected scope is no longer available.'};
}
