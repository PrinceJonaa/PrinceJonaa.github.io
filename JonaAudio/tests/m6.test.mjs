import test from 'node:test';
import assert from 'node:assert/strict';
import {computeQuality} from '../engine.js';
import {encodeWav,prepareRegion} from '../sample-dsp.js';
import {SESSION_SCHEMA,sessionSnapshot,parseSession,sampledFingerprint} from '../session-persistence.js';
import {safeCsv,csvReport,jsonReport} from '../reports.js';
const local=new Map();globalThis.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)};
const {state,dispatch,resolveValues}=await import('../store.js');
const near=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<=tolerance, `${a} should approximately equal ${b}`);
test('polarity inverted stereo retains channel-energy level and -1 correlation, without false mono RMS',()=>{
 const l=new Float32Array(1000).fill(.5),r=new Float32Array(1000).fill(-.5),q=computeQuality(l,r,1000);
 near(q.stereoEnergyRmsDb,-6.020599913);assert.equal(q.rmsDb,null);assert.equal(q.monoSumRmsDb,null);
 near(q.leftRmsDb,-6.020599913);near(q.rightRmsDb,-6.020599913);near(q.stereoCorrelation,-1);
 near(q.crestDb,0);assert.equal(q.nearCeilingSamples,0);
});
test('mono and silent channels report meaningful unavailable reasons, not fabricated correlation',()=>{
 const silent=computeQuality(new Float32Array(1000),new Float32Array(1000),1000);
 assert.equal(silent.rmsDb,null);assert.equal(silent.samplePeakDb,null);assert.equal(silent.stereoCorrelation,null);
 assert.match(silent.stereoCorrelationReason,/silent/);assert.equal(silent.leadingSilence,1);assert.equal(silent.trailingSilence,0);
 const mono=computeQuality(new Float32Array(10).fill(.25),null,1000);near(mono.rmsDb,mono.stereoEnergyRmsDb);assert.equal(mono.channels,1);assert.equal(mono.stereoCorrelationReason,'mono source');
 const asymmetric=computeQuality(new Float32Array(10).fill(.4),new Float32Array(10),1000);
 assert.equal(asymmetric.stereoCorrelation,null);assert.ok(Number.isFinite(asymmetric.stereoEnergyRmsDb));
});
test('AAC decoded overs: near-ceiling is counted by frames and export quantizes with acknowledgement',()=>{
 const l=Float32Array.of(0.25,1.5,-1.2,0),r=Float32Array.of(.2,.4,-1.4,0);
 const q=computeQuality(l,r,44100);assert.ok(q.samplePeakDb>0);assert.equal(q.nearCeilingSamples,2);
 const original=prepareRegion({channels:[l,r],sampleRate:44100,startFrame:0,endFrame:4,padStartFrame:0,sourceLength:4,fades:{inMs:0,outMs:0}});
 const wav=encodeWav(original.channels,44100,1000),v=new DataView(wav.buffer);assert.equal(wav.outOfRange,3);
 near(v.getInt16(46,true),Math.round(.2*32767),1);
 assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint32(40,true),16);
});
test('restorable session preserves musical decisions, but never invents uploaded audio',()=>{
 dispatch({type:'clear'});
 const file=new File([new Uint8Array(44)],'track.wav',{type:'audio/wav',lastModified:123});
 dispatch({type:'add',track:{id:8,name:file.name,file,url:'blob:dummy',size:file.size,duration:12,state:'ready',result:{tempo:{bpm:130,alternatives:[]},keys:[{key:'C major'}]}}});
 dispatch({type:'correct',trackId:8,values:{bpm:75,key:'G minor'}});
 dispatch({type:'region',trackId:8,region:{id:'part',start:2,end:4,label:'break',fades:{inMs:5,outMs:5}}});
 dispatch({type:'selectScope',trackId:8,regionId:'part'});
 const raw=sessionSnapshot(state),fresh=parseSession(raw),t=fresh.tracks[0];
 assert.equal(raw.schema,SESSION_SCHEMA);assert.equal(t.file,null);assert.equal(t.url,null);assert.equal(t.sourceAvailable,false);assert.equal(t.state,'source-missing');
 assert.equal(t.regions[0].label,'break');assert.equal(t.regions[0].fades.inMs,5);assert.equal(t.corrections.bpm,75);assert.equal(t.analysisScopeId,'part');assert.equal(t.result,null);
 assert.equal(JSON.stringify(raw).includes('blob:dummy'),false);
 assert.throws(()=>parseSession({...raw,schema:999}),/invalid/);
 assert.throws(()=>parseSession({...raw,tracks:[{...raw.tracks[0],regions:[{id:'bad',start:5,end:4}]}]}),/Invalid/);
 assert.equal(state.tracks[0].sourceAvailable,true); // parsing cannot mutate current tab
});
test('fingerprint catches same-size edited sources without reading all bytes',async()=>{
 const a=new File(['abcdef'],'same.wav'),b=new File(['abcdeg'],'same.wav');
 const [x,y]=await Promise.all([sampledFingerprint(a),sampledFingerprint(b)]);
 assert.match(x,/^[0-9a-f]{64}$/);assert.notEqual(x,y);assert.equal(await sampledFingerprint(a),x);
});
test('analysis exports distinguish provenance and quote formula-style filenames',()=>{
 const t=state.tracks[0];t.name='=2+2.wav';
 const csv=csvReport([t]);assert.match(csv,/"'=2\+2.wav"/);assert.ok(csv.includes('Corrected BPM'));assert.ok(csv.includes('Channel-energy RMS'));
 assert.equal(safeCsv(-12.4),'"-12.4"');assert.equal(safeCsv('-INJECT'),'"\'-INJECT"');
 const report=JSON.parse(jsonReport(state));assert.equal(report.kind,'jonaaudio-analysis-report');assert.equal(report.sources[0].effective.bpm,75);
 assert.equal(report.recovery.tracks[0].sourceAvailable,false);assert.ok(!JSON.stringify(report).includes('blob:dummy'));
});

test('worker level response keeps numeric channel count separate from PCM transfer arrays',async()=>{
 const messages=[];
 globalThis.self={postMessage:(message,transfer=[])=>messages.push({message,transfer})};
 await import('../worker.js');
 const sample=Float32Array.from({length:1000},()=>.4);
 globalThis.self.onmessage({data:{jobId:1,sessionGeneration:1,trackId:1,sourceRevision:1,
  scopeId:null,scopeRevision:0,capability:'levels',requestRevision:1,input:{channels:[sample,sample],sampleRate:1000,ranges:[{start:0,end:1}]}}});
 const final=messages.at(-1);assert.equal(final.message.type,'result');assert.equal(final.message.result.channels,2);
 assert.equal(final.message.result.stereoCorrelation,1);assert.equal(final.transfer.length,0);
});
