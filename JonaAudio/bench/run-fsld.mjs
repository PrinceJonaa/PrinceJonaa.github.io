#!/usr/bin/env node
// Read-only independent creator-separated, expert-agreed FSLD evaluation.
// Neither detector weights nor selection policy are ever fit to these labels.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {decodeLocalWav} from './wav-loader.mjs';
import {windowInputs} from '../analysis-input.js';
import {analyzeCapability} from '../analysis-worker-core.js';
import {TEMPO_DECISION_VERSION} from '../tempo-decision.js';
import {ENGINE_VERSION} from '../config.js';

const directory=resolve(process.argv[2]||'JonaAudio/bench/fixtures/FSLD');
const meta=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'));
if(meta.doi!=='10.5281/zenodo.3967852'||meta.sources?.length<20||
   meta.sources.some(s=>!['development','evaluation'].includes(s.split)))
 throw Error('Missing independently selected, expert-verified FSLD metadata');
const assertUnique=(values,name)=>{if(new Set(values).size!==values.length)throw Error('Duplicate '+name)};
assertUnique(meta.sources.map(s=>s.sourceId),'sound id');
assertUnique(meta.sources.map(s=>s.creatorDigest),'creator');
const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<=1;
const rows=[],work=mkdtempSync(join(tmpdir(),'jona-fsld-eval-'));
try{
 for(const [index,song] of meta.sources.entries()){
  const wav=join(work,'clip-'+index+'.wav');
  const convert=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y',
   '-i',join(directory,song.file),'-ac','1','-ar','11025','-c:a','pcm_s16le',wav],
   {timeout:60000,encoding:'utf8'});
  if(convert.status!==0)throw Error('Real FSLD decode failed '+song.sourceId+': '+String(convert.stderr).slice(0,150));
  const audio=decodeLocalWav(wav),start=performance.now();
  const quick=analyzeCapability('tempo',{...windowInputs(audio,{mode:'quick'}),analysisMode:'quick'});
  const deep=analyzeCapability('tempo',{...windowInputs(audio,{mode:'verify'}),analysisMode:'verify'});
  const root=deep.result?.beatRootEvidence;
  const decision=deep.result?.tempoDecision;
  const suggested=decision?.status==='recommend'?decision.suggestedBpm:null;
  const reference=song.expertBpm;
  const row={
   id:song.sourceId,creatorDigest:song.creatorDigest,split:song.split,
   sourceLicense:song.license,sourceTempo:reference,fullClipSeconds:+audio.duration.toFixed(2),
   quickBpm:quick.result?.bpm??null,legacyVerifyBpm:deep.result?.bpm??null,
   beatRootBpm:root?.primaryCandidate??null,
   beatRootHalfTimeBpm:root?.candidates?.[0]?.halfTime??null,
   decisionStatus:decision?.status??'abstain',
   decisionBpm:suggested,
   decisionType:decision?.suggestionType??null,
   decisionReasons:decision?.reasonCodes??[],
   sourceMatchQuick:near(quick.result?.bpm,reference),
   sourceMatchLegacy:near(deep.result?.bpm,reference),
   sourceMatchBeatRoot:near(root?.primaryCandidate,reference),
   sourceMatchHalf:near(root?.candidates?.[0]?.halfTime,reference),
   sourceMatchDecision:near(suggested,reference),
   milliseconds:+(performance.now()-start).toFixed(1)
  };
  rows.push(row);
  console.log('FSLD',index+1,meta.sources.length,song.split,'label',reference,
   'quick',row.quickBpm,'BeatRoot',row.beatRootBpm,'decision',suggested??'ABSTAIN',
   'correct',row.sourceMatchDecision);
 }
}finally{rmSync(work,{force:true,recursive:true});}
const summarize=values=>{
 const rec=values.filter(x=>x.decisionStatus==='recommend');
 return {count:values.length,quickCorrect:values.filter(x=>x.sourceMatchQuick).length,
  legacyCorrect:values.filter(x=>x.sourceMatchLegacy).length,
  beatRootCorrect:values.filter(x=>x.sourceMatchBeatRoot).length,
  beatRootHalfPairCorrect:values.filter(x=>x.sourceMatchBeatRoot||x.sourceMatchHalf).length,
  recommended:rec.length,recommendedCorrect:rec.filter(x=>x.sourceMatchDecision).length,
  incorrectRecommendations:rec.filter(x=>!x.sourceMatchDecision).length,
  abstained:values.length-rec.length,
  precision:rec.length?+(rec.filter(x=>x.sourceMatchDecision).length/rec.length).toFixed(4):null,
  coverage:values.length?+(rec.length/values.length).toFixed(4):null};
};
const groups={all:summarize(rows)};
for(const scope of ['development','evaluation'])
 groups[scope]=summarize(rows.filter(x=>x.split===scope));
const report={schema:1,source:'FSLD 2020 expert-consensus BPM; per-file audio license verified',
 creatorDisjoint:true,labelsFixedBeforeSelectorRun:true,
 engineVersion:ENGINE_VERSION,decisionVersion:TEMPO_DECISION_VERSION,
 caveat:'Independent Freesound loops, not complete songs or a guarantee of DAW time-signature/downbeat. Evaluation split is only untouched on FIRST run; further revisions contaminate it.',
 groups,rows};
writeFileSync(join(directory,'fsld-results.json'),JSON.stringify(report,null,2)+'\n');
console.log('FSLD CREATOR-DISJOINT EVALUATION',JSON.stringify(groups));
