#!/usr/bin/env node
// Genuine full-song key benchmark with expert FMAK keys and per-song CC BY licenses.
// Only small JSON reports persist; the copyrighted original MP3s remain temporary.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {decodeLocalWav} from './wav-loader.mjs';
import {windowInputs} from '../analysis-input.js';
import {analyzeCapability} from '../analysis-worker-core.js';
import {parsedKey} from './score-labeled.js';

const root='JonaAudio/bench/fixtures/FMAK';
const manifest=JSON.parse(readFileSync(join(root,'selection.json'),'utf8'));
if(manifest.annotationDoi!=='10.5281/zenodo.10719860'||manifest.tracks.length<5)
 throw Error('No independently annotated, licensed full-song files');
const rows=[],scratch=mkdtempSync(join(tmpdir(),'jona-fmak-'));
try{
 for(const [i,track] of manifest.tracks.entries()){
  if(!parsedKey(track.key)||!track.license.toLowerCase().startsWith('attribution'))
   throw Error('Invalid expert reference or per-song audio license '+track.trackId);
  const target=join(scratch,'source-'+i+'.wav');
  const ffmpeg=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error',
    '-i',join(root,track.filename),'-ar','11025','-ac','1','-c:a','pcm_s16le',target],
    {encoding:'utf8',timeout:120000});
  if(ffmpeg.status!==0)throw Error('Decoder failed '+track.trackId+' '+String(ffmpeg.stderr).slice(0,180));
  const audio=decodeLocalWav(target);
  if(audio.duration<50)throw Error('Not full-length enough to test '+track.trackId+' '+audio.duration);
  const quick=windowInputs(audio,{mode:'quick'});
  const deep=windowInputs(audio,{mode:'verify'});
  const q=analyzeCapability('key',{...quick,analysisMode:'quick'});
  const v=analyzeCapability('key',{...deep,analysisMode:'verify'});
  const candidates=v.result?.keys?.slice(0,5)??[];
  const peaks=v.result?.peakEvidence?.keys?.slice(0,3)??[];
  const label=parsedKey(track.key);
  const score=(key)=>parsedKey(key)?.canonical===label?.canonical;
  const sameScale=(key)=>{const a=parsedKey(key);return !!(a&&a.pitchClasses.every((x,i)=>x===label.pitchClasses[i]));};
  rows.push({
   id:track.id,trackId:track.trackId,genre:track.genre,artist:track.artist,
   labelSource:'FMAK expert key mode',referenceKey:track.key,
   originalLicense:track.license,fullSongSeconds:+audio.duration.toFixed(1),
   quick:q.result?.keys?.[0]?.key??null,
   verify:candidates[0]?.key??null,
   peak:peaks[0]?.key??null,
   quickExact:score(q.result?.keys?.[0]?.key),
   verifyExact:score(candidates[0]?.key),
   peakExact:score(peaks[0]?.key),
   verifyTopThree:candidates.slice(0,3).some(x=>score(x.key)),
   verifyScaleCompatible:sameScale(candidates[0]?.key),
   verifyTopCandidates:candidates.map(x=>x.key)
  });
  console.log(track.id,track.genre,track.key,'quick',rows.at(-1).quick,
    'verify',rows.at(-1).verify,'peaks',rows.at(-1).peak,'duration',audio.duration.toFixed(1));
 }
}finally{rmSync(scratch,{recursive:true,force:true});}
const summarize=(items)=>({
 count:items.length,quickExact:items.filter(x=>x.quickExact).length,
 verifyExact:items.filter(x=>x.verifyExact).length,
 peakExact:items.filter(x=>x.peakExact).length,
 verifyScaleCompatible:items.filter(x=>x.verifyScaleCompatible).length,
 verifyTopThree:items.filter(x=>x.verifyTopThree).length
});
const report={schema:1,dataset:'FMAK full-length songs',annotationDoi:manifest.annotationDoi,
 scope:'Unmodified original full-song recordings; actual track-level CC BY licenses',
 sampling:'Same JonaAudio Quick (12-second, three windows) and Verify (24-second, up to five windows) as website',
 evidence:'Expert song-level key labels, NOT inferred from file names or another model',
 caveat:'Small curated genre sample with several tracks from one hip-hop artist; does not establish cross-artist production accuracy',
 score:{all:summarize(rows),hipHop:summarize(rows.filter(x=>x.genre==='Hip-Hop')),
  other:summarize(rows.filter(x=>x.genre!=='Hip-Hop'))},rows};
writeFileSync(join(root,'full-song-results.json'),JSON.stringify(report,null,2)+'\n');
console.log('EXPERT FULL-SONG KEY SCORES',JSON.stringify(report.score));
