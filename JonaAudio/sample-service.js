import {state,resolveValues,dispatch,subscribe} from './store.js';
import {ENGINE_VERSION,RESOURCE_POLICY} from './config.js';
import {regionAudioKey,sanitizedFilename} from './sample-model.js';
import {createLoopPlayer} from './loop-player.js';
import {resolveTuning} from './tuning-state.js';
export function createSampleService({jobs,transport,onChange=()=>{},makeExportWorker=()=>new Worker(new URL('./export-worker.js',import.meta.url),{type:'module'}),makeLoopContext}={}){
 let audio=null,preparing=null,token=0,exportSerial=0,encoder=null,exportFinish=null,loopRequest=0;
 let exportState={status:'idle'},phase='idle';
 const find=(id,regionId)=>{const track=state.tracks.find(t=>t.id===id),region=track?.regions.find(r=>r.id===regionId);return {track,region};};
 const key=(t,r)=>regionAudioKey(t,r,state.generation);
 const metaKey=(t,r)=>JSON.stringify([key(t,r),r.label,r.corrections,r.tuningSetup,t.sampleGrid,t.gridStale,resolveValues(t,r.id),resolveTuning(t,r.id).summary]);
 const loop=createLoopPlayer({...(makeLoopContext?{makeContext:makeLoopContext}:{}),onChange:()=>{jobs.reserve((audio?audio.channels.reduce((s,c)=>s+c.byteLength,0)+audio.pyramid.reduce((s,l)=>s+l.min.byteLength+l.max.byteLength,0):0)+loop.retainedBytes+(exportState.file?.size||0));transport.notifyLoop?.();onChange();}});
 const invalidateExport=()=>{if(exportState.status==='ready'){const {track,region}=find(exportState.trackId,exportState.regionId);if(!track||!region||exportState.signature!==metaKey(track,region)){exportState.status='stale';onChange();}}};
 async function prepare(trackId,regionId,{assist=false}={}){
  const {track,region}=find(trackId,regionId);if(!region)return null;const signature=key(track,region);
  if(!assist&&audio?.audioKey===signature)return audio;
  if(!assist&&preparing?.signature===signature)return preparing.promise;
  if(!loop.active){audio=null;jobs.reserve(exportState.file?.size||0);}
  const revision=++token;phase=assist?'adjusting edges':'preparing region';onChange();
  preparing={signature,promise:null};
  const promise=(async()=>{
   const replies=await jobs.request(track,{capabilities:['region-audio'],scopeId:regionId,force:true,extraOptions:{fades:region.fades||{inMs:5,outMs:5},assist}});const reply=replies?.[0];
   const current=find(trackId,regionId);if(revision!==token||!current.region||key(current.track,current.region)!==signature){if(revision===token){phase='Region changed — prepare the latest selection.';onChange();}return null;}
   if(reply?.type!=='result'){phase=reply?.reason||'Region preparation cancelled.';onChange();return null;}
   const result=reply.result;
   if(assist&&(result.start!==region.start||result.end!==region.end)){dispatch({type:'region',trackId,region:{id:regionId,start:result.start,end:result.end}});}
   const actual=find(trackId,regionId);audio={...result,trackId,regionId,audioKey:key(actual.track,actual.region)};phase='region ready';jobs.reserve(audio.channels.reduce((s,c)=>s+c.byteLength,0)+audio.pyramid.reduce((s,l)=>s+l.min.byteLength+l.max.byteLength,0)+loop.retainedBytes+(exportState.file?.size||0));onChange();return audio;
  })();preparing={signature,promise};try{return await promise;}finally{if(revision===token)preparing=null;}
 }
 async function startLoop(trackId,regionId){const operation=++loopRequest;jobs.hold(true,'loop');const prepared=await prepare(trackId,regionId);if(!prepared||operation!==loopRequest){if(operation===loopRequest&&!loop.active)jobs.hold(false,'loop');return false;}const {track,region}=find(trackId,regionId);if(!region||key(track,region)!==prepared.audioKey){jobs.hold(false,'loop');return false;}transport.activateLoop(loop,()=>{loopRequest++;jobs.hold(false,'loop');});jobs.hold(true,'loop');const ok=await loop.start(track,prepared);if(operation!==loopRequest)return false;if(!ok){transport.releaseLoop(loop);jobs.hold(false,'loop');phase='Loop could not start. Tap again to resume audio.';onChange();}return ok;}
 function stopLoop(){loopRequest++;const wasActive=loop.active,source=loop.owner;transport.releaseLoop(loop);loop.stop();if(wasActive&&source&&state.tracks.includes(source))transport.select(source);jobs.hold(false,'loop');}
 function clear(){token++;exportSerial++;preparing=null;stopLoop();audio=null;jobs.hold(false,'export');if(encoder)encoder.terminate();encoder=null;exportFinish?.({type:'cancelled'});exportFinish=null;exportState={status:'idle'};phase='idle';jobs.reserve(0);onChange();}
 async function prepareWav(trackId,regionId){
  const exportId=++exportSerial;invalidateExport();jobs.hold(true,'export');const prepared=await prepare(trackId,regionId);if(!prepared){jobs.hold(false,'export');return;}
  const {track,region}=find(trackId,regionId);if(exportId!==exportSerial||!region||key(track,region)!==prepared.audioKey){jobs.hold(false,'export');return;}
  const signature=metaKey(track,region);
  jobs.hold(true,'export');if(encoder){encoder.terminate();exportFinish?.({type:'cancelled'});}exportState={status:'preparing',trackId,regionId,signature};onChange();
  try{
   const bytes=44+prepared.frames*prepared.channels.length*2;if(bytes>RESOURCE_POLICY.exportBytes)throw new Error('WAV exceeds the export budget. Select a shorter region.');
   const channels=prepared.channels.map(c=>c.slice());encoder=makeExportWorker();const owner=encoder;
   const result=await new Promise(resolve=>{let ended=false;const timer=setTimeout(()=>{owner.terminate();finish({type:'error',reason:'WAV preparation timed out.'});},RESOURCE_POLICY.jobTimeoutMs);const finish=response=>{if(ended)return;ended=true;clearTimeout(timer);if(encoder===owner)encoder=null;exportFinish=null;owner.terminate();resolve(response);};exportFinish=finish;owner.onmessage=({data})=>{if(data.exportId===exportId&&data.signature===signature)finish(data);};owner.onerror=()=>finish({type:'error',reason:'WAV worker failed. Retry preparation.'});try{owner.postMessage({exportId,signature,channels,sampleRate:prepared.sampleRate,maxBytes:RESOURCE_POLICY.exportBytes},channels.map(c=>c.buffer));}catch{finish({type:'error',reason:'WAV buffer transfer failed.'});}});
   const latest=find(trackId,regionId);if(exportId!==exportSerial||!latest.region||metaKey(latest.track,latest.region)!==signature){if(exportId===exportSerial)exportState={status:'stale'};return;}
   if(result.type!=='ready')throw new Error(result.reason||'WAV preparation cancelled.');
   const values=resolveValues(track,regionId),filename=sanitizedFilename(track.name,region,values),tuning=resolveTuning(track,regionId);
   const sidecar={schemaVersion:1,engineVersion:ENGINE_VERSION,source:{name:track.name,identity:track.sourceIdentity,sourceRevision:track.sourceRevision,fingerprint:track.fingerprint||null,fingerprintStatus:track.fingerprint?'available':'not computed'},region:{id:regionId,label:region.label||null,startSec:prepared.start,endSec:prepared.end,startFrame:prepared.startFrame,endFrame:prepared.endFrame,frames:prepared.frames,durationSec:prepared.frames/prepared.sampleRate},decodedSampleRate:prepared.sampleRate,channels:prepared.channels.length,encoding:result.encoding,fades:prepared.actualFades,requestedFades:region.fades,automatic:{bpm:region.result?.tempo?.bpm??null,key:region.result?.keys?.[0]?.key??null},manual:region.corrections,effective:values,grid:{...track.sampleGrid,stale:!!track.gridStale},chosenTuningReference:tuning.reference,tuningSetup:tuning.setup,warnings:result.outOfRange?[`${result.outOfRange} out-of-range channel samples saturate during PCM16 quantization`]:[],outOfRangeSamples:result.outOfRange,previewOnly:['playback gain','playback speed','reference notes','metronome'],createdAt:new Date().toISOString()};
   exportState={status:'ready',trackId,regionId,signature,filename,file:new File([result.buffer],filename,{type:'audio/wav'}),sidecar,sidecarFile:new File([JSON.stringify(sidecar,null,2)],filename.replace(/\.wav$/,'.json'),{type:'application/json'}),saturationAccepted:result.outOfRange===0};onChange();
  }catch(error){if(exportId===exportSerial){exportState={status:'error',reason:error.message};onChange();}}finally{jobs.hold(false,'export');}
 }
 function download(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 function cancelExport(){exportSerial++;encoder?.terminate();encoder=null;exportFinish?.({type:'cancelled'});exportFinish=null;if(exportState.status==='preparing')exportState={status:'cancelled'};jobs.hold(false,'export');onChange();}
 async function share(){invalidateExport();if(exportState.status!=='ready'||!exportState.saturationAccepted)return {type:'unavailable'};const files=[exportState.file,exportState.sidecarFile];if(!navigator.canShare?.({files})||!navigator.share)return {type:'unsupported'};try{await navigator.share({files,title:exportState.filename});return {type:'share-opened'};}catch(error){return {type:error.name==='AbortError'?'cancelled':'error'};}}
 subscribe(()=>{
  invalidateExport();if(loop.active&&audio){const current=find(audio.trackId,audio.regionId);if(!current.region){stopLoop();return;}const signature=key(current.track,current.region);if(signature!==loop.audioKey&&preparing?.signature!==signature){void prepare(audio.trackId,audio.regionId).then(result=>{if(result&&loop.active&&find(result.trackId,result.regionId).region&&key(find(result.trackId,result.regionId).track,find(result.trackId,result.regionId).region)===result.audioKey)loop.swap(result);});}}
 });
 return {prepare,startLoop,stopLoop,prepareWav,cancelExport,discardExport:()=>{cancelExport();exportState={status:'idle'};jobs.reserve((audio?audio.channels.reduce((s,c)=>s+c.byteLength,0)+audio.pyramid.reduce((s,l)=>s+l.min.byteLength+l.max.byteLength,0):0)+loop.retainedBytes);onChange();},clear,share,downloadWav:()=>{invalidateExport();if(exportState.status==='ready'&&exportState.saturationAccepted)download(exportState.file);},downloadSidecar:()=>{invalidateExport();if(exportState.status==='ready')download(exportState.sidecarFile);},acceptSaturation:value=>{exportState.saturationAccepted=!!value;onChange();},get audio(){return audio;},get phase(){return phase;},get loop(){return loop;},get exportState(){invalidateExport();return exportState;}};
}
