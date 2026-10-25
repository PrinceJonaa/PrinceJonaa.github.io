// Evaluate user-key settings separately from verified source-session labels.
const ROOTS={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11,'B#':0,'E#':5,Fb:4};
const MAJOR=[0,2,4,5,7,9,11],MINOR=[0,2,3,5,7,8,10];
export function parsedKey(value){
 if(typeof value!=='string')return null;
 const match=/^([A-G])([#b]?)[ ]+(major|minor|natural minor)$/i.exec(value.trim().replaceAll('♯','#').replaceAll('♭','b'));
 if(!match)return null;
 const root=ROOTS[match[1].toUpperCase()+match[2]];
 if(root===undefined)return null;
 const mode=match[3].toLowerCase()==='major'?'major':'minor';
 return {root,mode,pitchClasses:(mode==='major'?MAJOR:MINOR).map(i=>(root+i)%12).sort((a,b)=>a-b),
  canonical:root+':'+mode};
}
export function tempoRelation(actual,reference){
 if(!Number.isFinite(actual)||!Number.isFinite(reference)||actual<=0||reference<=0)return null;
 if(Math.abs(actual-reference)<=1)return 'within-1-bpm';
 const ratio=actual/reference;
 for(const [name,target] of [['half-time',.5],['double-time',2],['three-to-two',1.5],['two-to-three',2/3]])
  if(Math.abs(ratio-target)<=.025)return name;
 return 'not-equivalent';
}
function ensure(condition,message){if(!condition)throw Error(message)}
export function scoreLabeledPredictions({schema,annotations,predictions}){
 ensure(schema===1&&Array.isArray(annotations)&&Array.isArray(predictions),'Expected schema 1, annotations[], predictions[]');
 const labels=new Map();
 for(const [i,row] of annotations.entries()){
  ensure(row&&typeof row.id==='string'&&row.id.length<=128&&row.id.length>0,'Invalid annotation '+i+' id');
  ensure(!labels.has(row.id),'Duplicate annotation '+row.id);
  ensure(['working-setting','session-confirmed'].includes(row.basis),'Missing basis for '+row.id);
  ensure(row.key==null||parsedKey(row.key),'Invalid key for '+row.id);
  ensure(row.bpm==null||Number.isFinite(row.bpm)&&row.bpm>=20&&row.bpm<=400,'Invalid BPM for '+row.id);
  labels.set(row.id,row);
 }
 const seen=new Set(),results=[];
 for(const [i,p] of predictions.entries()){
  ensure(p&&typeof p.id==='string'&&typeof p.method==='string'&&p.method.length<=128,'Invalid prediction '+i);
  const label=labels.get(p.id);ensure(label,'Missing annotation for '+p.id);
  const identity=p.id+'\n'+p.method;ensure(!seen.has(identity),'Repeated method for '+p.id);seen.add(identity);
  const expected=parsedKey(label.key),detected=parsedKey(p.key);
  const exact=Boolean(expected&&detected&&expected.canonical===detected.canonical);
  const compatible=Boolean(expected&&detected&&expected.pitchClasses.every((pc,i)=>pc===detected.pitchClasses[i]));
  const pulse=tempoRelation(p.bpm,label.bpm);
  results.push({id:p.id,method:p.method,labelBasis:label.basis,annotatedKey:label.key??null,predictedKey:p.key??null,
   exactKey:expected?exact:null,compatibleScale:expected?compatible:null,
   relativeKey:Boolean(expected&&detected&&!exact&&compatible),annotatedBpm:label.bpm??null,
   predictedBpm:p.bpm??null,tempoRelation:pulse});
 }
 const summaries=[];
 for(const method of [...new Set(results.map(r=>r.method))])for(const basis of ['working-setting','session-confirmed']){
  const items=results.filter(r=>r.method===method&&r.labelBasis===basis);
  if(!items.length)continue;
  const keyRows=items.filter(r=>r.exactKey!==null),tempoRows=items.filter(r=>r.tempoRelation!==null);
  summaries.push({method,basis,tracks:items.length,keyCount:keyRows.length,
   exactKeys:keyRows.filter(r=>r.exactKey).length,scaleCompatible:keyRows.filter(r=>r.compatibleScale).length,
   relativeKeys:keyRows.filter(r=>r.relativeKey).length,tempoCount:tempoRows.length,
   bpmWithinOne:tempoRows.filter(r=>r.tempoRelation==='within-1-bpm').length});
 }
 return {schema:1,annotationBasis:'working-setting = practical pitch-correction choice; session-confirmed = independently checked DAW/session key/BPM',
  warning:'A small set of user-selected tracks is not an unbiased accuracy sample. Agreement with a working setting is not automatically musical ground truth.',summaries,results};
}