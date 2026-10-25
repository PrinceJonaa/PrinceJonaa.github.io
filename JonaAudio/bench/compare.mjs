#!/usr/bin/env node
// Reproducible synthetic baseline. Never describe this as commercial-track accuracy.
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {performance} from 'node:perf_hooks';
import {computeChroma,rankKeys,detectTempo} from '../engine.js';
import {analyzePeakKey} from '../harmonic-key.js';
import {setupFromKey} from '../tuning-model.js';
import {syntheticKeyCorpus,synthTempoFixture} from './fixtures.mjs';

const inTop=(keys,expected,n=1)=>keys.slice(0,n).some(x=>x.key===expected);
const compatible=(keys,expected)=>{
 const a=setupFromKey(keys[0]?.key),b=setupFromKey(expected);
 return Boolean(a&&b&&a.allowedPitchClasses.every(pc=>b.allowedPitchClasses.includes(pc)));
};
const summary=rows=>({
 count:rows.length,exact:rows.filter(r=>r.exact).length,top3:rows.filter(r=>r.top3).length,
 compatibleScale:rows.filter(r=>r.compatibleScale).length,unavailable:rows.filter(r=>r.unavailable).length,
 exactRate:rows.length?+((rows.filter(r=>r.exact).length/rows.length)*100).toFixed(1):null
});
const rows=[],tempo=[];
for(const item of syntheticKeyCorpus()){
 const range={start:0,end:item.duration},begin=performance.now();
 const baseline=rankKeys(computeChroma(item.samples,item.sampleRate,[range])).slice(0,5);
 const baseElapsedMs=performance.now()-begin,secondBegin=performance.now();
 const peak=analyzePeakKey(item.samples,item.sampleRate,[range],{maxFrames:24});
 const peakElapsedMs=performance.now()-secondBegin;
 for(const [method,keys,elapsedMs] of [
  ['baseline',baseline,baseElapsedMs],['spectral-peaks',peak.keys,peakElapsedMs]
 ])rows.push({fixture:item.id,split:item.variant,method,expected:item.label,actual:keys[0]?.key??null,
  exact:inTop(keys,item.label),top3:inTop(keys,item.label,3),compatibleScale:compatible(keys,item.label),
  unavailable:keys.length===0,elapsedMs:+elapsedMs.toFixed(2)});
}
for(const bpm of [65,75,90,100,120,140,150,180]){
 const item=synthTempoFixture(bpm),result=detectTempo(item.samples,item.sampleRate,[{start:0,end:item.duration}]);
 const actual=result.bpm,ratio=actual==null?null:actual/bpm;
 tempo.push({expected:bpm,actual,within1:actual!=null&&Math.abs(actual-bpm)<=1,
  halfDoubleEquivalent:ratio!=null&&[.5,1,2].some(r=>Math.abs(ratio-r)<.02)});
}
const aggregates={};
for(const split of ['development','challenge'])for(const method of ['baseline','spectral-peaks'])
 aggregates[split+'/'+method]=summary(rows.filter(x=>x.split===split&&x.method===method));
const report={
 schema:1,date:'not used for scoring',dataset:'deterministic synthetic only; not real-song held-out accuracy',
 syntheticRecipes:['triadic progressions','detuned alternate voicing','kick/noise overlay'],
 comparison:{sharedFFT:true,sharedKeyTemplates:true,independentModels:false},
 keys:aggregates,
 tempo:{total:tempo.length,within1:tempo.filter(t=>t.within1).length,
  halfDoubleEquivalent:tempo.filter(t=>t.halfDoubleEquivalent).length},
 errors:rows.filter(r=>!r.exact).map(({fixture,method,expected,actual})=>({fixture,method,expected,actual})),
 perFixture:rows,tempoFixtures:tempo
};
console.log('JonaAudio synthetic-only benchmark (NOT real-world musical accuracy)');
for(const [name,result] of Object.entries(aggregates))console.log(name,JSON.stringify(result));
console.log('Tempo ±1 BPM',report.tempo.within1+'/'+tempo.length,'half/double equivalent',report.tempo.halfDoubleEquivalent+'/'+tempo.length);
console.log('Disagreements',report.errors.length,'of',rows.length,'key estimator runs');
if(process.argv[2]){mkdirSync(dirname(process.argv[2]),{recursive:true});writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log('Saved synthetic report:',process.argv[2]);}
