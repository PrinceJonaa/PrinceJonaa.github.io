import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractBeatRootPulse,summarizeBeatRootWindows,relateBeatRoot,BEATROOT_VERSION} from '../beatroot-evidence.js';
import {analyzeCapability} from '../analysis-worker-core.js';
import {synthTempoFixture} from '../bench/fixtures.mjs';

test('BeatRoot is bundled locally with complete upstream MIT attribution',()=>{
 const src=readFileSync(new URL('../vendor/music-tempo.esm.js',import.meta.url),'utf8');
 const license=readFileSync(new URL('../third-party/MUSIC-TEMPO-LICENSE.txt',import.meta.url),'utf8');
 assert.match(src,/export default globalThis\.MusicTempo/);
 assert.match(license,/MIT License/);
 assert.match(license,/Copyright/);
});
test('Reject short, invalid-rate and silent inputs without hallucinating a confirmed tempo',()=>{
 assert.equal(extractBeatRootPulse(null,11025).status,'unavailable');
 assert.equal(extractBeatRootPulse(new Float32Array(11025*2),11025).status,'unavailable');
 assert.equal(extractBeatRootPulse(new Float32Array(11025*8),4000).status,'unavailable');
 assert.equal(extractBeatRootPulse(new Float32Array(11025*8),11025).status,'unavailable');
});
test('BeatRoot returns bounded candidates on a real click fixture, not a confirmed beat grid',()=>{
 const fixture=synthTempoFixture(120,{duration:12});
 const e=extractBeatRootPulse(fixture.samples,fixture.sampleRate);
 assert.equal(e.status,'experimental');
 assert.equal(e.version,BEATROOT_VERSION);
 assert.ok(e.bpm>=55&&e.bpm<=210);
 assert.ok(e.beats>=4);
 assert.equal(e.precision.startsWith('uncalibrated'),true);
 const s=summarizeBeatRootWindows([e,e]);
 assert.equal(s.status,'review');
 assert.equal(s.sectionAgreement,'consistent');
 assert.equal(s.candidates[0].windowVotes,2);
 assert.equal(s.manuallyConfirmed,false);
 assert.equal(s.autoApplied,false);
 assert.ok(s.candidates[0].halfTime===null||s.candidates[0].halfTime<s.candidates[0].bpm);
 assert.equal(relateBeatRoot({bpm:s.primaryCandidate},s),'similar');
});
test('Empty or inconsistent results remain explicitly unverified',()=>{
 assert.equal(summarizeBeatRootWindows([]).status,'unavailable');
 assert.equal(relateBeatRoot({bpm:80},{primaryCandidate:160}),'double-time');
 assert.equal(relateBeatRoot({bpm:160},{primaryCandidate:80}),'half-time');
 assert.equal(relateBeatRoot({bpm:100},{primaryCandidate:150}),'three-to-two');
 const mixed=summarizeBeatRootWindows([
  {status:'experimental',bpm:78,beats:8},
  {status:'experimental',bpm:154,beats:8}]);
 assert.equal(mixed.sectionAgreement,'single-reading');
 assert.equal(mixed.autoApplied,false);
});
test('Live Deep analysis exposes BeatRoot but does not rewrite the original BPM; Quick stays lightweight',()=>{
 const f=synthTempoFixture(120,{duration:12}),window={...f,start:0,end:12};
 const quick=analyzeCapability('tempo',{windows:[window],analysisMode:'quick'});
 const deep=analyzeCapability('tempo',{windows:[window],analysisMode:'verify'});
 assert.equal(quick.result.beatRootEvidence,null);
 assert.equal(deep.result.bpm,quick.result.bpm);
 assert.equal(deep.result.beatRootEvidence?.status,'review');
 assert.equal(deep.result.beatRootEvidence.autoApplied,false);
 assert.equal(deep.result.beatRootEvidence.method,BEATROOT_VERSION);
});
