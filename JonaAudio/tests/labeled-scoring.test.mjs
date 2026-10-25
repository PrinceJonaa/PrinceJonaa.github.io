import test from 'node:test';
import assert from 'node:assert/strict';
import {parsedKey,tempoRelation,scoreLabeledPredictions} from '../bench/score-labeled.js';

test('enharmonic spellings normalize identically for exact-key comparisons',()=>{
 for(const [a,b] of [['C♯ major','D♭ major'],['G♭ major','F♯ major'],['E♯ minor','F minor'],['A♭ minor','G♯ minor']])
  assert.equal(parsedKey(a).canonical,parsedKey(b).canonical);
});
test('relative major and natural minor share Auto-Tune notes but not tonal center',()=>{
 const result=scoreLabeledPredictions({schema:1,
  annotations:[{id:'case-a',basis:'working-setting',key:'F major'}],
  predictions:[{id:'case-a',method:'peak-profile',key:'D minor'}]});
 assert.equal(result.results[0].exactKey,false);
 assert.equal(result.results[0].compatibleScale,true);
 assert.equal(result.results[0].relativeKey,true);
 assert.equal(result.summaries[0].basis,'working-setting');
 assert.equal(result.summaries[0].scaleCompatible,1);
});
test('nearby but different note masks must not be treated as relative keys',()=>{
 const r=scoreLabeledPredictions({schema:1,
  annotations:[{id:'case-a',basis:'working-setting',key:'F major'}],
  predictions:[{id:'case-a',method:'baseline',key:'F minor'}]});
 assert.equal(r.results[0].compatibleScale,false);
 assert.equal(r.results[0].relativeKey,false);
});
test('tempo comparison reports relative divisions separately from exact BPM',()=>{
 assert.equal(tempoRelation(150,100),'three-to-two');
 assert.equal(tempoRelation(100,150),'two-to-three');
 assert.equal(tempoRelation(80,160),'half-time');
 assert.equal(tempoRelation(160,80),'double-time');
 assert.equal(tempoRelation(145,145.7),'within-1-bpm');
 assert.equal(tempoRelation(null,150),null);
});
test('annotation quality levels cannot silently be promoted or overwritten',()=>{
 const r=scoreLabeledPredictions({schema:1,annotations:[
  {id:'a',basis:'working-setting',key:'C♯ major'},
  {id:'b',basis:'session-confirmed',key:'C major'}],predictions:[
  {id:'a',method:'cqt',key:'D♭ major'},
  {id:'b',method:'cqt',key:'A minor'}]});
 assert.equal(r.summaries.length,2);
 assert.equal(r.summaries.find(s=>s.basis==='working-setting').exactKeys,1);
 assert.equal(r.summaries.find(s=>s.basis==='session-confirmed').scaleCompatible,1);
 assert.equal(r.summaries.find(s=>s.basis==='session-confirmed').exactKeys,0);
 assert.throws(()=>scoreLabeledPredictions({schema:1,annotations:[
  {id:'a',basis:'working-setting',key:'C major'}, {id:'a',basis:'working-setting',key:'D major'}],predictions:[]}),/Duplicate/);
 assert.throws(()=>scoreLabeledPredictions({schema:1,annotations:[{id:'x',key:'D minor'}],predictions:[]}),/Missing basis/);
});
