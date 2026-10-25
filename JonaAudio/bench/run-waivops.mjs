#!/usr/bin/env node
// Evaluate source-labeled, open-license hip-hop loops; DO NOT infer key from drums.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {decodeLocalWav} from './wav-loader.mjs';
import {windowInputs} from '../analysis-input.js';
import {analyzeCapability} from '../analysis-worker-core.js';
import {ENGINE_VERSION} from '../config.js';

const base=resolve(process.argv[2]||'JonaAudio/bench/fixtures/WaivOps');
const manifest=JSON.parse(readFileSync(join(base,'manifest.json'),'utf8'));
if(manifest.dataset!=='WaivOps hip-hop drum loops'||manifest.license!=='CC BY 4.0'||manifest.tracks?.length!==21)
 throw Error('Wrong corpus or license metadata; expected 21 original WaivOps examples');
const expectedIDs=new Set(),rows=[],work=mkdtempSync(join(tmpdir(),'jona-rhythm-'));
const accurate=(actual,label,threshold=1)=>Number.isFinite(actual)&&Math.abs(actual-label)<=threshold;
const ratio=(actual,expected,targets)=>Number.isFinite(actual)&&targets.some(x=>Math.abs(actual/expected-x)<.025);
try{
 for(const [index,track] of manifest.tracks.entries()){
  if(expectedIDs.has(track.id))throw Error('Duplicate track id: '+track.id);expectedIDs.add(track.id);
  if(track.key!==null||!['development','held-out'].includes(track.split)||
    !(track.bpm>=55&&track.bpm<=210))throw Error('Invalid annotated sample '+track.id);
  const output=join(work,'sample-'+index+'.wav');
  const conv=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y',
    '-i',join(base,track.file),'-ac','1','-ar','11025','-c:a','pcm_s16le',output],
    {encoding:'utf8',timeout:45000});
  if(conv.status!==0)throw Error('FFmpeg decode failed '+track.id+': '+String(conv.stderr||conv.error?.message).slice(0,160));
  const audio=decodeLocalWav(output),quickInput=windowInputs(audio,{mode:'quick'});
  const deepInput=windowInputs(audio,{mode:'verify'});
  const start=performance.now();
  const quick=analyzeCapability('tempo',{...quickInput,analysisMode:'quick'});
  const deep=analyzeCapability('tempo',{...deepInput,analysisMode:'verify'});
  const elapsedMs=+(performance.now()-start).toFixed(1);
  const primaryQuick=quick.result?.bpm??null;
  const primaryVerify=deep.result?.bpm??null;
  const flux=deep.result?.fluxEvidence?.candidates??[];
  const alt=deep.result?.tempoHypotheses;
  const exact=accurate(primaryQuick,track.bpm);
  const close=accurate(primaryQuick,track.bpm,3);
  const hypotheses=[...(alt?.direct||[]),...(alt?.metricalAlternatives||[])];
  const directChoices=flux.slice(0,3).map(x=>x.bpm);
  rows.push({id:track.id,group:track.genreGroup,split:track.split,referenceBpm:track.bpm,
    quickBpm:primaryQuick,verifyBpm:primaryVerify,fluxBpm:flux[0]?.bpm??null,
    quickExact:exact,quickClose:close,verifyExact:accurate(primaryVerify,track.bpm),
    fluxExact:accurate(flux[0]?.bpm,track.bpm),
    fluxTop3:directChoices.some(x=>accurate(x,track.bpm)),
    octaveEquivalent:ratio(primaryQuick,track.bpm,[.5,1,2]),
    directAlternativeExact:hypotheses.filter(x=>x.source!=='original-estimate').some(x=>accurate(x.bpm,track.bpm)),
    expandedCandidateExact:hypotheses.some(x=>accurate(x.bpm,track.bpm)),
    totalHypotheses:hypotheses.length,
    topAlternativeBpm:flux.slice(0,5).map(x=>x.bpm),
    tempoSections:deep.result?.sections??[],
    elapsedMs});
  console.log(track.id+' | '+track.split+' | label '+track.bpm+
    ' | quick '+primaryQuick+' | verify '+primaryVerify+
    ' | flux '+(flux[0]?.bpm??'—')+' | ms '+elapsedMs);
 }
}finally{rmSync(work,{recursive:true,force:true});}
const summarize=(items)=>({
 count:items.length,
 quickExact:items.filter(x=>x.quickExact).length,
 quickWithin3:items.filter(x=>x.quickClose).length,
 verifyExact:items.filter(x=>x.verifyExact).length,
 fluxExact:items.filter(x=>x.fluxExact).length,
 fluxTop3:items.filter(x=>x.fluxTop3).length,
 octaveEquivalent:items.filter(x=>x.octaveEquivalent).length,
 directAlternativeExact:items.filter(x=>x.directAlternativeExact).length,
 expandedCandidateExact:items.filter(x=>x.expandedCandidateExact).length,
 avgCandidateSetSize:items.length?+(
  items.reduce((s,x)=>s+x.totalHypotheses,0)/items.length).toFixed(1):null
});
const groups={all:summarize(rows)};
for(const split of ['development','held-out'])groups[split]=summarize(rows.filter(x=>x.split===split));
for(const genre of ['trap','boom-bap'])groups[genre]=summarize(rows.filter(x=>x.group===genre));
const report={
 schema:1,dataset:'WaivOps CC BY 4.0 trap and boom-bap drum-loop examples',
 engineVersion:ENGINE_VERSION,license:'CC BY 4.0',datasetSize:rows.length,
 groundTruth:'Publisher-encoded BPM in the official example filename (not analysis estimates)',
 scope:'Rhythm/tempo ONLY; samples are labeled loops, NOT full songs and have no musical-key annotations',
 caveat:'Keep held-out reference labels unused for tuning. A broad set of tempo alternatives is NOT a high-precision BPM result.',
 groups,rows
};
writeFileSync(join(base,'benchmark-results.json'),JSON.stringify(report,null,2)+'\n');
for(const [scope,stats] of Object.entries(groups))
 console.log(scope,JSON.stringify(stats));
console.log('Saved real licensed hip-hop tempo comparison (no network calls, no label mutation)');
