import test from 'node:test';
import assert from 'node:assert/strict';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const {state,dispatch,resolveValues}=await import('../store.js');
const {createJobs,requestMatches,stableDigest}=await import('../jobs.js');
const {analyzeCapability,resample}=await import('../analysis-worker-core.js');
const {windowInputs,candidateRanges}=await import('../analysis-input.js');
const {preflight,RESOURCE_POLICY}=await import('../config.js');
const {createTapTempo,parseBpm,tempoMultiple,summaryText}=await import('../musical-controls.js');
const waitUntil=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,2));}throw new Error('Condition not reached');};
function decoded(seconds=2,channels=1,rate=11025){const data=Array.from({length:channels},()=>new Float32Array(seconds*rate));return {duration:seconds,sampleRate:rate,length:data[0].length,numberOfChannels:channels,getChannelData:c=>data[c]};}
function add(id){dispatch({type:'add',track:{id,name:'owned.wav',file:new File([new Uint8Array(44)],'owned.wav',{lastModified:1,type:'audio/wav'}),duration:2,state:'queued',result:null}});return state.tracks.find(t=>t.id===id);}
function fakeWorker(log=[],fail=null){return {terminate(){this.terminated=true;},postMessage(job){log.push(job);queueMicrotask(()=>{if(this.terminated)return;const response=job.capability===fail?{type:'error',reason:'Deliberate spectrum failure'}:analyzeCapability(job.capability,job.input);this.onmessage?.({data:{...job,input:undefined,...response}});});}};}

