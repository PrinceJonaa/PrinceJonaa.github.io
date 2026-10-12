export const WIDGETS={tempo:'Tempo',key:'Key',waveform:'Waveform', 'tuning-notes':'Tuning notes',candidates:'Alternate readings',levels:'Levels',stereo:'Stereo',spectrum:'Spectrum','compare-summary':'Compare'};
const order=Object.keys(WIDGETS);
const definitions={quick:['tempo','key','waveform'],artist:['tempo','key','waveform','tuning-notes','candidates'],sampler:['waveform','tempo','key','candidates'],engineer:['levels','stereo','spectrum','compare-summary','waveform','tempo','key']};
export function defaultLayout(preset='quick') {
  if(!definitions[preset])preset='quick';
  const ids=[...definitions[preset],...order.filter(id=>!definitions[preset].includes(id))];
  return {version:1,preset,name:preset[0].toUpperCase()+preset.slice(1),density:'comfortable',widgets:ids.map(id=>({id,visible:definitions[preset].includes(id),span:id==='tempo'||id==='key'?1:2}))};
}
export function validateLayout(value) {
  if(!value||value.version!==1||!definitions[value.preset]||!Array.isArray(value.widgets))return null;
  const ids=value.widgets.map(w=>w.id);
  if(ids.length!==order.length||new Set(ids).size!==order.length||ids.some(id=>!WIDGETS[id]))return null;
  return {...defaultLayout(value.preset),name:String(value.name||value.preset).slice(0,60),density:value.density==='compact'?'compact':'comfortable',widgets:value.widgets.map(w=>({id:w.id,visible:!!w.visible,span:w.span===1?1:2}))};
}
const STORAGE='jonaaudio-layouts-v1';
export function createLayouts(onChange=()=>{}) {
  let layouts=Object.fromEntries(Object.keys(definitions).map(p=>[p,defaultLayout(p)])),active='quick',custom={};
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');
    if(saved?.version===1){for(const p of Object.keys(layouts)){const valid=validateLayout(saved.layouts?.[p]);if(valid)layouts[p]=valid;}for(const [id,v] of Object.entries(saved.custom||{})){const valid=validateLayout(v);if(/^saved-\d+$/.test(id)&&valid)custom[id]=valid;}if(layouts[saved.active]||custom[saved.active])active=saved.active;}
  }catch{}
  const current=()=>structuredClone(layouts[active]||custom[active]);
  const persist=()=>{try {localStorage.setItem(STORAGE,JSON.stringify({version:1,active,layouts,custom}));return true;}catch {return false;}};
  const notify=()=>onChange(current());
  return {
    current,options:()=>Object.entries({...layouts,...custom}).map(([id,v])=>({id,name:v.name})),
    select(id){if(!layouts[id]&&!custom[id])return false;active=id;const saved=persist();notify();return saved;},
    save(draft,{asNew=false}={}){const valid=validateLayout(draft);if(!valid)return false;if(asNew){active='saved-'+Date.now();custom[active]=valid;}else if(layouts[active])layouts[active]=valid;else custom[active]=valid;const saved=persist();notify();return saved;},
    reset(){const preset=current().preset;if(layouts[active])layouts[active]=defaultLayout(preset);else custom[active]=defaultLayout(preset);const saved=persist();notify();return saved;},
    get active(){return active;}
  };
}
