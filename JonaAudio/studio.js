import {KEYS} from './engine.js';
const $=id=>document.getElementById(id),ui={};for(const id of ['files','drop','clear','tracks','count','search','export','mode','status','song-name','song-meta','bpm','bpm-alt','key','key-alt','length','format','rms','wave','spectrum','chroma','candidates','peak','crest','stereo','clips','lead','trail','play','seek','time','end-time','rate','zoomin','zoomout','zoom-label','fix-bpm','fix-key','save-fix','reset-fix','message','audio','theme','mobile-analyze','mobile-library'])ui[id]=$(id);
const MAX_FILE_BYTES=125*1024*1024,MAX_TRACKS=80,notes=KEYS,keys=notes.flatMap(n=>[n+' major',n+' minor']);
for(const key of keys){const option=document.createElement('option');option.value=key;option.textContent=key;ui['fix-key'].append(option);}
let tracks=[],selected=null,running=false,worker=null,runId=0,zoom=1,activeJob=null,drawQueued=false;
const fmt=(n)=>Number.isFinite(n)?`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`:'—';
const number=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';
const decibels=(n)=>Number.isFinite(n)?`${n.toFixed(1)} dB`:'−∞ dB';
const corrections=(()=>{try{return JSON.parse(localStorage.getItem('jonaaudio-corrections')||'{}')}catch{return{}}})();
const fileKey=f=>[f.name,f.size,f.lastModified].join(':');
const corrFor=t=>corrections[fileKey(t.file)]||{};
const MAX_DECODED_BYTES=256*1024*1024;
const saveCorrections=()=>{try{localStorage.setItem('jonaaudio-corrections',JSON.stringify(corrections))}catch{notify('Could not save corrections in this browser.')}};
function notify(message){ui.message.textContent=message;}
function switchMobile(view){
 const showLibrary=view==='library';document.body.classList.toggle('mobile-library-open',showLibrary);
 ui['mobile-library'].setAttribute('aria-pressed',String(showLibrary));
 ui['mobile-analyze'].setAttribute('aria-pressed',String(!showLibrary));
}
function refreshMobile(){document.body.classList.toggle('has-tracks',tracks.length>0);}
function cancelWorker(){
 if(!activeJob)return;
 const job=activeJob;activeJob=null;if(job.timer)clearTimeout(job.timer);
 job.worker.terminate();if(worker===job.worker)worker=null;
 job.reject(new Error('Analysis cancelled'));
}

const statusNames={queued:'Waiting',decoding:'Decoding',analyzing:'Analyzing',ready:'Ready',error:'Error',cancelled:'Cancelled'};
function addFiles(incoming){const files=Array.from(incoming).filter(f=>f.type.startsWith('audio/')||/\.(wav|mp3|m4a|flac|aac|ogg|aiff?|opus|webm)$/i.test(f.name));if(files.length===0){notify('Choose an audio file supported by your browser.');return;}
 for(const file of files){if(tracks.length>=MAX_TRACKS){notify(`Session limit is ${MAX_TRACKS} tracks. Export or clear to add more.`);break;}if(file.size>MAX_FILE_BYTES){notify(`${file.name} exceeds the 125 MB browser analysis limit.`);continue;}
 const id=++runId,entry={id,file,url:URL.createObjectURL(file),name:file.name,size:file.size,duration:null,state:'queued',result:null,wave:null,error:null};tracks.push(entry);if(!selected)select(entry);}
 refreshMobile();renderLibrary();runQueue();}
function renderLibrary(){const q=ui.search.value.trim().toLowerCase();ui.tracks.replaceChildren();for(const item of tracks.filter(t=>t.name.toLowerCase().includes(q))){const row=document.createElement('div');row.className='track-row';const button=document.createElement('button');button.type='button';button.className='track'+(selected?.id===item.id?' selected':'');const title=document.createElement('span');title.className='track-name';title.textContent=item.name;const detail=document.createElement('span');detail.className='track-detail';const info=document.createElement('span');info.textContent=`${statusNames[item.state]}${item.duration?' · '+fmt(item.duration):''}`;const result=document.createElement('span');result.textContent=item.result?`${Math.round(item.result.tempo.bpm||0)||'?'} / ${item.result.keys[0]?.key||'?'}`:'';detail.append(info,result);button.append(title,detail);button.onclick=()=>select(item);const remove=document.createElement('button');remove.type='button';remove.className='remove-track';remove.textContent='×';remove.title='Remove track';remove.setAttribute('aria-label','Remove '+item.name);remove.onclick=()=>removeTrack(item);row.append(button,remove);ui.tracks.append(row);}
 if(!ui.tracks.children.length){const p=document.createElement('div');p.className='library-empty';p.textContent=tracks.length?'No tracks match that search.':'Your audio stays yours. Add a track to start analyzing.';ui.tracks.append(p);}ui.count.textContent=String(tracks.length);ui.export.disabled=!tracks.some(t=>t.result);}
