export const SHARPS=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const FLATS=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const NATURAL={C:0,D:2,E:4,F:5,G:7,A:9,B:11},LETTERS=['C','D','E','F','G','A','B'];
const INTERVALS={major:[0,2,4,5,7,9,11],'natural-minor':[0,2,3,5,7,8,10]};
const MODES=['major','natural-minor','custom'];
export function parseKey(key){
 const m=/^([A-G])([#♯b♭]?)(?:\s+)(major|minor|natural minor)$/.exec(key||'');if(!m)return null;
 const accidental=['#','♯'].includes(m[2])?1:['b','♭'].includes(m[2])?-1:0;
 return {tonic:(NATURAL[m[1]]+accidental+12)%12,mode:m[3]==='major'?'major':'natural-minor',rootSpelling:m[1]+(accidental===1?'♯':accidental===-1?'♭':'')};
}
export function scaleMask(tonic,mode){return Number.isInteger(tonic)&&tonic>=0&&tonic<12&&INTERVALS[mode]?INTERVALS[mode].map(i=>(i+tonic)%12):[];}
export function defaultTuning(){return {version:1,tonic:null,mode:'custom',allowedPitchClasses:[],referenceHz:440,referenceHzOrigin:'assumed',spellingPreference:'musical',setupOrigin:'manual',followsEffectiveKey:true,reference:null,startingScale:null,rootSpelling:null};}
export function setupFromKey(key,origin='estimated'){
 const parsed=parseKey(key);return parsed?{...defaultTuning(),...parsed,allowedPitchClasses:scaleMask(parsed.tonic,parsed.mode),setupOrigin:origin,startingScale:{...parsed}}:null;
}
export function validateTuning(value){
 if(!value||value.version!==1||!MODES.includes(value.mode)||!(value.tonic===null||Number.isInteger(value.tonic)&&value.tonic>=0&&value.tonic<12))return null;
 if(!Array.isArray(value.allowedPitchClasses)||value.allowedPitchClasses.some(pc=>!Number.isInteger(pc)||pc<0||pc>11))return null;
 if(!Number.isFinite(value.referenceHz)||value.referenceHz<20||value.referenceHz>20000)return null;
 const ref=value.reference;
 if(ref&&(!(typeof ref.trackId==='number'||typeof ref.trackId==='string')||!(ref.scopeId===null||typeof ref.scopeId==='string')))return null;
 const unique=[...new Set(value.allowedPitchClasses)];
 if(value.mode!=='custom'&&(value.tonic==null||unique.length!==7||scaleMask(value.tonic,value.mode).some(pc=>!unique.includes(pc))))return null;
 return {...defaultTuning(),...value,allowedPitchClasses:unique,spellingPreference:['musical','sharps','flats'].includes(value.spellingPreference)?value.spellingPreference:'musical',referenceHzOrigin:value.referenceHzOrigin==='user-chosen'?'user-chosen':'assumed',setupOrigin:['manual','estimated','candidate-choice','inherited'].includes(value.setupOrigin)?value.setupOrigin:'manual',followsEffectiveKey:value.followsEffectiveKey!==false,reference:ref?{...ref}:null};
}
export function noteName(pc,setup=null){
 if(setup?.spellingPreference==='sharps')return SHARPS[pc];if(setup?.spellingPreference==='flats')return FLATS[pc];
 if(setup&&setup.mode!=='custom'&&setup.tonic!=null){
  const root=setup.rootSpelling||(['major'].includes(setup.mode)?['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B']:['C','C♯','D','E♭','E','F','F♯','G','G♯','A','B♭','B'])[setup.tonic];
  const mask=scaleMask(setup.tonic,setup.mode),degree=mask.indexOf(pc);if(degree>=0){const letter=LETTERS[(LETTERS.indexOf(root[0])+degree)%7];let delta=(pc-NATURAL[letter]+12)%12;if(delta>6)delta-=12;return letter+(delta>0?'♯'.repeat(delta):delta<0?'♭'.repeat(-delta):'');}
 }
 return FLATS[pc]||'—';
}
export function orderedNotes(setup){return [...setup.allowedPitchClasses].sort((a,b)=>((a-(setup.tonic??0)+12)%12)-((b-(setup.tonic??0)+12)%12));}
export function tuningTitle(setup){return setup.mode==='custom'?'Custom notes':noteName(setup.tonic,setup)+' '+(setup.mode==='natural-minor'?'natural minor':'major');}
export function referenceFrequency(midi,referenceHz=440){return Number.isFinite(midi)&&Number.isFinite(referenceHz)&&referenceHz>0?referenceHz*Math.pow(2,(midi-69)/12):null;}
export function tuningSummary(setup,{target='Manual setup',scope='no audio reference',referenceLabel=null,referenceOrigin=null,stale=false}={}){
 const notes=orderedNotes(setup).map(pc=>noteName(pc,setup)).join(' ');
 const basis=setup.setupOrigin==='candidate-choice'?'selected from estimated alternatives':setup.setupOrigin==='inherited'?'inherited reference key':setup.setupOrigin==='estimated'?'estimated key':'user-chosen setup';
 return `${target} — ${tuningTitle(setup)}; notes ${notes||'none selected'}; reference A=${setup.referenceHz} Hz (${setup.referenceHzOrigin}); ${basis}; scope: ${scope}${referenceLabel?'; harmonic reference: '+referenceLabel+(referenceOrigin?' ('+referenceOrigin+')':''):''}${stale?'; reference source/range changed — review this setup':''}.`;
}
export function scientificNoteName(pc,octave,setup){const name=noteName(pc,setup),letter=name[0],accidental=[...name.slice(1)].reduce((sum,c)=>sum+(c==='♯'?1:c==='♭'?-1:0),0),adjust=Math.floor(((NATURAL[letter]??pc)+accidental)/12);return name+(octave-adjust);}
export function scaleMidis(setup,octave=4){const root=setup.tonic??0,base=(octave+1)*12+root;return orderedNotes(setup).map(pc=>base+(pc-root+12)%12);}
