import {RESOURCE_POLICY} from './config.js';
// Bounded WAV header inspection never reads the encoded source in full.
export async function readWavMetadata(file){
 const buffer=await file.slice(0,65536).arrayBuffer(),v=new DataView(buffer);
 const str=(p,n)=>p+n<=v.byteLength?String.fromCharCode(...new Uint8Array(buffer,p,n)):'';
 if(str(0,4)!=='RIFF'||str(8,4)!=='WAVE')return {};
 let channels,sourceSampleRate,byteRate,dataBytes;
 for(let p=12;p+8<=v.byteLength;){const type=str(p,4),length=v.getUint32(p+4,true),start=p+8;
  if(type==='fmt '&&length>=16&&start+16<=v.byteLength){channels=v.getUint16(start+2,true);sourceSampleRate=v.getUint32(start+4,true);byteRate=v.getUint32(start+8,true);}
  if(type==='data'){dataBytes=Math.min(length,Math.max(0,file.size-start));break;}
  p=start+length+(length%2);
 }
 return {channels,sourceSampleRate,duration:byteRate>0&&dataBytes!=null?dataBytes/byteRate:undefined};
}
export function candidateRanges(duration,mode='quick',scope={start:0,end:duration}){
 scope||={start:0,end:duration};
 const start=Math.max(0,scope.start||0),end=Math.min(duration,scope.end??duration),length=end-start,seconds=mode==='verify'?24:12;
 if(!(length>0))return [];
 const width=Math.min(seconds,length),span=length-width;
 const fractions=mode==='verify'?[0,.25,.5,.75,1]:[0,.5,1,.25,.75];
 const ranges=[];
 for(const f of fractions){const s=start+span*f;if(!ranges.some(r=>Math.abs(r.start-s)<width*.45))ranges.push({start:s,end:s+width});}
 return ranges.slice(0,5);
}
function sampledEnergy(decoded,range){
 const start=Math.floor(range.start*decoded.sampleRate),end=Math.min(decoded.length,Math.ceil(range.end*decoded.sampleRate));
 const energies=[];for(let c=0;c<decoded.numberOfChannels;c++){const samples=decoded.getChannelData(c);let sum=0,n=0;const stride=Math.max(1,Math.floor((end-start)/2048));for(let p=start;p<end;p+=stride){sum+=samples[p]*samples[p];n++;}energies.push(n?sum/n:0);}
 const energy=energies.reduce((a,b)=>a+b,0)/Math.max(1,energies.length);
 return {rmsDb:energy>0?10*Math.log10(energy):null,channel:energies.indexOf(Math.max(...energies)),energy};
}
export function windowInputs(decoded,options,policy=RESOURCE_POLICY){
 let bytes=0;const windows=[],ranges=[];const max=options.mode==='verify'?5:3;
 for(const range of candidateRanges(decoded.duration,options.mode,options.scope)){
  const energy=sampledEnergy(decoded,range);
  if(!energy.energy||(options.mode!=='verify'&&energy.rmsDb<policy.nearSilenceDb))continue;
  const available=Math.floor((policy.analysisWindowBytes-bytes)/4),startFrame=Math.floor(range.start*decoded.sampleRate),frames=Math.min(available,Math.ceil((range.end-range.start)*decoded.sampleRate),decoded.length-startFrame);
  if(frames<Math.min(decoded.sampleRate*.1,4096))break;
  // A strongest-channel analysis copy prevents opposite-polarity stereo cancellation.
  const samples=decoded.getChannelData(energy.channel).slice(startFrame,startFrame+frames);
  const actual={start:startFrame/decoded.sampleRate,end:(startFrame+frames)/decoded.sampleRate,rmsDb:energy.rmsDb,channel:energy.channel};
  windows.push({samples,sampleRate:decoded.sampleRate,...actual});ranges.push(actual);bytes+=samples.byteLength;if(windows.length===max)break;
 }
 return {windows,ranges,bytes};
}
export function waveformInput(decoded,policy=RESOURCE_POLICY){
 const per=policy.waveformSamplesPerBucket,buckets=policy.waveformBuckets,channels=[];
 for(let c=0;c<decoded.numberOfChannels;c++){const source=decoded.getChannelData(c),samples=new Float32Array(buckets*per);for(let b=0;b<buckets;b++){const a=Math.floor(b*decoded.length/buckets),end=Math.max(a+1,Math.floor((b+1)*decoded.length/buckets));for(let j=0;j<per;j++)samples[b*per+j]=source[Math.min(decoded.length-1,a+Math.floor((end-a)*j/per))];}channels.push(samples);}
 return {channels,buckets,per,method:'sparse overview; brief peaks may be missed'};
}
