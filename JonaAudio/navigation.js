// JonaAudio multi-view navigation. Browser-only: no uploads or remote requests.
const q=(selector,root=document)=>root.querySelector(selector);
const node=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
const main=q('#app'),intro=q('.intro'),drop=q('#drop'),workspace=q('.workspace');
const library=q('.library',workspace),stage=q('.stage',workspace),mobile=q('.mobile-switch');
const clear=q('#clear'),mode=q('#mode'),theme=q('#theme'),fileInput=q('#files'),bridge=window.JonaAudioBridge;
const layout=node('div','new-layout'),rail=node('nav','new-rail'),area=node('div','new-area'),pages=node('div','new-pages');
rail.setAttribute('aria-label','App navigation');
rail.innerHTML='<div class="rail-kicker">WORKSPACE</div><div class="rail-links"><button data-route="analyze" type="button"><b>◉</b><span>Analyze</span></button><button data-route="library" type="button"><b>▤</b><span>Library</span><em id="rail-count">0</em></button><button data-route="compare" type="button"><b>⇄</b><span>Compare</span></button><button data-route="settings" type="button"><b>⚙</b><span>Settings</span></button></div><div class="rail-now"><span>NOW SELECTED</span><strong id="rail-name">No track selected</strong><small id="rail-state">Add audio to begin</small></div><div class="rail-note">Files stay on your device</div>';
intro.classList.add('compact-intro');
q('.overline',intro).textContent='YOUR LOCAL AUDIO WORKSPACE';
q('h1',intro).textContent='JonaAudio Studio';
q('p',intro).textContent='Analyze, inspect, and compare tracks in one private workspace.';
clear.remove();mobile.hidden=true;
const makePage=(id,label)=>{const s=node('section','nav-page');s.dataset.page=id;s.setAttribute('aria-label',label);pages.append(s);return s;};
const analyze=makePage('analyze','Analyze audio');
const libraryPage=makePage('library','Track library');
const comparePage=makePage('compare','Compare tracks');
const settingsPage=makePage('settings','Settings');
analyze.append(stage);
const empty=node('div','analyzer-empty');
empty.innerHTML='<span class="empty-glyph">♫</span><h3>Start with a track.</h3><p>Import a song to inspect its waveform, pulse, musical key and mix.</p><label for="files" class="button primary">Choose audio</label>';
q('.song-head',stage).after(empty);
const metrics=q('.metrics',stage),subnav=node('nav','subnav'),detailPages=node('div','subpages');
subnav.setAttribute('aria-label','Analysis tools');
const tabs=[['overview','Overview'],['rhythm','Rhythm & key'],['spectrum','Spectrogram'],['quality','Mix quality'],['corrections','Corrections']];
for(const [id,label] of tabs){const b=node('button','subnav-button',label);b.type='button';b.dataset.detail=id;subnav.append(b);const pane=node('section','subpage');pane.dataset.subpage=id;pane.setAttribute('aria-label',label);detailPages.append(pane);}
metrics.after(subnav,detailPages);
q('[data-subpage=overview]',detailPages).append(q('.transport-panel',stage));
q('[data-subpage=rhythm]',detailPages).append(q('.harmonic-panel',stage));
q('[data-subpage=spectrum]',detailPages).append(q('.spectrum-panel',stage));
q('[data-subpage=quality]',detailPages).append(q('.quality-panel',stage));
q('[data-subpage=corrections]',detailPages).append(q('.corrections',stage));
q('.detail-grid',stage).remove();
const heading=(eyebrow,title,body)=>{const d=node('header','page-heading');d.innerHTML='<span class="quiet-label">'+eyebrow+'</span><h2>'+title+'</h2><p>'+body+'</p>';return d;};
libraryPage.append(heading('YOUR SESSION','Track library','Import, find and select any song in your current session.'),drop,library);
comparePage.append(heading('SIDE BY SIDE','Compare tracks','Understand tempo, harmony and mix differences between songs.'));
const compareInputs=node('div','compare-inputs'),first=node('select','compare-select'),second=node('select','compare-select'),compareResult=node('div','compare-result');
first.id='compare-first';second.id='compare-second';
first.setAttribute('aria-label','First track to compare');second.setAttribute('aria-label','Second track to compare');
const label=(text,control)=>{const l=node('label','compare-label',text);l.append(control);return l;};
compareInputs.append(label('FIRST TRACK',first),node('span','compare-between','⇄'),label('SECOND TRACK',second));comparePage.append(compareInputs,compareResult);
settingsPage.append(heading('PREFERENCES','Settings','Manage analysis, appearance and your current browser session.'));
const cards=node('div','settings-cards');settingsPage.append(cards);
const settingsCard=(title,desc)=>{const c=node('section','panel settings-card');c.append(node('h3','',title),node('p','',desc));cards.append(c);return c;};
const depth=settingsCard('Analysis depth','Quick checks sampled sections. Verify checks longer sections and takes more time.');
const selectMode=node('select','settings-mode');selectMode.setAttribute('aria-label','Analysis depth setting');selectMode.innerHTML='<option value="quick">Quick</option><option value="verify">Verify</option>';selectMode.value=mode.value;depth.append(selectMode);
const appearance=settingsCard('Appearance','Switch between dark and light themes.');
const themeButton=node('button','button subtle','Toggle light / dark');themeButton.type='button';appearance.append(themeButton);
settingsCard('Audio privacy','Decoding and analysis happen in this browser. Audio never leaves your device. Manual BPM/key corrections are stored locally.');
const session=settingsCard('Session','Clearing releases imported tracks. Export your analysis first from the Library.');
session.append(clear);
area.append(intro,pages);layout.append(rail,area);main.replaceChildren(layout,mobile);main.classList.add('nav-ready');
const toast=node('div','global-status');toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');area.append(toast);
const messages=q('#message');
new MutationObserver(()=>{toast.textContent=messages.textContent;toast.hidden=!toast.textContent;}).observe(messages,{childList:true,characterData:true,subtree:true});
toast.hidden=true;
function parse(){const bits=decodeURIComponent(location.hash.slice(1)).toLowerCase().split('/');return{page:['analyze','library','compare','settings'].includes(bits[0])?bits[0]:'analyze',detail:tabs.some(x=>x[0]===bits[1])?bits[1]:'overview'};}
let currentPage='analyze';
function sync(){const dest=parse();currentPage=dest.page;
for(const p of pages.children)p.hidden=p.dataset.page!==dest.page;
for(const b of rail.querySelectorAll('[data-route]'))b.setAttribute('aria-current',b.dataset.route===dest.page?'page':'false');
for(const b of subnav.children){const current=b.dataset.detail===dest.detail;b.setAttribute('aria-current',current?'page':'false');b.tabIndex=current?0:-1;}
for(const p of detailPages.children)p.hidden=p.dataset.subpage!==dest.detail;
if(dest.page==='compare')renderCompare();
if(dest.page==='analyze')requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
window.scrollTo(0,0);
}
function go(page,detail){const hash='#'+page+(page==='analyze'&&detail&&detail!=='overview'?'/'+detail:'');if(location.hash!==hash)history.pushState(null,'',hash);sync();}
rail.addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b)go(b.dataset.route);});
subnav.addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b)go('analyze',b.dataset.detail);});
subnav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...subnav.querySelectorAll('button')];let i=buttons.indexOf(document.activeElement);if(i<0)return;i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[i].focus();go('analyze',buttons[i].dataset.detail);e.preventDefault();});
window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);
const statusName=()=>{const all=bridge.list(),id=bridge.selectedId(),current=all.find(t=>t.id===id);
q('#rail-count').textContent=all.length;q('#rail-name').textContent=current?.name||'No track selected';
q('#rail-state').textContent=current?.state||'Add audio to begin';
analyze.classList.toggle('has-track',!!current);
if(currentPage==='compare')renderCompare();};
let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;statusName();});}
new MutationObserver(schedule).observe(q('#tracks'),{childList:true,subtree:true,characterData:true});
new MutationObserver(schedule).observe(q('#song-name'),{childList:true,subtree:true,characterData:true});
library.addEventListener('click',e=>{if(e.target.closest('button.track'))queueMicrotask(()=>{go('analyze');schedule();});});
fileInput.addEventListener('change',()=>queueMicrotask(()=>{go('analyze');schedule();}));
clear.addEventListener('click',()=>{go('analyze');schedule();});
selectMode.addEventListener('change',()=>{if(mode.value!==selectMode.value){mode.value=selectMode.value;mode.dispatchEvent(new Event('change',{bubbles:true}));}});
mode.addEventListener('change',()=>{selectMode.value=mode.value;});
themeButton.addEventListener('click',()=>theme.click());
function show(value,suffix=''){return Number.isFinite(value)?Math.round(value*10)/10+suffix:'—';}
function measure(code,t){const r=t?.result,q=r?.quality||{};if(!r)return '—';switch(code){
case 'tempo':return show(r.tempo?.bpm,' BPM');
case 'key':return r.keys?.[0]?.key||'—';
case 'duration':return Number.isFinite(t.duration)?Math.floor(t.duration/60)+':'+String(Math.floor(t.duration%60)).padStart(2,'0'):'—';
case 'rms':return show(q.rmsDb,' dBFS');
case 'peak':return show(q.samplePeakDb,' dBFS');
case 'crest':return show(q.crestDb,' dB');
case 'stereo':return Number.isFinite(q.stereoCorrelation)?q.stereoCorrelation.toFixed(2):'Mono';
default:return '—';}}
function renderCompare(){const ready=bridge.list().filter(t=>t.state==='ready'&&t.result);
const oldA=first.value,oldB=second.value;
for(const s of [first,second]){s.replaceChildren();for(const t of ready){const o=node('option','',t.name);o.value=String(t.id);s.append(o);}s.disabled=ready.length<2;}
compareInputs.hidden=ready.length<2;compareResult.replaceChildren();
if(ready.length<2){const e=node('div','compare-empty');e.append(node('h3','','Two tracks tell a better story.'),node('p','','Analyze at least two songs, then compare tempo, key and mix levels side by side.'));const btn=node('button','button primary','Open library');btn.type='button';btn.onclick=()=>go('library');e.append(btn);compareResult.append(e);return;}
first.value=ready.some(t=>String(t.id)===oldA)?oldA:String(ready[0].id);
second.value=ready.some(t=>String(t.id)===oldB&&oldB!==first.value)?oldB:String(ready.find(t=>String(t.id)!==first.value).id);
const a=ready.find(t=>String(t.id)===first.value),b=ready.find(t=>String(t.id)===second.value);
const table=node('div','compare-table');
for(const [id,title] of [['header','Metric'],['tempo','Tempo'],['key','Musical key'],['duration','Length'],['rms','RMS level'],['peak','Sample peak'],['crest','Crest factor'],['stereo','Stereo correlation']]){
const row=node('div','compare-row'+(id==='header'?' is-header':''));row.append(node('span','',title),node('strong','',id==='header'?a.name:measure(id,a)),node('strong','',id==='header'?b.name:measure(id,b)));table.append(row);}
compareResult.append(table);
}
first.addEventListener('change',renderCompare);second.addEventListener('change',renderCompare);
window.addEventListener('keydown',e=>{if(!e.altKey||!/^Digit[1-4]$/.test(e.code)||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;go(['analyze','library','compare','settings'][Number(e.code.at(-1))-1]);e.preventDefault();});
sync();statusName();
