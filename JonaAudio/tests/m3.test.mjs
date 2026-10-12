import test from 'node:test';
import assert from 'node:assert/strict';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const {state,dispatch,resolveValues}=await import('../store.js');
const {scaleMask,setupFromKey,noteName,referenceFrequency,scientificNoteName,scaleMidis,validateTuning}=await import('../tuning-model.js');
const {resolveTuning,editTuning}=await import('../tuning-state.js');
const {createReferenceTones}=await import('../reference-tones.js');
const {createAudioService}=await import('../audio-service.js');
const add=(id,key='G minor')=>{dispatch({type:'add',track:{id,name:'beat-'+id+'.wav',file:{name:'beat-'+id+'.wav',size:100,lastModified:1},url:'blob:'+id,duration:12,result:key?{keys:[{key}],tempo:{bpm:150}}:null}});return state.tracks.find(t=>t.id===id);};

test('major and natural minor note sets transpose through all twelve tonic pitch classes',()=>{
 for(let tonic=0;tonic<12;tonic++)for(const [mode,intervals] of [['major',[0,2,4,5,7,9,11]],['natural-minor',[0,2,3,5,7,8,10]]]){
  const notes=scaleMask(tonic,mode);assert.equal(new Set(notes).size,7);assert.deepEqual(notes.map(pc=>(pc-tonic+12)%12),intervals);
 }
 assert.deepEqual(setupFromKey('G minor').allowedPitchClasses,[7,9,10,0,2,3,5]);
 assert.deepEqual(setupFromKey('C♯ major').allowedPitchClasses,setupFromKey('D♭ major').allowedPitchClasses);
});
test('diatonic/enharmonic spelling and scientific octaves preserve sounding identity',()=>{
 const sharp=setupFromKey('C♯ major'),flat=setupFromKey('G minor');assert.equal(noteName(5,sharp),'E♯');assert.equal(noteName(0,sharp),'B♯');assert.equal(scientificNoteName(0,4,sharp),'B♯3');assert.equal(scientificNoteName(11,4,setupFromKey('C♭ major')),'C♭5');
 assert.equal(noteName(10,flat),'B♭');assert.equal(noteName(3,flat),'E♭');assert.equal(noteName(10,{...flat,spellingPreference:'sharps'}),'A♯');assert.equal(referenceFrequency(69),440);assert.equal(referenceFrequency(69,432),432);assert.deepEqual(scaleMidis(setupFromKey('G minor')),[67,69,70,72,74,75,77]);
});
test('Custom edits preserve starting scale and never rewrite detected/overridden key',()=>{
 dispatch({type:'clear'});const t=add(1);editTuning(t,null,{type:'note',pc:1,allowed:true});const custom=resolveTuning(t).setup;assert.equal(custom.mode,'custom');assert.equal(custom.startingScale.mode,'natural-minor');assert.equal(custom.allowedPitchClasses.includes(1),true);assert.equal(resolveValues(t).key,'G minor');
 dispatch({type:'correct',trackId:1,values:{key:'C major'}});assert.deepEqual(resolveTuning(t).setup.allowedPitchClasses,custom.allowedPitchClasses);assert.equal(t.result.keys[0].key,'G minor');
 const b=add(2);dispatch({type:'select',trackId:2});dispatch({type:'select',trackId:1});assert.deepEqual(resolveTuning(t).setup.allowedPitchClasses,custom.allowedPitchClasses);editTuning(t,null,{type:'reference',trackId:b.id,scopeId:null});assert.deepEqual(resolveTuning(t).setup.allowedPitchClasses,custom.allowedPitchClasses);
});
test('unedited setups follow effective keys; explicit inherited reference is not a local region estimate',()=>{
 dispatch({type:'clear'});const t=add(3);dispatch({type:'region',trackId:3,region:{id:'part',start:1,end:3}});assert.equal(resolveTuning(t,'part').available,false);
 editTuning(t,'part',{type:'reference',trackId:t.id,scopeId:null});assert.equal(resolveTuning(t,'part').setup.setupOrigin,'inherited');assert.equal(resolveValues(t,'part').key,null);assert.match(resolveTuning(t,'part').summary,/inherited reference key/);
 dispatch({type:'correct',trackId:3,values:{key:'C major'}});assert.deepEqual(resolveTuning(t,'part').setup.allowedPitchClasses,[0,2,4,5,7,9,11]);
 editTuning(t,'part',{type:'candidate',key:'A minor'});assert.equal(resolveTuning(t,'part').setup.setupOrigin,'candidate-choice');assert.match(resolveTuning(t,'part').summary,/selected from estimated alternatives/);assert.equal(resolveValues(t).key,'C major');
});
test('manual setup works with no analysis; frequency copy distinguishes assumption from choice',()=>{
 dispatch({type:'clear'});const t=add(4,null);editTuning(t,null,{type:'scale',tonic:7,mode:'natural-minor'});assert.equal(resolveTuning(t).available,true);assert.match(resolveTuning(t).summary,/A=440 Hz \(assumed\)/);
 editTuning(t,null,{type:'reference-hz',value:432});assert.match(resolveTuning(t).summary,/A=432 Hz \(user-chosen\)/);assert.ok(editTuning(t,null,{type:'reference-hz',value:NaN}).error);
 editTuning(null,null,{type:'scale',tonic:0,mode:'major'});assert.equal(resolveTuning(null).available,true);assert.match(resolveTuning(null).summary,/no audio reference/);assert.equal(validateTuning({...setupFromKey('C major'),allowedPitchClasses:[0]}),null);
});
test('scope/source revisions flag an inherited setup until the reference is explicitly accepted',()=>{
 dispatch({type:'clear'});const target=add(5),backing=add(6,'C major');dispatch({type:'region',trackId:6,region:{id:'phrase',start:0,end:2}});backing.regions[0].result={keys:[{key:'C major'}]};editTuning(target,null,{type:'reference',trackId:6,scopeId:'phrase'});
 dispatch({type:'region',trackId:6,region:{id:'phrase',start:0,end:3}});assert.equal(resolveTuning(target).stale,true);backing.regions[0].result={keys:[{key:'D minor'}]};editTuning(target,null,{type:'use-reference'});assert.equal(resolveTuning(target).stale,false);assert.equal(resolveTuning(target).setup.tonic,2);
});
test('reference tone synthesis uses chosen A frequency and Stop releases every voice',async()=>{
 const voices=[];let closed=0;
 const ctx={sampleRate:44100,currentTime:0,destination:{},async resume(){},async close(){closed++;},createOscillator(){const osc={frequency:{value:0},connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};voices.push(osc);return osc;},createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
 const tones=createReferenceTones({makeContext:()=>ctx});assert.equal(await tones.play([69,81],432),true);assert.deepEqual(voices.map(v=>v.frequency.value),[432,864]);assert.equal(tones.running,true);tones.stop();assert.equal(tones.running,false);assert.equal(voices.every(v=>v.stopped),true);assert.equal(closed,1);
});
test('reference source audition keeps editing selection and has one playback owner',async()=>{
 dispatch({type:'clear'});const a=add(7),b=add(8);dispatch({type:'select',trackId:7});
 class Audio extends EventTarget{duration=12;currentTime=0;readyState=1;playbackRate=1;paused=true;pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}load(){}removeAttribute(){}async play(){this.paused=false;this.dispatchEvent(new Event('play'));}}
 const audio=new Audio(),service=createAudioService(audio);let stopped=0;service.registerCompanion(()=>stopped++);service.select(a);await service.audition(b,{start:2,end:4});assert.equal(state.selectedId,7);assert.equal(service.owner,b);assert.equal(audio.currentTime,2);assert.equal(audio.playbackRate,1);audio.currentTime=4;audio.dispatchEvent(new Event('timeupdate'));assert.equal(audio.paused,true);assert.ok(stopped>=2);
});
