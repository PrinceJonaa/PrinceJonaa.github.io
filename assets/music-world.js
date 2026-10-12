
const $=s=>document.querySelector(s),KEY='pj-universe-music-v1';
const node=(tag,text,cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const safeStream=s=>{try{const u=new URL(s,location.origin);return u.protocol==='https:'&&/(^|\.)spotify\.com$|(^|\.)soundcloud\.com$|(^|\.)youtube\.com$|^youtu\.be$/.test(u.hostname)?u.href:null;}catch{return null;}};
const safePreview=s=>{try{const u=new URL(s,location.origin);return u.origin===location.origin&&u.pathname.startsWith('/assets/music/')?u.href:null;}catch{return null;}};
const clock=s=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';
let tracks=[],releases=[],videos=[],queue=[],local=[],current=-1,resume=null;
try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x?.schema===1&&x.playerResume?.trackPublicId)resume=x.playerResume;}catch{}
const audio=$('[data-music-audio]'),status=$('[data-music-status]'),seek=$('[data-music-seek]');
const currentTrack=()=>queue[current]||null;
function say(s){status.textContent=s;}
function save(){const t=currentTrack();if(!t||t.local)return;try{localStorage.setItem(KEY,JSON.stringify({schema:1,playerResume:{trackPublicId:t.id,seconds:Math.floor(audio.currentTime||0),paused:true}}));}catch{}}
function draw(){
 const t=currentTrack(),enabled=!!t,playing=enabled&&!audio.paused;
 $('[data-music-current]').textContent=t?.title||'Choose a track or select device audio';
 for(const k of ['play','prev','next','seek','mute'])$('[data-music-'+k+']').disabled=!enabled;
 $('[data-music-play]').textContent=playing?'Pause':'Play';
 $('[data-music-play]').setAttribute('aria-label',playing?'Pause track':'Play track');
 $('[data-music-mute]').textContent=audio.muted?'Unmute':'Mute';
 seek.max=Number.isFinite(audio.duration)?Math.floor(audio.duration):0;
 seek.value=Math.min(Number(seek.max),Math.floor(audio.currentTime||0));
 $('[data-music-time]').textContent=clock(audio.currentTime)+' / '+clock(audio.duration);
 const root=$('[data-music-queue]');root.replaceChildren();
 queue.forEach((item,i)=>{const li=node('li','');const b=node('button',item.title+(item.local?' · local':''));
 b.type='button';b.setAttribute('aria-current',String(i===current));if(i===current)b.className='is-current';b.onclick=()=>select(i,false);li.append(b);root.append(li);});
 if(!queue.length)root.append(node('li','Queue empty.'));
}
async function play(){if(!currentTrack())return;try{await audio.play();say('Playing '+currentTrack().title+'.');}catch{say('Could not play this audio. Check the format or use the official platform link.');}draw();}
function select(i,autoplay){
 if(i<0||i>=queue.length)return;
 audio.pause();current=i;const t=currentTrack(),source=t.local?t.objectURL:safePreview(t.previewUrl);
 if(!source){say('Preview unavailable; try the official stream link.');draw();return;}
 audio.src=source;audio.load();
 $('[data-music-fallback]').hidden=true;
 if(!t.local&&resume?.trackPublicId===t.id&&resume.seconds>0){
  const seconds=resume.seconds;audio.addEventListener('loadedmetadata',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(seconds,Math.max(0,audio.duration-.1));draw();},{once:true});resume=null;
 }
 say(autoplay?'Loading the next track…':'Selected. Press Play to listen.');draw();if(autoplay)void play();
}
function add(t,playNow){
 let i=queue.findIndex(x=>x.id===t.id);if(i<0){queue.push(t);i=queue.length-1;}
 if(current<0||playNow)select(i,playNow);else{say(t.title+' added to queue.');draw();}
}
function releaseLocal(){
 local.forEach(x=>URL.revokeObjectURL(x.objectURL));local=[];
 queue=queue.filter(x=>!x.local);current=-1;
}
function showCatalog(){
 const root=$('[data-music-tracks]'),q=$('[data-music-search]').value.trim().toLowerCase();
 const visible=tracks.filter(t=>(t.title+' '+(t.artist||'')+' '+(t.release||'')).toLowerCase().includes(q));
 $('[data-music-count]').textContent=visible.length+' approved preview tracks';root.replaceChildren();
 if(!visible.length){root.append(node('p',tracks.length?'No matches. Try another search.':'No recordings are currently cleared for public self-hosted playback. Listen through the official artist player or open a file from your device.','music-empty'));return;}
 for(const t of visible){
  const card=node('article','','music-track');card.append(node('h3',t.title),node('p',(t.artist||'Prince Jona')+(t.release?' · '+t.release:'')));
  const actions=node('div','','music-actions'),b=node('button','Play preview','btn'),q=node('button','Queue','btn');
  b.type='button';b.onclick=()=>add(t,true);q.type='button';q.onclick=()=>add(t,false);actions.append(b,q);
  const url=safeStream(t.streamUrl);if(url){const a=node('a','Official stream ↗','btn');a.href=url;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);}
  card.append(actions);root.append(card);
 }
}
function showRelease(){
 const root=$('[data-music-releases]');root.replaceChildren();
 if(!releases.length)root.append(node('p','Track-level release cards are awaiting verified credits, rights and artwork. Official discography links are available above.','fineprint'));
 releases.forEach(r=>{const a=node('a',r.title+' ↗','music-release');a.href=safeStream(r.streamUrl);a.target='_blank';a.rel='noopener noreferrer';root.append(a);});
 const gallery=$('[data-music-videos]');gallery.replaceChildren();
 if(!videos.length)gallery.append(node('p','Individual videos and captions await cleared public links and credits. Visit the official YouTube channel below.','fineprint'));
 videos.forEach(v=>{const a=node('a',v.title+' ↗','music-release');a.href=safeStream(v.url);a.target='_blank';a.rel='noopener noreferrer';gallery.append(a);});
}
if(audio){
 $('[data-music-play]').onclick=()=>{if(audio.paused)void play();else{audio.pause();save();draw();say('Paused.');}};
 $('[data-music-prev]').onclick=()=>select(Math.max(current-1,0),false);
 $('[data-music-next]').onclick=()=>select(Math.min(current+1,queue.length-1),false);
 seek.oninput=()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=Number(seek.value);draw();};
 $('[data-music-volume]').oninput=e=>{audio.volume=Number(e.target.value)/100;audio.muted=false;draw();};
 $('[data-music-mute]').onclick=()=>{audio.muted=!audio.muted;draw();};
 audio.volume=.85;
 audio.addEventListener('timeupdate',draw);audio.addEventListener('loadedmetadata',draw);
 audio.addEventListener('ended',()=>{if(current<queue.length-1)select(current+1,true);else{save();say('Queue finished.');draw();}});
 audio.addEventListener('error',()=>{const t=currentTrack();const url=t&&!t.local?safeStream(t.streamUrl):null;const a=$('[data-music-fallback]');a.hidden=!url;if(url)a.href=url;say('This browser could not decode the selected audio. Use the official stream if available.');draw();});
 $('[data-music-file]').onchange=e=>{
  audio.pause();audio.removeAttribute('src');audio.load();releaseLocal();
  const files=[...e.target.files].filter(f=>f.type.startsWith('audio/')||/\.(wav|mp3|m4a|aac|flac|ogg|opus)$/i.test(f.name)).slice(0,20);
  local=files.map((f,i)=>({id:'local:'+i,title:f.name,local:true,objectURL:URL.createObjectURL(f)}));
  queue.push(...local);if(local.length)select(queue.length-local.length,false);else{say('No supported audio selected.');draw();}
  e.target.value='';
 };
 $('[data-music-clear-queue]').onclick=()=>{audio.pause();audio.removeAttribute('src');audio.load();releaseLocal();queue=[];current=-1;draw();say('Queue cleared. Source files remained on your device.');};
 $('[data-music-provider]').onclick=()=>{
  const host=$('[data-music-provider-host]');host.replaceChildren();
  const iframe=document.createElement('iframe');iframe.src='https://open.spotify.com/embed/artist/4oLxy1WTGaWi2D5bCwRkzP';iframe.title='Spotify artist player for Prince Jona';iframe.loading='lazy';iframe.allow='encrypted-media; fullscreen; picture-in-picture';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.width='100%';iframe.height='352';host.append(iframe);
  $('[data-music-provider]').textContent='Spotify player loaded';$('[data-music-provider]').disabled=true;
 };
 $('[data-music-search]').oninput=showCatalog;
 window.addEventListener('pagehide',()=>{save();local.forEach(x=>URL.revokeObjectURL(x.objectURL));},{once:true});
 fetch('/assets/music-catalog.json').then(r=>{if(!r.ok)throw Error('catalog unavailable');return r.json();}).then(data=>{
  if(data.schema!==1)throw Error('wrong schema');
  tracks=(data.tracks||[]).filter(t=>t?.rights?.sitePreviewApproved===true&&typeof t.id==='string'&&typeof t.title==='string'&&safePreview(t.previewUrl));
  releases=(data.releases||[]).filter(r=>r?.rights?.publicMetadataApproved===true&&r.title&&safeStream(r.streamUrl));
  videos=(data.videos||[]).filter(v=>v?.rights?.publicVideoApproved===true&&v.title&&safeStream(v.url));
  if(resume){const r=tracks.find(t=>t.id===resume.trackPublicId);if(r)add(r,false);}
  showCatalog();showRelease();draw();
 }).catch(()=>{say('Public media catalog unavailable. Official streaming links still work.');showCatalog();showRelease();});
 draw();
}
