import test from 'node:test';
import assert from 'node:assert/strict';
import {fuseKeyProfiles} from '../key-fusion.js';
import {fractionalPulseCandidates,aggregateRefinedPulse} from '../pulse-refinement.js';
import {synthTempoFixture,synthKeyFixture} from '../bench/fixtures.mjs';
import {computeChroma} from '../engine.js';
import {buildTempoHypotheses,shortTempoGuide} from '../tempo-hypotheses.js';
import {analyzePeakKey} from '../harmonic-key.js';
import {analyzeCapability} from '../analysis-worker-core.js';

test('key fusion cannot invent a tonal center from missing or invalid evidence',()=>{
 assert.equal(fuseKeyProfiles(null,[]).status,'unavailable');
 assert.equal(fuseKeyProfiles(Array(12).fill(0),Array(12).fill(1)).status,'unavailable');
 assert.equal(fuseKeyProfiles(Array(12).fill(NaN),Array(12).fill(1)).status,'unavailable');
});
test('fusion is a bounded review-only ranking with no trained confidence percent',()=>{
 const clip=synthKeyFixture(0,'major');
 const segment={start:0,end:clip.duration};
 const main=computeChroma(clip.samples,clip.sampleRate,[segment]);
 const peaks=analyzePeakKey(clip.samples,clip.sampleRate,[segment]);
 const result=fuseKeyProfiles(main,peaks.chroma);
 assert.equal(result.status,'review');
 assert.equal(result.keys.length,5);
 assert.equal(result.keys[0].key,'C major');
 assert.equal(result.primaryKeyUnchanged,true);
 assert.match(result.scores,/uncalibrated/);
});
test('fractional pulse refuses silence, missing segments and short clips',()=>{
 assert.equal(fractionalPulseCandidates(null,11025,{start:0,end:1}).status,'unavailable');
 assert.equal(fractionalPulseCandidates(new Float32Array(11025),11025,{start:0,end:1}).status,'unavailable');
 assert.equal(fractionalPulseCandidates(new Float32Array(11025*5),11025,{start:0,end:5}).status,'unavailable');
 assert.equal(aggregateRefinedPulse([]).status,'unavailable');
});
test('fractional tempo emits plausible candidates with sub-integer BPM without overriding baseline',()=>{
 const clip=synthTempoFixture(120,{duration:12});
 const section={start:0,end:12};
 const refined=fractionalPulseCandidates(clip.samples,clip.sampleRate,section);
 assert.equal(refined.status,'experimental');
 assert.ok(refined.candidates.length>=1);
 assert.ok(refined.candidates.every(x=>Number.isFinite(x.bpm)&&x.bpm>=55&&x.bpm<=210));
 const quick=analyzeCapability('tempo',{windows:[{...clip,start:0,end:12}],analysisMode:'quick'});
 const deep=analyzeCapability('tempo',{windows:[{...clip,start:0,end:12}],analysisMode:'verify'});
 assert.equal(quick.result.tempoHypotheses,null);
 assert.equal(quick.result.bpm,deep.result.bpm);
 assert.equal(deep.result.pulseRefinement,undefined,'Unhelpful interpolator is benchmark-only');
 assert.equal(deep.result.tempoHypotheses.status,'review');
 assert.ok(Array.isArray(deep.result.tempoHypotheses.metricalAlternatives));
});
test('Failed equal-chroma fusion remains offline-only and does not distort main key',()=>{
 const clip=synthKeyFixture(9,'minor');
 const window={...clip,start:0,end:clip.duration};
 const quick=analyzeCapability('key',{windows:[window],analysisMode:'quick'});
 const deep=analyzeCapability('key',{windows:[window],analysisMode:'verify'});
 assert.equal(deep.result.keyFusion,undefined,'Experimental fusion is not a live DSP dependency');
 assert.equal(quick.result.keys[0].key,deep.result.keys[0].key);
 assert.equal(deep.result.peakEvidence.status,undefined);
});
test('Tempo alternative transformations preserve provenance and never mark an estimate confirmed',()=>{
 const data=buildTempoHypotheses({bpm:99},{candidates:[
  {bpm:196,score:.8},{bpm:204,score:.77},{bpm:187,score:.72}
 ]});
 assert.equal(data.status,'review');
 assert.equal(data.originalBpm,99);
 assert.equal(data.direct[0].bpm,99);
 assert.ok(data.metricalAlternatives.some(x=>x.bpm===98&&x.relationship==='half-time'));
 assert.ok(data.metricalAlternatives.some(x=>x.bpm===68&&x.relationship==='third-time'));
 assert.ok(data.metricalAlternatives.every(x=>x.verified===false));
 assert.match(shortTempoGuide(data),/Unverified/);
 assert.equal(buildTempoHypotheses({bpm:null},{candidates:[]}).status,'unavailable');
});
