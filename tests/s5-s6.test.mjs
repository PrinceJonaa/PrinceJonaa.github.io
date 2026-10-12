import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=f=>readFileSync(f,'utf8');
test('S5 public export contains only already published source concepts',()=>{
 const m=JSON.parse(load('assets/atlas-public.json'));
 assert.equal(m.schema,1);
 assert.equal(m.notFullAtlas,true);
 assert.equal(m.articles.length,6);
 const ids=new Set(m.articles.map(a=>a.id));
 for(const a of m.articles){
  assert.equal(a.status,'published');
  assert.equal(a.evidenceClass,'authoredInterpretation');
  assert.equal(a.body,a.summary);
  assert.ok(a.sourceRefs.every(s=>s.startsWith('https://github.com/PrinceJonaa/PrinceJonaa.github.io/')));
  assert.match(a.id,/^article:[a-z0-9-]+$/);
 }
 assert.equal(ids.size,6);
 for(const e of m.edges){assert.equal(e.status,'published');assert.equal(e.evidenceClass,'authoredInterpretation');assert.ok(ids.has(e.fromId)&&ids.has(e.toId));assert.equal(e.label,'navigate to lens');}
 assert.ok(!load('assets/atlas-public.json').includes('app.notion.com/p/3e5adfe9'));
});
test('S5 integrates searchable direct links and dialog with keyboard fallback',()=>{
 assert.match(load('assets/catalog.js'),/atlasSearch/);
 assert.match(load('assets/discovery.js'),/Atlas concepts/);
 for(const p of ['data-atlas-list','data-atlas-graph','data-atlas-window','data-atlas-close'])assert.ok(load('atlas/index.html').includes(p));
 assert.match(load('assets/atlas-public.js'),/popstate/);
});
test('S6 owner API fails closed without valid signed JWT, even with spoofed headers',async()=>{
 const raw=load('cloudflare/universe-owner/index.js');
 assert.match(raw,/crypto\.subtle\.verify/);
 assert.match(raw,/get\('Cf-Access-Jwt-Assertion'\)/);
 assert.match(raw,/SELECT role FROM principals WHERE email=\? AND active=1/);
 assert.match(raw,/X-Universe-Action/);
 assert.ok(!raw.includes('service_role'));
 const handler=new Function(raw.replace('export default {fetch:respond};','return respond;'))();
 const fakeDb={prepare(){throw Error('DB must not be touched by unsigned users');}};
 const response=await handler(new Request('https://princejona-universe-owner.jbonner.workers.dev/api/items',{headers:{'Cf-Access-Authenticated-User-Email':'owner@example.invalid'}}),{DB:fakeDb});
 assert.equal(response.status,401);
 assert.equal(response.headers.get('Cache-Control'),'no-store, private');
 const spoof=await handler(new Request('https://princejona-universe-owner.jbonner.workers.dev/',{headers:{'Cf-Access-Jwt-Assertion':'not.a.jwt'}}),{DB:fakeDb});
 assert.equal(spoof.status,401);
});
