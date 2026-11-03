#!/usr/bin/env node
// Score REAL CC BY 4.0 annotated GuitarSet clips, never optimize on these test files.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {decodeLocalWav} from './wav-loader.mjs';
import {windowInputs} from '../analysis-input.js';
import {analyzeCapability} from '../analysis-worker-core.js';
import {scoreLabeledPredictions} from './score-labeled.js';
import {ENGINE_VERSION} from '../config.js';
import {fuseKeyProfiles} from '../key-fusion.js';
import {fractionalPulseCandidates,aggregateRefinedPulse} from '../pulse-refinement.js';
import {parsedKey} from './score-labeled.js';

const folder=resolve(process.argv[2]||'JonaAudio/bench/fixtures/GuitarSet');
const manifest=JSON.parse(readFileSync(join(folder,'manifest.json'),'utf8'));
if(manifest.dataset!=='GuitarSet'||manifest.version!=='1.1.0'||!manifest.tracks?.length)throw Error('Missing GuitarSet v1.1.0 fixture metadata');
const annotations=[],predictions=[],trackResults=[];
const working=mkdtempSync(join(tmpdir(),'jona-guitarset-eval-'));
try{
 for(const [i,track] of manifest.tracks.entries()){
  const source=join(folder,track.file),wav=join(working,'input-'+i+'.wav');
  const ffmpeg=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-i',source,
    '-ar','11025','-ac','1','-c:a','pcm_s16le',wav],{timeout:60000,encoding:'utf8'});
  if(ffmpeg.status!==0)throw Error('Audio conversion failed for '+track.id+': '+(ffmpeg.stderr||ffmpeg.error?.message||'unknown').slice(0,200));
  const audio=decodeLocalWav(wav);
  const quickInput=windowInputs(audio,{mode:'quick'}),deepInput=windowInputs(audio,{mode:'verify'});
  const quickKey=analyzeCapability('key',{...quickInput,analysisMode:'quick'});
  const verifiedKey=analyzeCapability('key',{...deepInput,analysisMode:'verify'});
  const quickTempo=analyzeCapability('tempo',{...quickInput,analysisMode:'quick'});
  const verifiedTempo=analyzeCapability('tempo',{...deepInput,analysisMode:'verify'});
  const originalKey=verifiedKey.result?.keys?.[0]?.key??null;
  const peakKey=verifiedKey.result?.peakEvidence?.keys?.[0]?.key??null;
  const fluxBpm=verifiedTempo.result?.fluxEvidence?.candidates?.[0]?.bpm??null;
  // Benchmark-only negative controls: these candidates do not run in the product.
  const fusion=fuseKeyProfiles(verifiedKey.result?.chroma,verifiedKey.result?.peakEvidence?.chroma);
  const combinedKey=fusion.keys?.[0]?.key??null;
  const refinement=aggregateRefinedPulse(deepInput.windows.map(w=>({
   start:w.start,end:w.end,
   ...fractionalPulseCandidates(w.samples,w.sampleRate,{start:0,end:w.samples.length/w.sampleRate})
  })));
  const refinedBpm=refinement.candidates?.[0]?.bpm??null;
  const beatRootBpm=verifiedTempo.result?.beatRootEvidence?.primaryCandidate??null;
  const selective=verifiedTempo.result?.tempoDecision;
  const suggested=selective?.status==='recommend'?selective.suggestedBpm:null;
  const keyCandidates=verifiedKey.result?.keys?.slice(0,3)??[];
  const expected=parsedKey(track.key);
  const top3KeyMatch=Boolean(expected&&keyCandidates.some(k=>parsedKey(k.key)?.canonical===expected.canonical));
  const alternatives=verifiedTempo.result?.tempoHypotheses;
  const possiblePulseChoices=[...(alternatives?.direct||[]),...(alternatives?.metricalAlternatives||[])];
  const hasNearCorrectPulse=possiblePulseChoices.some(candidate=>Math.abs(candidate.bpm-track.bpm)<=1);
  const values=[
   ['JonaAudio Quick',quickKey.result?.keys?.[0]?.key??null,quickTempo.result?.bpm??null],
   ['JonaAudio Verify',originalKey,verifiedTempo.result?.bpm??null],
   ['Spectral Peaks',peakKey,null],
   ['Spectral Flux',null,fluxBpm],
   ['Fused key (review only)',combinedKey,null],
   ['Fractional pulse (review only)',null,refinedBpm],
   ['MIT BeatRoot (review only)',null,beatRootBpm]
  ];
  annotations.push({id:track.id,basis:'session-confirmed',key:track.key,bpm:track.bpm});
  for(const [method,key,bpm] of values)predictions.push({id:track.id,method,key,bpm});
  trackResults.push({
   id:track.id,sourceKey:track.key,sourceTempoBpm:track.bpm,jamsBeatTempoBpm:track.beat_bpm_from_jams,
   style:track.style,player:track.player,file:track.file,
   quick:{key:values[0][1],bpm:values[0][2]},
   verify:{key:originalKey,bpm:verifiedTempo.result?.bpm??null,keyCandidates:verifiedKey.result?.keys?.slice(0,3)??[]},
   spectralPeaks:{key:peakKey,candidates:verifiedKey.result?.peakEvidence?.keys?.slice(0,3)??[]},
   spectralFlux:{bpm:fluxBpm,candidates:verifiedTempo.result?.fluxEvidence?.candidates?.slice(0,3)??[]},
   keyFusion:{key:combinedKey,candidates:fusion.keys?.slice(0,3)??[],context:'offline-only'},
   fractionalPulse:{bpm:refinedBpm,candidates:refinement.candidates?.slice(0,3)??[],context:'offline-only'},
   selectiveTempo:{status:selective?.status??'abstain',bpm:suggested,
    exactWithinOne:suggested!==null&&Math.abs(suggested-track.bpm)<=1,
    reasonCodes:selective?.reasonCodes??[]},
   beatRoot:{bpm:beatRootBpm,sections:verifiedTempo.result?.beatRootEvidence?.sections??[],
    halfTime:verifiedTempo.result?.beatRootEvidence?.candidates?.[0]?.halfTime??null,
    context:'Deep review only; never automatically replaces the primary BPM'},
   hypothesisCoverage:{keyInTopThree:top3KeyMatch,tempoWithinOneAmongChoices:hasNearCorrectPulse,
    numberOfTempoChoices:possiblePulseChoices.length,alternativePulseModes:alternatives?.metricalAlternatives?.slice(0,6)??[]},
   evidence:{keyComparison:verifiedKey.result?.keyComparison??null,
    tempoComparison:verifiedTempo.result?.tempoComparison??null,
    keyFusion:verifiedKey.result?.keyFusion?.relation??null},
   durationSeconds:+audio.duration.toFixed(2)});
  console.log([track.id,'reference:',track.key,track.bpm+'BPM','quick:',values[0][1],values[0][2],
   'verify:',originalKey,values[1][2],'peaks:',peakKey,'flux:',fluxBpm,
   'fusion:',combinedKey,'fractional:',refinedBpm,'beatroot:',beatRootBpm].join(' | '));
 }
}finally{rmSync(working,{recursive:true,force:true});}

