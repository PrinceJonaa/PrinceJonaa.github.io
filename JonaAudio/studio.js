import {KEYS} from './engine.js';
import {state, selectedTrack, dispatch, resolveValues, subscribe, emit} from './store.js';
import {createAudioService} from './audio-service.js';
import {createJobs} from './jobs.js';
import {createSampleService} from './sample-service.js';
import {RESOURCE_POLICY} from './config.js';
import {parseBpm} from './musical-controls.js';
import {describeKeyReadiness, formatTuningReference} from './analysis-readiness.js';
import {createSessionWriter,readSavedSession,parseSession,sessionSnapshot,sampledFingerprint} from './session-persistence.js';
import {csvReport,jsonReport,downloadText} from './reports.js';
const $=id=>document.getElementById(id),ui={};for(const id of ['files','drop','clear','tracks','count','search','export','mode','status','song-name','song-meta','bpm','bpm-alt','key','key-alt','copy-tuning','length','format','rms','wave','spectrum','chroma','candidates','peak','crest','stereo','clips','lead','trail','play','seek','time','end-time','rate','zoomin','zoomout','zoom-label','fix-bpm','fix-key','save-fix','reset-fix','message','audio','theme','mobile-analyze','mobile-library'])ui[id]=$(id);
const MAX_FILE_BYTES=RESOURCE_POLICY.maxFileBytes,MAX_TRACKS=RESOURCE_POLICY.maxTracks,notes=KEYS,keys=notes.flatMap(n=>[n+' major',n+' minor']);
for(const key of keys){const option=document.createElement('option');option.value=key;option.textContent=key;ui['fix-key'].append(option);}
let runId=0,zoom=1,drawQueued=false;
const writer=createSessionWriter({onError:message=>notify(message)});
const fmt=(n)=>Number.isFinite(n)?`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`:'—';
const number=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';
const decibels=(n)=>Number.isFinite(n)?`${n.toFixed(1)} dB`:'−∞ dB';
const corrFor=t=>t.corrections||{};
const valuesFor=t=>resolveValues(t,t?.analysisScopeId||null);
const scopeResult=t=>t?.analysisScopeId?t.regions.find(r=>r.id===t.analysisScopeId)?.result:t?.result;
try{ui.mode.value=localStorage.getItem('jonaaudio-depth')==='verify'?'verify':'quick';}catch{}
const jobs=createJobs({onChange:item=>{if(selectedTrack()?.id===item.id)renderDetail();renderLibrary();}});
function notify(message){ui.message.textContent=message;window.dispatchEvent(new CustomEvent('jona:status',{detail:message}));}
let nextPlaybackSave=0;const playback=createAudioService(ui.audio,{onChange:(item,event)=>{if(event==='metadata'){renderDetail();renderLibrary();}if(item&&performance.now()>nextPlaybackSave){nextPlaybackSave=performance.now()+10000;writer.schedule(state);}updatePosition();window.dispatchEvent(new CustomEvent('jona:playback',{detail:item?.id??null}));},onError:notify});
const samples=createSampleService({jobs,transport:playback,onChange:()=>window.dispatchEvent(new Event('jona:sample'))});
function switchMobile(view){
 const showLibrary=view==='library';document.body.classList.toggle('mobile-library-open',showLibrary);
 ui['mobile-library'].setAttribute('aria-pressed',String(showLibrary));
 ui['mobile-analyze'].setAttribute('aria-pressed',String(!showLibrary));
}
function refreshMobile(){document.body.classList.toggle('has-tracks',state.tracks.length>0);}
const statusNames={'source-missing':'Source missing · Relink',queued:'Waiting',decoding:'Decoding',analyzing:'Analyzing',ready:'Ready','partial-ready':'Partial result',unavailable:'Unavailable',error:'Error',cancelled:'Cancelled'};
async function relinkFile(target,file,digest=null){
 if(!target||target.sourceAvailable||!file)return false;
 if(file.name!==target.name||file.size!==target.size){notify('That file does not match the saved name and size. Source was not replaced.');return false;}
 const fingerprint=digest??await sampledFingerprint(file).catch(()=>null);
 if(target.fingerprint){if(!fingerprint||target.fingerprint!==fingerprint){notify('Source fingerprint differs or cannot be verified. Nothing was relinked.');return false;}}
 else if(!window.confirm('This older session has no source fingerprint. The name and size match, but audio identity cannot be verified. Relink it?'))return false;
 const url=URL.createObjectURL(file);
 if(!dispatch({type:'relink',trackId:target.id,file,url})){URL.revokeObjectURL(url);return false;}
 target.fingerprint=fingerprint||target.fingerprint;
 if(selectedTrack()?.id===target.id)playback.select(target);
 jobs.request(target,{mode:ui.mode.value});renderLibrary();renderDetail();notify('Source relinked. Music decisions were retained; analysis will run again.');return true;
}
async function addFiles(incoming){
 const files=Array.from(incoming).filter(f=>f.type.startsWith('audio/')||/\.(wav|mp3|m4a|flac|aac|ogg|aiff?|opus|webm)$/i.test(f.name));
 if(!files.length){notify('Choose an audio file supported by your browser.');return;}
 for(const file of files){
  if(file.size>MAX_FILE_BYTES){notify(`${file.name} exceeds the 125 MB browser analysis limit.`);continue;}
  const fingerprint=await sampledFingerprint(file).catch(()=>null);
  const missing=state.tracks.find(t=>!t.sourceAvailable&&t.name===file.name&&t.size===file.size);
  if(missing){if(window.confirm('A saved JonaAudio session has decisions for '+file.name+'. Relink this file to those decisions?'))await relinkFile(missing,file,fingerprint);continue;}
  if(state.tracks.length>=MAX_TRACKS){notify(`Session limit is ${MAX_TRACKS} tracks. Export or clear to add more.`);break;}
  const id=++runId,entry={id,file,url:URL.createObjectURL(file),name:file.name,size:file.size,fingerprint,duration:null,state:'queued',result:null,wave:null,error:null};
  dispatch({type:'add',track:entry});if(!selectedTrack())select(entry);jobs.request(entry,{mode:ui.mode.value});
 }
 refreshMobile();renderLibrary();
}
function renderLibrary(){emit();const q=ui.search.value.trim().toLowerCase();ui.tracks.replaceChildren();for(const item of state.tracks.filter(t=>t.name.toLowerCase().includes(q))){const row=document.createElement('div');row.className='track-row';const button=document.createElement('button');button.type='button';button.className='track'+(selectedTrack()?.id===item.id?' selected':'');const title=document.createElement('span');title.className='track-name';title.textContent=item.name;const detail=document.createElement('span');detail.className='track-detail';const info=document.createElement('span');info.textContent=`${statusNames[item.state]}${item.duration?' · '+fmt(item.duration):''}`;const progress=document.createElement('span');progress.textContent=Object.entries(item.analysis||{}).map(([cap,v])=>cap.split(':').at(-1)+': '+v.status).join(' · ');detail.append(progress);const result=document.createElement('span');const rv=valuesFor(item);result.textContent=item.result||rv.bpm!=null||rv.key!=null?`${rv.bpm??'?'} BPM / ${rv.key??'?'} · ${rv.bpmSource}/${rv.keySource}`:'';detail.append(info,result);button.append(title,detail);button.onclick=()=>select(item);const remove=document.createElement('button');remove.type='button';remove.className='remove-track';remove.textContent='×';remove.title='Remove track';remove.setAttribute('aria-label','Remove '+item.name);remove.onclick=()=>removeTrack(item);const action=document.createElement('button');action.type='button';action.className='text-button job-action';const busy=Object.values(item.analysis||{}).some(v=>['queued','decoding','running'].includes(v.status));action.textContent=!item.sourceAvailable?'Relink source':busy?'Cancel':'Retry Quick';action.setAttribute('aria-label',action.textContent+' '+item.name);
 action.onclick=()=>{if(!item.sourceAvailable){const picker=document.createElement('input');picker.type='file';picker.accept='audio/*,.wav,.mp3,.m4a,.flac,.aac,.ogg,.opus';picker.onchange=()=>void relinkFile(item,picker.files?.[0]);picker.click();}else busy?jobs.cancel(item.id):jobs.request(item,{mode:'quick',force:true});};row.append(button,remove,action);ui.tracks.append(row);}
 if(!ui.tracks.children.length){const p=document.createElement('div');p.className='library-empty';p.textContent=state.tracks.length?'No tracks match that search.':'Your audio stays yours. Add a track to start analyzing.';ui.tracks.append(p);}ui.count.textContent=String(state.tracks.length);ui.export.disabled=!state.tracks.length;}
