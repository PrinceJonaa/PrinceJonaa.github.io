// Private local benchmarking: bounded PCM WAV decoding, no network API and no uploads.
import {readFileSync} from 'node:fs';
const MAX_BYTES=125*1024*1024;
export function decodeLocalWav(path) {
 const data=readFileSync(path);
 if(data.length<44||data.length>MAX_BYTES)throw Error('WAV must be between 44 bytes and 125 MiB');
 if(data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE')throw Error('Expected RIFF/WAVE');
 let format=null,pcm=null;
 for(let p=12;p+8<=data.length;){
  const name=data.toString('ascii',p,p+4),size=data.readUInt32LE(p+4),start=p+8;
  if(start+size>data.length)throw Error('Truncated WAV chunk '+name);
  if(name==='fmt '){
   if(size<16)throw Error('Invalid WAV format');
   format={code:data.readUInt16LE(start),channels:data.readUInt16LE(start+2),
    sampleRate:data.readUInt32LE(start+4),blockAlign:data.readUInt16LE(start+12),bits:data.readUInt16LE(start+14)};
  }
  if(name==='data')pcm={start,size};
  p=start+size+(size%2);
 }
 if(!format||!pcm||!Number.isFinite(format.sampleRate)||format.sampleRate<8000||format.sampleRate>192000)throw Error('Incomplete WAV');
 if(format.channels<1||format.channels>2||![1,3].includes(format.code)||
    !(format.code===1&&format.bits===16||format.code===3&&format.bits===32))throw Error('Only mono/stereo PCM16 or Float32 WAV supported. Export a WAV copy locally.');
 const bytes=format.bits/8;
 if(format.blockAlign!==format.channels*bytes)throw Error('Unsupported interleaved WAV layout');
 const frames=Math.floor(pcm.size/format.blockAlign),channels=Array.from({length:format.channels},()=>new Float32Array(frames)),view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 for(let i=0;i<frames;i++)for(let c=0;c<format.channels;c++){
  const offset=pcm.start+i*format.blockAlign+c*bytes;
  channels[c][i]=format.code===1?view.getInt16(offset,true)/32768:view.getFloat32(offset,true);
 }
 return {sampleRate:format.sampleRate,duration:frames/format.sampleRate,length:frames,numberOfChannels:format.channels,
  getChannelData:c=>channels[c]};
}
