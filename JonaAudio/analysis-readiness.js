import {setupFromKey, orderedNotes, noteName} from './tuning-model.js';

// Evidence labels are decision hints, not calibrated probabilities or proof of key.
const distinct = values => [...new Set(values)];

function samePitchSet(a, b) {
  const first = setupFromKey(a);
  const second = setupFromKey(b);
  if (!first || !second || first.tonic === second.tonic && first.mode === second.mode) return false;
  return first.allowedPitchClasses.every(pc => second.allowedPitchClasses.includes(pc));
}

export function assessKeyReadiness(result, values = {}) {
  const estimated = result?.keys?.[0]?.key ?? null;
  const key = values.key ?? estimated;
  const source = values.keySource ?? (key ? 'estimated' : 'unavailable');
  if (!key) return {
    status: 'unavailable', key: null, source, reasonCodes: ['NO_KEY'],
    alternative: null, allowedNotes: [], safeToAutoApply: false
  };

  const candidates = Array.isArray(result?.keys) ? result.keys : [];
  const other = candidates.find(candidate => candidate?.key && candidate.key !== key)?.key ?? null;
  const reasons = [source === 'estimated' ? 'HEURISTIC_ESTIMATE' : 'USER_SELECTED_NOT_VERIFIED'];
  const validScores = candidates.length >= 2 && Number.isFinite(candidates[0].score) && Number.isFinite(candidates[1].score);
  if (result?.ambiguous || validScores && candidates[0].score - candidates[1].score < 0.025) reasons.push('CLOSE_CANDIDATES');
  if (result?.disagreement) reasons.push('SECTION_DISAGREEMENT');
  const sections = result?.keyEvidence ?? result?.evidence ?? [];
  const sectionKeys = sections.map(section => section?.keys?.[0]?.key).filter(Boolean);
  if (new Set(sectionKeys).size > 1) reasons.push('SECTION_DISAGREEMENT');
  if (other && samePitchSet(key, other)) reasons.push('SAME_NOTES_DIFFERENT_TONIC');
  if (sections.length && !sections.some(section => section?.keys?.length)) reasons.push('WEAK_TONAL_EVIDENCE');
  if (result?.keyComparison?.relation === 'different-scale-notes') reasons.push('PROFILE_SCALE_CONFLICT');
  else if (result?.keyComparison?.relation === 'same-scale-different-tonic') reasons.push('PROFILE_TONIC_CONFLICT');
  else if (result?.keyComparison?.status === 'disagreement') reasons.push('PROFILE_DISAGREEMENT');
  const setup = setupFromKey(key);
  return {
    status: 'review', key, source, reasonCodes: distinct(reasons), alternative: other,
    allowedNotes: setup ? orderedNotes(setup).map(pc => noteName(pc, setup)) : [],
    safeToAutoApply: false
  };
}

export function describeKeyReadiness(result, values = {}) {
  const state = assessKeyReadiness(result, values);
  if (state.status === 'unavailable') return 'No key established. Choose a scale manually; do not auto-tune from a guess.';
  const parts = [state.source === 'estimated' ? 'Unverified estimate — confirm before Auto-Tune' : 'Selected key — verify by ear'];
  if (state.reasonCodes.includes('SECTION_DISAGREEMENT')) parts.push('sections disagree');
  if (state.reasonCodes.includes('CLOSE_CANDIDATES')) parts.push('close key candidates');
  if (state.reasonCodes.includes('SAME_NOTES_DIFFERENT_TONIC')) parts.push('same notes, different tonic');
  if (state.reasonCodes.includes('PROFILE_SCALE_CONFLICT')) parts.push('cross-check disagrees on allowed tuning notes');
  if (state.reasonCodes.includes('PROFILE_TONIC_CONFLICT')) parts.push('cross-check shares notes but differs on tonic');
  if (state.reasonCodes.includes('PROFILE_DISAGREEMENT')) parts.push('cross-check differs; verify the notes');
  if (state.alternative) parts.push('alternative: ' + state.alternative);
  return parts.join(' · ') + '.';
}

export function formatTuningReference(result, values = {}) {
  const state = assessKeyReadiness(result, values);
  const bpm = Number.isFinite(values.bpm) ? values.bpm + ' BPM' : 'unknown';
  const tempoChoices = (result?.tempo?.alternatives ?? [])
    .map(candidate => candidate.bpm)
    .filter(Number.isFinite)
    .slice(0, 3).join(' / ');
  return [
    'JonaAudio — tuning reference (clipboard only; NOT sent to any plugin)',
    'Key: ' + (state.key ?? 'unknown'),
    'Key origin: ' + state.source,
    'Review status: ' + state.status + ' (' + state.reasonCodes.join(', ') + ')',
    'Allowed notes: ' + (state.allowedNotes.join(', ') || 'select manually'),
    'Tempo: ' + bpm,
    'Tempo candidates: ' + (tempoChoices || 'none'),
    'Alternative key: ' + (state.alternative ?? 'none'),
    'Verify profile: ' + (result?.keyComparison?.relation ?? result?.keyComparison?.status ?? 'not run') + (result?.keyComparison?.peak ? ' (' + result.keyComparison.peak + ')' : ''),
    'Scale differences: ' + (result?.keyComparison?.changedNotes ? 
      'baseline only '+(result.keyComparison.changedNotes.baselineOnly.join(' ')||'none')+
      '; peak only '+(result.keyComparison.changedNotes.peakOnly.join(' ')||'none') : 'not compared'),
    'Verify tonic, note mask and BPM by ear before setting Auto-Tune.'
  ].join('\n');
}
