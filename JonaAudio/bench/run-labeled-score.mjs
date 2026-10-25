#!/usr/bin/env node
// Run entirely locally; never check private labels/results into a public repo.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {scoreLabeledPredictions} from './score-labeled.js';
const [input,output]=process.argv.slice(2);
if(!input){
 console.error('Usage: node JonaAudio/bench/run-labeled-score.mjs /private/evaluation.json [/private/scored.json]');
 process.exit(2);
}
const payload=JSON.parse(readFileSync(input,'utf8'));
const result=scoreLabeledPredictions(payload);
for(const x of result.summaries)console.log([
 x.method,x.basis,'exact '+x.exactKeys+'/'+x.keyCount,
 'same tuning notes '+x.scaleCompatible+'/'+x.keyCount,
 'BPM±1 '+x.bpmWithinOne+'/'+x.tempoCount].join(' | '));
console.log('Interpretation: working pitch-correction settings are useful comparators, not proven musical truth.');
if(output){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log('Wrote:',output);}
