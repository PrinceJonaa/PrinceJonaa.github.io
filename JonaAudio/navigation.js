import {createRouter} from './router.js';
import {createSampleView} from './sample-view.js';
import {createTuningView} from './tuning-view.js';
import {createLayouts, WIDGETS} from './layouts.js';
import {createTapTempo,tempoMultiple,summaryText,createMetronome} from './musical-controls.js';
const q=(s,r=document)=>r.querySelector(s);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn,cls='button small')=>{const b=node('button',cls,text);b.type='button';if(fn)b.onclick=fn;return b;};
const main=q('#app'),intro=q('.intro'),drop=q('#drop'),stage=q('.stage'),library=q('.library'),bridge=window.JonaAudioBridge;
const fileInput=q('#files'),clear=q('#clear'),mode=q('#mode'),theme=q('#theme');
const layout=node('div','new-layout'),rail=node('nav','new-rail'),area=node('div','new-area'),pages=node('div','new-pages');
rail.setAttribute('aria-label','App navigation');
rail.innerHTML='<div class="rail-kicker">WORKSPACE</div><div class="rail-links"><button data-route="quick" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg><span>Quick</span></button><button data-route="library" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/></svg><span>Library</span><em id="rail-count">0</em></button><button data-route="studio" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 18V5l9-2v13"/><circle cx="7" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg><span>Studio</span></button><button data-route="settings" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2"/></svg><span>Settings</span></button></div><div class="rail-now"><span>NOW SELECTED</span><strong id="rail-name">No track selected</strong><small id="rail-state">Add audio to begin</small></div><div class="rail-note">Files stay on your device</div>';
intro.classList.add('compact-intro');q('.overline',intro).textContent='LOCAL AUDIO WORKSPACE';q('h1',intro).textContent='JonaAudio';q('p',intro).textContent='Find the key. Catch the tempo. Take the useful part.';clear.remove();
const makePage=(id,label)=>{const p=node('section','nav-page');p.dataset.page=id;p.setAttribute('aria-label',label);pages.append(p);return p;};
const quick=makePage('quick','Quick key and tempo'),libraryPage=makePage('library','Track library'),studio=makePage('studio','Studio tools'),settings=makePage('settings','Settings');
const songHead=q('.song-head'),metrics=q('.metrics'),wave=q('.transport-panel'),transport=q('.transport'),harmonic=q('.harmonic-panel'),spectrum=q('.spectrum-panel'),quality=q('.quality-panel'),corrections=q('.corrections');
const quickWorkspace=node('div','widget-grid'),studioWorkspace=node('div','widget-grid');
const empty=node('section','analyzer-empty');empty.innerHTML='<h3>Start with a track.</h3><p>Choose a song to find its key and tempo.</p><label for="files" class="button primary">Choose audio</label>';
const quickActions=node('div','quick-actions');
quickActions.append(button('Copy key & BPM',copyValues,'button primary'),button('Correct an estimate',()=>router.go('quick?corrections')),button('Share setup',shareValues));
const shortcuts=node('nav','tool-shortcuts');shortcuts.setAttribute('aria-label','Open a studio tool');
for(const [id,label] of [['tune','Tune'],['sample','Sample'],['engineer','Engineer']])shortcuts.append(button(label,()=>router.go('studio/'+id)));
const controls=node('section','panel quick-controls');controls.append(node('h3','','Tempo & analysis'));
const progress=node('p','muted');progress.setAttribute('role','status');const rangeText=node('p','muted'),quickCandidates=node('div','candidates');quickCandidates.setAttribute('aria-label','Choose an alternate reading');
const tap=createTapTempo(),tapButton=button('Tap tempo',()=>{const result=tap.tap(performance.now());tapButton.textContent=result.message+' ('+result.taps+' taps)';if(result.bpm){const saved=bridge.setOverride('bpm',result.bpm,'tap');if(saved?.saved===false)status('Tapped BPM is available in this tab but could not be saved.');}});
const half=button('½ tempo',()=>bridge.setOverride('bpm',tempoMultiple(bridge.currentValues().bpm,.5),'candidate-choice')),double=button('2× tempo',()=>bridge.setOverride('bpm',tempoMultiple(bridge.currentValues().bpm,2),'candidate-choice'));
const metroButton=button('Start metronome',async()=>{if(metronome.running)metronome.stop();else if(!await metronome.start({bpm:bridge.currentValues().bpm,phaseMs:Number(phase.value),count:Number(count.value)}))status('Metronome could not start. Tap again or choose a BPM.');});
const phase=node('input','');phase.type='number';phase.min='-1000';phase.max='1000';phase.step='10';phase.value='0';phase.setAttribute('aria-label','Metronome phase offset in milliseconds');
const count=node('input','');count.type='number';count.min='1';count.max='12';count.step='1';count.value='4';count.setAttribute('aria-label','Metronome beats per count');
const metronome=createMetronome({onState:running=>{metroButton.textContent=running?'Stop metronome ('+bridge.currentValues().bpm+' BPM)':'Start metronome';phase.disabled=running;count.disabled=running;}});bridge.transport.registerCompanion(metronome.stop);
for(const field of [phase,count])field.onchange=()=>metronome.stop();
document.addEventListener('visibilitychange',()=>{if(document.hidden)metronome.stop();});
const musicalActions=node('div','quick-actions');musicalActions.append(tapButton,button('Reset taps',()=>{tap.reset();tapButton.textContent='Tap tempo';}),half,double,metroButton);
const metroFields=node('div','scope-fields');metroFields.append(labelControl('Phase offset (ms)',phase),labelControl('Beats per count',count));
const start=node('input',''),end=node('input','');for(const input of [start,end]){input.type='number';input.min='0';input.step='.001';}start.value='0';start.setAttribute('aria-label','Analysis start seconds');end.setAttribute('aria-label','Analysis end seconds');
const regionFields=node('div','scope-fields');regionFields.append(labelControl('Start seconds',start),labelControl('End seconds',end));
const scopeActions=node('div','quick-actions');scopeActions.append(button('Analyze this part',()=>{if(!bridge.setScope(Number(start.value),Number(end.value)))return status('Choose a start and end within this source.');bridge.requestAnalysis(['tempo','key']);}),button('Whole track',()=>bridge.setScope(null)));
const analysisActions=node('div','quick-actions');analysisActions.append(button('Quick analysis',()=>bridge.requestAnalysis(['tempo','key','waveform'],{mode:'quick',force:true})),button('Deep analysis',()=>bridge.requestAnalysis(['tempo','key'],{mode:'verify',force:true})),button('Export tempo MIDI for Logic',()=>bridge.downloadTempoMidi()),button('Cancel analysis',()=>bridge.cancel(bridge.selectedId())));
controls.append(progress,rangeText,quickCandidates,musicalActions,metroFields,node('p','muted','Metronome phase is adjustable; an estimated beat does not establish a downbeat.'),regionFields,scopeActions,analysisActions);
quick.append(empty,quickActions,quickWorkspace,controls,shortcuts);
function labelControl(text,control){const l=node('label','compare-label',text);l.append(control);return l;}

