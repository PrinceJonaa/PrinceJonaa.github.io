import {state,dispatch,resolveValues} from './store.js';
import {RESOURCE_POLICY,ENGINE_VERSION,preflight} from './config.js';
import {frameBounds} from './sample-model.js';
import {readWavMetadata,windowInputs,waveformInput} from './analysis-input.js';
export const scopeKey=(scopeId,capability)=>(scopeId||'track')+':'+capability;
export function stableDigest(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stableDigest).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableDigest(value[k])).join(',')+'}';}
export function requestMatches(job,message,track,generation){
 if(!track||generation!==job.sessionGeneration||track.sourceRevision!==job.sourceRevision)return false;
 const region=job.scopeId?track.regions.find(r=>r.id===job.scopeId):null;
 if(job.scopeId&&(!region||(region.regionRevision||0)!==job.scopeRevision))return false;
 if(job.options?.gridRevision!=null&&job.options.gridRevision!==track.gridRevision)return false;
 if(track.analysis?.[scopeKey(job.scopeId,job.capability)]?.requestRevision!==job.requestRevision)return false;
 return ['jobId','sessionGeneration','trackId','sourceRevision','scopeId','scopeRevision','capability','requestRevision'].every(k=>message[k]===job[k]);
}
export function createJobs({policy=RESOURCE_POLICY,makeContext=()=>new (window.AudioContext||window.webkitAudioContext)({sampleRate:policy.decodeSampleRate}),makeWorker=()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),onChange=()=>{}}={}){
 let serial=0,pumping=false,active=null,decodedOwner=null,worker=null,nativeDecoding=false,held=false,reservedBytes=0;const queue=[],cache=new Map(),trace=[],completions=new Map(),holds=new Set();
 const settle=(job,message={type:'cancelled'})=>{const pending=completions.get(job.jobId);if(pending){completions.delete(job.jobId);pending.resolve(message);}};
 const find=id=>state.tracks.find(t=>t.id===id);
 const valid=job=>requestMatches(job,job,find(job.trackId),state.generation);
 function update(job,patch){const track=find(job.trackId);if(!valid(job))return;Object.assign(track.analysis[scopeKey(job.scopeId,job.capability)],patch);refresh(track);}
 function refresh(track){
  const entries=Object.values(track.analysis||{}),statuses=entries.map(e=>e.status);
  track.state=statuses.includes('decoding')?'decoding':statuses.includes('running')?(track.result?'partial-ready':'analyzing'):statuses.includes('queued')?'queued':track.result||statuses.includes('ready')?'ready':statuses.includes('error')?'error':statuses.includes('unavailable')?'unavailable':statuses.includes('cancelled')?'cancelled':'queued';
  track.error=entries.filter(e=>['error','unavailable'].includes(e.status)).map(e=>e.reason).filter(Boolean).at(-1)||null;
  dispatch({type:'patch',trackId:track.id,patch:{state:track.state,error:track.error}});onChange(track);
 }
 function cacheKey(job,track){return stableDigest([track.sourceIdentity,track.id,job.sourceRevision,ENGINE_VERSION,job.capability,job.options]);}
 function apply(job,message){
  const track=find(job.trackId);if(!requestMatches(job,message,track,state.generation))return false;
  const entry=track.analysis[scopeKey(job.scopeId,job.capability)];
  if(message.type==='progress'){entry.phase=message.phase;onChange(track);return true;}
  if(message.type==='result'||message.type==='unavailable'){
   const target=job.scopeId?track.regions.find(r=>r.id===job.scopeId):track;
   if(job.capability==='waveform')track.wave=message.result?.peaks||null;
   else if(job.capability==='suggestions'){track.candidates=message.result?.candidates||[];track.candidatesStale=false;track.candidateDiagnostics=message.result;track.featureMap={sourceRevision:track.sourceRevision,engineVersion:ENGINE_VERSION,features:message.result?.features||[]};}
   else if(job.capability==='region-audio'){}
   else {
    target.result||={tempo:{bpm:null,alternatives:[],beats:[]},keys:[]};
    if(job.capability==='tempo'){target.result.tempo=message.result||{bpm:null,alternatives:[],beats:[]};if(!job.scopeId&&track.sampleGrid?.bpmOrigin?.startsWith('inherited')&&track.sampleGrid.bpm!==resolveValues(track).bpm){track.gridStale=true;track.candidatesStale=true;track.gridRevision++;}}
    if(job.capability==='key'){target.result.keys=message.result?.keys||[];target.result.chroma=message.result?.chroma;target.result.keyEvidence=message.result?.evidence;target.result.ambiguous=message.result?.ambiguous||false;target.result.disagreement=message.result?.disagreement||false;target.result.peakEvidence=message.result?.peakEvidence||null;target.result.keyComparison=message.result?.keyComparison||null;target.result.bassEvidence=message.result?.bassEvidence||null;target.result.bassComparison=message.result?.bassComparison||null;}
    if(job.capability==='levels')target.result.quality=message.result;
    if(job.capability==='spectrum')target.result.spectrogram=message.result;
    target.result.engineVersion=ENGINE_VERSION;
   }
   entry.ranges=message.ranges||[];entry.diagnostics=message.diagnostics||{};entry.status=message.type==='result'?'ready':'unavailable';entry.reason=message.reason||null;
   entry.completedAt=performance.now();entry.elapsedMs=entry.completedAt-entry.startedAt;
   if(message.type==='result'&&job.capability!=='region-audio'){const key=cacheKey(job,track);cache.delete(key);cache.set(key,{...message,jobId:null});while(cache.size>policy.maxCacheEntries)cache.delete(cache.keys().next().value);}
   const pending=completions.get(job.jobId);if(pending)pending.response=message;refresh(track);return true;
  }
  if(message.type==='error'){const pending=completions.get(job.jobId);if(pending)pending.response=message;update(job,{status:'error',reason:message.reason});return true;}
  return false;
 }
 function request(track,{capabilities=['tempo','key','waveform'],mode='quick',scopeId=null,force=false,extraOptions={}}={}){
  const region=scopeId?track.regions.find(r=>r.id===scopeId):null;if(scopeId&&!region)return;
  const promises=[];if(force)track.analysisRefusal=null;
  for(const capability of capabilities){
   if(!['tempo','key','waveform','levels','spectrum','suggestions','region-audio'].includes(capability))continue;
   const key=scopeKey(scopeId,capability);track.analysis||={};const prior=track.analysis[key];const revision=(prior?.requestRevision||0)+1;
   const scope=region?Object.freeze({start:region.start,end:region.end}):null;
   const options=Object.freeze({...structuredClone(extraOptions),mode:mode==='verify'?'verify':'quick',scope});
   const job=Object.freeze({jobId:++serial,sessionGeneration:state.generation,trackId:track.id,sourceRevision:track.sourceRevision,scopeId,scopeRevision:region?.regionRevision||0,capability,requestRevision:revision,options});
   promises.push(new Promise(resolve=>completions.set(job.jobId,{resolve})));
   track.analysis[key]={status:'queued',requestRevision:revision,options,ranges:prior?.ranges||[],diagnostics:prior?.diagnostics||{},startedAt:performance.now(),phase:'waiting'};
   if(active?.job.trackId===track.id&&active.job.scopeId===scopeId&&active.job.capability===capability)abortWorker();
   const hit=!force&&cache.get(cacheKey(job,track));if(hit){apply(job,{...hit,...job});settle(job,completions.get(job.jobId)?.response);continue;}
   queue.push(job);
  }
  refresh(track);void pump();return Promise.all(promises);
 }
 function abortWorker(){if(!active?.finish)return;worker?.terminate();worker=null;active.finish(new Error('Cancelled'));}
 function cancel(trackId,capability=null,scopeId=undefined){
  const track=find(trackId);if(!track)return;
  for(const [key,entry] of Object.entries(track.analysis||{})){if(capability&&!key.endsWith(':'+capability))continue;if(scopeId!==undefined&&!key.startsWith((scopeId||'track')+':'))continue;if(['queued','decoding','running'].includes(entry.status)){entry.requestRevision++;entry.status='cancelled';entry.phase='cancelled';}}
  if(active?.job.trackId===trackId&&(!capability||active.job.capability===capability)&&(scopeId===undefined||active.job.scopeId===scopeId))abortWorker();
  refresh(track);
 }
 function clear(){holds.clear();held=false;for(const t of state.tracks)cancel(t.id);for(const job of queue)settle(job);queue.length=0;cache.clear();decodedOwner=null;abortWorker();}
 async function decode(job,track){
  if(track.analysisRefusal?.sourceRevision===track.sourceRevision)throw new Error(track.analysisRefusal.reason);
  const refuse=reason=>{if(valid(job))track.analysisRefusal={sourceRevision:track.sourceRevision,reason};return new Error(reason);};
  if(decodedOwner?.trackId===track.id&&decodedOwner.sourceRevision===track.sourceRevision)return decodedOwner.buffer;
  decodedOwner=null;update(job,{status:'decoding',phase:'checking source'});
  const wav=await readWavMetadata(track.file);if(!valid(job))return null;
  const metadata={...wav,duration:wav.duration||track.duration};
  const check=preflight(metadata,track.file.size,policy);track.resourceEstimate=check.estimate;track.preflightUncertain=check.uncertain;
  if(!check.allowed||check.estimate.knownPeakBytes!=null&&check.estimate.knownPeakBytes+reservedBytes>policy.totalKnownBytes)throw refuse(check.reason||'This track may be too large while a region is retained. Stop the loop and use a shorter source.');
  update(job,{status:'decoding',phase:check.uncertain?'decoding · memory estimate uncertain':'decoding'});
  const bytes=await track.file.arrayBuffer();if(!valid(job))return null;
  const context=makeContext();let buffer;
  const began=performance.now();
  try{nativeDecoding=true;buffer=await context.decodeAudioData(bytes);}catch{throw refuse("This browser couldn't decode this file. Choose another file or Retry.");}finally{try{await context.close();}finally{nativeDecoding=false;}}
  // A cancelled native decode must settle before this serialized pump starts another.
  if(!valid(job))return null;
  const decodedBytes=buffer.length*buffer.numberOfChannels*4;
  track.decodeMs=performance.now()-began;track.decodedSampleRate=buffer.sampleRate;track.channels=buffer.numberOfChannels;track.sourceSampleRate=wav.sourceSampleRate||null;track.duration=buffer.duration;
  if(buffer.numberOfChannels>2)throw refuse('Multichannel analysis is unsupported here; source playback may still work.');
  if(decodedBytes>policy.decodedBytes||decodedBytes+track.file.size+policy.analysisWindowBytes+policy.workerScratchBytes+reservedBytes>policy.totalKnownBytes)throw refuse('This track may be too large to analyze here. Use a shorter source; playback remains available when supported.');
  track.decodedBytes=decodedBytes;decodedOwner={trackId:track.id,sourceRevision:track.sourceRevision,buffer};return buffer;
 }
 function inputs(job,buffer){
  const track=find(job.trackId);
  if(job.capability==='region-audio'){
   const bounds=frameBounds(job.options.scope.start,job.options.scope.end,buffer.sampleRate,buffer.length),radius=job.options.assist?Math.round(buffer.sampleRate*.005):0,padStartFrame=Math.max(0,bounds.startFrame-radius),padEnd=Math.min(buffer.length,bounds.endFrame+radius),frames=padEnd-padStartFrame,bytes=frames*buffer.numberOfChannels*4;
   if(bytes+frames*.5>policy.regionCacheBytes||bytes*2+frames*.5+track.decodedBytes+reservedBytes+policy.workerScratchBytes>policy.totalKnownBytes)throw new Error('Region exceeds this preview/cache budget. Stop the loop or select a shorter region.');
   const channels=Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c).slice(padStartFrame,padEnd));return {input:{...bounds,channels,padStartFrame,sourceLength:buffer.length,fades:job.options.fades,assist:job.options.assist},transfer:channels.map(c=>c.buffer)};
  }
  if(job.capability==='suggestions'){
   if(track.featureMap?.sourceRevision===track.sourceRevision&&track.featureMap.engineVersion===ENGINE_VERSION)return {input:{features:track.featureMap.features,duration:track.duration,settings:job.options.settings},transfer:[]};
   let chosen=0,bestEnergy=-1;for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);let energy=0;for(let p=0;p<buffer.length;p+=Math.max(1,Math.floor(buffer.length/2048)))energy+=data[p]*data[p];if(energy>bestEnergy){bestEnergy=energy;chosen=c;}}
   const source=buffer.getChannelData(chosen),bucketFrames=Math.round(buffer.sampleRate*.25),buckets=Math.max(1,Math.min(64,Math.floor(policy.featureChunkBytes/(bucketFrames*4)))),chunkFrames=buckets*bucketFrames;let offset=0;
   const next=()=>{const end=Math.min(buffer.length,offset+chunkFrames),samples=source.slice(offset,end),input={stream:true,samples,sampleRate:buffer.sampleRate,bucketFrames,offset,last:end===buffer.length,duration:buffer.duration,settings:{...job.options.settings,featureChannel:chosen}};offset=end;return {input,transfer:[samples.buffer]};};return {next};
  }

  if(job.capability==='waveform'){const input=waveformInput(buffer,policy);return {input,transfer:input.channels.map(c=>c.buffer)};}
  if(job.capability==='levels'){
   const scope=job.options.scope||{start:0,end:buffer.duration},start=Math.max(0,Math.round(scope.start*buffer.sampleRate)),end=Math.min(buffer.length,Math.round(scope.end*buffer.sampleRate));
   const size=(end-start)*buffer.numberOfChannels*4;
   if(size+buffer.length*buffer.numberOfChannels*4+policy.workerScratchBytes>policy.totalKnownBytes)throw new Error('Level scan needs more memory than this budget allows. Analyze a shorter region.');
   const channels=Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c).slice(start,end));
   return {input:{channels,sampleRate:buffer.sampleRate,ranges:[{start:start/buffer.sampleRate,end:end/buffer.sampleRate}]},transfer:channels.map(c=>c.buffer)};
  }
  const input=windowInputs(buffer,job.options,policy);
  input.analysisMode=job.options.mode;
  if(job.capability==='spectrum'){input.windows=input.windows.slice(0,1);input.ranges=input.ranges.slice(0,1);}
  return {input,transfer:input.windows.map(w=>w.samples.buffer)};
 }
 async function execute(job,buffer){
  const prepared=inputs(job,buffer);let {input,transfer}=prepared.next?prepared.next():prepared;if(!valid(job))return;
  update(job,{status:'running',phase:'analyzing '+job.capability});
  worker||=makeWorker();const owner=worker;
  await new Promise((resolve,reject)=>{
   let ended=false;const timer=setTimeout(()=>{owner.terminate();if(worker===owner)worker=null;finish(new Error('Analysis timed out. Retry Quick or use a shorter source.'));},policy.jobTimeoutMs);
   function finish(error){if(ended)return;ended=true;clearTimeout(timer);owner.onmessage=null;owner.onerror=null;if(active?.job===job)active=null;error?reject(error):resolve();}
   active={job,finish};owner.onmessage=({data})=>{if(data.jobId===job.jobId&&!valid(job)){finish();return;}if(!requestMatches(job,data,find(job.trackId),state.generation))return;if(data.type==='progress'){apply(job,data);if(data.nextChunk&&prepared.next){const next=prepared.next();try{owner.postMessage({...job,input:next.input,engineVersion:ENGINE_VERSION},next.transfer);}catch{finish(new Error('Feature chunk transfer failed.'));}}return;}apply(job,data);finish();};
   owner.onerror=e=>{owner.terminate();if(worker===owner)worker=null;finish(new Error(e.message||'Analysis worker failed. Retry this capability.'));};
   try{owner.postMessage({...job,input,engineVersion:ENGINE_VERSION},transfer);}catch{owner.terminate();if(worker===owner)worker=null;finish(new Error('This browser could not transfer the bounded analysis buffers. Retry or use another browser.'));}
  });
 }
 async function pump(){if(pumping)return;pumping=true;
  try{while(queue.length){
   if(held&&!queue.some(j=>j.capability==='region-audio'))break;
   queue.sort((a,b)=> (held?Number(b.capability==='region-audio')-Number(a.capability==='region-audio'):0)||(b.trackId===state.selectedId)-(a.trackId===state.selectedId)||a.jobId-b.jobId);const job=queue.shift();if(!valid(job)){settle(job);continue;}
   const track=find(job.trackId);active={job};
   try{const compact=job.capability==='suggestions'&&track.featureMap?.sourceRevision===track.sourceRevision&&track.featureMap.engineVersion===ENGINE_VERSION;const buffer=compact?null:await decode(job,track);if(!compact&&!buffer||!valid(job))continue;await execute(job,buffer);}catch(error){if(valid(job))update(job,{status:error.message.includes('too large')||error.message.includes('Multichannel')?'unavailable':'error',reason:error.message});}finally{if(active?.job===job)active=null;trace.push({capability:job.capability,elapsedMs:performance.now()-(track.analysis?.[scopeKey(job.scopeId,job.capability)]?.startedAt||performance.now()),status:track.analysis?.[scopeKey(job.scopeId,job.capability)]?.status});if(job.capability==='region-audio')decodedOwner=null;const pending=completions.get(job.jobId);settle(job,pending?.response||{type:valid(job)?'error':'cancelled',reason:track.error||'Request no longer matches this source or region.'});if(trace.length>80)trace.shift();}
  }}finally{pumping=false;decodedOwner=null;}
 }
 return {request,cancel,clear,hold:(value,reason='manual')=>{if(value)holds.add(reason);else holds.delete(reason);held=holds.size>0;if(!held)void pump();},reserve:bytes=>{reservedBytes=Math.max(0,bytes);},diagnostics:()=>({engineVersion:ENGINE_VERSION,budgets:policy,backgroundHeld:held,reservedRegionBytes:reservedBytes,decodeInFlight:nativeDecoding,activeCapability:active?.job.capability||null,queued:queue.filter(valid).length,cacheEntries:cache.size,trace:[...trace],nativeOverhead:'unknown'}),apply};
}
