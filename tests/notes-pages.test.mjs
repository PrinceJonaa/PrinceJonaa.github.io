import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildNotes, markdownToHtml } from '../scripts/build-notes.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const approvedContent = `# A synthetic document used only in tests

This fixture checks the article renderer and is not a statement attributed to the artist. It has enough meaningful sample text to exercise paragraph rendering, metadata, reading structure, and safe links under the local temporary test directory.

## A section

- A first nonpublic example
- A second example with **bold** emphasis

A [secure source](https://example.org/docs) can be linked without letting an unsafe URI become a browser-executable URL. The test content is deliberately artificial.`;
function fixture(overrides = {}) {
  return {
    id:'note:sample',slug:'sample',title:'Synthetic fixture for unit tests',summary:'A synthetic test article for verifying the notes renderer, never intended for publishing.',
    authorId:'person:prince-jona',articleType:'software-tutorial',status:'public',authoredAt:null,publishedAt:'2026-10-27',updatedAt:null,
    categories:['Creative Tools'],contentFile:'content/notes/sample.md',heroAsset:null,sources:['https://example.org/docs'],
    rights:{textApproved:true,thirdPartyMediaApproved:true},
    editorialApproval:{approvedBy:'person:prince-jona',publicationApproved:true,approvedAt:'2026-10-27',revision:'synthetic-test-only',evidenceUrl:'https://example.org/test-approval'},
    relatedEdges:[],...overrides
  };
}
async function setup(entries = [], content = approvedContent) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jona-notes-fixture-'));
  await mkdir(path.join(root,'templates'),{recursive:true});
  await mkdir(path.join(root,'content/notes'),{recursive:true});
  await mkdir(path.join(root,'data'),{recursive:true});
  await cp(path.join(sourceRoot,'templates/note.html'),path.join(root,'templates/note.html'));
  await writeFile(path.join(root,'data/public-notes.json'),JSON.stringify({schemaVersion:1,updatedAt:null,entries}));
  await writeFile(path.join(root,'content/notes/sample.md'),content);
  return root;
}
const dispose = async (root) => rm(root,{recursive:true,force:true});
const read = (root,file) => readFile(path.join(root,file),'utf8');

test('production archive has no unapproved articles or fabricated cards',async()=>{
  const manifest=JSON.parse(await readFile(path.join(sourceRoot,'data/public-notes.json'),'utf8'));
  assert.equal(manifest.schemaVersion,1);
  assert.deepEqual(manifest.entries,[]);
  const landing=await readFile(path.join(sourceRoot,'notes/index.html'),'utf8');
  assert.match(landing,/No articles have been approved/);
  assert.match(landing,/noindex,follow/);
  assert.match(landing,/href="\/music\/"/);
  assert.match(landing,/href="\/atlas\/"/);
  assert.equal((landing.match(/<h1[\s>]/g)??[]).length,1);
  assert.ok(landing.includes('src="/assets/notes.js"'));
});

test('draft and review entries never publish or leak private text',async(t)=>{
  const entries=[fixture({status:'draft',title:'PRIVATE DRAFT'})];
  const root=await setup(entries,'NEVER_PUBLISH_THIS');t.after(()=>dispose(root));
  await buildNotes({root});
  assert.doesNotMatch(await read(root,'notes/index.html'),/PRIVATE DRAFT|NEVER_PUBLISH_THIS/);
  assert.deepEqual(await readdir(path.join(root,'notes')),['index.html']);
  entries[0].status='review';
  await writeFile(path.join(root,'data/public-notes.json'),JSON.stringify({schemaVersion:1,updatedAt:null,entries}));
  await buildNotes({root});
  assert.deepEqual(await readdir(path.join(root,'notes')),['index.html']);
});