const toolnav=node('nav','subnav');toolnav.setAttribute('aria-label','Studio tool');
for(const [id,label] of [['tune','Tune'],['sample','Sample'],['engineer','Engineer'],['compare','Compare']]){const b=button(label,()=>router.go('studio/'+id),'subnav-button');b.dataset.tool=id;toolnav.append(b);}
const toolIntro=node('p','muted tool-intro'),toolActions=node('div','quick-actions');studio.append(toolnav,toolIntro,toolActions,studioWorkspace);
const heading=(title,body)=>{const h=node('header','page-heading');h.append(node('h2','',title),node('p','',body));return h;};
libraryPage.append(heading('Track library','Find, select or add a song.'),drop,library);
const compare=node('section','panel compare-widget');compare.append(node('h3','','Compare tracks'));
const first=node('select','compare-select'),second=node('select','compare-select');first.setAttribute('aria-label','First track');second.setAttribute('aria-label','Second track');
const compareInputs=node('div','compare-inputs'),compareResult=node('div','compare-result'),compareActions=node('div','quick-actions'),compareNote=node('p','muted');let compareMatch=false;
const label=(text,control)=>{const l=node('label','compare-label',text);l.append(control);return l;};
compareInputs.append(label('FIRST TRACK',first),node('span','compare-between','⇄'),label('SECOND TRACK',second));
const matchToggle=node('input','');matchToggle.type='checkbox';matchToggle.setAttribute('aria-label','Enable attenuation-only RMS match');
matchToggle.onchange=()=>{compareMatch=matchToggle.checked;bridge.setCompareAttenuation(1);renderCompare();};
const listenA=button('▶ Listen A',()=>listenCompare(first.value)),listenB=button('▶ Listen B',()=>listenCompare(second.value));
compareActions.append(listenA,listenB,button('Measure both levels',()=>{for(const id of [first.value,second.value])bridge.requestFor(id,['levels']);status('Requested levels for A and B.');}),label('Match quieter source (playback only)',matchToggle));
compareNote.textContent='A/B keeps each source position. Match only attenuates the louder source; no file, export or analysis data changes.';
compare.append(compareInputs,compareActions,compareNote,compareResult);
async function listenCompare(id){
 const list=bridge.list(),a=list.find(t=>String(t.id)===first.value),b=list.find(t=>String(t.id)===second.value),chosen=list.find(t=>String(t.id)===id);
 if(!chosen)return;
 const qa=a?.result?.quality,qb=b?.result?.quality,measured=qa&&qb&&[qa.stereoEnergyRmsDb,qb.stereoEnergyRmsDb].every(Number.isFinite);
 if(compareMatch&&!measured){status('Analyze levels on both tracks before matching.');return;}
 const target=Math.min(qa?.stereoEnergyRmsDb??0,qb?.stereoEnergyRmsDb??0);
 const gain=compareMatch?Math.min(1,Math.pow(10,(target-chosen.result.quality.stereoEnergyRmsDb)/20)):1;
 const ok=await bridge.auditionCompare(chosen.id,gain);
 status(ok?'Auditioning '+(id===first.value?'A':'B')+(compareMatch?' · attenuation '+(20*Math.log10(gain)).toFixed(1)+' dB':' · original playback level'):'Unable to start A/B audio. Try again.');
}
const sampleView=createSampleView({bridge,status});studio.insertBefore(sampleView.element,studioWorkspace);
const tuningView=createTuningView({bridge,openSheet,status}),tuning=tuningView.element;
const stereo=node('section','panel');stereo.append(node('h3','','Stereo'));const stereoText=node('p','muted');stereo.append(stereoText);
const widgets={tempo:q('.metric.bpm'),key:q('.metric.key'),waveform:wave,'tuning-notes':tuning,candidates:harmonic,levels:quality,stereo,spectrum,'compare-summary':compare};
for(const [id,widget] of Object.entries(widgets))widget.dataset.widget=id;
const trackBar=node('section','source-bar'),trackSelect=node('select','source-select');trackSelect.setAttribute('aria-label','Selected audio source');trackBar.append(songHead,label('TRACK',trackSelect));
trackSelect.onchange=()=>bridge.choose(trackSelect.value);
const dock=node('section','player-dock');dock.setAttribute('aria-label','Persistent audio player');
const playerTitle=node('button','text-button','No track selected');playerTitle.type='button';playerTitle.onclick=()=>router.go('studio/sample');dock.append(playerTitle,transport);
const stopReference=button('Stop notes',()=>bridge.transport.stopCompanions());stopReference.hidden=true;dock.append(stopReference);let referenceToneLabel=null;
function refreshPlayerTitle(){playerTitle.textContent=referenceToneLabel||(bridge.transport.owner?(bridge.transport.isLoop?'Loop · ':'')+bridge.transport.owner.name:'No track selected');}
const toast=node('div','global-status');toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.hidden=true;
settings.append(heading('Settings','Appearance, workspace layouts and browser session.'));
const cards=node('div','settings-cards');settings.append(cards);
function card(title,body){const c=node('section','panel settings-card');c.append(node('h3','',title),node('p','',body));cards.append(c);return c;}
const layoutCard=card('Workspace layout','Choose a preset or save your own. Layout changes preserve your song and edits.');
const presetSelect=node('select','settings-mode');presetSelect.setAttribute('aria-label','Workspace preset');layoutCard.append(presetSelect,button('Edit workspace',openLayout));
const depth=card('Analysis default','Applies to new requests. Quick runs bounded tempo/key windows; Deep uses longer windows. Hidden level and spectrum tools stay idle.');
const depthSelect=node('select','settings-mode');depthSelect.setAttribute('aria-label','Default analysis depth');depthSelect.innerHTML='<option value="quick">Quick</option><option value="verify">Deep analysis</option>';depthSelect.value=mode.value;depth.append(depthSelect,button('Reanalyze all tracks',()=>bridge.requestAll()));
const diagnosticCard=card('Local diagnostics','Configured budgets and job traces; no raw audio or filenames. Native/browser memory overhead is unknown.');diagnosticCard.append(button('View diagnostics',()=>{const text=node('pre','diagnostic-text',JSON.stringify(bridge.diagnostics(),null,2));openSheet('Local analysis diagnostics',text);}));
const appearance=card('Appearance','Choose a light or dark workspace.');appearance.append(button('Toggle light / dark',()=>theme.click()));
const recoveryCard=card('Session recovery','IndexedDB stores decisions and source metadata, not audio. After reload, relink your original files in Library. Export JSON as a portable backup.');recoveryCard.append(button('Export session JSON',()=>void bridge.exportSession()),button('Import session JSON',()=>bridge.pickSession()),button('Export analysis JSON',()=>bridge.exportJson()));
 card('Privacy','Audio decoding and analysis happen locally. Source audio is never uploaded or stored by session recovery. Manual corrections and layouts remain in browser storage.');
