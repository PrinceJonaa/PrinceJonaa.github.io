const MiB=1024*1024;
export const ENGINE_VERSION='jona-dsp-2.7.0-selective-tempo';
export const RESOURCE_POLICY=Object.freeze({maxTracks:80,maxFileBytes:125*MiB,decodedBytes:128*MiB,decodedUpperCeiling:256*MiB,totalKnownBytes:192*MiB,analysisWindowBytes:24*MiB,workerScratchBytes:8*MiB,regionCacheBytes:16*MiB,exportBytes:64*MiB,decodeSampleRate:44100,nearSilenceDb:-70,jobTimeoutMs:120000,metadataTimeoutMs:4000,waveformBuckets:1200,waveformSamplesPerBucket:16,maxCacheEntries:256,featureChunkBytes:4*MiB});
export function allocationEstimate({duration,channels=2,rate=RESOURCE_POLICY.decodeSampleRate,encodedBytes=0,windowBytes=RESOURCE_POLICY.analysisWindowBytes,scratchBytes=RESOURCE_POLICY.workerScratchBytes}) {
 const decodedBytes=Number.isFinite(duration)&&duration>0?Math.ceil(duration*rate*channels*4):null;
 return {decodedBytes,encodedBytes,windowBytes,knownPeakBytes:decodedBytes==null?null:decodedBytes+encodedBytes+windowBytes+scratchBytes,nativeOverhead:'unknown'};
}
export function preflight(metadata,encodedBytes,policy=RESOURCE_POLICY){
 const estimate=allocationEstimate({...metadata,rate:policy.decodeSampleRate,encodedBytes,windowBytes:policy.analysisWindowBytes,scratchBytes:policy.workerScratchBytes});
 if(metadata.channels>2)return {allowed:false,reason:'Multichannel analysis is unsupported here; source playback may still work.',estimate};
 if(estimate.decodedBytes!=null&&(estimate.decodedBytes>policy.decodedBytes||estimate.knownPeakBytes>policy.totalKnownBytes))return {allowed:false,reason:'This track may be too large to analyze here. Use a shorter source; playback remains available when supported.',estimate};
 return {allowed:true,uncertain:estimate.decodedBytes==null||!metadata.channels,estimate};
}