function select(item){
 if(selectedTrack()?.id===item.id)return;
 dispatch({type:'select',trackId:item.id});zoom=item.playback.zoom||1;ui['zoom-label'].textContent=zoom+'×';ui.rate.value=String(item.playback.rate||1);
 playback.select(item.sourceAvailable?item:null);notify(item.sourceAvailable?'':'Source missing. Choose Relink source in Library.');switchMobile('analyze');renderDetail();renderLibrary();
}
function removeTrack(item){jobs.cancel(item.id);item.state='cancelled';URL.revokeObjectURL(item.url);const active=selectedTrack()?.id===item.id;if(active)playback.clear();dispatch({type:'remove',trackId:item.id});if(active&&state.tracks.length)select(state.tracks[0]);refreshMobile();renderDetail();renderLibrary();}
function clearSession(){samples.clear();jobs.clear();playback.stopCompanions();state.tracks.forEach(t=>URL.revokeObjectURL(t.url));playback.clear();dispatch({type:'clear'});refreshMobile();switchMobile('analyze');renderDetail();renderLibrary();notify('Session cleared. No audio was uploaded.');}
function renderDetail(){const item=selectedTrack(),result=scopeResult(item),scope=item?.analysisScopeId?item.regions.find(r=>r.id===item.analysisScopeId):item,correction=scope?.corrections||{};ui.status.textContent=item?statusNames[item.state].toUpperCase():'AWAITING AUDIO';ui['song-name'].textContent=item?.name||'No track selected';ui['song-meta'].textContent=item?`${(item.size/1048576).toFixed(1)} MB · ${item.duration?fmt(item.duration):'Reading duration'}${item.error?' · '+item.error:''}`:'Drag in a song to begin.';
 ui.bpm.textContent=valuesFor(item).bpm??'—';ui['bpm-alt'].textContent=result?.tempo?.alternatives?.length?`Candidates: ${result.tempo.alternatives.slice(0,3).map(c=>c.bpm).join(' / ')}`:Object.entries(item?.analysis||{}).find(([k])=>k===((item.analysisScopeId||'track')+':tempo'))?.[1]?.reason||'BPM is an estimate';ui.key.textContent=valuesFor(item).key||'—';ui['key-alt'].textContent=describeKeyReadiness(result,valuesFor(item));ui.length.textContent=item?.duration?fmt(item.duration):'—';ui.format.textContent=(item?.file?.name||item?.name||'').split('.').at(-1)?.toUpperCase()||'Source audio';ui.rms.textContent=result?.quality?decibels(result.quality.rmsDb):'—';ui.rms.parentElement.querySelector('span').textContent='MONO-SUM RMS · dBFS';
 ui.bpm.parentElement.querySelector('span').textContent='BPM · '+valuesFor(item).bpmSource.toUpperCase();ui.key.parentElement.querySelector('span').textContent='KEY · '+valuesFor(item).keySource.toUpperCase();
 const q=result?.quality;ui.peak.textContent=q?decibels(q.samplePeakDb):'—';ui.crest.textContent=q?decibels(q.crestDb):'—';ui.stereo.textContent=q?(Number.isFinite(q.stereoCorrelation)?number(q.stereoCorrelation,2):q.stereoCorrelationReason||'unavailable'):'—';ui.clips.textContent=q?Number(q.nearCeilingSamples).toLocaleString():'—';ui.lead.textContent=q?number(q.leadingSilence,2)+' s':'—';ui.trail.textContent=q?number(q.trailingSilence,2)+' s':'—';
 ui['end-time'].textContent=item?.duration?fmt(item.duration):'0:00';ui.play.disabled=!item?.sourceAvailable;ui.seek.disabled=!item?.sourceAvailable;ui.zoomin.disabled=!item?.wave;ui.zoomout.disabled=!item?.wave;ui['copy-tuning'].disabled=!valuesFor(item).key;ui['save-fix'].disabled=!item;ui['reset-fix'].disabled=!item;if(!document.querySelector('dialog[open] .corrections')){ui['fix-bpm'].value=correction.bpm||'';ui['fix-key'].value=correction.key||'';}drawWave();drawSpectrum();drawChroma();renderCandidates();updatePosition();}
