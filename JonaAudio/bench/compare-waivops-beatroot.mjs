#!/usr/bin/env node
// Evaluate MIT BeatRoot implementation. This does NOT link it into production.
// Call with BEATROOT_PACKAGE=/tmp/.../node_modules/music-tempo.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {decodeLocalWav} from './wav-loader.mjs';
const require=createRequire(import.meta.url);
const packagePath=process.env.BEATROOT_PACKAGE||'music-tempo';
const MusicTempo=require(packagePath);
const root='JonaAudio/bench/fixtures/WaivOps';
const m=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
const work=mkdtempSync(join(tmpdir(),'jona-musictempo-')),rows=[];
try{
 for(const [i,track] of m.tracks.entries()){
  const path=join(work,i+'.wav');
  const p=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-i',join(root,track.file),
    '-ac','1','-ar','44100','-c:a','pcm_s16le',path],{encoding:'utf8',timeout:45000});
  if(p.status!==0)throw Error(String(p.stderr||p.error));
  const audio=decodeLocalWav(path);
  const mt=new MusicTempo(audio.getChannelData(0),{
    bufferSize:2048,hopSize:441,timeStep:.01,
    minBeatInterval:60/210,maxBeatInterval:60/55
  });
  const parsed=Number(mt.tempo); // Upstream BeatRoot serializes BPM with toFixed() to a string.
  const bpm=Number.isFinite(parsed)&&parsed>0?+parsed.toFixed(2):null;
  rows.push({id:track.id,bpm,reference:track.bpm,split:track.split,group:track.genreGroup,
   within1:bpm!==null&&Math.abs(track.bpm-bpm)<=1,
   within3:bpm!==null&&Math.abs(track.bpm-bpm)<=3,
   beatCount:mt.beats?.length??0});
  console.log(track.id,'label',track.bpm,'MIT BeatRoot',bpm);
 }
}finally{rmSync(work,{force:true,recursive:true});}
const stats={};
for(const split of ['all','development','held-out']){
 const xs=rows.filter(x=>split==='all'||x.split===split);
 stats[split]={count:xs.length,withinOne:xs.filter(x=>x.within1).length,withinThree:xs.filter(x=>x.within3).length};
}
const obj={schema:1,reference:'Original WaivOps CC BY source BPM annotations',engine:'music-tempo@1.0.3 (BeatRoot), MIT licensed',
 config:'44.1kHz mono, FFT2048 hop441, IBI bounds 55–210 BPM',
 disclaimer:'One independently tested method; evaluate held-out not just development before integration',
 stats,rows};
writeFileSync(join(root,'music-tempo-results.json'),JSON.stringify(obj,null,2)+'\n');
console.log('MIT-BEATROOT',JSON.stringify(stats));
