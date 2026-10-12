import test from 'node:test';
import assert from 'node:assert/strict';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const {dispatch,state,resolveValues}=await import('../store.js');
const {normalizeRoute}=await import('../router.js');
const {createLayouts,defaultLayout,validateLayout}=await import('../layouts.js');

test('correction/reset preserve auto estimates; region scope never invents inherited values',()=>{
 dispatch({type:'clear'});dispatch({type:'add',track:{id:1,file:{name:'beat.wav',size:200,lastModified:1},duration:10,result:{tempo:{bpm:150},keys:[{key:'G minor'}]}}});
 const t=state.tracks[0];dispatch({type:'correct',trackId:1,values:{bpm:75,key:'C major'}});
 assert.equal(resolveValues(t).bpm,75);assert.equal(resolveValues(t).keySource,'manual');assert.equal(t.result.tempo.bpm,150);assert.equal(t.gridStale,true);
 dispatch({type:'region',trackId:1,region:{id:'r',start:1,end:2}});assert.equal(resolveValues(t,'r').bpm,null);
 dispatch({type:'correct',trackId:1,regionId:'r',values:{bpm:90}});dispatch({type:'resetCorrection',trackId:1});assert.equal(resolveValues(t).bpm,150);assert.equal(resolveValues(t,'r').bpm,90);
 assert.equal(dispatch({type:'correct',trackId:1,values:{bpm:NaN}}),false);assert.equal(dispatch({type:'correct',trackId:1,values:{key:'bogus'}}),false);
});
test('legacy and malformed hashes recover to canonical routes',()=>{
 for(const [input,expected] of Object.entries({'#analyze':'#quick','#analyze/overview':'#quick','#analyze/rhythm':'#studio/tune?evidence','#analyze/spectrum':'#studio/engineer?spectrum','#analyze/quality':'#studio/engineer?levels','#analyze/corrections':'#quick?corrections','#compare':'#studio/compare','#%':'#quick','#what':'#quick','#quick/extra':'#quick','#studio/tune/extra':'#quick'}))assert.equal(normalizeRoute(input).hash,expected,input);
 assert.equal(normalizeRoute('#studio','sample').hash,'#studio/sample');
});
test('presets, named layouts and cancel drafts do not change music state',()=>{
 const manager=createLayouts();const draft=manager.current();draft.widgets.reverse();assert.notDeepEqual(manager.current().widgets,draft.widgets);draft.name='My workspace';manager.save(draft,{asNew:true});
 const restored=createLayouts();assert.equal(restored.current().name,'My workspace');assert.deepEqual(restored.current().widgets,draft.widgets);
 restored.reset();assert.equal(restored.current().name,'Quick');assert.equal(resolveValues(state.tracks[0],'r').bpm,90);
 assert.equal(validateLayout({...defaultLayout(),widgets:[]}),null);assert.equal(validateLayout({...defaultLayout(),version:99}),null);
});
test('correction keys accept the exact note spellings used by the analyzer',()=>{
 for(const key of ['C♯ major','E♭ minor','F♯ minor','A♭ major','B♭ minor'])assert.notEqual(dispatch({type:'correct',trackId:1,values:{key}}),false,key);
});
test('single playback owner remembers each source and never autoplays on switch',async()=>{
 const {createAudioService}=await import('../audio-service.js');
 class Audio extends EventTarget {
  currentTime=0;duration=20;playbackRate=1;paused=true;loads=0;plays=0;
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  load(){this.loads++;this.currentTime=0;}
  removeAttribute(){this.src='';}
  async play(){this.plays++;this.paused=false;this.dispatchEvent(new Event('play'));}
 }
 const audio=new Audio(),svc=createAudioService(audio);const a={url:'a',duration:20,playback:{position:2,rate:1}},b={url:'b',duration:20,playback:{position:4,rate:1}};
 svc.select(a);audio.onloadedmetadata();assert.equal(audio.currentTime,2);svc.seek(6);await svc.toggle();assert.equal(audio.plays,1);
 svc.select(b);audio.onloadedmetadata();assert.equal(a.playback.position,6);assert.equal(audio.currentTime,4);assert.equal(audio.paused,true);
 svc.select(b);assert.equal(audio.loads,2);svc.select(a);audio.onloadedmetadata();assert.equal(audio.currentTime,6);assert.equal(audio.plays,1);svc.clear();assert.equal(svc.owner,null);
});