function select(item){selected=item;zoom=1;ui['zoom-label'].textContent='1×';ui.audio.pause();ui.audio.src=item.url;ui.audio.playbackRate=Number(ui.rate.value);ui.audio.load();ui.audio.onloadedmetadata=()=>{if(selected?.id!==item.id)return;item.duration=ui.audio.duration;renderDetail();renderLibrary();};ui.audio.onerror=()=>{if(selected?.id===item.id)notify('This browser cannot play that format. Try WAV, MP3 or M4A.');};notify('');switchMobile('analyze');renderDetail();renderLibrary();}
function removeTrack(item){item.state='cancelled';if(activeJob?.id===item.id)cancelWorker();URL.revokeObjectURL(item.url);tracks=tracks.filter(t=>t.id!==item.id);if(selected?.id===item.id){selected=null;ui.audio.pause();ui.audio.removeAttribute('src');ui.audio.load();if(tracks.length)select(tracks[0]);}refreshMobile();renderDetail();renderLibrary();runQueue();}
function clearSession(){cancelWorker();tracks.forEach(t=>URL.revokeObjectURL(t.url));tracks=[];selected=null;ui.audio.pause();ui.audio.removeAttribute('src');ui.audio.load();refreshMobile();switchMobile('analyze');renderDetail();renderLibrary();notify('Session cleared. No audio was uploaded.');}
async function analyzeItem(item){
 if(item.state!=='queued')return;
 item.state='decoding';item.error=null;renderLibrary();if(selected?.id===item.id)renderDetail();
 let buffer;
 try{
  buffer=await item.file.arrayBuffer();
  if(item.state==='cancelled'||!tracks.includes(item))return;
  const context=new (window.AudioContext||window.webkitAudioContext)();let decoded;
  try{decoded=await context.decodeAudioData(buffer);}finally{await context.close();}
  buffer=null;
  if(!tracks.includes(item)||item.state==='cancelled')return;
  const estimated=decoded.length*decoded.numberOfChannels*4;
  if(estimated>MAX_DECODED_BYTES)throw Error('Decoded audio exceeds the 256 MB memory safety limit. Try a shorter track.');
  item.duration=decoded.duration;
  // Move the full-resolution quality scan and waveform extraction off the UI thread.
  const left=decoded.getChannelData(0),right=decoded.numberOfChannels>1?decoded.getChannelData(1):null;
  item.state='analyzing';renderLibrary();if(selected?.id===item.id)renderDetail();
  const mode=ui.mode.value;
  const result=await new Promise((resolve,reject)=>{
   const w=new Worker('./worker.js',{type:'module'});w._id=item.id;worker=w;
   const timer=setTimeout(()=>{if(activeJob?.worker===w){activeJob=null;worker=null;}w.terminate();reject(Error('Analysis timed out. Try Quick mode or a smaller song.'));},120000);
   activeJob={id:item.id,worker:w,reject,timer};
   const finish=()=>{clearTimeout(timer);w.terminate();if(activeJob?.worker===w)activeJob=null;if(worker===w)worker=null;};
   w.onmessage=e=>{
    if(e.data.id!==item.id)return;
    if(e.data.phase==='wave'){
     if(tracks.includes(item)){item.wave=e.data.peaks;if(selected?.id===item.id)scheduleWave();}
     return;
    }
    finish();e.data.error?reject(Error(e.data.error)):resolve(e.data.result);
   };
   w.onerror=e=>{finish();reject(Error(e.message||'Analysis worker failed.'));};
   try{
    const payload={id:item.id,left,right,sampleRate:decoded.sampleRate,mode};
    const transfer=right?[left.buffer,right.buffer]:[left.buffer];
    try{w.postMessage(payload,transfer);}catch(transferError){
     // Browser implementations with non-transferable channel memory can clone instead.
     w.postMessage(payload);
    }
   }catch(error){finish();reject(Error('This browser could not send the audio for background analysis: '+error.message));}
  });
  if(!tracks.includes(item)||item.state==='cancelled')return;
  item.result=result;item.state='ready';
 }catch(e){if(item.state!=='cancelled'&&tracks.includes(item)){item.state='error';item.error=e?.message||String(e);}}
 finally{if(selected?.id===item.id)renderDetail();renderLibrary();}
}
async function runQueue(){if(running)return;running=true;try{while(true){const next=tracks.find(t=>t.state==='queued');if(!next)break;await analyzeItem(next);}}finally{running=false;}}
function renderDetail(){const item=selected,result=item?.result,correction=item?corrFor(item):{};ui.status.textContent=item?statusNames[item.state].toUpperCase():'AWAITING AUDIO';ui['song-name'].textContent=item?.name||'No track selected';ui['song-meta'].textContent=item?`${(item.size/1048576).toFixed(1)} MB · ${item.duration?fmt(item.duration):'Reading duration'}${item.error?' · '+item.error:''}`:'Drag in a song to begin.';
 ui.bpm.textContent=correction.bpm||result?.tempo.bpm||'—';ui['bpm-alt'].textContent=result?.tempo.alternatives?.length?`Candidates: ${result.tempo.alternatives.slice(0,3).map(c=>c.bpm).join(' / ')}`:item?.state==='analyzing'?'Estimating pulse…':'BPM is an estimate';ui.key.textContent=correction.key||result?.keys[0]?.key||'—';ui['key-alt'].textContent=result?.keys[1]?.key?`Alternative: ${result.keys[1].key}`:'Key may be ambiguous';ui.length.textContent=item?.duration?fmt(item.duration):'—';ui.format.textContent=item?.file.name.split('.').at(-1)?.toUpperCase()||'Source audio';ui.rms.textContent=result?.quality?decibels(result.quality.rmsDb):'—';
 const q=result?.quality;ui.peak.textContent=q?decibels(q.samplePeakDb):'—';ui.crest.textContent=q?decibels(q.crestDb):'—';ui.stereo.textContent=q?(q.stereoCorrelation===null?'Mono':number(q.stereoCorrelation,2)):'—';ui.clips.textContent=q?Number(q.nearCeilingSamples).toLocaleString():'—';ui.lead.textContent=q?number(q.leadingSilence,2)+' s':'—';ui.trail.textContent=q?number(q.trailingSilence,2)+' s':'—';
 ui['end-time'].textContent=item?.duration?fmt(item.duration):'0:00';ui.play.disabled=!item;ui.seek.disabled=!item;ui.zoomin.disabled=!item?.wave;ui.zoomout.disabled=!item?.wave;ui['save-fix'].disabled=!item;ui['reset-fix'].disabled=!item;ui['fix-bpm'].value=correction.bpm||'';ui['fix-key'].value=correction.key||'';drawWave();drawSpectrum();drawChroma();renderCandidates();updatePosition();}