function canvasContext(canvas){const box=canvas.getBoundingClientRect(),width=Math.max(200,Math.floor(box.width)),height=Math.max(100,Math.floor(box.height||Number(canvas.getAttribute('height'))));const dpr=Math.min(devicePixelRatio||1,window.innerWidth<760?1.25:1.75);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w:width,h:height};}
function palette(){const css=getComputedStyle(document.documentElement);return {accent:css.getPropertyValue('--accent').trim(),muted:css.getPropertyValue('--muted').trim(),line:css.getPropertyValue('--line').trim(),text:css.getPropertyValue('--text').trim()};}
function scheduleWave(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;drawWave();});}
function drawWave(){if(!ui.wave.getClientRects().length)return;const {ctx,w,h}=canvasContext(ui.wave),t=selectedTrack(),p=palette();ctx.clearRect(0,0,w,h);ctx.strokeStyle=p.line;ctx.beginPath();ctx.moveTo(0,h*.5);ctx.lineTo(w,h*.5);ctx.stroke();if(!t?.wave)return;
 const total=t.duration||1,span=total/zoom,start=Math.max(0,Math.min(total-span,(playback.owner?.id===t.id?(playback.position||0):(t.playback.position||0))-span/2)),wave=t.wave;
 ctx.fillStyle=p.accent;for(let px=0;px<w;px++){const idx=Math.min(wave.length-1,Math.floor(((start+px/w*span)/total)*wave.length)),amp=wave[idx];if(amp){ctx.globalAlpha=.83;ctx.fillRect(px,h/2-amp*(h*.42),Math.max(1,w/wave.length),amp*(h*.84));}}ctx.globalAlpha=1;
 if(t.result?.tempo?.beats?.length){ctx.strokeStyle='#f9b780';ctx.globalAlpha=.52;ctx.beginPath();for(const beat of t.result.tempo.beats){if(beat>=start&&beat<=start+span){const x=(beat-start)/span*w;ctx.moveTo(x,h-15);ctx.lineTo(x,h);}}ctx.stroke();ctx.globalAlpha=1;}
 const position=playback.owner?.id===t.id?((playback.position||0)-start)/span*w:-1;if(position>=0&&position<=w){ctx.strokeStyle=p.text;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(position,0);ctx.lineTo(position,h);ctx.stroke();ctx.lineWidth=1;}}