test('bounded windows spread in time, reject Quick silence and preserve low-level Deep',()=>{
 assert.equal(candidateRanges(180).length,5);const buffer=decoded(180,2,1000);buffer.getChannelData(0).fill(.1);buffer.getChannelData(1).fill(-.1);
 const input=windowInputs(buffer,{mode:'quick',scope:null});assert.equal(input.windows.length,3);assert.deepEqual(input.ranges.map(r=>r.start),[0,84,168]);assert.ok(input.bytes<=RESOURCE_POLICY.analysisWindowBytes);
 const silent=decoded();assert.equal(windowInputs(silent,{mode:'quick'}).windows.length,0);silent.getChannelData(0).fill(.00001);assert.equal(windowInputs(silent,{mode:'quick'}).windows.length,0);assert.equal(windowInputs(silent,{mode:'verify'}).windows.length,1);
});
test('silence and short clips give unavailable independently; key preserves ambiguity',()=>{
 for(const cap of ['tempo','key','spectrum'])assert.equal(analyzeCapability(cap,{windows:[],ranges:[]}).type,'unavailable');
 const short={windows:[{samples:new Float32Array(100).fill(.1),sampleRate:11025,start:0,end:.01}],ranges:[]};assert.equal(analyzeCapability('key',short).type,'unavailable');assert.equal(analyzeCapability('spectrum',short).type,'unavailable');
 const chord=new Float32Array(11025*2);for(let i=0;i<chord.length;i++)for(const hz of [261.63,329.63,392])chord[i]+=.1*Math.sin(2*Math.PI*hz*i/11025);
 const key=analyzeCapability('key',{windows:[{samples:chord,sampleRate:11025,start:0,end:2}],ranges:[{start:0,end:2}]});assert.equal(key.type,'result');assert.ok(key.result.keys.length>=3);assert.equal(typeof key.result.ambiguous,'boolean');assert.equal(key.result.evidence.length,1);assert.equal(key.result.keys.some(k=>'probability' in k),false);
});
test('anti-aliased downsample suppresses above-Nyquist content',()=>{
 const signal=hz=>Float32Array.from({length:44100},(_,i)=>Math.sin(2*Math.PI*hz*i/44100));
 const rms=a=>Math.sqrt(a.slice(100,-100).reduce((s,v)=>s+v*v,0)/(a.length-200));
 const low=resample(signal(1000),44100),high=resample(signal(16000),44100);assert.equal(low.sampleRate,11025);assert.ok(rms(high.samples)<rms(low.samples)*.1);
});
test('tap/manual/multiple/copy preserve valid range, precision and provenance',()=>{
 const tap=createTapTempo();for(const t of [0,500,1000])assert.equal(tap.tap(t).bpm,null);assert.equal(tap.tap(1500).bpm,120);assert.equal(tap.tap(4500).bpm,null);assert.equal(tap.tap(4501).bpm,null);
 assert.equal(parseBpm('120.25'),120.25);for(const v of ['24','401','100.123','NaN','1e2'])assert.equal(parseBpm(v),null);assert.equal(tempoMultiple(200,2),400);assert.equal(tempoMultiple(210,2),null);
 dispatch({type:'clear'});const t=add(1);dispatch({type:'correct',trackId:1,values:{bpm:120},origin:'tap',fields:['bpm']});assert.equal(resolveValues(t).bpmSource,'tap');assert.match(summaryText(t,resolveValues(t)),/BPM source: tap.*whole track/);
});
test('request identity rejects source/scope/session/requeue staleness; digest sorts keys',()=>{
 dispatch({type:'clear'});const t=add(2);t.analysis={'track:tempo':{requestRevision:1}};const j={jobId:1,trackId:2,sourceRevision:1,scopeId:null,scopeRevision:0,capability:'tempo',requestRevision:1,sessionGeneration:state.generation};
 assert.equal(requestMatches(j,j,t,state.generation),true);for(const k of ['jobId','trackId','sourceRevision','scopeId','scopeRevision','capability','requestRevision','sessionGeneration'])assert.equal(requestMatches(j,{...j,[k]:'stale'},t,state.generation),false,k);
 t.analysis['track:tempo'].requestRevision++;assert.equal(requestMatches(j,j,t,state.generation),false);assert.equal(stableDigest({b:2,a:1}),stableDigest({a:1,b:2}));
});
test('Quick posts only tempo/key/waveform; one decode; spectrum errors retain quick results',async()=>{
 dispatch({type:'clear'});const t=add(3),buffer=decoded(),log=[];let decodes=0;const jobs=createJobs({makeContext:()=>({async decodeAudioData(){decodes++;return buffer;},async close(){}}),makeWorker:()=>fakeWorker(log,'spectrum')});
 jobs.request(t);await waitUntil(()=>jobs.diagnostics().queued===0&&t.analysis['track:waveform']?.status==='ready');assert.deepEqual(log.map(j=>j.capability),['tempo','key','waveform']);assert.equal(decodes,1);assert.ok(t.result);assert.equal(t.result.quality,undefined);assert.equal(t.result.spectrogram,undefined);
 const old=t.result.tempo;jobs.request(t,{capabilities:['spectrum']});await waitUntil(()=>t.analysis['track:spectrum']?.status==='error');assert.equal(t.result.tempo,old);assert.equal(t.error,'Deliberate spectrum failure');
});
test('cancelled native decode settles before requeue; late results cannot apply',async()=>{
 dispatch({type:'clear'});const t=add(4),buffer=decoded(),gates=[];let current=0,maximum=0;
 const jobs=createJobs({makeContext:()=>({decodeAudioData(){current++;maximum=Math.max(maximum,current);return new Promise(resolve=>gates.push(()=>resolve(buffer)));},async close(){current--;}}),makeWorker:()=>fakeWorker()});
 jobs.request(t,{capabilities:['tempo']});await waitUntil(()=>gates.length===1);const firstRevision=t.analysis['track:tempo'].requestRevision;jobs.cancel(t.id);jobs.request(t,{capabilities:['tempo'],mode:'verify'});assert.equal(gates.length,1);gates[0]();await waitUntil(()=>gates.length===2);assert.equal(maximum,1);assert.ok(t.analysis['track:tempo'].requestRevision>firstRevision);gates[1]();await waitUntil(()=>t.analysis['track:tempo'].status==='unavailable');assert.equal(maximum,1);
});
test('preflight refuses known oversize and unsupported channels without deleting a source',()=>{
 assert.equal(preflight({duration:10000,channels:2},100).allowed,false);assert.equal(preflight({duration:2,channels:6},100).allowed,false);const unknown=preflight({},100);assert.equal(unknown.allowed,true);assert.equal(unknown.uncertain,true);assert.equal(unknown.estimate.nativeOverhead,'unknown');
});
test('click track produces tempo without a level or spectrum scan',()=>{
 const samples=new Float32Array(11025*12);for(let beat=0;beat<24;beat++){const begin=Math.round(beat*.5*11025);for(let i=0;i<800&&begin+i<samples.length;i++)samples[begin+i]=Math.exp(-i/130)*Math.sin(2*Math.PI*120*i/11025);}
 const r=analyzeCapability('tempo',{windows:[{samples,sampleRate:11025,start:0,end:12}],ranges:[{start:0,end:12}]});assert.equal(r.type,'result');assert.ok(Math.min(Math.abs(r.result.bpm-120),Math.abs(r.result.bpm-60))<=3);assert.ok(r.result.sections.length);assert.equal(r.result.rangePreference,'none');
});
test('editing a region during worker analysis discards the old answer and releases the queue',async()=>{
 dispatch({type:'clear'});const t=add(5);dispatch({type:'region',trackId:5,region:{id:'part',start:0,end:1}});
 let pending;const log=[];const worker={terminate(){},postMessage(job){log.push(job);pending=()=>this.onmessage?.({data:{...job,type:'result',result:{bpm:120,alternatives:[],beats:[]},ranges:[]}});}};
 const jobs=createJobs({makeContext:()=>({async decodeAudioData(){return decoded();},async close(){}}),makeWorker:()=>worker});
 jobs.request(t,{capabilities:['tempo'],scopeId:'part'});await waitUntil(()=>!!pending);dispatch({type:'region',trackId:5,region:{id:'part',start:.25,end:1.5}});pending();await waitUntil(()=>jobs.diagnostics().activeCapability===null);assert.equal(t.regions[0].result,null);assert.equal(t.analysis['part:tempo'].status,'idle');
});
test('a cancelled native decode failure cannot poison a newer explicit retry',async()=>{
 dispatch({type:'clear'});const t=add(6);let failOld,decodes=0;
 const jobs=createJobs({makeContext:()=>({decodeAudioData(){decodes++;return decodes===1?new Promise((_,reject)=>failOld=reject):Promise.resolve(decoded());},async close(){}}),makeWorker:()=>fakeWorker()});
 jobs.request(t,{capabilities:['tempo']});await waitUntil(()=>!!failOld);jobs.cancel(t.id);jobs.request(t,{capabilities:['tempo'],force:true});failOld(new Error('Old cancelled decode failed'));await waitUntil(()=>t.analysis['track:tempo'].status==='unavailable');assert.equal(decodes,2);assert.equal(t.analysisRefusal,null);
});
