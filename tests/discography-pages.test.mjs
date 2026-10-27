import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {buildDiscography} from '../scripts/build-discography.mjs';

const ROOT=resolve(import.meta.dirname,'..'),read=p=>readFileSync(join(ROOT,p),'utf8');
const official='https://open.spotify.com/album/ABC123abc';
const fixture=()=>({
  schemaVersion:1,reviewedAt:'2026-10-27',
  sources:[{id:'source:official-1',kind:'official-release',url:official,verifiedAt:'2026-10-27'}],
  releases:[{
    id:'release:example-1',slug:'sample-single',title:'Sample single <script>alert(1)</script>',kind:'single',
    status:'public',primaryArtistIds:['person:prince-jona'],trackIds:['track:example-1'],
    releaseDate:'2026-10-27',datePrecision:'day',
    links:[{platform:'spotify',url:official,sourceId:'source:official-1'}],
    evidenceSourceIds:['source:official-1'],
    fieldSources:{title:['source:official-1'],kind:['source:official-1'],primaryArtistIds:['source:official-1'],releaseDate:['source:official-1'],editorial:['source:official-1']},
    approvals:{publicMetadataApproved:true,approvedBy:'person:prince-jona',approvedAt:'2026-10-27',publicTextApproved:true},
    editorial:{introduction:'Synthetic fixture only <img src=x onerror=alert(1)>. Not a genuine work.'}
  }],
  tracks:[{id:'track:example-1',title:'Demo <b>song</b>',releaseIds:['release:example-1'],position:1,sourceIds:['source:official-1'],approvals:{publicMetadataApproved:true}}]
});
function harness(data=fixture()){
  const dir=mkdtempSync(join(tmpdir(),'prince-jona-discog-'));
  mkdirSync(join(dir,'data'));mkdirSync(join(dir,'templates'));mkdirSync(join(dir,'music'));
  writeFileSync(join(dir,'data/public-discography.json'),JSON.stringify(data));
  writeFileSync(join(dir,'templates/music-release.html'),read('templates/music-release.html'));
  writeFileSync(join(dir,'music/index.html'),'before\n<!-- PUBLIC_DISCOGRAPHY_START -->\nold\n<!-- PUBLIC_DISCOGRAPHY_END -->\nafter\n');
  return {dir,save:d=>writeFileSync(join(dir,'data/public-discography.json'),JSON.stringify(d)),close:()=>rmSync(dir,{recursive:true,force:true})};
}
test('production release registry is empty and does not affect legacy schema-1 S3 catalog',()=>{
  const registry=JSON.parse(read('data/public-discography.json'));
  const catalog=JSON.parse(read('assets/music-catalog.json'));
  assert.equal(registry.schemaVersion,1);
  assert.deepEqual(registry.releases,[]);
  assert.deepEqual(registry.tracks,[]);
  assert.equal(catalog.schema,1);
  assert.deepEqual(catalog.releases,[]);
  assert.deepEqual(catalog.tracks,[]);
  assert.match(read('assets/music-world.js'),/sitePreviewApproved===true/);
  assert.match(read('assets/music-world.js'),/publicMetadataApproved===true/);
  assert.match(read('music/index.html'),/data-music-provider/);
});
test('no verified releases means no generated public pages, and check is stable',()=>{
  const h=harness({schemaVersion:1,reviewedAt:'2026-10-27',sources:[],releases:[],tracks:[]});
  try{
    assert.equal(buildDiscography(h.dir).published,0);
    assert.match(readFileSync(join(h.dir,'music/index.html'),'utf8'),/rights are verified/);
    assert.deepEqual(buildDiscography(h.dir,{check:true}).paths,[]);
  }finally{h.close();}
});
test('approved synthetic release becomes static, escaped, canonical and schema-rich',()=>{
  const h=harness();
  try{
    assert.equal(buildDiscography(h.dir).published,1);
    const file=join(h.dir,'music/sample-single/index.html'),html=readFileSync(file,'utf8');
    assert.match(html,/rel="canonical" href="https:\/\/princejona.me\/music\/sample-single\/"/);
    assert.match(html,/<h1>Sample single &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h1>/);
    assert.match(html,/Synthetic fixture only &lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html,/<script>alert\(1\)<\/script>|<img src=x onerror=/);
    assert.match(html,/<ol class="release-tracks"><li>Demo &lt;b&gt;song&lt;\/b&gt;<\/li><\/ol>/);
    assert.match(html,/target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(html,/<(?:audio|video|iframe)\b[^>]*\bautoplay\b/i);
    const ld=JSON.parse(html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/)[1]);
    const graph=ld['@graph'];
    assert.equal(graph.find(n=>n['@type']==='Person')['@id'],'https://princejona.me/#prince-jona');
    assert.equal(graph.find(n=>n['@type']==='MusicRecording').name,fixture().releases[0].title);
    assert.equal(graph.find(n=>n['@type']==='BreadcrumbList').itemListElement.length,3);
    assert.match(readFileSync(join(h.dir,'music/index.html'),'utf8'),/href="\/music\/sample-single\/"/);
    assert.doesNotThrow(()=>buildDiscography(h.dir,{check:true}));
    const same=readFileSync(file,'utf8');
    buildDiscography(h.dir);
    assert.equal(readFileSync(file,'utf8'),same);
  }finally{h.close();}
});
test('rights and provenance omissions stop publishing instead of leaking content',()=>{
  const cases=[
    d=>{d.releases[0].approvals.publicMetadataApproved=false;},
    d=>{d.releases[0].status='public';d.releases[0].evidenceSourceIds=[];},
    d=>{delete d.releases[0].fieldSources.title;},
    d=>{d.releases[0].editorial.whyIMadeIt='Unapproved';d.releases[0].approvals.publicTextApproved=false;},
    d=>{d.releases[0].cover={src:'/assets/uncleared.jpg',alt:'cover'};},
    d=>{d.releases[0].editorial.intentionalLyricNotes=[{excerpt:'quoted',meaning:'test'}];},
    d=>{d.tracks[0].approvals.publicMetadataApproved=false;},
    d=>{d.releases[0].credits=[{name:'Mystery',role:'Producer',sourceId:'source:absent'}];},
    d=>{d.releases[0].credits=[{name:'Synthetic credit',role:'Producer',sourceId:'source:official-1'}];},
    d=>{d.releases[0].related=[{title:'Music world',href:'/music/',sourceId:'source:official-1'}];},
    d=>{d.releases[0].related=[{title:'Music world',href:'/music/',sourceId:'source:missing'}];d.releases[0].approvals.publicRelationsApproved=true;},
    d=>{d.releases[0].editorial.creativeTimeline=[{label:'Undated project',date:'2026-99-99'}];}
  ];
  for(const mutate of cases){
    const data=fixture();mutate(data);
    const h=harness(data);
    try{
      assert.throws(()=>buildDiscography(h.dir),/Discography:/);
      assert.ok(!existsSync(join(h.dir,'music/sample-single/index.html')));
    }finally{h.close();}
  }
});
test('traversal, duplicate identity and unsafe/unverified streaming URLs are rejected',()=>{
  const cases=[
    d=>{d.releases[0].slug='../outside';},
    d=>{d.releases[0].slug='Sample-Single';},
    d=>{d.releases.push({...d.releases[0],id:'release:another'});},
    d=>{d.releases[0].links[0].url='javascript:alert(1)';},
    d=>{d.releases[0].links[0].url='https://open.spotify.com/artist/abcd';},
    d=>{d.releases[0].links[0].url='https://open.spotify.com/album/OTHER';},
    d=>{d.tracks.push({...d.tracks[0]});}
  ];
  for(const mutate of cases){
    const data=fixture();mutate(data);
    const h=harness(data);
    try{assert.throws(()=>buildDiscography(h.dir));}
    finally{h.close();}
  }
});
test('approved credits, relationships and creative timeline are escaped and visible',()=>{
  const d=fixture(),r=d.releases[0];
  r.approvals.publicCreditsApproved=true;
  r.approvals.publicRelationsApproved=true;
  r.credits=[{name:'Demo <b>producer</b>',role:'Producer',sourceId:'source:official-1'}];
  r.related=[{title:'Music world <3',href:'/music/',sourceId:'source:official-1'}];
  r.editorial.creativeTimeline=[{date:'2026-10-27',label:'Sketch <draft>',detail:'A synthetic test, not an artist claim.'}];
  const h=harness(d);
  try{
    buildDiscography(h.dir);
    const html=readFileSync(join(h.dir,'music/sample-single/index.html'),'utf8');
    assert.match(html,/Demo &lt;b&gt;producer&lt;\/b&gt;/);
    assert.match(html,/Music world &lt;3/);
    assert.match(html,/Sketch &lt;draft&gt;/);
    assert.match(html,/<time datetime="2026-10-27">/);
  }finally{h.close();}
});
test('references cannot point to an unapproved release even if its page exists',()=>{
  const d=fixture(),r=d.releases[0];
  d.releases.push({...structuredClone(r),id:'release:future',slug:'future-release',status:'review',trackIds:[]});
  r.approvals.publicRelationsApproved=true;
  r.related=[{title:'Not yet published',href:'/music/future-release/',sourceId:'source:official-1'}];
  const h=harness(d);
  try{
    mkdirSync(join(h.dir,'music/future-release'));
    writeFileSync(join(h.dir,'music/future-release/index.html'),'stale page');
    assert.throws(()=>buildDiscography(h.dir),/related release is not public/);
  }finally{h.close();}
});
test('drafts never generate pages and withdrawal removes only generated files',()=>{
  const data=fixture(),h=harness(data);
  try{
    buildDiscography(h.dir);
    const path=join(h.dir,'music/sample-single/index.html');
    assert.ok(existsSync(path));
    data.releases[0].status='withdrawn';h.save(data);
    assert.throws(()=>buildDiscography(h.dir,{check:true}),/Stale generated/);
    assert.equal(buildDiscography(h.dir).published,0);
    assert.equal(existsSync(path),false);
    assert.doesNotMatch(readFileSync(join(h.dir,'music/index.html'),'utf8'),/href="\/music\/sample-single\/"/);
    assert.doesNotThrow(()=>buildDiscography(h.dir,{check:true}));
  }finally{h.close();}
});
test('same verified recording on single and album reuses track ID, not a thin track route',()=>{
  const d=fixture();d.releases[0].title='Single edition';d.releases[0].editorial={};d.releases[0].fieldSources.editorial=[];
  const other={...structuredClone(d.releases[0]),id:'release:example-album',slug:'sample-album',kind:'album',title:'Album edition'};
  d.releases.push(other);d.tracks[0].releaseIds.push(other.id);
  const h=harness(d);
  try{
    const result=buildDiscography(h.dir);
    assert.equal(result.published,2);
    assert.equal(result.paths.length,2);
    assert.ok(!existsSync(join(h.dir,'music/sample-album/demo/index.html')));
    assert.match(readFileSync(join(h.dir,'music/sample-album/index.html'),'utf8'),/"@type":"MusicAlbum"/);
  }finally{h.close();}
});
test('layout preserves touch width, keyboard navigation and reduced motion',()=>{
  const css=read('assets/release-pages.css');
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(read('templates/music-release.html'),/href="#main">Skip to content/);
  assert.match(read('music/index.html'),/<!-- PUBLIC_DISCOGRAPHY_START -->/);
});
