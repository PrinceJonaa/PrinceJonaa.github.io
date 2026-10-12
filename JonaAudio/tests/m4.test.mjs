import test from 'node:test';
import assert from 'node:assert/strict';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const {state,dispatch}=await import('../store.js');
const {parseTime,frameBounds,editBoundary,snapTime,barSeconds,sanitizedFilename}=await import('../sample-model.js');
const {prepareRegion,encodeWav,zeroBoundary}=await import('../sample-dsp.js');
const {rankCandidates,describeChunk}=await import('../sample-candidates.js');
const {createLoopPlayer}=await import('../loop-player.js');
const {createJobs}=await import('../jobs.js');
const {analyzeCapability}=await import('../analysis-worker-core.js');
const {createSampleService}=await import('../sample-service.js');
const {createAudioService}=await import('../audio-service.js');
const until=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,2));}throw new Error('Condition not reached');};
function buffer(seconds=4,channels=2,rate=1000){const arrays=Array.from({length:channels},(_,c)=>Float32Array.from({length:seconds*rate},(_,i)=>(c?-1:1)*.5*Math.sin(2*Math.PI*60*i/rate)));return {duration:seconds,sampleRate:rate,length:arrays[0].length,numberOfChannels:channels,getChannelData:c=>arrays[c]};}
function add(id=1){dispatch({type:'add',track:{id,file:new File([new Uint8Array(44)],'source.wav',{type:'audio/wav',lastModified:1}),name:'source.wav',url:'blob:'+id,duration:4,state:'ready',result:{tempo:{bpm:120,beats:[]},keys:[{key:'C major'}]}}});return state.tracks.find(t=>t.id===id);}
function context(){const nodes=[];return {nodes,currentTime:0,sampleRate:44100,destination:{},async resume(){},async close(){},createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {length,numberOfChannels:channels,sampleRate,copyToChannel:(input,c)=>data[c].set(input)};},createBufferSource(){const node={connect(){},disconnect(){},start(when,offset){this.startAt=when;this.offset=offset;},stop(when){this.stopAt=when??0;}};nodes.push(node);return node;}};}
function analysisWorker(log=[]){let features=[];return {terminate(){this.terminated=true;},postMessage(job){log.push(job);queueMicrotask(()=>{if(this.terminated)return;let response;if(job.input.stream){if(job.input.offset===0)features=[];features.push(...describeChunk(job.input.samples,job.input.sampleRate,job.input.offset,job.input.bucketFrames,features.at(-1)?.lastRms||0));response=job.input.last?{type:'result',result:{...rankCandidates(features,job.input.duration,job.input.settings),features}}:{type:'progress',phase:'features',nextChunk:true};}else response=analyzeCapability(job.capability,job.input);this.onmessage?.({data:{...job,...response}});});}};}

