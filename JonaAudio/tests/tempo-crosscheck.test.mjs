import test from 'node:test';
import assert from 'node:assert/strict';
import {spectralFluxCandidates,compareTempoFamilies} from '../tempo-crosscheck.js';
import {analyzeCapability} from '../analysis-worker-core.js';
import {synthTempoFixture} from '../bench/fixtures.mjs';

test('silence and short samples cannot produce a fake spectral-flux BPM',()=>{
 for(const samples of [null,new Float32Array(0),new Float32Array(1000),new Float32Array(11025*5)]) {
  assert.equal(spectralFluxCandidates(samples,11025).status,'unavailable');
 }
});

test('accented click input produces bounded experimental candidates without a calibrated confidence percent',()=>{
 const sample=synthTempoFixture(120,{duration:12});
 const result=spectralFluxCandidates(sample.samples,sample.sampleRate);
 assert.equal(result.status,'experimental');
 assert.ok(result.candidates.length>=1&&result.candidates.length<=6);
 assert.ok(result.candidates.every(c=>Number.isFinite(c.score)&&c.bpm>=55&&c.bpm<=210));
 assert.match(result.scores,/uncalibrated/i);
});

test('pulse comparisons distinguish near, half/double and triplet-style disagreements',()=>{
 const cases=[
  [120,121,'near-same'],
  [120,60,'half-time'],
  [75,150,'double-time'],
  [96,144,'three-to-two'],
  [136,91,'two-to-three'],
  [91,161,'different-pulse']
 ];
 for(const [base,flux,expected] of cases) {
  const c=compareTempoFamilies({bpm:base},{candidates:[{bpm:flux,score:.7}]});
  assert.equal(c.relation,expected,JSON.stringify({base,flux}));
  assert.equal(c.status,expected==='near-same'?'agreement':'review');
 }
});

test('Verify adds tempo evidence but does not alter legacy BPM; Quick stays lightweight',()=>{
 const sample=synthTempoFixture(120,{duration:12}),w={samples:sample.samples,sampleRate:sample.sampleRate,start:0,end:12};
 const input={windows:[w],ranges:[{start:0,end:12}]};
 const quick=analyzeCapability('tempo',{...input,analysisMode:'quick'});
 const verify=analyzeCapability('tempo',{...input,analysisMode:'verify'});
 assert.equal(quick.result.fluxEvidence,null);
 assert.equal(quick.result.tempoComparison,null);
 assert.equal(verify.result.bpm,quick.result.bpm);
 assert.equal(verify.result.fluxEvidence.method,'spectral-flux-tempo-experimental-0.1.0');
 assert.ok(['review','agreement','unavailable'].includes(verify.result.tempoComparison.status));
});