function canvasContext(canvas){const box=canvas.getBoundingClientRect(),width=Math.max(200,Math.floor(box.width)),height=Math.max(100,Math.floor(box.height||Number(canvas.getAttribute('height'))));const dpr=Math.min(devicePixelRatio||1,window.innerWidth<760?1.25:1.75);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w:width,h:height};}
function palette(){const css=getComputedStyle(document.documentElement);return {accent:css.getPropertyValue('--accent').trim(),muted:css.getPropertyValue('--muted').trim(),line:css.getPropertyValue('--line').trim(),text:css.getPropertyValue('--text').trim()};}
function scheduleWave(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;drawWave();});}
function drawWave(){const {ctx,w,h}=canvasContext(ui.wave),t=selected,p=palette();ctx.clearRect(0,0,w,h);ctx.strokeStyle=p.line;ctx.beginPath();ctx.moveTo(0,h*.5);ctx.lineTo(w,h*.5);ctx.stroke();if(!t?.wave)return;
 const total=t.duration||1,span=total/zoom,start=Math.max(0,Math.min(total-span,(ui.audio.currentTime||0)-span/2)),wave=t.wave;
 ctx.fillStyle=p.accent;for(let px=0;px<w;px++){const idx=Math.min(wave.length-1,Math.floor(((start+px/w*span)/total)*wave.length)),amp=wave[idx];if(amp){ctx.globalAlpha=.83;ctx.fillRect(px,h/2-amp*(h*.42),Math.max(1,w/wave.length),amp*(h*.84));}}ctx.globalAlpha=1;
 if(t.result?.tempo?.beats?.length){ctx.strokeStyle='#f9b780';ctx.globalAlpha=.52;ctx.beginPath();for(const beat of t.result.tempo.beats){if(beat>=start&&beat<=start+span){const x=(beat-start)/span*w;ctx.moveTo(x,h-15);ctx.lineTo(x,h);}}ctx.stroke();ctx.globalAlpha=1;}
 const position=((ui.audio.currentTime||0)-start)/span*w;if(position>=0&&position<=w){ctx.strokeStyle=p.text;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(position,0);ctx.lineTo(position,h);ctx.stroke();ctx.lineWidth=1;}}
