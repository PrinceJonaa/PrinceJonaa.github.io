#!/usr/bin/env node
// Browser-portability check for Essentia.js WASM; AGPL dependency lives ONLY in this
// temporary CI research process, not the JonaAudio static web distribution.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {decodeLocalWav} from './wav-loader.mjs';

const require=createRequire(import.meta.url);
const pkg=process.env.ESSENTIA_PACKAGE||'essentia.js';
const lib=require(pkg);
const engine=new lib.Essentia(lib.EssentiaWASM);
const folder='JonaAudio/bench/fixtures/WaivOps';
const data=JSON.parse(readFileSync(join(folder,'manifest.json'),'utf8'));
const tmp=mkdtempSync(join(tmpdir(),'jona-essentiajs-')),rows=[];
try{
 for(const [i,item] of data.tracks.entries()){
  const file=join(tmp,'source-'+i+'.wav');
  const convert=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y',
    '-i',join(folder,item.file),'-ac','1','-ar','44100','-c:a','pcm_f32le',file],
    {encoding:'utf8',timeout:55000});
  if(convert.status!==0)throw Error('Conversion failed: '+item.id);
  const audio=decodeLocalWav(file);
  const vector=engine.arrayToVector(audio.getChannelData(0));
  const start=performance.now();
  let output;
  try{
   output=engine.RhythmExtractor2013(vector,208,'multifeature',40);
  }finally{vector.delete?.();}
  const bpm=Number.isFinite(output?.bpm)?+output.bpm.toFixed(2):null;
  rows.push({id:item.id,genreGroup:item.genreGroup,split:item.split,
    sourceBpm:item.bpm,essentiaJSBpm:bpm,
    withinOne:bpm!==null&&Math.abs(bpm-item.bpm)<=1,
    durationMs:+(performance.now()-start).toFixed(1)});
  console.log(item.id,'label',item.bpm,'EssentiaJS',bpm,'timeMs',rows.at(-1).durationMs);
 }
}finally{engine.delete?.();rmSync(tmp,{recursive:true,force:true});}
const summary={};
for(const split of ['development','held-out','all']){
 const selected=rows.filter(x=>split==='all'||x.split===split);
 summary[split]={count:selected.length,withinOne:selected.filter(x=>x.withinOne).length,
  avgMs:selected.length?+(selected.reduce((a,b)=>a+b.durationMs,0)/selected.length).toFixed(1):null};
}
const result={schema:1,source:'WaivOps official source BPM labels',library:'Essentia.js v0.1.3 AGPL-3.0',
  purpose:'WebAssembly parity investigation ONLY; not part of static JonaAudio release',
  caveat:'Browser load, iOS memory, and copyleft source obligations need review. Source audio never uploaded.',
  summary,rows};
writeFileSync(join(folder,'essentiajs-results.json'),JSON.stringify(result,null,2)+'\n');
console.log('WASM-PARITY',JSON.stringify(summary));
