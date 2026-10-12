// M5 decision recovery: no File, AudioBuffer or raw PCM is persisted.
export const SESSION_SCHEMA=1;
const DB_NAME='jonaaudio-recovery', STORE='records', KEY='current';
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const finite=(n,min=0,max=Infinity)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const text=(v,max=256)=>typeof v==='string'&&v.length<=max;
const optionalNumber=(n,min,max)=>n==null||finite(n,min,max);
const record=(v)=>v&&typeof v==='object'&&!Array.isArray(v);
const urlSafeId=id=>typeof id==='string'&&id.length>0&&id.length<120&&!/[\x00-\x1f]/.test(id);
export function sessionSnapshot(state){
 return {kind:'jonaaudio-session',schema:SESSION_SCHEMA,savedAt:new Date().toISOString(),selectedId:state.selectedId,
  standaloneTuning:clone(state.standaloneTuning),tracks:state.tracks.map(t=>({
   id:t.id,name:t.name,size:t.size,lastModified:t.file?.lastModified??t.lastModified??0,
   fingerprint:t.fingerprint||null,sourceIdentity:t.sourceIdentity,sourceAvailable:false,
   duration:t.duration??null,decodedSampleRate:t.decodedSampleRate??null,channels:t.channels??null,
   corrections:clone(t.corrections||{}),tuningSetup:clone(t.tuningSetup),sampleGrid:clone(t.sampleGrid||{}),
   gridStale:!!t.gridStale,regions:clone((t.regions||[]).map(({result,history,...r})=>r)),
   candidateFavorites:clone(t.candidateFavorites||{}),analysisScopeId:t.analysisScopeId||null,
   playback:{position:t.playback?.position||0,rate:t.playback?.rate||1,zoom:t.playback?.zoom||1}
  }))};
}
export function parseSession(raw){
 if(!record(raw)||raw.kind!=='jonaaudio-session'||raw.schema!==SESSION_SCHEMA||!Array.isArray(raw.tracks)||raw.tracks.length>80)throw Error('Unsupported, future or invalid session. Current work was not changed.');
 const seen=new Set(),tracks=raw.tracks.map(t=>{
  if(!record(t)||!Number.isSafeInteger(t.id)||t.id<1||seen.has(t.id)||!text(t.name,250)||!finite(t.size,0,125*1048576)||!text(t.sourceIdentity,600)||!optionalNumber(t.duration,0,24*3600)||!optionalNumber(t.lastModified,0,1e15)||!optionalNumber(t.decodedSampleRate,1,768000)||!optionalNumber(t.channels,1,2)||!(t.fingerprint==null||/^[0-9a-f]{64}$/.test(t.fingerprint)))throw Error('Invalid source metadata; current work was not changed.');
  seen.add(t.id);
  if(!record(t.corrections)||!record(t.sampleGrid)||!record(t.candidateFavorites)||!record(t.playback)||!Array.isArray(t.regions)||t.regions.length>512)throw Error('Invalid decisions; current work was not changed.');
  const c=t.corrections;if(!optionalNumber(c.bpm,25,400)||!(c.key==null||text(c.key,30)))throw Error('Invalid correction; current work was not changed.');
  if(!optionalNumber(t.playback.position,0,24*3600)||!optionalNumber(t.playback.rate,.1,4)||!optionalNumber(t.playback.zoom,1,16))throw Error('Invalid playback state; current work was not changed.');
  const ids=new Set();
  const regions=t.regions.map(r=>{
   if(!record(r)||!urlSafeId(r.id)||ids.has(r.id)||!finite(r.start,0,24*3600)||!finite(r.end,r.start+1e-6,24*3600)||t.duration!=null&&r.end>t.duration+0.01)throw Error('Invalid sample region; current work was not changed.');
   ids.add(r.id);
   if(r.corrections!=null&&!record(r.corrections))throw Error('Invalid region correction.');
   return {id:r.id,start:r.start,end:r.end,regionRevision:Math.max(1,Math.floor(r.regionRevision||1)),audioRevision:Math.max(1,Math.floor(r.audioRevision||1)),
    fades:record(r.fades)?{inMs:finite(r.fades.inMs,0,10)?r.fades.inMs:5,outMs:finite(r.fades.outMs,0,10)?r.fades.outMs:5}:{inMs:5,outMs:5},
    label:text(r.label,120)?r.label:'',notes:text(r.notes,2000)?r.notes:'',corrections:clone(r.corrections||{}),
    tuningSetup:clone(r.tuningSetup||null),result:null,trackId:t.id};
  });
  return {id:t.id,name:t.name,size:t.size,lastModified:t.lastModified||0,fingerprint:t.fingerprint||null,
    sourceIdentity:t.sourceIdentity,file:null,url:null,sourceAvailable:false,state:'source-missing',result:null,wave:null,error:null,analysis:{},regions,
    duration:t.duration??null,decodedSampleRate:t.decodedSampleRate||null,channels:t.channels||null,
    corrections:clone(c),tuningSetup:clone(t.tuningSetup||null),sampleGrid:clone(t.sampleGrid),gridStale:!!t.gridStale,gridRevision:0,
    candidateFavorites:clone(t.candidateFavorites),analysisScopeId:ids.has(t.analysisScopeId)?t.analysisScopeId:null,
    playback:clone(t.playback),sourceRevision:1,decisionRevision:0,history:[],candidatesStale:true};
 });
 if(raw.selectedId!=null&&!seen.has(raw.selectedId))throw Error('Invalid session selection; current work was not changed.');
 return {tracks,selectedId:raw.selectedId??tracks[0]?.id??null,standaloneTuning:clone(raw.standaloneTuning||null)};
}
export async function sampledFingerprint(file){
 if(!file||!globalThis.crypto?.subtle)return null;
 const n=Math.min(file.size,65536),a=new Uint8Array(await file.slice(0,n).arrayBuffer()),b=new Uint8Array(await file.slice(Math.max(0,file.size-n)).arrayBuffer());
 const bytes=new Uint8Array(8+a.length+b.length),view=new DataView(bytes.buffer);
 view.setUint32(0,Math.floor(file.size/4294967296));view.setUint32(4,file.size>>>0);bytes.set(a,8);bytes.set(b,8+a.length);
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
function openDB(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined')return reject(Error('IndexedDB is unavailable'));
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Storage open failed'));
 });
}
async function withStore(mode,action){
 const db=await openDB();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),request=action(tx.objectStore(STORE));let result;
  request.onsuccess=()=>{result=request.result;};request.onerror=()=>reject(request.error||Error('Storage request failed'));
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('Storage transaction failed'));tx.onabort=()=>reject(tx.error||Error('Storage aborted'));
 });}finally{db.close();}
}
export async function readSavedSession(){const value=await withStore('readonly',store=>store.get(KEY));return value?parseSession(value):null;}
export async function deleteSavedSession(){return withStore('readwrite',store=>store.delete(KEY));}
export function createSessionWriter({onError=()=>{}}={}){
 let next=null,busy=false,failed=false,timer=null;
 const drain=async()=>{if(busy)return;busy=true;try{
  while(next){const snapshot=next;next=null;try{await withStore('readwrite',store=>store.put(snapshot,KEY));failed=false;}catch(e){if(!failed)onError('Session changes are available in this tab but could not be saved. Export session JSON.');failed=true;}}
 }finally{busy=false;}};
 return {schedule(state){next=sessionSnapshot(state);if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=null;void drain();},650);},
  async flush(){if(timer){clearTimeout(timer);timer=null;}await drain();},
  async forget(){if(timer){clearTimeout(timer);timer=null;}next=null;await deleteSavedSession();}};
}
