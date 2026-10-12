import {analyzeCapability} from './analysis-worker-core.js';
import {describeChunk,rankCandidates} from './sample-candidates.js';
let stream=null;
self.onmessage=({data})=>{
 const {jobId,sessionGeneration,trackId,sourceRevision,scopeId,scopeRevision,capability,requestRevision}=data;
 const envelope={jobId,sessionGeneration,trackId,sourceRevision,scopeId,scopeRevision,capability,requestRevision};
 try{
  let response;
  if(data.input.stream){
   const input=data.input;if(!stream||stream.jobId!==jobId)stream={jobId,features:[]};
   stream.features.push(...describeChunk(input.samples,input.sampleRate,input.offset,input.bucketFrames,stream.features.at(-1)?.lastRms||0));
   if(!input.last){self.postMessage({...envelope,type:'progress',phase:'Scanning coarse features',nextChunk:true});return;}
   response={type:'result',result:{...rankCandidates(stream.features,input.duration,input.settings),features:stream.features},ranges:[{start:0,end:input.duration}]};stream=null;
  }else{self.postMessage({...envelope,type:'progress',phase:'analyzing '+capability});response=analyzeCapability(capability,data.input);}
  const transfer=response.result?.peaks?[response.result.peaks.buffer]:response.result?.channels?response.result.channels.map(c=>c.buffer):[];
  if(response.result?.pyramid)for(const level of response.result.pyramid)transfer.push(level.min.buffer,level.max.buffer);
  self.postMessage({...envelope,...response},transfer);
 }catch(error){stream=null;self.postMessage({...envelope,type:'error',reason:error?.message||'Analysis failed. Retry this capability.'});}
};
