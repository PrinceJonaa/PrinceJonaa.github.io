import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {services,caseStudies} from '../assets/work-records.js';
import {apps} from '../assets/registry.js';
import {publicIndex,searchRecords} from '../assets/catalog.js';
test('services are scoped quote-only offers discoverable in public search',()=>{
 assert.equal(services.length,3);
 for(const s of services){assert.ok(s.deliverables.length);assert.ok(s.inputs.length);assert.ok(s.exclusions.length);assert.match(s.revisions,/quote/);assert.equal(s.pricing,'Written quote only');assert.ok(searchRecords(publicIndex,s.name).some(r=>r.publicId===s.publicId));}
});
test('case studies have context, contribution, artifacts, outcomes, stack and attribution',()=>{
 for(const c of caseStudies){for(const k of ['context','contribution','attribution'])assert.ok(c[k]);for(const k of ['artifacts','outcomes','stack','limits'])assert.ok(c[k].length);assert.ok(existsSync('.'+c.href+'index.html'));}
 const pending=caseStudies.find(c=>c.id==='song-to-video');assert.equal(pending.evidenceStatus,'pending');assert.match(pending.outcomes.join(' '),/No approved/);
});
test('private source is not advertised as an available source application',()=>{
 const beat=apps.find(a=>a.id==='beatcut');assert.equal(beat.status,'planned');assert.equal(beat.repositoryHref,null);assert.deepEqual(beat.sourceRefs,[]);assert.equal(beat.href,'/beatcut/');
});
test('public resume is searchable, redacted and does not claim an unfinished degree',()=>{
 assert.ok(searchRecords(publicIndex,'resume').some(r=>r.publicId==='resume:public'));
 const text=readFileSync('assets/downloads/jonathan-bonner-resume.txt','utf8');assert.match(text,/Jonathan Bonner/i);assert.match(text,/contact@intervised.com/);assert.ok(!/27\s+Mt\.?\s+Hope|347[- .]?433|jona7738|completed.*associate|A\.S\.\s+degree\s+earned/i.test(text));
 assert.ok(readFileSync('assets/downloads/jonathan-bonner-resume.pdf').subarray(0,4).equals(Buffer.from('%PDF')));
});
test('new routes have public metadata and direct navigation; contact is unavailable by default',()=>{
 for(const route of ['/services/',...caseStudies.map(c=>c.href),'/work/cases/resume/','/beatcut/']){const html=readFileSync('.'+route+'index.html','utf8');assert.match(html,/data-search-dialog/);assert.match(html,/aria-label="Breadcrumb"/);assert.match(html,/og:image/);assert.match(html,/application\/ld\+json/);}
 const html=readFileSync('work/index.html','utf8');assert.match(html,/data-inquiry-submit disabled/);assert.match(html,/data-email-brief/);assert.match(html,/mailbox/);assert.ok(!/action="https:\/\/.*supabase.*\/rest\/v1/.test(html));
});
