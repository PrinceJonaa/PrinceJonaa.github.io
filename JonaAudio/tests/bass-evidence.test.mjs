import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateBassEvidence,compareBassToKeys} from '../bass-evidence.js';
import {analyzeCapability} from '../analysis-worker-core.js';
import {synthKeyFixture} from '../bench/fixtures.mjs';
test('bass profile cannot invent a tonic from silence or a brief clip',()=>{
 const p=estimateBassEvidence(new Float32Array(3000),11025,[{start:0,end:.25}]);
 assert.equal(p.status,'unavailable');
 assert.deepEqual(p.notes,[]);
});
test('bass analysis reports ranked low notes as hints, never a confirmed tonic',()=>{
 const fixture=synthKeyFixture(9,'minor','development');
 const p=estimateBassEvidence(fixture.samples,fixture.sampleRate,[{start:0,end:fixture.duration}],{maxFrames:12});
 assert.equal(p.status,'experimental');
 assert.ok(p.frames<=12);
 assert.ok(p.notes.every(n=>n.weight>0&&n.weight<=1&&n.pitchClass>=0&&n.pitchClass<12));
 assert.match(p.warning,/not verified key or tonic/);
 const compare=compareBassToKeys([{key:'A minor'},{key:'C major'}],p);
 assert.equal(compare.status,'review');
 assert.equal(compare.candidates.length,2);
 assert.match(compare.caveat,/not proof/i);
});
test('verify mode attaches bass clue without altering the original FFT key',()=>{
 const fixture=synthKeyFixture(9,'minor','development');
 const w={samples:fixture.samples,sampleRate:fixture.sampleRate,start:0,end:fixture.duration};
 const input={windows:[w],ranges:[{start:0,end:fixture.duration}]};
 const quick=analyzeCapability('key',{...input,analysisMode:'quick'});
 const verify=analyzeCapability('key',{...input,analysisMode:'verify'});
 assert.equal(quick.result.bassEvidence,null);
 assert.equal(verify.result.keys[0].key,quick.result.keys[0].key);
 assert.ok(['experimental','unavailable'].includes(verify.result.bassEvidence.status));
});
