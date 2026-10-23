/* Run with: node records/jona-52/tests/m1-m2.smoke.mjs
   Static-site regression tests: no third-party package or live network required. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=n=>readFileSync(path.join(root,n),'utf8');
const cache=new Map();
const localStorage={
 getItem:key=>cache.get(key)??null,
 setItem:(key,val)=>cache.set(key,String(val)),
 removeItem:key=>cache.delete(key)
};
const listeners={};
const document={
 addEventListener:(event,fn)=>{(listeners[event]||=[]).push(fn)},
 getElementById:()=>null
};
const window={};
const ctx=vm.createContext({window,document,localStorage,console});
for(const script of ['evidence-data.js','evidence-engine.js','personnel-security.js','cross-department.js']){
 vm.runInContext(file(script),ctx,{filename:script,timeout:3000});
}
let count=0;
function test(name,fn){fn();count++;process.stdout.write('PASS '+name+'\n')}
const {Site99EvidenceData:data,Site99Evidence:evidence,Site99PersonnelSecurity:ps,Site99CrossDepartment:cross}=window;
const ids=new Set(data.records.map(r=>r.id));
test('Registry has unique durable IDs',()=>{assert.equal(ids.size,data.records.length);assert.ok(ids.size>=14)});
test('Every source has a version and chain of custody',()=>assert.ok(data.records.every(r=>r.versions.length>0&&r.custody.length>0)));
test('All cross-references resolve',()=>assert.ok(data.edges.every(([a,,b])=>ids.has(a)&&ids.has(b))));
test('Related records are resolvable',()=>assert.ok(data.records.every(r=>r.related.every(id=>ids.has(id)))));
test('Findings depend only on explicit source records',()=>assert.ok(data.findings.every(f=>f.requires.every(id=>ids.has(id)))));
test('Division identifier is not exposed in first two milestones',()=>{assert.ok(!file('evidence-data.js').includes('Division 0'));assert.ok(!file('personnel-security.js').includes('Division 0'))});
test('A single document opens through its deep link',()=>assert.ok(evidence.renderRecord('sloane-person').includes('EMPLOYEE')));
test('Incident arrival is separately retained',()=>assert.ok(evidence.renderRecord('transfer-52b').includes('three minutes')));
test('Inspecting only two sources cannot infer cyclic authorization',()=>{evidence.observe('appointment-0418');assert.ok(!evidence.found().some(f=>f.id==='identity-loop'))});
test('The third independent source opens a founded connection',()=>{evidence.observe('badge-b419');assert.ok(evidence.found().some(f=>f.id==='identity-loop'))});
test('HR starts at ordinary directory',()=>{const h=ps.html('hr');assert.ok(h.includes('E. Sloane')&&h.includes('Ada Yuen'))});
test('HR dossier exposes future date',()=>assert.ok(ps.html('hr-sloane').includes('14 JAN 2027')));
test('Historical organization has date-selectable eras',()=>assert.ok(ps.html('hr-organization').includes('1952')&&ps.html('hr-organization').includes('1998')));
test('Personnel form links to badge and version history',()=>assert.ok(ps.html('hr-appointment').includes('#security-badge')&&ps.html('hr-appointment').includes('#evidence-appointment-0418')));
test('Security screen links directly to HR',()=>assert.ok(ps.html('security').includes('#hr-sloane')));
test('Security viewer exposes an adjustable but nondestructive clock',()=>assert.ok(ps.html('security-camera').includes('id="ps-offset"')));
test('The badge case distinguishes cryptographic validation from issue',()=>assert.ok(ps.html('security-badge').includes('NOT PRINTED')));
test('The loop diagram documents mutual dependencies',()=>assert.ok(ps.html('security-gateway').includes('Accepts approved appointment')));
test('Holt and Yuen are separate named witnesses',()=>assert.ok(ps.html('security-interview').includes('M. Holt')&&ps.html('security-interview').includes('A. Yuen')));
test('Transfer 52-B now has a direct personnel handoff',()=>assert.ok(cross.html().includes('#hr-sloane')));
test('Investigation is saved in a separate localStorage namespace',()=>assert.ok(cache.has('site99:investigation:v1')&&!cache.has('site99:clearance:v1')));
test('Notebook never enumerates unexplored records',()=>{const note=evidence.renderNotebook();assert.ok(note.includes('My Investigation')&&!note.includes('Cost center 00-17 / inherited benefits'))});
test('Index imports data before its consumers',()=>{const h=file('index.html');const scripts=['evidence-data.js','evidence-engine.js','personnel-security.js','cross-department.js','site99.js'];assert.ok(scripts.every((x,i)=>i===0||h.indexOf(x)>h.indexOf(scripts[i-1])))});
test('Legacy story routes retained in existing dispatcher',()=>{const r=file('site99.js');for(const route of ['world-before','veil-nil','continuity','revision-','case-','xdept'])assert.ok(r.includes(route))});
test('Mobile and reduced-motion styles defined',()=>assert.ok(file('investigation.css').includes('max-width:440px')&&file('investigation.css').includes('prefers-reduced-motion')));
console.log(count+' smoke checks passed.');