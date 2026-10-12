import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInquiry, briefText, receiptIsValid, consentVersion} from '../assets/inquiry-core.js';
import {inquiryConfig} from '../assets/inquiry-config.js';

const valid = {inquiryType:'software',serviceId:'web-software',replyEmail:'client@example.com',projectSummary:'Build an accessible portfolio for my work.',referencedUrl:'https://example.com/work',consent:true,consentVersion:'2026-10-12',website:'',sourcePublicPageId:'world:work'};
test('accepts a bounded brief and rejects missing consent or invalid contact',()=>{
 assert.equal(validateInquiry(valid).ok,true);
 for(const change of [{consent:false},{consentVersion:'old'},{replyEmail:'bad address'},{projectSummary:'short'},{projectSummary:'x'.repeat(4001)},{inquiryType:'spam'},{serviceId:'unknown'},{sourcePublicPageId:'private:notes'},{unexpected:'data'}]) assert.equal(validateInquiry({...valid,...change}).ok,false,JSON.stringify(change).slice(0,80));
 assert.equal(consentVersion,valid.consentVersion);
});
test('rejects unsafe reference URLs and treats the honeypot as rejection',()=>{
 for(const referencedUrl of ['javascript:alert(1)','http://example.com','https://name:password@example.com','file:///etc/passwd','https://example.com/?email=client@example.com','https://example.com/?%65mail=client%40example.com','https://example.com/#token=secret','https://example.com/?q=client%40example.com']) assert.equal(validateInquiry({...valid,referencedUrl}).ok,false,referencedUrl);
 assert.equal(validateInquiry({...valid,website:'bot'}).ok,false);
 assert.equal(validateInquiry({...valid,referencedUrl:''}).ok,true);
});
test('only a persisted receipt with a bounded transport state is success',()=>{
 const r={requestId:'123e4567-e89b-42d3-a456-426614174000',receivedAt:'2026-10-12T18:00:00.000Z',state:'received',emailState:'queued'};
 assert.equal(receiptIsValid(r),true);
 for(const change of [{requestId:''},{receivedAt:'today'},{state:'sent'},{emailState:'delivered'}]) assert.equal(receiptIsValid({...r,...change}),false);
 assert.equal(receiptIsValid({ok:true}),false);
});
test('a brief remains a draft and public configuration contains no active unverified endpoint',()=>{
 const text=briefText(valid); assert.match(text,/Project inquiry/);assert.match(text,/client@example.com/);assert.match(text,/web-software/);assert.ok(!text.includes('received'));
 assert.equal(inquiryConfig.endpoint,null);assert.equal(inquiryConfig.email,'contact@intervised.com');
});