test('time/frame edits preserve end-exclusive stereo alignment and a two-frame minimum',()=>{
 assert.equal(parseTime('1:02.125'),62.125);assert.equal(parseTime('1:72'),null);assert.equal(parseTime('junk'),null);
 const r=frameBounds(.0014,.0036,1000,100);assert.deepEqual([r.startFrame,r.endFrame,r.duration],[1,4,.003]);const edited=editBoundary({start:1,end:2},'start',3,4,1000);assert.equal(edited.region.start,1.998);assert.equal(edited.limited,true);
 const g={bpm:120,numerator:7,denominator:8,anchor:1,anchorOrigin:'user-set',snap:'bar'};assert.equal(barSeconds(g),1.75);assert.equal(snapTime(2.7,g).time,2.75);assert.ok(snapTime(2.7,{...g,anchorOrigin:'suggested'}).error);
});
test('preview/export preparation shares linear endpoint fades and raw source frames',()=>{
 const channels=[new Float32Array(20).fill(1),new Float32Array(20).fill(-1)];const p=prepareRegion({channels,sampleRate:1000,startFrame:5,endFrame:15,padStartFrame:0,sourceLength:20,fades:{inMs:5,outMs:5}});
 assert.equal(p.frames,10);assert.equal(p.startFrame,5);assert.equal(p.endFrame,15);assert.equal(p.channels[0][0],0);assert.equal(p.channels[0][4],1);assert.equal(p.channels[0][9],0);assert.equal(p.channels[1][4],-1);assert.equal(channels[0][5],1);assert.equal(p.actualFades.inFrames,5);assert.ok(p.pyramid.length);assert.equal(p.channels[0].length,p.channels[1].length);
 assert.equal(zeroBoundary([Float32Array.of(1,0,0,1),Float32Array.of(1,.3,.3,1)],1,0,4),2);
});
test('PCM16 WAV fields, interleaving, saturation and silence agree',()=>{
 const p=encodeWav([Float32Array.of(-1,0,1,2),Float32Array.of(1,0,-1,-2)],48000,1000),v=new DataView(p.buffer);assert.equal(v.getUint32(4,true),p.bytes-8);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint32(28,true),192000);assert.equal(v.getUint16(32,true),4);assert.equal(v.getUint32(40,true),16);assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(46,true),32767);assert.equal(v.getInt16(48,true),0);assert.equal(p.outOfRange,2);assert.throws(()=>encodeWav([new Float32Array(100)],44100,50));assert.throws(()=>encodeWav([Float32Array.of(NaN,0)],44100,100));
 const filename=sanitizedFilename('../bad/name.wav',{label:'../loop\n',start:0,end:2},{bpm:null,key:null});assert.equal(/[\x00-\x1f/\\]/.test(filename),false);assert.equal(filename.includes('unknown'),false);
});
test('suggestions reject silence, suppress overlap, cap the pool and preserve deterministic order',()=>{
 const silent=Array.from({length:128},(_,i)=>({start:i*.25,end:(i+1)*.25,energy:0,peak:0,onsets:[],chroma:null,head:0,tail:0}));assert.equal(rankCandidates(silent,32).candidates.length,0);
 const f=silent.map((v,i)=>({...v,energy:.1+.04*Math.sin(i),onsets:i%2?[v.start]:[],chroma:[1,.1,.2,.1,.8,.2,.1,.7,.1,.2,.1,.1]}));const a=rankCandidates(f,32),b=rankCandidates(f,32);assert.deepEqual(a,b);assert.ok(a.poolSize<=256);assert.ok(a.candidates.length<=8);for(const c of a.candidates)assert.ok(c.reason&&!c.reason.includes('vocal-free'));
 for(let i=0;i<a.candidates.length;i++)for(let j=i+1;j<a.candidates.length;j++){const x=a.candidates[i],y=a.candidates[j],overlap=Math.max(0,Math.min(x.end,y.end)-Math.max(x.start,y.start));assert.ok(overlap/(x.length+y.length-overlap)<=.65);}
});
test('region/fade edits have monotonic revisions and Undo does not revive an old worker revision',()=>{
 dispatch({type:'clear'});const t=add();dispatch({type:'region',trackId:t.id,region:{id:'r',start:0,end:2}});const r=t.regions[0],audioRevision=r.audioRevision;dispatch({type:'region',trackId:t.id,region:{...r,fades:{inMs:0,outMs:0}}});assert.ok(r.audioRevision>audioRevision);const rev=r.regionRevision;dispatch({type:'region',trackId:t.id,region:{...r,start:1}});assert.ok(r.regionRevision>rev);const latest=r.regionRevision;dispatch({type:'undo',trackId:t.id});assert.equal(t.regions[0].start,0);assert.ok(t.regions[0].regionRevision>latest);for(let i=0;i<40;i++)dispatch({type:'region',trackId:t.id,region:{id:'r',label:String(i),start:0,end:2}});assert.equal(t.history.length,30);
});
test('loop swaps are scheduled at a loop boundary and Stop silences all nodes',async()=>{
 const ctx=context(),loop=createLoopPlayer({makeContext:()=>ctx}),audio={channels:[new Float32Array(2000)],frames:2000,sampleRate:1000,start:1,audioKey:'one'};await loop.start({id:1},audio);ctx.currentTime=.5;loop.swap({...audio,audioKey:'two',start:2});const boundary=ctx.nodes[1].startAt;assert.equal(boundary,2.025);assert.equal(ctx.nodes[0].stopAt,boundary);ctx.currentTime=boundary+.1;assert.ok(Math.abs(loop.position()-2.1)<1e-8);loop.stop();assert.equal(loop.active,false);assert.equal(ctx.nodes.every(n=>n.stopAt===0),false);assert.equal(ctx.nodes[1].stopAt,0);
});
test('region preparation, WAV sidecar and cancelled sharing retain a complete export',async()=>{
 dispatch({type:'clear'});const t=add(2);dispatch({type:'region',trackId:2,region:{id:'r',start:1,end:3,label:'Phrase'}});
 const jobs=createJobs({makeContext:()=>({async decodeAudioData(){return buffer();},async close(){}}),makeWorker:()=>analysisWorker()});
 class Audio extends EventTarget{duration=4;currentTime=0;paused=true;readyState=1;playbackRate=1;pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}load(){}removeAttribute(){}async play(){this.paused=false;}}
 const transport=createAudioService(new Audio());transport.select(t);const service=createSampleService({jobs,transport,makeLoopContext:context,makeExportWorker:()=>({terminate(){},postMessage(data){queueMicrotask(()=>{try{this.onmessage?.({data:{...data,...encodeWav(data.channels,data.sampleRate,data.maxBytes),type:'ready'}});}catch(error){this.onmessage?.({data:{...data,type:'error',reason:error.message}});}});}})});
 await service.prepareWav(2,'r');const exp=service.exportState;assert.equal(exp.status,'ready');assert.equal(exp.sidecar.region.startFrame,1000);assert.equal(exp.sidecar.region.endFrame,3000);assert.equal(exp.sidecar.channels,2);assert.equal(exp.sidecar.decodedSampleRate,1000);assert.equal(exp.sidecar.effective.key,null);assert.equal(exp.file.size,44+2000*2*2);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{canShare:()=>true,share:async()=>{throw new DOMException('User cancelled','AbortError');}}});assert.equal((await service.share()).type,'cancelled');assert.equal(service.exportState.status,'ready');dispatch({type:'region',trackId:2,region:{id:'r',start:1.5,end:3}});assert.equal(service.exportState.status,'stale');service.clear();jobs.clear();
});
test('candidate scans use bounded chunks and cached compact features can be reranked',async()=>{
 dispatch({type:'clear'});const t=add(3),log=[];let decodes=0;const jobs=createJobs({makeContext:()=>({async decodeAudioData(){decodes++;return buffer(70,2,11025);},async close(){}}),makeWorker:()=>analysisWorker(log)});
 const replies=await jobs.request(t,{capabilities:['suggestions'],extraOptions:{gridRevision:t.gridRevision,settings:{grid:t.sampleGrid,family:'all'}}});assert.equal(replies[0].type,'result');assert.ok(t.featureMap.features.length);assert.ok(log.filter(j=>j.input.stream).length>1);assert.ok(log.filter(j=>j.input.samples).every(j=>j.input.samples.byteLength<=4*1024*1024));
 const before=log.length;await jobs.request(t,{capabilities:['suggestions'],force:true,extraOptions:{gridRevision:t.gridRevision,settings:{grid:t.sampleGrid,family:'break'}}});assert.equal(log.length,before+1);assert.ok(log.at(-1).input.features);assert.equal(decodes,1);jobs.clear();
});