function drawSpectrum(){const {ctx,w,h}=canvasContext(ui.spectrum),s=selected?.result?.spectrogram;ctx.clearRect(0,0,w,h);if(!s)return;const image=ctx.createImageData(s.columns,s.rows);for(let i=0;i<s.pixels.length;i++){const v=s.pixels[i]/255,k=i*4;image.data[k]=Math.round(10+v*153);image.data[k+1]=Math.round(20+v*200);image.data[k+2]=Math.round(36+v*112);image.data[k+3]=255;}
 const temp=document.createElement('canvas');temp.width=s.columns;temp.height=s.rows;temp.getContext('2d').putImageData(image,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(temp,0,0,w,h);ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,h-21,210,21);ctx.fillStyle='#f4f7fc';ctx.font='11px system-ui';ctx.fillText(`Preview: ${fmt(s.start)} – ${fmt(s.end)}`,9,h-7);}
function drawChroma(){ui.chroma.replaceChildren();const chroma=selected?.result?.chroma;if(!chroma){const msg=document.createElement('p');msg.className='muted';msg.textContent='Chromatic energy appears here when analysis finishes.';ui.chroma.append(msg);return;}for(let i=0;i<12;i++){const cell=document.createElement('div');cell.className='note';const b=document.createElement('div');b.className='bar-note';const bar=document.createElement('i');bar.style.height=Math.round((chroma[i]||0)*100)+'%';b.append(bar);const name=document.createElement('small');name.textContent=notes[i];cell.append(b,name);ui.chroma.append(cell);}}
function renderCandidates(){const area=ui.candidates;area.replaceChildren();const r=selected?.result;if(!r){area.textContent='No estimates yet.';return;}for(const label of [...r.tempo.alternatives.slice(0,3).map(x=>x.bpm+' BPM'),...r.keys.slice(0,3).map(x=>x.key)]){const span=document.createElement('span');span.className='candidate';span.textContent=label;area.append(span);}}
function updatePosition(){ui.time.textContent=fmt(ui.audio.currentTime||0);ui.seek.value=ui.audio.duration?String(Math.round(ui.audio.currentTime/ui.audio.duration*1000)):'0';ui.play.textContent=ui.audio.paused?'▶':'❚❚';if(selected?.wave&&ui.audio.duration)scheduleWave();}
function exportCsv(){const rows=[['File','Duration seconds','Auto BPM','BPM candidates','Auto key','Other key','Corrected BPM','Corrected key','RMS dBFS','Sample peak dBFS','Crest dB','Stereo correlation','Near ceiling samples','Leading silence seconds','Trailing silence seconds']];for(const t of tracks){if(!t.result)continue;const r=t.result,c=corrFor(t),q=r.quality;rows.push([t.name,t.duration??'',r.tempo.bpm??'',r.tempo.alternatives.map(v=>v.bpm).join('|'),r.keys[0]?.key??'',r.keys[1]?.key??'',c.bpm??'',c.key??'',q.rmsDb??'',q.samplePeakDb??'',q.crestDb??'',q.stereoCorrelation??'',q.nearCeilingSamples,q.leadingSilence,q.trailingSilence]);}
 const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='jonaaudio-analysis.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
ui.files.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});ui.search.addEventListener('input',renderLibrary);ui.clear.addEventListener('click',clearSession);ui.export.addEventListener('click',exportCsv);
for(const event of ['dragenter','dragover'])document.addEventListener(event,e=>{e.preventDefault();ui.drop.classList.add('dragging');});for(const event of ['dragleave','drop'])document.addEventListener(event,e=>{e.preventDefault();if(event==='drop'){ui.drop.classList.remove('dragging');addFiles(e.dataTransfer?.files||[]);}else if(e.target===document.documentElement||e.target===document.body)ui.drop.classList.remove('dragging');});
ui.play.onclick=()=>{if(!selected)return;ui.audio.paused?ui.audio.play().catch(()=>notify('Playback failed; this audio format may not be supported.')):ui.audio.pause();};ui.audio.addEventListener('timeupdate',updatePosition);ui.audio.addEventListener('play',updatePosition);ui.audio.addEventListener('pause',updatePosition);ui.audio.addEventListener('ended',updatePosition);ui.seek.oninput=()=>{if(ui.audio.duration)ui.audio.currentTime=Number(ui.seek.value)/1000*ui.audio.duration;};ui.rate.onchange=()=>ui.audio.playbackRate=Number(ui.rate.value);
ui.wave.addEventListener('click',e=>{if(!selected?.duration)return;const box=ui.wave.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),span=selected.duration/zoom,start=Math.max(0,Math.min(selected.duration-span,(ui.audio.currentTime||0)-span/2));ui.audio.currentTime=start+fraction*span;drawWave();});
ui.zoomin.onclick=()=>{zoom=Math.min(8,zoom*2);ui['zoom-label'].textContent=zoom+'×';drawWave();};ui.zoomout.onclick=()=>{zoom=Math.max(1,zoom/2);ui['zoom-label'].textContent=zoom+'×';drawWave();};
ui.mode.onchange=()=>{for(const item of tracks){if(item.state==='ready'||item.state==='error'){item.state='queued';item.result=null;}}renderDetail();renderLibrary();runQueue();};
ui['save-fix'].onclick=()=>{if(!selected)return;const bpm=Number(ui['fix-bpm'].value),key=ui['fix-key'].value;if(ui['fix-bpm'].value&&(bpm<25||bpm>400||!Number.isFinite(bpm))){notify('Enter a BPM between 25 and 400.');return;}if(key&&!keys.includes(key)){notify('Choose a listed musical key.');return;}corrections[fileKey(selected.file)]={...(ui['fix-bpm'].value?{bpm}:{}) ,...(key?{key}:{})};saveCorrections();renderDetail();notify('Saved your correction in this browser.');};ui['reset-fix'].onclick=()=>{if(!selected)return;delete corrections[fileKey(selected.file)];saveCorrections();renderDetail();notify('Manual correction reset.');};
ui.theme.onclick=()=>{const value=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=value;try{localStorage.setItem('jonaaudio-theme',value)}catch{}drawWave();drawSpectrum();};try{document.documentElement.dataset.theme=localStorage.getItem('jonaaudio-theme')||'dark';}catch{}
let resizeQueued=false;window.addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;drawWave();drawSpectrum();});});window.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName||'')){e.preventDefault();ui.play.click();}});
ui['mobile-analyze'].addEventListener('click',()=>switchMobile('analyze'));
ui['mobile-library'].addEventListener('click',()=>switchMobile('library'));
refreshMobile();renderDetail();renderLibrary();
// Read-only adapter for the multi-view navigation and comparison workspace.
window.JonaAudioBridge=Object.freeze({
 list:()=>tracks.map(t=>({id:t.id,name:t.name,state:t.state,duration:t.duration,result:t.result?{tempo:t.result.tempo,keys:t.result.keys,quality:t.result.quality}:null})),
 selectedId:()=>selected?.id??null,
 choose:id=>{const match=tracks.find(t=>t.id===Number(id));if(match)select(match);}
});
