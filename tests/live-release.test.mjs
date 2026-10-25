import test from 'node:test';
import assert from 'node:assert/strict';
import {checkManifest,entryAssets,inspectLive} from '../scripts/verify-rhythmcut-live.mjs';
const sha='a'.repeat(40),release={commit:sha,sourceRef:'main',path:'/rhythmcut/',version:'0.5.2'};
const info={commit:sha,version:'0.5.2',sourceRef:'main',manifest:'release.json'};
const html='<script src="/rhythmcut/assets/index-aaa.js"></script><link rel="stylesheet" href="/rhythmcut/assets/index-bbb.css"><script src="/assets/app-return.js"></script>';
test('Reject unsupported source and inconsistent artifact manifests',()=>{
 assert.deepEqual(checkManifest(release,info),{sha,version:'0.5.2'});
 assert.throws(()=>checkManifest({...release,sourceRef:'preview'},info));
 assert.throws(()=>checkManifest(release,{...info,commit:'b'.repeat(40)}));
});
test('Require versioned runtime and return navigation',()=>{
 assert.equal(entryAssets(html).length,2);
 assert.throws(()=>entryAssets('<script src="/rhythmcut/assets/index-aaa.js"></script>'));
});
test('Public bytes must match staged artifact and Vercel production identity',async()=>{
 const files={
  'release.json':JSON.stringify(release),
  'release-info.json':JSON.stringify(info),
  'index.html':html,
  'assets/index-aaa.js':'console.log(1)',
  'assets/index-bbb.css':'body{}'
 };
 const reader=async p=>Buffer.from(files[p.slice(p.indexOf('rhythmcut/')+10)]);
 const fetcher=async url=>{
  const u=new URL(url),key=u.pathname.slice('/rhythmcut/'.length);
  if(u.hostname==='rhythmcut.vercel.app')return new Response(JSON.stringify(info));
  return new Response(files[key]??'',{status:files[key]===undefined?404:200});
 };
 const result=await inspectLive({reader,fetcher});
 assert.equal(result.checked,5);
 await assert.rejects(inspectLive({reader,fetcher:async url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('index-aaa.js'))return new Response('tampered');
  return fetcher(url);
 }}),/bytes differ/);
 await assert.rejects(inspectLive({reader,fetcher:async url=>{
  const u=new URL(url);
  if(u.hostname==='rhythmcut.vercel.app')return new Response(JSON.stringify({...info,commit:'b'.repeat(40)}));
  return fetcher(url);
 }}),/no longer equal/);
});