test('approved synthetic fixture renders semantic crawlable article deterministically',async(t)=>{
  const root=await setup([fixture()]);t.after(()=>dispose(root));
  const result=await buildNotes({root});
  assert.deepEqual(result,{pages:2,published:1,slugs:['sample'],sitemap:'/notes/sitemap.xml'});
  const html=await read(root,'notes/sample/index.html');
  assert.match(html,/<article class="article">/);
  assert.match(html,/<h2>A synthetic document used only in tests<\/h2>/);
  assert.match(html,/<time datetime="2026-10-27">/);
  assert.match(html,/<meta name="description"/);
  assert.match(html,/https:\/\/princejona.me\/notes\/sample\//);
  assert.match(html,/<script type="application\/ld\+json">/);
  assert.match(html,/"@type":"BlogPosting"/);
  assert.match(html,/"@id":"https:\/\/princejona.me\/#prince-jona"/);
  assert.match(html,/Skip to content/);
  assert.equal((html.match(/<h1[\s>]/g)??[]).length,1);
  assert.doesNotMatch(html,/data-open-search|window\.onload|autoplay/);
  const sitemap=await read(root,'notes/sitemap.xml');
  assert.match(sitemap,/https:\/\/princejona\.me\/notes\/sample\//);
  assert.match(sitemap,/https:\/\/princejona\.me\/notes\/<\/loc>/);
  const feed=await read(root,'notes/feed.xml');
  assert.match(feed,/<rss version="2\.0">/);
  assert.match(feed,/Synthetic fixture for unit tests/);
  await buildNotes({root});
  assert.equal(await read(root,'notes/sample/index.html'),html);
});

test('unsafe Markdown is escaped; JavaScript links and unapproved images fail',async(t)=>{
  assert.match(markdownToHtml('A <script>alert(1)</script>'),/&lt;script&gt;/);
  assert.doesNotMatch(markdownToHtml('A <script>alert(1)</script>'),/<script>/);
  assert.throws(()=>markdownToHtml('[click](javascript:alert)'),/unsafe Markdown link/);
  assert.throws(()=>markdownToHtml('![screenshot](https://example.org/fake.png)'),/images require/);
  const root=await setup([fixture()],approvedContent+'\n\n[unsafe](data:text/html)');t.after(()=>dispose(root));
  await assert.rejects(buildNotes({root}),/unsafe Markdown link/);
});

test('bad slugs, duplicate IDs, missing permissions and incorrect paths fail closed',async(t)=>{
  for (const entry of [
    fixture({slug:'../unapproved'}),
    fixture({editorialApproval:{approvedBy:'agent',publicationApproved:true}}),
    fixture({rights:{textApproved:false,thirdPartyMediaApproved:true}}),
    fixture({contentFile:'../secrets.md'}),
    fixture({publishedAt:'unknown'})
  ]) {
    const root=await setup([entry]);t.after(()=>dispose(root));
    await assert.rejects(buildNotes({root}));
  }
  const root=await setup([fixture(),fixture({slug:'second',contentFile:'content/notes/second.md'})]);t.after(()=>dispose(root));
  await assert.rejects(buildNotes({root}),/duplicate note id/);
});

test('public relation edges require approved provenance and existing real targets',async(t)=>{
  const edge={from:'note:sample',to:'tool:jonaaudio',type:'references',sourceUrl:'https://example.org/docs',visibility:'public',approval:{approved:true}};
  const root=await setup([fixture({relatedEdges:[edge]})]);t.after(()=>dispose(root));
  await assert.rejects(buildNotes({root}),/missing public route/);
  await mkdir(path.join(root,'JonaAudio'),{recursive:true});
  await writeFile(path.join(root,'JonaAudio/index.html'),'public route stub in a test sandbox');
  await buildNotes({root});
  const html=await read(root,'notes/sample/index.html');
  assert.match(html,/Explore connections/);
  assert.match(html,/href="\/JonaAudio\/"/);
  const bad={...edge,to:'release:unverified'};
  await writeFile(path.join(root,'data/public-notes.json'),JSON.stringify({schemaVersion:1,updatedAt:null,entries:[fixture({relatedEdges:[bad]})]}));
  await assert.rejects(buildNotes({root}),/unresolved public relation/);
});

test('withheld relations never produce links or trigger guessed destinations',async(t)=>{
  const root=await setup([fixture({relatedEdges:[{from:'note:sample',to:'release:unreleased',type:'about',visibility:'review',approval:{approved:false}}]})]);t.after(()=>dispose(root));
  await buildNotes({root});
  const html=await read(root,'notes/sample/index.html');
  assert.doesNotMatch(html,/release:unreleased|Explore connections/);
});

test('withdrawal removes only previously generated pages, never unrelated content',async(t)=>{
  const root=await setup([fixture()]);t.after(()=>dispose(root));
  await buildNotes({root});
  await mkdir(path.join(root,'notes/custom'),{recursive:true});
  await writeFile(path.join(root,'notes/custom/index.html'),'keep me');
  await writeFile(path.join(root,'data/public-notes.json'),JSON.stringify({schemaVersion:1,updatedAt:null,entries:[fixture({status:'withdrawn'})]}));
  await buildNotes({root});
  await assert.rejects(read(root,'notes/sample/index.html'),/ENOENT/);
  assert.equal(await read(root,'notes/custom/index.html'),'keep me');
});

test('Notes CSS includes mobile reflow, focus and reduced motion support',async()=>{
  const css=await readFile(path.join(sourceRoot,'assets/notes.css'),'utf8');
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  const template=await readFile(path.join(sourceRoot,'templates/note.html'),'utf8');
  assert.match(template,/<main id="main">/);
  assert.match(template,/aria-label="Notes navigation"/);
});

test('SEO sitemap and feed exclude drafts and vanish on withdrawal',async(t)=>{
  const root=await setup([fixture({status:'review'})]);t.after(()=>dispose(root));
  await buildNotes({root});
  await assert.rejects(read(root,'notes/sitemap.xml'),/ENOENT/);
  await assert.rejects(read(root,'notes/feed.xml'),/ENOENT/);
  const entries=[fixture()];
  await writeFile(path.join(root,'data/public-notes.json'),JSON.stringify({schemaVersion:1,updatedAt:null,entries}));
  await buildNotes({root});
  entries[0].status='withdrawn';
  await writeFile(path.join(root,'data/public-notes.json'),JSON.stringify({schemaVersion:1,updatedAt:null,entries}));
  await buildNotes({root});
  await assert.rejects(read(root,'notes/sitemap.xml'),/ENOENT/);
  await assert.rejects(read(root,'notes/feed.xml'),/ENOENT/);
});

test('writing desk is safe and cannot publish or send drafts',async()=>{
  const html=await readFile(path.join(sourceRoot,'notes/editor/index.html'),'utf8');
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
  assert.match(html,/Private browser scratchpad/);
  assert.match(html,/Export Markdown/);
  assert.match(html,/replaceChildren\(\)/);
  assert.doesNotMatch(html,/fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
  assert.doesNotMatch(html,/<form[^>]+action=/);
});
