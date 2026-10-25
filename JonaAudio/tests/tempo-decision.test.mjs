import test from 'node:test';
import assert from 'node:assert/strict';
import {decideTempo,describeTempoDecision,TEMPO_DECISION_VERSION} from '../tempo-decision.js';
const beat=(bpm,extras={})=>({status:'review',primaryCandidate:bpm,
 windowsWithPulse:1,windowsEvaluated:1,sectionAgreement:'consistent',
 candidates:[{bpm,sampleFrames:24,windowVotes:1}],...extras});
const flux=bpm=>({candidates:[{bpm,score:.4}]});
test('missing, silent, or under-observed tempo evidence abstains',()=>{
 assert.equal(decideTempo({}).status,'abstain');
 assert.equal(decideTempo({beatRoot:beat(160,{candidates:[{sampleFrames:3}]})}).status,'abstain');
 assert.equal(decideTempo({beatRoot:{status:'unavailable'}}).suggestedBpm,null);
});
test('normal pulse is suggested only when independent reading supports it',()=>{
 const result=decideTempo({beatRoot:beat(145),originalBpm:95,flux:flux(144)});
 assert.equal(result.status,'recommend');
 assert.equal(result.suggestedBpm,145);
 assert.equal(result.suggestionType,'normal');
 assert.equal(result.autoApplied,false);
 assert.equal(result.calibratedProbability,null);
 assert.equal(result.version,TEMPO_DECISION_VERSION);
 assert.match(describeTempoDecision(result),/Suggested/);
});
test('half-time requires both other onset representations to support half BPM',()=>{
 const approved=decideTempo({beatRoot:beat(160),originalBpm:80.5,flux:flux(79.6)});
 assert.equal(approved.status,'recommend');
 assert.equal(approved.suggestedBpm,80);
 assert.equal(approved.suggestionType,'half-time');
 const oneVote=decideTempo({beatRoot:beat(160),originalBpm:105,flux:flux(80)});
 assert.equal(oneVote.status,'abstain');
 assert.ok(oneVote.reasonCodes.includes('SINGLE_HALF_TIME_SIGNAL'));
});
test('genre blind: never classify half-time from a filename, artist or fixed genre tempo prior',()=>{
 const trap=decideTempo({beatRoot:beat(158),originalBpm:103,flux:flux(78)});
 assert.equal(trap.status,'abstain','Trap-like 158 vs 78 requires human check');
 const boom=decideTempo({beatRoot:beat(158),originalBpm:79,flux:flux(79)});
 assert.equal(boom.suggestedBpm,79);
});
test('independent bad estimators cannot create spurious false confidence',()=>{
 const none=decideTempo({beatRoot:beat(130),originalBpm:92,flux:flux(89)});
 assert.equal(none.status,'abstain');
 assert.equal(none.suggestedBpm,null);
 assert.match(describeTempoDecision(none),/ambiguous/);
});
test('multi-section consistency without flux can yield a tentative normal reading',()=>{
 const root=beat(148,{windowsWithPulse:3,windowsEvaluated:3,
  candidates:[{sampleFrames:30,windowVotes:3}]});
 const result=decideTempo({beatRoot:root});
 assert.equal(result.status,'recommend');
 assert.equal(result.suggestedBpm,148);
 assert.equal(result.reasonCodes[0],'MULTI_WINDOW_BEAT_TRACK_AGREEMENT');
});
test('multiple windows that disagree and an out-of-range octave cannot fabricate a winner',()=>{
 const unstable=beat(160,{windowsWithPulse:3,windowsEvaluated:3,
  sectionAgreement:'single-reading'});
 assert.equal(decideTempo({beatRoot:unstable,flux:flux(160)}).status,'abstain');
 const low=decideTempo({beatRoot:beat(100),originalBpm:50,flux:flux(49)});
 assert.equal(low.alternateBpm,null);
 assert.equal(low.status,'abstain');
});
