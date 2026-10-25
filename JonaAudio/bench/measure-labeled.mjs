#!/usr/bin/env node
// Run on owner's Mac with privately annotated WAV files. No source audio is uploaded.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,isAbsolute} from 'node:path';
import {decodeLocalWav} from './wav-loader.mjs';
import {windowInputs} from '../analysis-input.js';
import {analyzeCapability} from '../analysis-worker-core.js';
import {setupFromKey} from '../tuning-model.js';
import {ENGINE_VERSION} from '../config.js';
const manifestPath=process.argv[2],outPath=process.argv[3];
if(!manifestPath){console.error('Usage: node JonaAudio/bench/measure-labeled.mjs /private/corpus.json [private/results.json]');process.exit(2);}
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
if(manifest.schema!==1||!Array.isArray(manifest.tracks)||!manifest.tracks.length)throw Error('Expected manifest schema 1 with tracks');
const correct=(prediction,reference)=>prediction===reference;
const scaleSame=(prediction,reference)=>{
 const a=setupFromKey(prediction),b=setupFromKey(reference);
 return !!(a&&b&&a.allowedPitchClasses.every(pc=>b.allowedPitchClasses.includes(pc)));
};
const rows=[];
for(const [idx,track] of manifest.tracks.entries()) {
 if(!track||typeof track.id!=='string'||typeof track.path!=='string'||!setupFromKey(track.key)||!['development','held-out'].includes(track.split)||!track.annotation)throw Error('Invalid annotation for manifest row '+idx);
 const path=isAbsolute(track.path)?track.path:resolve(dirname(manifestPath),track.path);
 const audio=decodeLocalWav(path);
 // Retain the exact same bounded sampled windows and resampler the browser uses.
 const input=windowInputs(audio,{mode:'verify',scope:null});
 const keyResult=analyzeCapability('key',{...input,analysisMode:'verify'});
 const tempoResult=track.bpm!=null?analyzeCapability('tempo',{...input,analysisMode:'verify'}):null;
 const baseline=keyResult.result?.keys||[],peak=keyResult.result?.peakEvidence?.keys||[];
 const observations=[['baseline',baseline],['spectral-peaks',peak]];
 for(const [method,keys] of observations)rows.push({
  id:track.id,split:track.split,genre:track.genre??'unlabeled',method,
  annotatedKey:track.key,prediction:keys[0]?.key??null,
  exact:correct(keys[0]?.key,track.key),
  top3:keys.slice(0,3).some(x=>x.key===track.key),
  scaleCompatible:scaleSame(keys[0]?.key,track.key),
  unavailable:keys.length===0,comparison:keyResult.result?.keyComparison?.status??null,
  annotatedBpm:track.bpm??null,estimatedBpm:tempoResult?.result?.bpm??null,
  bpmWithinOne:track.bpm==null?null:tempoResult?.result?.bpm!=null&&Math.abs(tempoResult.result.bpm-track.bpm)<=1
 });
 console.log('Analyzed',idx+1,'/',manifest.tracks.length,track.id,'(labels kept local)');
}
const metrics={};
for(const split of ['development','held-out'])for(const method of ['baseline','spectral-peaks']) {
 const selected=rows.filter(x=>x.split===split&&x.method===method),count=selected.length;
 metrics[split+'/'+method]={count,exact: selected.filter(x=>x.exact).length,top3:selected.filter(x=>x.top3).length,
  scaleCompatible:selected.filter(x=>x.scaleCompatible).length,unavailable:selected.filter(x=>x.unavailable).length,
  exactRate:count?Math.round(selected.filter(x=>x.exact).length/count*1000)/10:null};
}
const report={schema:1,engineVersion:ENGINE_VERSION,kind:'real-owned-local-WAV-benchmark',
 notes:'Annotations are owner-supplied; independently verify musical key and tonic before publication. Zero audio files embedded. Shared FFT and templates mean these are not independent models.',
 metrics,rows};
for(const [group,score] of Object.entries(metrics))console.log(group,JSON.stringify(score));
if(outPath){mkdirSync(dirname(outPath),{recursive:true});writeFileSync(outPath,JSON.stringify(report,null,2));console.log('Wrote private JSON report to',outPath);}
else console.log('No output file requested. Data remains on this computer.');
