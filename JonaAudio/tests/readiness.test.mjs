import test from 'node:test';
import assert from 'node:assert/strict';
import {assessKeyReadiness, describeKeyReadiness, formatTuningReference} from '../analysis-readiness.js';

const key = (name, score) => ({key:name, score});

test('missing evidence refuses to name a key or silently authorize tuning', () => {
  const state = assessKeyReadiness(null, {key:null, keySource:'unavailable'});
  assert.equal(state.status, 'unavailable');
  assert.equal(state.safeToAutoApply, false);
  assert.deepEqual(state.allowedNotes, []);
});

test('estimated key remains reviewable even when rankings have a clear gap', () => {
  const result = {keys:[key('G minor', .91), key('C minor', .70)], evidence:[{keys:[key('G minor', .91)]}]};
  const state = assessKeyReadiness(result, {key:'G minor', keySource:'estimated'});
  assert.equal(state.status, 'review');
  assert.equal(state.safeToAutoApply, false);
  assert.ok(state.reasonCodes.includes('HEURISTIC_ESTIMATE'));
  assert.equal(state.allowedNotes.length, 7);
});

test('closely ranked relative major/minor warns about tonic ambiguity', () => {
  const result = {keys:[key('C major', .92), key('A minor', .91)], ambiguous:true, evidence:[{keys:[key('C major', .92)]}]};
  const state = assessKeyReadiness(result, {key:'C major', keySource:'estimated'});
  assert.ok(state.reasonCodes.includes('CLOSE_CANDIDATES'));
  assert.ok(state.reasonCodes.includes('SAME_NOTES_DIFFERENT_TONIC'));
  assert.match(describeKeyReadiness(result, {key:'C major'}), /different tonic/);
});

test('contradictory sections remain reviewable even when legacy disagreement flag is missing', () => {
  const result = {keys:[key('G minor', .93)], evidence:[{keys:[key('G minor', .91)]},{keys:[key('C minor', .92)]}]};
  assert.ok(assessKeyReadiness(result, {key:'G minor'}).reasonCodes.includes('SECTION_DISAGREEMENT'));
});

test('manual and candidate-choice keys retain provenance but are not treated as confirmed', () => {
  const result = {keys:[key('C major', .88), key('A minor', .87)]};
  for (const source of ['manual', 'candidate-choice']) {
    const state = assessKeyReadiness(result, {key:'G minor', keySource:source});
    assert.equal(state.key, 'G minor');
    assert.ok(state.reasonCodes.includes('USER_SELECTED_NOT_VERIFIED'));
    assert.equal(state.safeToAutoApply, false);
    assert.ok(!state.reasonCodes.includes('HEURISTIC_ESTIMATE'));
  }
});

test('clipboard reference exposes exact allowed notes, warnings and no false plugin handoff', () => {
  const result = {keys:[key('G minor', .91), key('B♭ major', .89)], ambiguous:true, tempo:{alternatives:[{bpm:150},{bpm:75}]}};
  const text = formatTuningReference(result, {key:'G minor', keySource:'estimated', bpm:150});
  assert.match(text, /Allowed notes: G, A, B♭, C, D, E♭, F/);
  assert.match(text, /Tempo candidates: 150 \/ 75/);
  assert.match(text, /NOT sent to any plugin/);
  assert.match(text, /SAME_NOTES_DIFFERENT_TONIC/);
});
