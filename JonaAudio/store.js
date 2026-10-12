import {KEYS} from './engine.js';
const VALID_KEYS=new Set(KEYS.flatMap(n=>[n+' major',n+' minor']));
// Musical decisions have one owner. Layout and playback never rewrite estimates.
export const state = {tracks: [], selectedId: null, generation: 0};
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
  return {bpm, key, bpmSource: override.bpm != null ? 'manual' : bpm != null ? 'estimated' : 'unavailable',
    keySource: override.key != null ? 'manual' : key != null ? 'estimated' : 'unavailable',
    scope: regionId == null ? 'whole track' : 'region', autoBpm: auto?.tempo?.bpm ?? null, autoKey: auto?.keys?.[0]?.key ?? null};
}
function persistCorrections(track) {
  legacyCorrections[track.sourceIdentity] = {...track.corrections};
  try {localStorage.setItem('jonaaudio-corrections', JSON.stringify(legacyCorrections));return true;} catch {return false;}
}
export function dispatch(command) {
  const track = state.tracks.find(t => t.id === command.trackId);
  switch (command.type) {
    case 'add': {
      const t=command.track;
      const c=legacyCorrections[sourceKey(t.file)] || {};
      t.sourceIdentity=sourceKey(t.file);t.regions=[];t.corrections={};
      if(Number.isFinite(c.bpm)&&c.bpm>=25&&c.bpm<=400)t.corrections.bpm=c.bpm;
      if(VALID_KEYS.has(c.key))t.corrections.key=c.key;
      t.playback={position:0,rate:1,zoom:1};t.sourceAvailable=true;t.decisionRevision=0;
      state.tracks.push(t);break;
    }
    case 'select': if (!track) return false;state.selectedId=track.id;break;
    case 'patch': if (!track) return false;Object.assign(track, command.patch);break;
    case 'remove': state.tracks=state.tracks.filter(t => t.id!==command.trackId);if(state.selectedId===command.trackId)state.selectedId=null;break;
    case 'clear': state.tracks=[];state.selectedId=null;state.generation++;break;
    case 'region': {
      if(!track)return false;
      const r=command.region;
      if(!r || !Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end<=r.start||r.end>(track.duration??Infinity))return false;
      const current=track.regions.find(v=>v.id===r.id);
      if(current)Object.assign(current,r);else track.regions.push({...r,trackId:track.id,corrections:r.corrections||{}});
      break;
    }
    case 'correct':
    case 'resetCorrection': {
      if(!track)return false;
      const target=command.regionId==null?track:track.regions.find(r=>r.id===command.regionId);
      if(!target)return false;
      const values=command.type==='resetCorrection'?{}:command.values;
      if(!values || (values.bpm!=null&&(!Number.isFinite(values.bpm)||values.bpm<25||values.bpm>400)))return false;
      if(values.key!=null&&!VALID_KEYS.has(values.key))return false;
      const old=resolveValues(track,command.regionId);
      target.corrections={...values};track.decisionRevision++;
      if(old.bpm!==resolveValues(track,command.regionId).bpm)target.gridStale=true;
      const saved=target!==track||persistCorrections(track);
      emit(command.type);return {saved};
    }
    default: return false;
  }
  emit(command.type);return true;
}
