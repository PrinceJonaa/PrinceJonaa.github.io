import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync('cloudflare/universe-owner/index.js','utf8');
const api=new Function(source.replace('export default {fetch:respond};','return respond;'))();
const issuer='https://jbonner.cloudflareaccess.com';
const aud='36506af8a602d7150b9d552a8f4ad7ae5589e51d2f99e22c36dd4e74fa605665';
const base='https://princejona-universe-owner.jbonner.workers.dev';
const b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
const fakeDb={prepare(sql){
 return{bind(...args){this.args=args;return this;},
 async first(){
  if(sql.includes('SELECT role FROM principals'))return {role:'owner'};
  if(sql.includes("WHERE state='review'"))return {n:0};
  if(sql.includes('SELECT COUNT(*) n'))return {n:0};
  return null;
 },
 async all(){return {results:[]};}
 };
}};
test('owner API verifies actual signed Access token and deny forged audience, origin',async()=>{
 const saved=globalThis.fetch;
 const keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pub=await webcrypto.subtle.exportKey('jwk',keys.publicKey);pub.kid='test-access-key';
 globalThis.fetch=async()=>new Response(JSON.stringify({keys:[pub]}),{status:200});
 try{
  const make=async payload=>{
   const h=b64({alg:'RS256',kid:'test-access-key'}),p=b64(payload),data=h+'.'+p;
   const sig=await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(data));
   return data+'.'+Buffer.from(sig).toString('base64url');
  };
  const now=Math.floor(Date.now()/1000);
  const valid=await make({iss:issuer,aud:[aud],email:'reviewer@example.com',iat:now-5,nbf:now-5,exp:now+300});
  const allowed=await api(new Request(base+'/api/overview',{headers:{'Cf-Access-Jwt-Assertion':valid}}),{DB:fakeDb});
  assert.equal(allowed.status,200);
  assert.equal((await allowed.json()).principal.role,'owner');
  const badAud=await make({iss:issuer,aud:['not-this-application'],email:'reviewer@example.com',iat:now-5,nbf:now-5,exp:now+300});
  assert.equal((await api(new Request(base+'/api/items',{headers:{'Cf-Access-Jwt-Assertion':badAud}}),{DB:fakeDb})).status,401);
  assert.equal((await api(new Request(base+'/api/items',{headers:{'Cf-Access-Jwt-Assertion':valid.slice(0,-6)+'ABCDEF'}}),{DB:fakeDb})).status,401);
  const originDenied=await api(new Request(base+'/api/items',{method:'POST',headers:{'Cf-Access-Jwt-Assertion':valid,'Content-Type':'application/json','X-Universe-Action':'1','Origin':'https://other-site.example'},body:'{}'}),{DB:fakeDb});
  assert.equal(originDenied.status,403);
 }finally{globalThis.fetch=saved;}
});

test('owner proposal pipeline records review without executing external operations',()=>{
 assert.match(source,/agent_proposals/);
 assert.match(source,/path==='\/api\/proposals'/);
 assert.match(source,/path==='\/api\/proposal-review'/);
 assert.match(source,/No automatic execution/);
 assert.match(source,/state='proposed'/);
 assert.doesNotMatch(source,/eval\(|new Function\(/);
});
