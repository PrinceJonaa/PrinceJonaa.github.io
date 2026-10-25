import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTempoMidi} from '../tempo-midi.js';
test('MIDI export stores standard format-0 tempo and 4/4 signature with valid event sizes',()=>{
 const bytes=makeTempoMidi(150);
 const b=new DataView(bytes.buffer);
 assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'MThd');
 assert.equal(b.getUint32(4,false),6);
 assert.equal(b.getUint16(8,false),0);
 assert.equal(b.getUint16(10,false),1);
 assert.equal(b.getUint16(12,false),480);
 assert.equal(new TextDecoder().decode(bytes.slice(14,18)),'MTrk');
 assert.equal(b.getUint32(18,false),bytes.length-22);
 assert.equal(bytes.at(-4),0);
 assert.deepEqual([...bytes.slice(-3)],[255,47,0]);
 // Expected meta track name: length exactly 15, not 16.
 assert.deepEqual([...bytes.slice(22,26)],[0,255,3,15]);
 assert.equal(new TextDecoder().decode(bytes.slice(26,41)),'JonaAudio tempo');
 // tempo meta after track name
 assert.deepEqual([...bytes.slice(41,45)],[0,255,81,3]);
 const micros=(bytes[45]<<16)|(bytes[46]<<8)|bytes[47];
 assert.equal(micros,400000);
 assert.deepEqual([...bytes.slice(48,56)],[0,255,88,4,4,2,24,8]);
});
test('BPM and meter validation never fabricate MIDI for unsafe values',()=>{
 for(const bad of [0,-90,Infinity,NaN,401,19])assert.throws(()=>makeTempoMidi(bad));
 assert.throws(()=>makeTempoMidi(120,{denominator:3}));
 assert.throws(()=>makeTempoMidi(120,{numerator:0}));
 assert.equal(makeTempoMidi(94,{numerator:3,denominator:8})[54],3);
});
