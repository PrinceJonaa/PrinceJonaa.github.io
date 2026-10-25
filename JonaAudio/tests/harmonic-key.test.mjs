import test from 'node:test';
import assert from 'node:assert/strict';
import {spectralPeakProfile,analyzePeakKey,compareKeyFamilies} from '../harmonic-key.js';
import {analyzeCapability} from '../analysis-worker-core.js';
import {synthKeyFixture} from '../bench/fixtures.mjs';

test('peak detector refuses silence, short files and invalid inputs rather than fabricating a key',()=>{
 for(const input of [new Float32Array(0),new Float32Array(11025),null]){
  const p=spectralPeakProfile(input,11025,[{start:0,end:1}]);
  assert.equal(p.chroma,null);
  assert.ok(p.reason);
 }
});

test('tonal chord audio generates a bounded experimental key ranking with measured evidence',()=>{
 const x=synthKeyFixture(7,'minor');
 const p=analyzePeakKey(x.samples,x.sampleRate,[{start:0,end:x.duration}],{maxFrames:10});
 assert.equal(p.status,'experimental');
 assert.ok(p.keys.length>=3);
 assert.ok(p.frames<=10);
 assert.equal(p.chroma.length,12);
 assert.ok(p.peaks>0);
 assert.ok(Number.isFinite(p.tuningCents));
});

test('comparison does not fabricate agreement when one evidence family abstains',()=>{
 assert.equal(compareKeyFamilies([{key:'G minor'}],{keys:[]}).status,'unavailable');
 assert.equal(compareKeyFamilies([{key:'G minor'}],{keys:[{key:'G minor'}]}).status,'agreement');
 assert.equal(compareKeyFamilies([{key:'G minor'}],{keys:[{key:'C minor'}]}).status,'disagreement');
});

test('Quick leaves additional profile unloaded; Verify attaches bounded cross-check and sections',()=>{
 const x=synthKeyFixture(0,'major'),w={samples:x.samples,sampleRate:x.sampleRate,start:0,end:x.duration};
 const input={windows:[w],ranges:[{start:0,end:x.duration}]};
 const quick=analyzeCapability('key',{...input,analysisMode:'quick'});
 const verify=analyzeCapability('key',{...input,analysisMode:'verify'});
 assert.equal(quick.type,'result');
 assert.equal(quick.result.peakEvidence,null);
 assert.equal(quick.result.keyComparison,null);
 assert.equal(verify.type,'result');
 assert.equal(verify.result.peakEvidence.method,'spectral-peaks-experimental-0.1.0');
 assert.ok(Array.isArray(verify.result.peakEvidence.sections));
 assert.ok(['agreement','disagreement','unavailable'].includes(verify.result.keyComparison.status));
 assert.equal(verify.result.keys[0].key,quick.result.keys[0].key,'experimental engine never mutates baseline key');
});

test('separate full-spectrum and peak-profile estimates are still explicitly uncalibrated',()=>{
 const x=synthKeyFixture(5,'major','challenge');
 const v=analyzeCapability('key',{windows:[{samples:x.samples,sampleRate:x.sampleRate,start:0,end:x.duration}],analysisMode:'verify',ranges:[]});
 assert.equal(v.diagnostics.scores,'raw similarity/autocorrelation; not probabilities');
 assert.equal(v.result.peakEvidence.scores,'uncalibrated');
});
