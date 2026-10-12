import {analyzeCapability} from './analysis-worker-core.js';
self.onmessage=({data})=>{
 const {jobId,sessionGeneration,trackId,sourceRevision,scopeId,scopeRevision,capability,requestRevision}=data;
 const envelope={jobId,sessionGeneration,trackId,sourceRevision,scopeId,scopeRevision,capability,requestRevision};
 try{
  self.postMessage({...envelope,type:'progress',phase:'analyzing '+capability});
  const response=analyzeCapability(capability,data.input);
  const transfer=response.result?.peaks?[response.result.peaks.buffer]:[];
  self.postMessage({...envelope,...response},transfer);
 }catch(error){self.postMessage({...envelope,type:'error',reason:error?.message||'Analysis failed. Retry this capability.'});}
};
