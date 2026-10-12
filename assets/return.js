
import {apps,worlds} from './registry.js';
import {siteUpdates} from './site-updates.js';

const KEY='pj-universe-return-v1', MUSIC_KEY='pj-universe-music-v1', LIMIT=12;
const entries=[...worlds,...apps].filter(x=>x.visibility==='public');
const byId=new Map(entries.map(x=>[x.publicId,x]));
const safePath=path=>{try{return new URL(path,location.origin).pathname.replace(/\/+$/,'')+'/';}catch{return ''}};
const byPath=new Map(entries.map(x=>[safePath(x.href),x]));
const blank=()=>({schema:1,historyEnabled:false,recents:[],favorites:[]});
let memory=blank(),storageOK=true;
try {
 const stored=JSON.parse(localStorage.getItem(KEY)||'null');
 if(stored?.schema===1){
  memory.historyEnabled=stored.historyEnabled===true;
  memory.recents=Array.isArray(stored.recents)?stored.recents.filter(r=>byId.has(r?.publicId)&&Number.isFinite(r?.lastOpenedAt)).slice(0,LIMIT):[];
  memory.favorites=Array.isArray(stored.favorites)?[...new Set(stored.favorites.filter(id=>byId.has(id)))].slice(0,32):[];
 }
} catch {storageOK=false;}
function save(){
 try {localStorage.setItem(KEY,JSON.stringify(memory));storageOK=true;return true;}
 catch {storageOK=false;return false;}
}
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n;};
const link=(label,href,cls)=>{const a=el('a',cls,label);a.href=href;return a;};
const desc=id=>{
 const r=byId.get(id);if(!r)return '';
 if(r.id==='jonaaudio')return 'Session decisions stay in JonaAudio. Original audio must be relinked.';
 if(r.id==='rhythmcut')return 'Open RhythmCut Projects; the app owns its video and project storage.';
 if(r.id==='beatcut')return 'Project status only; there is no released editor to resume.';
 if(r.kind==='app')return 'Open the source app. Local files and project recovery stay app-owned.';
 return 'Continue exploring this public world.';
};
function record(id){
 if(!memory.historyEnabled||!byId.has(id))return;
 memory.recents=[{publicId:id,lastOpenedAt:Date.now()},...memory.recents.filter(x=>x.publicId!==id)].slice(0,LIMIT);
 save();
}
function toggleFavorite(id){
 if(!byId.has(id))return;
 memory.favorites=memory.favorites.includes(id)?memory.favorites.filter(x=>x!==id):[id,...memory.favorites].slice(0,32);
 const persisted=save();render();
 announce(persisted?'Saved preference updated on this device.':'Local storage is unavailable; preference is temporary.');
}
function announce(message){const out=document.querySelector('[data-memory-status]');if(out)out.textContent=message;}
function item(id,showRemove=false){
 const r=byId.get(id);if(!r)return null;
 const card=el('article','memory-card');
 const top=el('div','memory-card-top');top.append(el('span','eyebrow',r.kind==='app'?'Application':'World'));
 const star=el('button','memory-star',memory.favorites.includes(id)?'★ Saved':'☆ Save');
 star.type='button';star.setAttribute('aria-pressed',String(memory.favorites.includes(id)));
 star.setAttribute('aria-label',(memory.favorites.includes(id)?'Remove favorite: ':'Save favorite: ')+r.name);
 star.addEventListener('click',()=>toggleFavorite(id));top.append(star);
 const h=el('h3');h.append(link(r.name+' ↗',r.href));
 card.append(top,h,el('p','',desc(id)));
 if(showRemove){const remove=el('button','memory-remove','Remove from recents');remove.type='button';remove.onclick=()=>{memory.recents=memory.recents.filter(x=>x.publicId!==id);save();render();};card.append(remove);}
 return card;
}
function renderList(selector,ids,emptyText,remove=false){
 const root=document.querySelector(selector);if(!root)return;
 root.replaceChildren();
 if(!ids.length){root.append(el('p','memory-empty',emptyText));return;}
 for(const id of ids){const node=item(id,remove);if(node)root.append(node);}
}
function render(){
 const enabled=document.querySelector('[data-memory-enable]');
 if(enabled){enabled.checked=memory.historyEnabled;enabled.disabled=!storageOK;}
 renderList('[data-memory-favorites]',memory.favorites,'Nothing saved yet. Save a public world or application to return here.');
 renderList('[data-memory-recents]',memory.historyEnabled?memory.recents.map(r=>r.publicId):[],memory.historyEnabled?'No recent public pages saved yet.':'History is off. Turn it on to save public navigation on this device.',true);
 document.querySelectorAll('[data-favorite-current]').forEach(button=>{
  const r=byPath.get(safePath(location.pathname));if(!r)return;
  button.textContent=memory.favorites.includes(r.publicId)?'★ Saved':'☆ Save world';
  button.setAttribute('aria-pressed',String(memory.favorites.includes(r.publicId)));
 });
}
function init(){
 if(!document.querySelector('link[href="/assets/return.css"]')){const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/assets/return.css';document.head.append(sheet);}
 const current=byPath.get(safePath(location.pathname));
 if(memory.historyEnabled&&current)record(current.publicId);
 document.addEventListener('click',event=>{
  const anchor=event.target.closest?.('a[href]');if(!anchor||!memory.historyEnabled)return;
  if(anchor.origin!==location.origin)return;
  const target=byPath.get(safePath(anchor.pathname));if(target)record(target.publicId);
 },{capture:true});
 const nav=document.querySelector('[data-nav]');
 if(nav&&!nav.querySelector('[data-memory-nav]'))nav.append(link('My Universe','/continue/','memory-nav'));
 if(current&&document.querySelector('.breadcrumb')){
  const b=el('button','memory-star memory-save-current','☆ Save world');
  b.type='button';b.dataset.favoriteCurrent='';b.setAttribute('aria-pressed','false');
  b.addEventListener('click',()=>toggleFavorite(current.publicId));
  document.querySelector('.breadcrumb').append(b);
 }
 const enable=document.querySelector('[data-memory-enable]');
 enable?.addEventListener('change',()=>{
  memory.historyEnabled=enable.checked;
  if(!memory.historyEnabled)memory.recents=[];
  const success=save();render();
  announce(success?(enable.checked?'On-device public-page history enabled.':'History disabled and existing recents erased.'):'Device storage is unavailable; history cannot be saved.');
 });
 document.querySelector('[data-memory-clear-recents]')?.addEventListener('click',()=>{
  memory.recents=[];save();render();announce('Recent pages cleared.');
 });
 document.querySelector('[data-memory-clear-all]')?.addEventListener('click',()=>{
  memory=blank();try{localStorage.removeItem(KEY);localStorage.removeItem(MUSIC_KEY);storageOK=true;}catch{storageOK=false;}
  render();announce('Local Universe recents, favorites and player resume cleared. App-owned projects were not touched.');
 });
 const preview=document.querySelector('[data-return-home]');
 if(preview){
  const heading=el('div','section-head'),intro=el('div');
  intro.append(el('span','eyebrow','04 / Return'),el('h2','','Pick up where you left off.'));
  heading.append(intro,link('My Universe →','/continue/','btn'));
  const grid=el('div','memory-home-grid');
  const latest=siteUpdates.find(u=>u.status==='published');
  if(latest){const news=el('article','memory-card');news.append(el('span','eyebrow','Latest verified update · '+latest.date),el('h3','',latest.title),el('p','',latest.summary),link('Read updates →','/updates/'));grid.append(news);}
  if(memory.historyEnabled&&memory.recents.length){const r=byId.get(memory.recents[0].publicId);if(r){const back=el('article','memory-card');back.append(el('span','eyebrow','On this device'),el('h3','',r.name),el('p','',desc(r.publicId)),link('Continue →',r.href));grid.append(back);}}
  else{const back=el('article','memory-card');back.append(el('span','eyebrow','Optional memory'),el('h3','','Return without an account'),el('p','','Save favorite public worlds and opt into local recents. Nothing is sent to a server.'),link('Choose what to keep →','/continue/'));grid.append(back);}
  preview.append(heading,grid);
 }
 render();
 if(!storageOK)announce('This browser blocks local storage. Saved preferences may not persist.');
}
init();
