import {state,selectedTrack,dispatch,subscribe} from './store.js';
import {resolveTuning,editTuning} from './tuning-state.js';
import {FLATS,SHARPS,noteName,scientificNoteName,referenceFrequency,scaleMidis,setupFromKey,tuningTitle} from './tuning-model.js';
import {createReferenceTones} from './reference-tones.js';
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const label=(text,control)=>{const l=node('label','compare-label',text);l.append(control);return l;};
const select=(name,options)=>{const s=node('select','');s.setAttribute('aria-label',name);for(const [value,text] of options){const o=node('option','',text);o.value=value;s.append(o);}return s;};
const button=(text,fn,cls='button small')=>{const b=node('button',cls,text);b.type='button';b.onclick=fn;return b;};
export function createTuningView({bridge,openSheet,status}){
 const element=node('section','panel tuning-workspace');element.append(node('h3','','Tuning setup'));
 const provenance=node('p','tuning-provenance');provenance.setAttribute('role','status');
 const targetScope=select('Tuning target scope',[]),reference=select('Harmonic reference',[]);
 const root=select('Tuning tonic',[['','Choose tonic'],...FLATS.map((name,i)=>[String(i),name])]);
 const mode=select('Tuning scale',[['major','Major'],['natural-minor','Natural minor'],['custom','Custom notes']]);
 const spelling=select('Note spelling',[['musical','Scale spelling'],['sharps','Sharps'],['flats','Flats']]);
 const hz=node('input','');hz.type='number';hz.min='20';hz.max='20000';hz.step='.01';hz.value='440';hz.setAttribute('aria-label','Reference A frequency in Hz');
 const octave=select('Reference keyboard octave',[['3','Octave 3'],['4','Octave 4'],['5','Octave 5']]);octave.value='4';
 const context=node('div','tuning-form');context.append(label('SETUP FOR',targetScope),label('HARMONIC REFERENCE',reference));
 const fields=node('div','tuning-form');fields.append(label('TONIC',root),label('SCALE',mode),label('NOTE SPELLING',spelling),label('REFERENCE A (Hz)',hz));
 const explanation=node('p','muted'),history=node('p','muted');
 const referenceActions=node('div','quick-actions');referenceActions.append(button('Use reference key',()=>edit({type:'use-reference'})),button('Analyze reference key',()=>{const r=current();if(!r.referenceTrack)return status('Choose an audio reference first.');bridge.requestFor(r.referenceTrack.id,['key'],{scopeId:r.reference?.scopeId||null});}),button('Assume A=440',()=>edit({type:'assume-440'})));
 const allowed=node('div','note-mask');allowed.setAttribute('role','group');allowed.setAttribute('aria-label','Allowed notes');const noteControls=[];
 const keyboard=node('div','reference-keyboard');keyboard.setAttribute('role','group');keyboard.setAttribute('aria-label','Audition reference notes');const noteKeys=[];
 for(let pc=0;pc<12;pc++){
  const cell=node('label','note-toggle'),check=node('input','');check.type='checkbox';check.dataset.pitchClass=pc;check.onchange=()=>edit({type:'note',pc,allowed:check.checked});const text=node('span','');cell.append(check,text);allowed.append(cell);noteControls.push({check,text,cell});
  const key=button('',()=>playMidis([(Number(octave.value)+1)*12+pc]),'reference-key');key.dataset.pitchClass=pc;key.dataset.accidental=[1,3,6,8,10].includes(pc);keyboard.append(key);noteKeys.push(key);
 }
 const alternatives=node('div','tuning-alternatives');alternatives.setAttribute('aria-label','Alternative reference keys');
 const audition=node('div','quick-actions'),playScale=button('Audition note set',()=>playMidis(scaleMidis(current().setup,Number(octave.value)))),stopNotes=button('Stop notes',()=>tones.stop());
 const playSource=button('Audition reference source',async()=>{const r=current();tones.stop();if(!r.referenceTrack)return;const ok=await bridge.auditionReference(r.referenceTrack.id,r.reference?.scopeId||null);if(!ok)status('Reference playback paused — tap the player to resume.');});
 const playTarget=button('Audition this source',async()=>{const t=selectedTrack();if(t)await bridge.auditionReference(t.id,t.analysisScopeId||null);});
 audition.append(playScale,stopNotes,playSource,playTarget);const toneStatus=node('p','muted');toneStatus.setAttribute('role','status');
 const summary=node('p','tuning-summary');const copy=button('Copy tuning setup',()=>copySetup(),'button primary'),share=button('Share tuning setup',()=>shareSetup());const copyActions=node('div','quick-actions');copyActions.append(copy,share);
 element.append(provenance,summary,copyActions,context,fields,explanation,history,referenceActions,node('h4','','Allowed notes'),allowed,alternatives,label('REFERENCE KEYBOARD',octave),keyboard,audition,toneStatus,node('p','muted','Use a beat or chosen backing reference for harmonic context. A solo vocal does not establish the accompaniment key. These notes prepare your tuning setup; no pitch correction, vocal analysis or plug-in preset is applied.'));
 let optionSignature='',candidateSignature='',contextKey='';
 const tones=createReferenceTones({onState:(running,midi)=>{stopNotes.disabled=!running;for(let pc=0;pc<12;pc++)noteKeys[pc].classList.toggle('sounding',running&&midi!=null&&midi%12===pc);const r=current();toneStatus.textContent=running?(midi==null?'Playing the chosen reference note set.':'Playing '+scientificNoteName(midi%12,Math.floor(midi/12)-1,r.setup)+' at '+referenceFrequency(midi,r.setup.referenceHz).toFixed(2)+' Hz'):'Reference tones stopped.';window.dispatchEvent(new CustomEvent('jona:reference-tone',{detail:{running,label:running?'Reference notes · A='+r.setup.referenceHz+' Hz':null}}));}});
 bridge.transport.registerCompanion(tones.stop);
 function current(){const track=selectedTrack();return resolveTuning(track,track?.analysisScopeId||null);}
 function edit(change){bridge.transport.stopCompanions();const track=selectedTrack(),result=editTuning(track,track?.analysisScopeId||null,change);if(result.error){status(result.error);refresh();}}
 async function playMidis(midis,setup=current().setup){bridge.transport.pause();if(!await tones.play(midis,setup.referenceHz))status('Reference notes could not play. Try again or choose a lower frequency/octave.');}
 async function copySetup(){const r=current();if(!r.available)return status('Choose a scale or at least one allowed note first.');try{await navigator.clipboard.writeText(r.summary);status('Copied tuning setup.');}catch{const field=node('textarea','copy-fallback');field.value=r.summary;field.readOnly=true;field.setAttribute('aria-label','Select and copy tuning setup');openSheet('Copy tuning setup',field);field.focus();field.select();}}
 async function shareSetup(){const r=current();if(!r.available)return;if(!navigator.share)return copySetup();try{await navigator.share({title:'JonaAudio tuning setup',text:r.summary});}catch(error){if(error.name!=='AbortError')await copySetup();}}
 root.onchange=()=>{if(root.value===''){status('Choose a tonic.');refresh();}else edit({type:'root',tonic:Number(root.value)});};mode.onchange=()=>mode.value==='custom'?edit({type:'custom'}):edit({type:'scale',mode:mode.value});spelling.onchange=()=>edit({type:'spelling',value:spelling.value});hz.onchange=()=>edit({type:'reference-hz',value:Number(hz.value)});octave.onchange=()=>tones.stop();
 targetScope.onchange=()=>{bridge.transport.stopCompanions();const track=selectedTrack();if(track)dispatch({type:'selectScope',trackId:track.id,regionId:targetScope.value||null});};
 reference.onchange=()=>{if(reference.value==='local')return edit({type:'local'});const ref=JSON.parse(reference.value);edit({type:'reference',trackId:ref.trackId,scopeId:ref.scopeId});};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)tones.stop();});
 function refresh(){
  const track=selectedTrack(),scopeId=track?.analysisScopeId||null,r=current(),setup=r.setup;
  const key=(track?.id||'manual')+':'+(scopeId||'track');if(contextKey!==key){tones.stop();contextKey=key;}
  const signatures=JSON.stringify(state.tracks.map(t=>[t.id,t.name,t.regions.map(region=>[region.id,region.start,region.end])]));
  const scopeSignature=key+signatures;
  if(optionSignature!==scopeSignature){
   targetScope.replaceChildren();const whole=node('option','',track?'Whole track':'Manual setup · no audio');whole.value='';targetScope.append(whole);for(const region of track?.regions||[]){const o=node('option','',region.label||`${region.start.toFixed(2)}–${region.end.toFixed(2)} s`);o.value=region.id;targetScope.append(o);}
   reference.replaceChildren();const local=node('option','','Local key for this scope');local.value='local';reference.append(local);
   for(const t of state.tracks){const whole=node('option','',t.name+' · whole track');whole.value=JSON.stringify({trackId:t.id,scopeId:null});reference.append(whole);for(const region of t.regions){const option=node('option','',t.name+` · ${region.start.toFixed(2)}–${region.end.toFixed(2)} s`);option.value=JSON.stringify({trackId:t.id,scopeId:region.id});reference.append(option);}}
   optionSignature=scopeSignature;
  }
  targetScope.value=scopeId||'';targetScope.disabled=!track;
  reference.value=setup.reference?JSON.stringify({trackId:setup.reference.trackId,scopeId:setup.reference.scopeId}):'local';reference.disabled=!state.tracks.length;
  root.value=setup.tonic==null?'':String(setup.tonic);for(let pc=0;pc<12;pc++)root.options[pc+1].textContent=setup.spellingPreference==='sharps'?SHARPS[pc]:setup.spellingPreference==='musical'&&pc===setup.tonic&&setup.rootSpelling?setup.rootSpelling:FLATS[pc];
  mode.value=setup.mode;spelling.value=setup.spellingPreference;if(document.activeElement!==hz)hz.value=String(setup.referenceHz);
  provenance.textContent=(r.available?tuningTitle(setup):'Choose a scale or notes manually')+' · '+setup.setupOrigin+' · '+r.scope+(setup.followsEffectiveKey&&r.referenceValues.keySource==='estimated'&&r.referenceTarget?.result?.ambiguous?' · ambiguous reference — audition or choose':'')+(r.stale?' · reference changed, review setup':'');
  explanation.textContent=setup.mode==='natural-minor'?'Natural minor uses 1, 2, ♭3, 4, 5, ♭6, ♭7. Borrowed or raised notes can be added below.':setup.mode==='custom'?'Custom notes preserve your choices. Editing the note mask does not change the detected key.':'Major uses 1, 2, 3, 4, 5, 6, 7. Edit included notes for borrowed tones.';
  history.textContent=setup.mode==='custom'&&setup.startingScale?.mode?'Started from '+tuningTitle({...setup,...setup.startingScale})+'. Your custom notes stay intact when analysis or the reference key changes.':'A='+setup.referenceHz+' Hz is '+setup.referenceHzOrigin+'; it has not been measured from this audio.';
  for(let pc=0;pc<12;pc++){const name=noteName(pc,setup),active=setup.allowedPitchClasses.includes(pc),control=noteControls[pc];control.check.checked=active;control.check.setAttribute('aria-label','Allow '+name);control.text.textContent=name;control.cell.classList.toggle('included',active);const key=noteKeys[pc],midi=(Number(octave.value)+1)*12+pc;key.textContent=scientificNoteName(pc,Number(octave.value),setup);key.setAttribute('aria-label','Audition '+key.textContent+(active?', included note':', outside note set'));key.title=referenceFrequency(midi,setup.referenceHz).toFixed(2)+' Hz';key.classList.toggle('included',active);}
  const candidates=(r.referenceTarget?.result?.keys||[]).filter(c=>setupFromKey(c.key)),signature=JSON.stringify([key,candidates.map(c=>c.key),setup.referenceHz,octave.value]);
  if(signature!==candidateSignature){alternatives.replaceChildren();if(candidates.length){alternatives.append(node('h4','','Estimated alternatives'));for(const c of candidates.slice(0,3)){const row=node('div','tuning-candidate');row.append(node('strong','',c.key),button('Use',()=>edit({type:'candidate',key:c.key})),button('Audition',()=>{const preview={...setupFromKey(c.key),referenceHz:current().setup.referenceHz};void playMidis(scaleMidis(preview,Number(octave.value)),preview);}));alternatives.append(row);}}candidateSignature=signature;}
  summary.textContent=r.summary;copy.disabled=!r.available;share.disabled=!r.available;playScale.disabled=!r.available;playSource.disabled=!r.referenceTrack||r.stale;stopNotes.disabled=!tones.running;playTarget.disabled=!track;playTarget.hidden=!track||r.reference?.trackId===track.id&&r.reference?.scopeId===scopeId;
 }
 subscribe(refresh);refresh();
 return {element,refresh,stop:tones.stop};
}