function drawSpectrum(){if(!ui.spectrum.getClientRects().length)return;const {ctx,w,h}=canvasContext(ui.spectrum),s=scopeResult(selectedTrack())?.spectrogram;ctx.clearRect(0,0,w,h);if(!s)return;const image=ctx.createImageData(s.columns,s.rows);for(let i=0;i<s.pixels.length;i++){const v=s.pixels[i]/255,k=i*4;image.data[k]=Math.round(10+v*153);image.data[k+1]=Math.round(20+v*200);image.data[k+2]=Math.round(36+v*112);image.data[k+3]=255;}
 const temp=document.createElement('canvas');temp.width=s.columns;temp.height=s.rows;temp.getContext('2d').putImageData(image,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(temp,0,0,w,h);ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,h-21,210,21);ctx.fillStyle='#f4f7fc';ctx.font='11px system-ui';ctx.fillText(`Preview: ${fmt(s.start)} – ${fmt(s.end)}`,9,h-7);}
function drawChroma(){ui.chroma.replaceChildren();const chroma=scopeResult(selectedTrack())?.chroma;if(!chroma){const msg=document.createElement('p');msg.className='muted';msg.textContent='Chromatic energy appears here when analysis finishes.';ui.chroma.append(msg);return;}for(let i=0;i<12;i++){const cell=document.createElement('div');cell.className='note';const b=document.createElement('div');b.className='bar-note';const bar=document.createElement('i');bar.style.height=Math.round((chroma[i]||0)*100)+'%';b.append(bar);const name=document.createElement('small');name.textContent=notes[i];cell.append(b,name);ui.chroma.append(cell);}}
function renderCandidates(){const area=ui.candidates;area.replaceChildren();const r=scopeResult(selectedTrack());if(!r){area.textContent='No estimates yet.';return;}for(const entry of [...(r.tempo?.alternatives||[]).slice(0,3).map(x=>({field:'bpm',value:x.bpm,label:x.bpm+' BPM'})),...(r.keys||[]).slice(0,3).map(x=>({field:'key',value:x.key,label:x.key}))]){const btn=document.createElement('button');btn.type='button';btn.className='candidate';btn.textContent=entry.label;btn.onclick=()=>setOverride(entry.field,entry.value,'candidate-choice');area.append(btn);}}

