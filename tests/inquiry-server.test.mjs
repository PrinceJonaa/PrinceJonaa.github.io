import test from 'node:test';
import assert from 'node:assert/strict';
import {createInquiryHandler} from '../supabase/functions/universe-inquiries/handler.js';
const origin='https://princejona.me', key='123e4567-e89b-42d3-a456-426614174000';
const body={inquiryType:'general',serviceId:'',replyEmail:'client@example.com',projectSummary:'A small website project with an accessible contact page.',referencedUrl:'',consent:true,consentVersion:'2026-10-12',website:'',sourcePublicPageId:'world:work'};
const req=(data=body,headers={})=>new Request('https://example.com/intake',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':key,...headers},body:JSON.stringify(data)});
const stored={request_id:key,received_at:'2026-10-12T18:00:00.000Z',email_state:'unconfigured',duplicate:false};
test('requires origin, valid input and retry key before touching persistence',async()=>{
 let calls=0;const handler=createInquiryHandler({ready:async()=>true,receive:async()=>{calls++;return stored;}});
 assert.equal((await handler(req(body,{Origin:'https://evil.example'}))).status,403);
 assert.equal((await handler(req({...body,consent:false}))).status,400);
 assert.equal((await handler(req(body,{'Idempotency-Key':'bad'}))).status,400);
 assert.equal(calls,0);
});
test('waits for real persistence and returns no success on storage failure',async()=>{
 let release;const durable=new Promise(r=>release=r);let done=false;
 const handler=createInquiryHandler({ready:async()=>true,receive:async()=>{await durable;return stored;}});
 const result=handler(req()).then(r=>{done=true;return r;});await new Promise(r=>setTimeout(r,10));assert.equal(done,false);release();const response=await result;assert.equal(response.status,201);assert.equal((await response.json()).state,'received');
 const failed=createInquiryHandler({ready:async()=>true,receive:async()=>{throw new Error('private SQL and contact data');}});
 const fail=await failed(req());assert.equal(fail.status,503);assert.ok(!(await fail.text()).includes('private SQL'));
});
test('rate and idempotency conflicts return bounded errors; retries retain their receipt',async()=>{
 for(const [code,status] of [['RATE_LIMIT',429],['IDEMPOTENCY_CONFLICT',409]]){const h=createInquiryHandler({ready:async()=>true,receive:async()=>{throw Object.assign(new Error('sensitive'),{code});}});assert.equal((await h(req())).status,status);}
 const h=createInquiryHandler({ready:async()=>true,receive:async()=>({...stored,duplicate:true})});const r=await h(req());assert.equal(r.status,200);assert.equal((await r.json()).requestId,key);
});
test('notification failure cannot erase a persisted receipt or become delivered',async()=>{
 let state;const h=createInquiryHandler({ready:async()=>true,receive:async()=>({...stored,email_state:'queued'}),notify:async()=>{throw new Error('provider failed');},recordEmail:async(id,s)=>{state=s;}});
 const r=await h(req());assert.equal(r.status,201);const receipt=await r.json();assert.equal(receipt.emailState,'failed');assert.equal(state,'failed');assert.equal(receipt.state,'received');
});