card('Clear session','Export your results in Library first. Saved layouts and manual corrections remain available.').append(clear);
area.append(intro,trackBar,pages,toast);layout.append(rail,area);main.replaceChildren(layout);main.classList.add('nav-ready');q('.app-shell').append(dock);stage.remove();metrics.remove();
mode.querySelector('[value=verify]').textContent='Deep analysis · longer sections';
const dialog=node('dialog','workspace-sheet');dialog.setAttribute('aria-labelledby','sheet-title');const sheetTitle=node('h2','','');sheetTitle.id='sheet-title';const close=button('Close',closeSheet,'button small subtle');const sheetBody=node('div','sheet-body');dialog.append(sheetTitle,close,sheetBody);document.body.append(dialog);
let sheetReturn=null,sheetRouteOwned=false,lastAudioRoute='quick',scrolls=new Map(),draft=null,previousFocus=null;
const layouts=createLayouts(()=>{refreshPresetOptions();applyWidgets();});
const router=createRouter(renderRoute);
function openSheet(title,body,{historyEntry=true}={}){
  if(dialog.open){dialog.close();}
  previousFocus=document.activeElement;sheetTitle.textContent=title;sheetBody.replaceChildren(body);sheetReturn=router.current.hash;
  sheetRouteOwned=historyEntry;
  if(historyEntry)history.pushState({jonaSheet:true},'',location.hash);
  dialog.showModal();close.focus();
}
function dismissSheet(){if(dialog.open)dialog.close();draft=null;previousFocus?.focus?.();}
function closeSheet(){if(!dialog.open)return;if(sheetRouteOwned){history.back();}else if(router.current.sheet){router.go(router.current.hash.slice(1).split('?')[0],{replace:true});}else dismissSheet();}
dialog.addEventListener('cancel',e=>{e.preventDefault();closeSheet();});
dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const nodes=[...dialog.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(e=>!e.disabled&&!e.hidden);const a=nodes[0],b=nodes.at(-1);if(e.shiftKey&&document.activeElement===a){b.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===b){a.focus();e.preventDefault();}});
function renderRoute(dest,previous){
  if(previous&&previous.hash!==dest.hash)tuningView.stop();
  if(dialog.open && (previous?.hash!==dest.hash||!history.state?.jonaSheet))dismissSheet();
  if(previous&&previous.hash!==dest.hash)scrolls.set(previous.hash,window.scrollY);
  if(dest.page==='quick'||dest.page==='studio')lastAudioRoute=dest.page==='quick'?'quick':'studio/'+dest.tool;
  for(const p of pages.children)p.hidden=p.dataset.page!==dest.page;
  trackBar.hidden=!['quick','studio'].includes(dest.page);
  for(const b of rail.querySelectorAll('[data-route]'))b.setAttribute('aria-current',b.dataset.route===dest.page?'page':'false');
  for(const b of toolnav.children)b.setAttribute('aria-current',b.dataset.tool===dest.tool?'page':'false');
  const descriptions={tune:'Choose your backing reference, edit allowed notes, audition a scale and copy the tuning setup.',sample:'Choose a region, audition the loop and prepare original-source WAV.',engineer:'Inspect the existing level and spectrum measurements.',compare:'Compare effective key, tempo and available measurements.'};
  sampleView.element.hidden=dest.page!=='studio'||dest.tool!=='sample';
  toolIntro.textContent=descriptions[dest.tool]||'';if(previous?.tool==='compare'&&dest.tool!=='compare')bridge.setCompareAttenuation(1);
  toolActions.replaceChildren();if(dest.tool==='engineer'){toolActions.append(button('Analyze levels',()=>bridge.requestAnalysis(['levels'])),button('Analyze spectrum',()=>bridge.requestAnalysis(['spectrum'])),button('Cancel analysis',()=>bridge.cancel(bridge.selectedId())));}
  applyWidgets();refresh();
  requestAnimationFrame(()=>{bridge.redraw();if(previous?.hash!==dest.hash)window.scrollTo(0,scrolls.get(dest.hash)||0);});
  if(dest.sheet==='corrections')openSheet('Correct an estimate',corrections,{historyEntry:false});
}
function applyWidgets(){
  const layout=layouts.current(),dest=router.current;if(!dest)return;
  main.dataset.density=layout.density;
  const required=dest.page==='quick'?['tempo','key','waveform']:({tune:['tuning-notes'],sample:['waveform'],engineer:['levels'],compare:['compare-summary']}[dest.tool]||[]);
  const host=dest.page==='quick'?quickWorkspace:studioWorkspace;
  const pinned=dest.page==='quick'?['tempo','key']:required;
  const ordered=[...pinned.map(id=>layout.widgets.find(w=>w.id===id)),...layout.widgets.filter(w=>!pinned.includes(w.id))];
  for(const w of ordered){
    const element=widgets[w.id];host.append(element);element.style.gridColumn='span '+w.span;
    element.hidden=!required.includes(w.id)&&!w.visible;
    if(dest.page==='quick'&&['levels','spectrum','compare-summary','stereo'].includes(w.id))element.hidden=true;
  }
  // Direct evidence links always open the relevant existing surface.
  if(dest.sheet==='evidence')widgets.candidates.hidden=false;
  if(dest.sheet==='spectrum')widgets.spectrum.hidden=false;
  if(dest.sheet==='levels')widgets.levels.hidden=false;
  if(dest.tool==='sample')widgets.waveform.hidden=true;
  if(dest.tool==='compare'){for(const [id,w] of Object.entries(widgets))w.hidden=id!=='compare-summary';}
  quickActions.hidden=!bridge.selectedId();shortcuts.hidden=!bridge.selectedId();
  bridge.redraw();
}
function refreshPresetOptions(){presetSelect.replaceChildren();for(const {id,name} of layouts.options()){const o=node('option','',name);o.value=id;presetSelect.append(o);}presetSelect.value=layouts.active;}
function refresh(){
  const all=bridge.list(),current=all.find(t=>t.id===bridge.selectedId());
  q('#rail-count').textContent=all.length;q('#rail-name').textContent=current?.name||'No track selected';q('#rail-state').textContent=current?.state||'Add audio to begin';
  refreshPlayerTitle();dock.classList.toggle('is-empty',!current);
  empty.hidden=!!current;quickWorkspace.hidden=!current;quickActions.hidden=!current;shortcuts.hidden=!current;controls.hidden=!current;toolActions.hidden=!current;refreshMusical(current);
  intro.classList.toggle('has-track',!!current);
  const old=trackSelect.value;trackSelect.replaceChildren();if(!all.length)trackSelect.append(node('option','','No track selected'));
  for(const t of all){const o=node('option','',t.name);o.value=String(t.id);trackSelect.append(o);}trackSelect.value=String(current?.id||old);trackSelect.disabled=!all.length;
  tuningView.refresh();sampleView.refresh();
  const qualityInfo=current?.scopeResult?.quality||current?.result?.quality;
 stereoText.textContent=qualityInfo?'Channel-energy RMS: '+(Number.isFinite(qualityInfo.stereoEnergyRmsDb)?qualityInfo.stereoEnergyRmsDb.toFixed(1)+' dBFS':'−∞ dBFS')+
 ' · Mono-sum RMS: '+(Number.isFinite(qualityInfo.monoSumRmsDb)?qualityInfo.monoSumRmsDb.toFixed(1)+' dBFS':'−∞ dBFS')+
 ' · L/R: '+(Number.isFinite(qualityInfo.leftRmsDb)?qualityInfo.leftRmsDb.toFixed(1):'−∞')+' / '+(qualityInfo.channels===1?'mono':Number.isFinite(qualityInfo.rightRmsDb)?qualityInfo.rightRmsDb.toFixed(1):'−∞')+' dBFS'+
 ' · Correlation: '+(Number.isFinite(qualityInfo.stereoCorrelation)?qualityInfo.stereoCorrelation.toFixed(2):qualityInfo.stereoCorrelationReason||'undefined')+
 ' · Scope: '+(current?.analysisScopeId?'selected region':'whole track')+
 ' · LUFS/true peak unavailable (not measured).':'Analyze levels for measured channel energy and stereo correlation.';
  renderCompare();
}
function renderCompare(){
  const ready=bridge.list().filter(t=>t.result);const oldA=first.value,oldB=second.value;
  for(const s of [first,second]){s.replaceChildren();for(const t of ready){const o=node('option','',t.name);o.value=String(t.id);s.append(o);}s.disabled=ready.length<2;}
  compareInputs.hidden=ready.length<2;compareActions.hidden=ready.length<2;compareNote.hidden=ready.length<2;compareResult.replaceChildren();
  if(ready.length<2){compareResult.append(node('p','muted','Add and analyze a reference track to compare.'),button('Add reference track',()=>fileInput.click()));return;}
  first.value=ready.some(t=>String(t.id)===oldA)?oldA:String(ready[0].id);
  second.value=ready.some(t=>String(t.id)===oldB&&oldB!==first.value)?oldB:String(ready.find(t=>String(t.id)!==first.value).id);
  const a=ready.find(t=>String(t.id)===first.value),b=ready.find(t=>String(t.id)===second.value),table=node('div','compare-table');
 const measured=[a.result.quality?.stereoEnergyRmsDb,b.result.quality?.stereoEnergyRmsDb].every(Number.isFinite);listenA.disabled=!a.sourceAvailable;listenB.disabled=!b.sourceAvailable;
 matchToggle.disabled=!measured;matchToggle.checked=compareMatch&&measured;if(!measured){compareMatch=false;compareNote.textContent='RMS matching unavailable: analyze levels on both tracks first. A/B listening remains available.';}else compareNote.textContent='A/B uses each source’s last position. Matching attenuates only the louder playback, never boosts or changes original audio.';
  const measure=(id,t)=>{const v=t.effective,quality=t.result.quality||{};if(id==='tempo')return (v.bpm??'—')+' BPM · '+v.bpmSource;if(id==='key')return (v.key??'—')+' · '+v.keySource;if(id==='duration')return format(t.duration);const n=quality[id];return Number.isFinite(n)?n.toFixed(id==='stereoCorrelation'?2:1)+(id==='stereoCorrelation'?'':' dB'):(id==='stereoCorrelation'&&quality.stereoCorrelationReason||'—');};
  for(const [id,title] of [['header','Metric'],['tempo','Tempo'],['key','Key'],['duration','Length'],['stereoEnergyRmsDb','Channel-energy RMS dBFS'],['rmsDb','Mono-sum RMS dBFS'],['samplePeakDb','Sample peak dBFS'],['crestDb','Crest vs channel energy'],['stereoCorrelation','Stereo correlation']]){const row=node('div','compare-row'+(id==='header'?' is-header':''));row.append(node('span','',title),node('strong','',id==='header'?a.name:measure(id,a)),node('strong','',id==='header'?b.name:measure(id,b)));table.append(row);}compareResult.append(table);
}
function format(seconds){return Number.isFinite(seconds)?Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0'):'—';}
async function copyValues(){const t=bridge.list().find(t=>t.id===bridge.selectedId());if(!t)return;const text=summaryText(t,bridge.currentValues());try {await navigator.clipboard.writeText(text);status('Copied key and BPM.');}catch {const field=node('textarea','copy-fallback');field.value=text;field.readOnly=true;field.setAttribute('aria-label','Select and copy key and BPM');openSheet('Copy key & BPM',field);field.focus();field.select();}}
async function shareValues(){const t=bridge.list().find(t=>t.id===bridge.selectedId());if(!t)return;const text=summaryText(t,bridge.currentValues());if(!navigator.share)return copyValues();try{await navigator.share({title:'JonaAudio setup',text});}catch(error){if(error.name!=='AbortError')await copyValues();}}
let lastMusicalTrack=null;
function refreshMusical(current){
 if(!current)return;const values=bridge.currentValues(),prefix=(current.analysisScopeId||'track')+':',analysis=current.analysis||{},tempo=analysis[prefix+'tempo'],key=analysis[prefix+'key'];
 if(lastMusicalTrack!==current.id){tap.reset();tapButton.textContent='Tap tempo';lastMusicalTrack=current.id;start.value=current.scopeRange?.start||0;end.value=current.scopeRange?.end||current.duration||'';}
 if(!end.value&&current.duration)end.value=current.duration;
 const wording=(entry)=>!entry?'not requested':entry.status==='ready'?'ready':entry.status==='unavailable'?entry.reason:entry.phase||entry.status;
 progress.textContent='Tempo: '+wording(tempo)+' · Key: '+wording(key);
 const ranges=[...(tempo?.ranges||[]),...(key?.ranges||[])],unique=[...new Map(ranges.map(r=>[r.start+':'+r.end,r])).values()];
 rangeText.textContent='Scope: '+values.scope+(unique.length?' · Sampled '+unique.map(r=>r.start.toFixed(1)+'–'+r.end.toFixed(1)+' s').join(', '):' · Ranges appear as analysis completes');
 quickCandidates.replaceChildren();const result=current.scopeResult;
 const beat=result?.tempo?.beatRootEvidence;
 const beatCandidates=beat?.status==='review'?[
  {field:'bpm',value:beat.primaryCandidate,text:beat.primaryCandidate+' BPM · BeatRoot candidate (unverified)'},
  ...(beat.candidates[0]?.halfTime?[{field:'bpm',value:beat.candidates[0].halfTime,text:beat.candidates[0].halfTime+' BPM · ½-time BeatRoot feel'}]:[]),
  ...(beat.candidates[0]?.doubleTime?[{field:'bpm',value:beat.candidates[0].doubleTime,text:beat.candidates[0].doubleTime+' BPM · 2× BeatRoot feel'}]:[])
 ]:[];
 const measured=(result?.tempo?.alternatives||[]).slice(0,3).map(x=>({field:'bpm',value:x.bpm,text:x.bpm+' BPM · original estimate'}));
 const reviewPulse=result?.tempo?.tempoHypotheses;
 const direct=(reviewPulse?.direct||[]).filter(x=>x.source!=='original-estimate').slice(0,4)
  .map(x=>({field:'bpm',value:x.bpm,text:x.bpm+' BPM · extra pulse'}));
 const metrical=(reviewPulse?.metricalAlternatives||[]).slice(0,5)
  .map(x=>({field:'bpm',value:x.bpm,text:x.bpm+' BPM · '+x.relationship}));
 const candidateKeys=(result?.keys||[]).slice(0,4).map(x=>({field:'key',value:x.key,text:x.key+' · estimated key'}));
 const choices=[...beatCandidates,...measured,...direct,...metrical,...candidateKeys].filter((value,index,array)=>
  index===array.findIndex(other=>other.field===value.field&&Math.abs(value.field==='bpm'?other.value-value.value:0)<.75&&
   (value.field==='bpm'||other.value===value.value)));
 for(const c of choices)quickCandidates.append(button(c.text,()=>bridge.setOverride(c.field,c.value,'candidate-choice'),'candidate'));
 for(const [b,f] of [[half,.5],[double,2]]){const value=tempoMultiple(values.bpm,f);b.disabled=value==null;b.title=value==null?'Choose a tempo; the result must stay between 25 and 400 BPM.':'Use '+value+' BPM';b.textContent=(f===.5?'½':'2×')+' tempo'+(value==null?'':' · '+value);}
 metroButton.disabled=!Number.isFinite(values.bpm);phase.disabled=metronome.running;count.disabled=metronome.running;
}
function status(text){toast.textContent=text;toast.hidden=!text;}
function openLayout(){
  draft=layouts.current();const content=node('div','layout-editor');
  const name=node('input','');name.value=draft.name;name.maxLength=60;name.setAttribute('aria-label','Layout name');name.oninput=()=>draft.name=name.value;
  const density=node('select','settings-mode');density.setAttribute('aria-label','Layout density');density.innerHTML='<option value="comfortable">Comfortable</option><option value="compact">Compact</option>';density.value=draft.density;density.onchange=()=>draft.density=density.value;
  const rows=node('div','layout-rows');content.append(label('LAYOUT NAME',name),label('DENSITY',density),node('p','muted','Quick key/BPM and the current tool remain reachable. Playback and navigation are always available.'),rows);
  const renderRows=()=>{rows.replaceChildren();draft.widgets.forEach((w,i)=>{const row=node('div','layout-row');const visible=node('input','');visible.type='checkbox';visible.checked=w.visible;visible.setAttribute('aria-label','Show '+WIDGETS[w.id]);visible.onchange=()=>w.visible=visible.checked;const size=node('select','');size.setAttribute('aria-label',WIDGETS[w.id]+' desktop width');size.innerHTML='<option value="1">1 column</option><option value="2">2 columns</option>';size.value=w.span;size.onchange=()=>w.span=Number(size.value);const up=button('Up',()=>{[draft.widgets[i-1],draft.widgets[i]]=[draft.widgets[i],draft.widgets[i-1]];renderRows();rows.children[i-1].querySelector('button').focus();});up.disabled=i===0;up.setAttribute('aria-label','Move '+WIDGETS[w.id]+' up');const down=button('Down',()=>{[draft.widgets[i+1],draft.widgets[i]]=[draft.widgets[i],draft.widgets[i+1]];renderRows();rows.children[i+1].querySelectorAll('button')[1].focus();});down.disabled=i===draft.widgets.length-1;down.setAttribute('aria-label','Move '+WIDGETS[w.id]+' down');row.append(label(WIDGETS[w.id],visible),size,up,down);rows.append(row);});};renderRows();
  const actions=node('div','sheet-actions');
  const save=asNew=>{const saved=layouts.save(draft,{asNew});status(saved?'Workspace saved.':'Workspace changed in this tab; browser storage is unavailable.');closeSheet();};
  actions.append(button('Save',()=>save(false),'button primary'),button('Save as new',()=>save(true)),button('Cancel',closeSheet),button('Reset preset',()=>{const saved=layouts.reset();status(saved?'Layout reset.':'Layout reset in this tab; browser storage is unavailable.');closeSheet();}));content.append(actions);openSheet('Edit workspace',content);
}
rail.onclick=e=>{const b=e.target.closest('[data-route]');if(b)router.go(b.dataset.route);};
presetSelect.onchange=()=>{const saved=layouts.select(presetSelect.value);if(!saved)status('Layout is available in this tab but could not be saved.');};
depthSelect.onchange=()=>{mode.value=depthSelect.value;mode.dispatchEvent(new Event('change',{bubbles:true}));};mode.addEventListener('change',()=>depthSelect.value=mode.value);
first.onchange=()=>{bridge.setCompareAttenuation(1);renderCompare();};second.onchange=()=>{bridge.setCompareAttenuation(1);renderCompare();};
bridge.subscribe(()=>refresh());window.addEventListener('jona:status',e=>status(e.detail));
window.addEventListener('jona:playback',refreshPlayerTitle);
window.addEventListener('jona:reference-tone',e=>{referenceToneLabel=e.detail.label;stopReference.hidden=!e.detail.running;refreshPlayerTitle();dock.classList.toggle('has-reference-tone',e.detail.running);});
library.addEventListener('click',e=>{if(e.target.closest('button.track'))router.go(lastAudioRoute);});fileInput.addEventListener('change',()=>router.go('quick'));clear.addEventListener('click',()=>router.go('quick'));
window.addEventListener('keydown',e=>{if(!e.altKey||!/^Digit[1-4]$/.test(e.code)||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))return;router.go(['quick','library','studio','settings'][Number(e.code.at(-1))-1]);e.preventDefault();});
function measureDock(){document.documentElement.style.setProperty('--nav-height',rail.getBoundingClientRect().height+'px');document.documentElement.style.setProperty('--player-height',dock.getBoundingClientRect().height+'px');}
new ResizeObserver(measureDock).observe(dock);new ResizeObserver(measureDock).observe(rail);
refreshPresetOptions();router.sync();measureDock();