const assessment=scoreLabeledPredictions({schema:1,annotations,predictions});
const recommended=trackResults.filter(x=>x.selectiveTempo.status==='recommend');
const report={schema:1,kind:'open-licensed-GuitarSet-real-recordings',
 selectiveSummary:{count:trackResults.length,recommended:recommended.length,
  correct:recommended.filter(x=>x.selectiveTempo.exactWithinOne).length,
  wrong:recommended.filter(x=>!x.selectiveTempo.exactWithinOne).length,
  abstained:trackResults.length-recommended.length},
 hypothesisCoverage:{keyInTopThree:trackResults.filter(t=>t.hypothesisCoverage.keyInTopThree).length,
  tempoWithinOneAmongChoices:trackResults.filter(t=>t.hypothesisCoverage.tempoWithinOneAmongChoices).length,
  countsOfTempoChoices:trackResults.map(t=>t.hypothesisCoverage.numberOfTempoChoices)},dataset:manifest.dataset,version:manifest.version,doi:manifest.doi,
 license:manifest.license,source:'Annotated GuitarSet v1.1.0 JAMS and tempo-encoded session IDs',
 sampleCount:manifest.tracks.length,engineVersion:ENGINE_VERSION,
 note:'This corpus is real acoustic guitar; source metadata is authoritative for its sessions. It is not independent evidence of performance on drill or rap full mixes. No detector weights were learned from these eight recordings; the candidate methods remain non-default.',
 aggregates:assessment.summaries,perTrack:trackResults,classification:assessment.results};
const target=join(folder,'benchmark-results.json');
writeFileSync(target,JSON.stringify(report,null,2)+'\n');
console.log('=== Dataset key, allowable tuning notes and exact BPM results ===');
for(const s of assessment.summaries){
 console.log(s.method+': '+s.exactKeys+'/'+s.keyCount+' exact keys; '+s.scaleCompatible+'/'+s.keyCount+' compatible note sets; '+s.bpmWithinOne+'/'+s.tempoCount+' BPM ±1');
}
console.log('Top-three reference-key coverage:',report.hypothesisCoverage.keyInTopThree+'/'+manifest.tracks.length);
console.log('Unverified alternative-pulse coverage within ±1 BPM:',report.hypothesisCoverage.tempoWithinOneAmongChoices+'/'+manifest.tracks.length,
  '(large alternative sets are NOT a precision/accuracy score)');
console.log('Selective BPM decision, not automatically applied:',JSON.stringify(report.selectiveSummary));
console.log('Saved reproducible real-audio report:',target);
