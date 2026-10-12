import {KEYS} from './engine.js';
import {validateTuning} from './tuning-model.js';
const VALID_KEYS=new Set(KEYS.flatMap(n=>[n+' major',n+' minor']));
// Musical decisions have one owner. Layout and playback never rewrite estimates.
export const state = {tracks: [], selectedId: null, generation: 0, standaloneTuning:null};
const listeners = new Set();
export const selectedTrack = () => state.tracks.find(t => t.id === state.selectedId) || null;
export const sourceKey = f => [f.name, f.size, f.lastModified].join(':');
const readCorrections = () => {try {const v=JSON.parse(localStorage.getItem('jonaaudio-corrections') || '{}');return v && typeof v==='object' && !Array.isArray(v)?v:{};} catch {return {};}};
const legacyCorrections = readCorrections();
export function emit(type='tracks') {for (const listener of listeners) listener({type, state});}
export function subscribe(listener) {listeners.add(listener);return () => listeners.delete(listener);}
export function resolveValues(track, regionId=null) {
  const scope = regionId == null ? track : track?.regions?.find(r => r.id === regionId);
  const auto = scope?.result, override = scope?.corrections || {};
  const bpm = override.bpm ?? auto?.tempo?.bpm ?? null;
  const key = override.key ?? auto?.keys?.[0]?.key ?? null;
  return {bpm, key, bpmSource: override.bpm != null ? (['manual','tap','candidate-choice'].includes(override.origins?.bpm)?override.origins.bpm:'manual') : bpm != null ? 'estimated' : 'unavailable',
    keySource: override.key != null ? (['manual','tap','candidate-choice'].includes(override.origins?.key)?override.origins.key:'manual') : key != null ? 'estimated' : 'unavailable',
    scope: regionId == null ? 'whole track' : 'region', autoBpm: auto?.tempo?.bpm ?? null, autoKey: auto?.keys?.[0]?.key ?? null};
}
function persistCorrections(track) {
  legacyCorrections[track.sourceIdentity] = {...track.corrections};
  try {localStorage.setItem('jonaaudio-corrections', JSON.stringify(legacyCorrections));return true;} catch {return false;}
}
function musicSnapshot(track){return structuredClone({corrections:track.corrections,tuningSetup:track.tuningSetup,sampleGrid:track.sampleGrid,gridStale:track.gridStale,analysisScopeId:track.analysisScopeId,regions:track.regions.map(({result,...r})=>r),candidateFavorites:track.candidateFavorites});}
function rememberEdit(track){track.history||=[];track.history.push(musicSnapshot(track));if(track.history.length>30)track.history.shift();}
function invalidateRegion(track,id){for(const [key,entry] of Object.entries(track.analysis||{}))if(key.startsWith(id+':')){entry.requestRevision++;entry.status='idle';entry.reason=null;}}
export function dispatch(command) {
  const track = state.tracks.find(t => t.id === command.trackId);
  switch (command.type) {
    case 'add': {
      const t=command.track;
      const c=legacyCorrections[sourceKey(t.file)] || {};
      t.history=[];t.gridRevision=0;t.sampleGrid={bpm:null,bpmOrigin:'unset',numerator:4,denominator:4,meterOrigin:'assumed',anchor:null,anchorOrigin:null,snap:'off'};t.candidateFavorites={};t.tuningSetup=null;t.sourceIdentity=sourceKey(t.file);t.sourceRevision=1;t.analysis={};t.regions=[];t.corrections={};
      if(Number.isFinite(c.bpm)&&c.bpm>=25&&c.bpm<=400)t.corrections.bpm=c.bpm;
      if(VALID_KEYS.has(c.key))t.corrections.key=c.key;
      t.corrections.origins=c.origins&&typeof c.origins==='object'?c.origins:{};
      t.playback={position:0,rate:1,zoom:1};t.sourceAvailable=true;t.decisionRevision=0;
      state.tracks.push(t);break;
    }
    case 'select': if (!track) return false;state.selectedId=track.id;break;
    case 'selectScope':if(!track||(command.regionId!=null&&!track.regions.some(r=>r.id===command.regionId)))return false;track.analysisScopeId=command.regionId||null;break;
    case 'patch': if (!track) return false;Object.assign(track, command.patch);break;
    case 'remove': state.tracks=state.tracks.filter(t => t.id!==command.trackId);if(state.selectedId===command.trackId)state.selectedId=null;break;
    case 'clear': state.tracks=[];state.selectedId=null;state.standaloneTuning=null;state.generation++;break;
    case 'region': {
      if(!track)return false;
      const r=command.region;
      if(!r || !Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end<=r.start||r.end>(track.duration??Infinity))return false;
      const current=track.regions.find(v=>v.id===r.id);if(command.history!==false)rememberEdit(track);
      if(current){const changed=current.start!==r.start||current.end!==r.end;
        if(changed){current.regionRevision=(current.regionRevision||0)+1;current.result=null;invalidateRegion(track,r.id);}
        if(changed||r.fades&&JSON.stringify(r.fades)!==JSON.stringify(current.fades))current.audioRevision=(current.audioRevision||0)+1;
        const {result,regionRevision,audioRevision,trackId,...edit}=r;Object.assign(current,edit);
      }else track.regions.push({...r,regionRevision:1,audioRevision:1,fades:r.fades||{inMs:5,outMs:5},trackId:track.id,corrections:r.corrections||{}});
      track.decisionRevision++;

      break;
    }
    case 'grid': {
      if(!track)return false;const g={...track.sampleGrid,...command.grid};
      if(!(g.bpm==null||Number.isFinite(g.bpm)&&g.bpm>=25&&g.bpm<=400)||!Number.isInteger(g.numerator)||g.numerator<1||g.numerator>32||![1,2,4,8,16].includes(g.denominator)||!(g.anchor==null||Number.isFinite(g.anchor)&&g.anchor>=0&&g.anchor<=(track.duration||Infinity))||!['off','beat','bar'].includes(g.snap))return false;
      rememberEdit(track);track.sampleGrid=g;track.gridRevision++;track.candidatesStale=true;track.gridStale=command.confirm===true?false:true;track.decisionRevision++;break;
    }
    case 'candidateFavorite':if(!track)return false;track.candidateFavorites[command.id]=!!command.favorite;break;
    case 'undo': {
      if(!track?.history?.length)return false;const snapshot=track.history.pop(),oldRegions=track.regions;
      track.regions=snapshot.regions.map(r=>{const old=oldRegions.find(v=>v.id===r.id),same=old&&old.start===r.start&&old.end===r.end;invalidateRegion(track,r.id);return {...r,regionRevision:(old?.regionRevision||r.regionRevision||0)+1,audioRevision:(old?.audioRevision||r.audioRevision||0)+1,result:same?old.result:null};});
      track.corrections=snapshot.corrections;track.tuningSetup=snapshot.tuningSetup;track.sampleGrid=snapshot.sampleGrid;track.gridStale=snapshot.gridStale;track.analysisScopeId=snapshot.analysisScopeId;track.candidateFavorites=snapshot.candidateFavorites;track.gridRevision++;track.decisionRevision++;persistCorrections(track);break;
    }
    case 'tuning': {
      const setup=validateTuning(command.setup);if(!setup)return false;
      if(command.trackId==null){state.standaloneTuning=setup;}else {const target=command.regionId==null?track:track?.regions.find(r=>r.id===command.regionId);if(!target)return false;rememberEdit(track);target.tuningSetup=setup;track.decisionRevision++;}
      break;
    }
    case 'correct':
    case 'resetCorrection': {
      if(!track)return false;
      const target=command.regionId==null?track:track.regions.find(r=>r.id===command.regionId);
      if(!target)return false;
      const values=command.type==='resetCorrection'?{}:command.values;
      if(!values || (values.bpm!=null&&(!Number.isFinite(values.bpm)||values.bpm<25||values.bpm>400||Math.abs(values.bpm*100-Math.round(values.bpm*100))>1e-6)))return false;
      if(values.key!=null&&!VALID_KEYS.has(values.key))return false;
      const old=resolveValues(track,command.regionId);rememberEdit(track);
      const origins={...target.corrections?.origins};
      for(const field of command.fields||['bpm','key'])if(values[field]!=null)origins[field]=['manual','tap','candidate-choice'].includes(command.origin)?command.origin:'manual';
      target.corrections={...values,origins:command.type==='resetCorrection'?{}:origins};track.decisionRevision++;
      if(old.bpm!==resolveValues(track,command.regionId).bpm){target.gridStale=true;track.gridStale=true;track.candidatesStale=true;track.gridRevision++;}
      const saved=target!==track||persistCorrections(track);
      emit(command.type);return {saved};
    }
    default: return false;
  }
  emit(command.type);return true;
}
