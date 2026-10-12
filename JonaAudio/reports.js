import {sessionSnapshot} from './session-persistence.js';
import {ENGINE_VERSION} from './config.js';
import {resolveValues} from './store.js';
// Spreadsheet formula injection is possible even inside quoted CSV fields.
export function safeCsv(value){
 let s=String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
 if(/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
export function reportRows(tracks){
 const heading=['File','Scope','Duration seconds','Auto BPM','Corrected BPM','Effective BPM','BPM source','Auto key','Corrected key','Effective key','Key source','Mono-sum RMS dBFS','Channel-energy RMS dBFS','Left RMS dBFS','Right RMS dBFS','Sample peak dBFS','Crest dB vs channel energy','Stereo correlation','Correlation status','Near ceiling sample frames','Leading silence seconds','Trailing silence seconds'];
 return [heading,...tracks.map(t=>{const v=resolveValues(t),q=t.result?.quality||{},c=t.corrections||{};
  return [t.name,'whole track',t.duration??'',v.autoBpm??'',c.bpm??'',v.bpm??'',v.bpmSource,v.autoKey??'',c.key??'',v.key??'',v.keySource,q.rmsDb??'',q.stereoEnergyRmsDb??'',q.leftRmsDb??'',q.rightRmsDb??'',q.samplePeakDb??'',q.crestDb??'',q.stereoCorrelation??'',q.stereoCorrelationReason??'',q.nearCeilingSamples??'',q.leadingSilence??'',q.trailingSilence??''];
 })];
}
export function csvReport(tracks){return '\ufeff'+reportRows(tracks).map(row=>row.map(safeCsv).join(',')).join('\r\n');}
export function jsonReport(state){return JSON.stringify({kind:'jonaaudio-analysis-report',version:1,engineVersion:ENGINE_VERSION,createdAt:new Date().toISOString(),
 sources:state.tracks.map(t=>({name:t.name,sourceIdentity:t.sourceIdentity,duration:t.duration,
  effective:resolveValues(t),auto:{tempo:t.result?.tempo||null,keys:t.result?.keys||[]},
  quality:t.result?.quality||null,measurementsScope:'whole track',spectrogram:t.result?.spectrogram?{start:t.result.spectrogram.start,end:t.result.spectrogram.end}:null,
  regions:t.regions.map(r=>({id:r.id,start:r.start,end:r.end,values:resolveValues(t,r.id)}))})),
 recovery:sessionSnapshot(state)},null,2);}
export function downloadText(text,name,mime){
 const url=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
}
