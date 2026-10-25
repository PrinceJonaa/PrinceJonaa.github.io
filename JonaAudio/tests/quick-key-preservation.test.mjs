import test from 'node:test';
import assert from 'node:assert/strict';
const local=new Map();
globalThis.localStorage={getItem:key=>local.get(key)||null,setItem:(key,v)=>local.set(key,v)};
const {state,dispatch}=await import('../store.js');
const {createJobs}=await import('../jobs.js');

function bufferedAudio(){
 const sr=11025,length=sr*10;
 const samples=Float32Array.from({length},(_,i)=>.15*Math.sin(i/sr*2*Math.PI*220));
 return {duration:10,sampleRate:sr,length,numberOfChannels:1,
  getChannelData:()=>samples};
}
function fakeWorker(){
 return {terminate(){this.terminated=true;},
  postMessage(job){
   queueMicrotask(()=>{
    if(this.terminated)return;
    const deep=job.input.analysisMode==='verify';
    this.onmessage?.({data:{...job,type:'result',
     result:{keys:[{key:deep?'G major':'C major',score:deep?.8:.9}],
      chroma:new Array(12).fill(.3),ambiguous:false,disagreement:false}}});
   });
  }
 };
}
test('Quick key is still selectable after Deep re-ranks; stale source invalidates the old snapshot',async()=>{
 dispatch({type:'clear'});
 const f=new File([new Uint8Array(44)],'melody.wav',{type:'audio/wav'});
 dispatch({type:'add',track:{id:9901,file:f,name:f.name,url:'blob:melody',size:f.size,
  duration:10,state:'ready',result:{tempo:{bpm:null},keys:[]}}});
 const t=state.tracks.find(x=>x.id===9901);
 const jobs=createJobs({makeContext:()=>({decodeAudioData:async()=>bufferedAudio(),close:async()=>{}}),
  makeWorker:()=>fakeWorker()});
 try{
  const quick=await jobs.request(t,{capabilities:['key'],mode:'quick',force:true});
  assert.equal(quick[0].type,'result');
  assert.equal(t.result.keys[0].key,'C major');
  assert.equal(t.result.quickKeyEvidence.key,'C major');
  assert.equal(t.result.quickKeyEvidence.sourceRevision,t.sourceRevision);
  const deep=await jobs.request(t,{capabilities:['key'],mode:'verify',force:true});
  assert.equal(deep[0].type,'result');
  assert.equal(t.result.keys[0].key,'G major');
  assert.equal(t.result.quickKeyEvidence.key,'C major');
  // Distinct source revision cannot inherit the earlier song's selected key.
  t.sourceRevision++;
  await jobs.request(t,{capabilities:['key'],mode:'verify',force:true});
  assert.equal(t.result.quickKeyEvidence,undefined);
 }finally{jobs.clear();dispatch({type:'clear'});}
});
