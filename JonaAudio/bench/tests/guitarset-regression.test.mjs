import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../fixtures/GuitarSet');
const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
const reportPath=join(root,'benchmark-results.json');

test('fixture metadata preserves independent CC BY license and original JAMS source',()=>{
 assert.equal(manifest.schema,1);
 assert.equal(manifest.dataset,'GuitarSet');
 assert.equal(manifest.version,'1.1.0');
 assert.equal(manifest.doi,'10.5281/zenodo.3371780');
 assert.equal(manifest.license,'CC BY 4.0');
 assert.equal(manifest.tracks.length,8);
 const credits=readFileSync(join(root,'CREDITS.md'),'utf8');
 assert.match(credits,/Qingyang Xi/);
 assert.match(credits,/Creative Commons Attribution 4\.0/);
 assert.match(credits,/https:\/\/doi\.org\/10\.5281\/zenodo\.3371780/);
 assert.match(manifest.annotations_source,/Original GuitarSet JAMS/);
});

test('fixture audio is present, unique and byte-identical to provenance SHA-256',()=>{
 const ids=new Set(),files=new Set();
 for(const track of manifest.tracks){
  assert.match(track.id,/^[A-Za-z0-9_#-]+$/);
  assert.ok(!ids.has(track.id),'Duplicate track ID: '+track.id);ids.add(track.id);
  assert.equal(track.file,track.id+'.m4a');
  assert.ok(!files.has(track.file));files.add(track.file);
  assert.match(track.source_wav_sha256,/^[0-9a-f]{64}$/);
  assert.match(track.fixture_sha256,/^[0-9a-f]{64}$/);
  assert.ok(Number.isFinite(track.bpm)&&track.bpm>=20&&track.bpm<=400);
  assert.match(track.key,/^[A-G][#b]? (?:major|minor)$/);
  assert.ok(existsSync(join(root,track.file)),'Missing '+track.file);
  const actual=createHash('sha256').update(readFileSync(join(root,track.file))).digest('hex');
  assert.equal(actual,track.fixture_sha256,'Fixture content changed: '+track.id);
 }
});

test('fresh real-audio report contains eight independent source labels and scored methods',()=>{
 assert.ok(existsSync(reportPath),'Missing newly generated benchmark-results.json');
 const report=JSON.parse(readFileSync(reportPath,'utf8'));
 assert.equal(report.schema,1);
 assert.equal(report.kind,'open-licensed-GuitarSet-real-recordings');
 assert.equal(report.dataset,manifest.dataset);
 assert.equal(report.version,manifest.version);
 assert.equal(report.doi,manifest.doi);
 assert.equal(report.license,manifest.license);
 assert.equal(report.sampleCount,manifest.tracks.length);
 assert.ok(Array.isArray(report.aggregates)&&report.aggregates.length>=4);
 assert.equal(report.perTrack.length,manifest.tracks.length);
 const source=new Map(manifest.tracks.map(x=>[x.id,x]));
 for(const scored of report.perTrack){
  const label=source.get(scored.id);
  assert.ok(label,'Scored an unknown recording');
  assert.equal(scored.sourceKey,label.key);
  assert.equal(scored.sourceTempoBpm,label.bpm);
  assert.equal(scored.file,label.file);
  assert.ok(scored.quick&&scored.verify&&scored.spectralPeaks&&scored.spectralFlux);
 }
 for(const summary of report.aggregates){
  assert.ok(summary.tracks===8);
  assert.ok(Number.isSafeInteger(summary.keyCount)&&summary.keyCount>=0&&summary.keyCount<=8);
  assert.ok(Number.isSafeInteger(summary.exactKeys)&&summary.exactKeys>=0&&summary.exactKeys<=summary.keyCount);
  assert.ok(Number.isSafeInteger(summary.bpmWithinOne)&&summary.bpmWithinOne>=0&&summary.bpmWithinOne<=summary.tempoCount);
 }
});