function updatePosition(){ui['end-time'].textContent=fmt(playback.owner?.duration||0);ui.time.textContent=fmt(playback.position||0);ui.seek.value=playback.owner?.duration?String(Math.round(playback.position/playback.owner.duration*1000)):'0';ui.play.textContent=playback.playing?'❚❚':'▶';ui.rate.disabled=playback.isLoop;if(selectedTrack()?.wave&&ui.audio.duration)scheduleWave();}
function exportCsv(){downloadText(csvReport(state.tracks),'jonaaudio-analysis.csv','text/csv;charset=utf-8');}
ui['copy-tuning'].addEventListener('click',async()=>{
 const track=selectedTrack();if(!track)return;
 const reference=formatTuningReference(scopeResult(track),valuesFor(track));
 try {
  if(!navigator.clipboard?.writeText)throw new Error('Clipboard API unavailable');
  await navigator.clipboard.writeText(reference);
  notify('Tuning reference copied. Auto-Tune and Logic were not modified.');
 } catch {
  const field=document.createElement('textarea');field.value=reference;field.setAttribute('aria-label','Copy tuning reference');field.style.position='fixed';field.style.left='-9999px';document.body.append(field);field.select();
  let copied=false;try{copied=document.execCommand('copy');}catch{}field.remove();
  notify(copied?'Tuning reference copied. Auto-Tune was not modified.':'Clipboard unavailable. Open Studio → Tune to copy manually.');
 }
});
ui.files.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});ui.search.addEventListener('input',renderLibrary);ui.clear.addEventListener('click',clearSession);ui.export.addEventListener('click',exportCsv);
for(const event of ['dragenter','dragover'])document.addEventListener(event,e=>{e.preventDefault();ui.drop.classList.add('dragging');});for(const event of ['dragleave','drop'])document.addEventListener(event,e=>{e.preventDefault();if(event==='drop'){ui.drop.classList.remove('dragging');addFiles(e.dataTransfer?.files||[]);}else if(e.target===document.documentElement||e.target===document.body)ui.drop.classList.remove('dragging');});
ui.play.onclick=()=>playback.toggle();
ui.seek.oninput=()=>{if(playback.owner?.duration)playback.seek(Number(ui.seek.value)/1000*playback.owner.duration);};ui.rate.onchange=()=>playback.setRate(Number(ui.rate.value));
ui.wave.addEventListener('click',e=>{if(!selectedTrack()?.duration||!selectedTrack()?.sourceAvailable)return;if(playback.owner?.id!==selectedTrack().id)playback.select(selectedTrack());const box=ui.wave.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),span=selectedTrack().duration/zoom,start=Math.max(0,Math.min(selectedTrack().duration-span,(playback.position||0)-span/2));playback.seek(start+fraction*span);drawWave();});
ui.zoomin.onclick=()=>{zoom=Math.min(8,zoom*2);ui['zoom-label'].textContent=zoom+'×';if(selectedTrack())selectedTrack().playback.zoom=zoom;drawWave();};ui.zoomout.onclick=()=>{zoom=Math.max(1,zoom/2);ui['zoom-label'].textContent=zoom+'×';if(selectedTrack())selectedTrack().playback.zoom=zoom;drawWave();};
ui.mode.onchange=()=>{try{localStorage.setItem('jonaaudio-depth',ui.mode.value);}catch{}notify('Analysis default changed for new requests. Existing results stay available.');};
function setOverride(field,value,origin='manual'){
 const track=selectedTrack();if(!track)return false;const regionId=track.analysisScopeId||null,target=regionId?track.regions.find(r=>r.id===regionId):track;
 const result=dispatch({type:'correct',trackId:track.id,regionId,values:{...target.corrections,[field]:value},fields:[field],origin});
 if(result){playback.stopCompanions();renderDetail();renderLibrary();}return result;
}
ui['save-fix'].onclick=()=>{if(!selectedTrack())return;const bpm=parseBpm(ui['fix-bpm'].value),key=ui['fix-key'].value;if(ui['fix-bpm'].value&&bpm==null){notify('Enter a BPM between 25 and 400, with at most two decimals.');return;}if(key&&!keys.includes(key)){notify('Choose a listed musical key.');return;}const outcome=dispatch({type:'correct',trackId:selectedTrack().id,regionId:selectedTrack().analysisScopeId||null,values:{...(ui['fix-bpm'].value?{bpm}:{}),...(key?{key}:{})}});playback.stopCompanions();renderDetail();renderLibrary();notify(outcome?.saved?'Saved your correction in this browser.':'Changes are available in this tab but could not be saved.');};
ui['reset-fix'].onclick=()=>{if(!selectedTrack())return;const outcome=dispatch({type:'resetCorrection',trackId:selectedTrack().id,regionId:selectedTrack().analysisScopeId||null});ui['fix-bpm'].value='';ui['fix-key'].value='';playback.stopCompanions();renderDetail();renderLibrary();notify(outcome?.saved?'Manual correction reset.':'Reset in this tab; browser storage is unavailable.');};
ui.theme.onclick=()=>{const value=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=value;try{localStorage.setItem('jonaaudio-theme',value)}catch{}drawWave();drawSpectrum();};try{document.documentElement.dataset.theme=localStorage.getItem('jonaaudio-theme')||'dark';}catch{}
let resizeQueued=false;window.addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;drawWave();drawSpectrum();});});window.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName||'')){e.preventDefault();ui.play.click();}});
ui['mobile-analyze'].addEventListener('click',()=>switchMobile('analyze'));
ui['mobile-library'].addEventListener('click',()=>switchMobile('library'));
function exportJson(){downloadText(jsonReport(state),'jonaaudio-analysis.json','application/json');}
async function exportSession(){await writer.flush();downloadText(JSON.stringify(sessionSnapshot(state),null,2),'jonaaudio-session.json','application/json');}
function applyRecovered(data){
 samples.clear();jobs.clear();playback.clear();state.tracks.forEach(t=>{if(t.url)URL.revokeObjectURL(t.url);});
 dispatch({type:'restore',entries:data.tracks,selectedId:data.selectedId,standaloneTuning:data.standaloneTuning});
 runId=Math.max(0,...data.tracks.map(t=>t.id));zoom=1;
 refreshMobile();renderDetail();renderLibrary();
 notify(data.tracks.length?'Restored decisions for '+data.tracks.length+' tracks. Relink the source files in Library.':'Restored an empty session.');
}
async function importSession(file){
 if(!file||file.size>4*1048576){notify('Session JSON is missing or exceeds 4 MB. Current work unchanged.');return false;}
 try{const parsed=parseSession(JSON.parse(await file.text()));applyRecovered(parsed);writer.schedule(state);return true;}
 catch(e){notify((e.message||'Invalid session file')+' Current work unchanged.');return false;}
}
function pickSession(){const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';picker.onchange=()=>void importSession(picker.files?.[0]);picker.click();}
const saveTypes=new Set(['add','restore','relink','select','remove','clear','region','grid','candidateFavorite','undo','tuning','correct','resetCorrection','selectScope']);
subscribe(({type})=>{if(saveTypes.has(type))writer.schedule(state);});
window.addEventListener('pagehide',()=>{void writer.flush();});document.addEventListener('visibilitychange',()=>{if(document.hidden)void writer.flush();});
async function startRecovery(){
 try{const restored=await readSavedSession();if(restored&&state.tracks.length===0)applyRecovered(restored);}
 catch(e){if(!/IndexedDB is unavailable/.test(e.message))notify('Saved session could not be restored. Existing corrections remain; you can import session JSON.');}
}
void startRecovery();
refreshMobile();renderDetail();renderLibrary();
// Explicit subscriptions replace DOM mutation observation in the shell.
subscribe(({type})=>{if(['correct','resetCorrection','region','selectScope','undo'].includes(type)){renderDetail();}});
window.JonaAudioBridge=Object.freeze({
 saveSession:()=>writer.flush(),sessionDirty:()=>writer.isDirty(),
 list:()=>state.tracks.map(t=>({id:t.id,name:t.name,state:t.state,sourceAvailable:t.sourceAvailable,duration:t.duration,analysis:t.analysis,analysisScopeId:t.analysisScopeId,scopeRange:t.analysisScopeId?t.regions.find(r=>r.id===t.analysisScopeId):null,effective:resolveValues(t),activeEffective:valuesFor(t),scopeResult:scopeResult(t),result:t.result?{tempo:t.result.tempo,keys:t.result.keys,quality:t.result.quality}:null})),
 samples,findSamples:options=>{const t=selectedTrack();if(t?.sourceAvailable){samples.stopLoop();return jobs.request(t,{capabilities:['suggestions'],force:true,extraOptions:{gridRevision:t.gridRevision,settings:{grid:t.sampleGrid,gridStale:t.gridStale,...options}}});}},
 selectedId:()=>state.selectedId,
 choose:id=>{const match=state.tracks.find(t=>t.id===Number(id));if(match)select(match);},
 currentValues:()=>valuesFor(selectedTrack()),setOverride,
 requestAnalysis:(capabilities,options={})=>{const t=selectedTrack();if(t?.sourceAvailable)jobs.request(t,{mode:ui.mode.value,scopeId:t.analysisScopeId||null,...options,capabilities});},
 requestFor:(id,capabilities,options={})=>{const t=state.tracks.find(t=>t.id===Number(id));if(t?.sourceAvailable)jobs.request(t,{mode:ui.mode.value,...options,capabilities});},
 requestAll:()=>{for(const t of state.tracks)if(t.sourceAvailable)jobs.request(t,{mode:ui.mode.value,force:true});},cancel:id=>jobs.cancel(id),diagnostics:jobs.diagnostics,
 setScope:(start,end)=>{const t=selectedTrack();if(!t)return false;if(start==null){t.analysisScopeId=null;}else {if(!dispatch({type:'region',trackId:t.id,region:{id:'quick-region',start,end}}))return false;t.analysisScopeId='quick-region';}renderDetail();renderLibrary();return true;},
 subscribe,values:(id,regionId)=>resolveValues(state.tracks.find(t=>t.id===Number(id)),regionId),
 auditionRange:(id,range)=>{const t=state.tracks.find(t=>t.id===id);return t?.sourceAvailable?playback.audition(t,range):Promise.resolve(false);},
 auditionCompare:(id,gain=1)=>{const t=state.tracks.find(t=>t.id===Number(id));if(!t?.sourceAvailable||!t.url)return Promise.resolve(false);playback.setListeningAttenuation(gain);return playback.audition(t,{start:t.playback.position||0});},setCompareAttenuation:value=>playback.setListeningAttenuation(value),auditionReference:(id,scopeId=null)=>{const t=state.tracks.find(t=>t.id===id);if(!t?.sourceAvailable)return Promise.resolve(false);const r=scopeId?t.regions.find(r=>r.id===scopeId):null;return playback.audition(t,{start:r?.start||0,end:r?.end??null});},
 redraw:()=>{drawWave();drawSpectrum();},exportJson,exportSession,pickSession,transport:playback
});
window.dispatchEvent(new Event('jona:ready'));

// Site exits pass through the app-owned save barrier. A failed write keeps the tab.
let leaving=false;
document.addEventListener('click',async event=>{
 const a=event.target.closest?.('a[href]');if(!a||a.target==='_blank'||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const dest=new URL(a.href,location.href);if(dest.origin!==location.origin||!['/','/apps/'].includes(dest.pathname))return;
 event.preventDefault();if(leaving)return;leaving=true;
 try{writer.schedule(state);const saved=await writer.flush();
  if(!saved){notify('Could not save this session. Export session JSON or open the Universe in another tab; your work is still here.');return;}
  location.assign(dest.href);
 }catch(e){notify('Could not save this session. Keep this tab open and export session JSON.');}
 finally{leaving=false;}
});
window.addEventListener('beforeunload',event=>{if(writer.isDirty()){event.preventDefault();event.returnValue='';}});
