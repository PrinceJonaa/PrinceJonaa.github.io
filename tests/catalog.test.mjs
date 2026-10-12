import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {apps,worlds} from '../assets/registry.js';
import {searchRecords,publicIndex,musicTasks,paths} from '../assets/catalog.js';
const ids=new Set();
test('public index has unique IDs and routes for every approved app and world',()=>{
 for(const r of [...apps,...worlds]){assert.equal(r.visibility,'public');assert.equal(r.editorialState,'published');}
 for(const r of publicIndex){assert.ok(!ids.has(r.publicId),r.publicId);ids.add(r.publicId);assert.ok(['app','world','action','service','caseStudy','resume'].includes(r.kind));const url=new URL(r.href,'https://princejona.me');assert.ok(['https:'].includes(url.protocol));if(url.origin==='https://princejona.me')assert.ok(existsSync('.'+url.pathname+(url.pathname.endsWith('/')?'index.html':'')),r.href);}
 assert.equal(apps.length,8);for(const a of apps){assert.equal(searchRecords(publicIndex,a.name).some(r=>r.publicId===a.publicId),true);assert.ok(a.owner);assert.ok(a.owningRepo);assert.ok(a.howToRecover);assert.equal(a.deviceEvidence,null);}
 for(const w of worlds)assert.ok(searchRecords(publicIndex,w.name).some(r=>r.publicId===w.publicId));
});
test('search matches all tokens and tags, categories, release statuses and reset',()=>{
 assert.deepEqual(searchRecords(apps,'BPM').map(r=>r.id),['jonaaudio']);assert.equal(searchRecords(apps,'JÓNA audio').length,1);
 assert.equal(searchRecords(apps,'', {category:'utility'}).length,1);assert.equal(searchRecords(apps,'',{status:'preview'})[0].id,'rhythmcut');
 assert.equal(searchRecords(apps,'impossible term').length,0);assert.equal(searchRecords(apps,'').length,8);
});
test('private and draft records never reach returned search data',()=>{
 const base={...apps[0],name:'secret person',tags:['confidential']};
 assert.equal(searchRecords([{...base,visibility:'private'},{...base,editorialState:'draft'}],'secret').length,0);
});
test('task routes and four paths reach real endpoints',()=>{
 assert.equal(paths.length,4);assert.equal(musicTasks.length,6);
 const hashes=musicTasks.filter(t=>t.href.startsWith('/JonaAudio/')).map(t=>new URL(t.href,'https://princejona.me').hash);assert.deepEqual(hashes,['#quick','#studio/tune','#studio/sample','#studio/engineer','#studio/compare']);
});
test('release evidence preserves source/deployment distinction and canonical origin',()=>{
 const r=apps.find(a=>a.id==='rhythmcut'),release=JSON.parse(readFileSync('rhythmcut/release.json'));assert.equal(r.builtArtifactCommit,release.commit);assert.notEqual(r.sourceCommit,r.builtArtifactCommit);assert.match(r.lastKnownIssue,/behind/);
 assert.equal(readFileSync('CNAME','utf8').trim(),'princejona.me');
});
test('all public pages have direct navigation, palette, breadcrumbs and public metadata',()=>{
 for(const route of ['',...worlds.map(w=>w.id),'404.html']){
  const filename=route==='404.html'?route:route?route+'/index.html':'index.html';const html=readFileSync(filename,'utf8');assert.match(html,/data-search-dialog/);assert.match(html,/data-open-search/);assert.match(html,/application\/ld\+json/);assert.match(html,/og:image/);if(route)assert.match(html,/aria-label="Breadcrumb"/);
  assert.ok(!/onnx|ort-wasm|rhythmcut\/assets|ffmpeg/i.test(html));
 }
});
