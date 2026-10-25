import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {decodeLocalWav} from '../bench/wav-loader.mjs';
import {windowInputs} from '../analysis-input.js';
import {analyzeCapability} from '../analysis-worker-core.js';

function pcm16(){
 const buf=Buffer.alloc(44+44100*2);
 buf.write('RIFF',0);buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);
 buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(44100,24);
 buf.writeUInt32LE(88200,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);
 buf.write('data',36);buf.writeUInt32LE(88200,40);
 for(let i=0;i<44100;i++)buf.writeInt16LE(Math.round(16000*Math.sin(2*Math.PI*220*i/44100)),44+i*2);
 return buf;
}
test('private WAV loader decodes PCM16 and feeds existing bounded analysis policy',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jona-wav-')),file=join(dir,'sample.wav');
 try{
  writeFileSync(file,pcm16());
  const data=decodeLocalWav(file);
  assert.equal(data.sampleRate,44100);assert.equal(data.duration,1);assert.equal(data.numberOfChannels,1);
  assert.ok(Math.abs(data.getChannelData(0)[1000])<=1);
  const windows=windowInputs(data,{mode:'verify'});
  assert.equal(windows.windows.length,1);
  assert.equal(analyzeCapability('key',{...windows,analysisMode:'verify'}).type,'result');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('malformed or unsupported input is refused without trying to guess audio',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jona-wav-')),file=join(dir,'not-wav');
 try{writeFileSync(file,Buffer.alloc(50));assert.throws(()=>decodeLocalWav(file),/RIFF/);}
 finally{rmSync(dir,{recursive:true,force:true});}
});
