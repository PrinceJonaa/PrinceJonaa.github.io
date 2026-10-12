import {fft} from './engine.js';
import {resample} from './resample.js';
import {barSeconds} from './sample-model.js';
export function describeChunk(samples,sampleRate,offset=0,bucketFrames=Math.round(sampleRate*.25),previousRms=0){
 const features=[];let priorRms=previousRms;for(let a=0;a<samples.length;a+=bucketFrames){const b=Math.min(samples.length,a+bucketFrames);let energy=0,peak=0,onsets=[],lastRms=priorRms;
  const hop=Math.max(1,Math.round(sampleRate*.01));for(let p=a;p<b;p+=hop){let sum=0,n=0;for(let i=p;i<Math.min(b,p+hop);i++){const x=samples[i];sum+=x*x;energy+=x*x;peak=Math.max(peak,Math.abs(x));n++;}const rms=Math.sqrt(sum/Math.max(1,n));if(rms>lastRms*1.4+.002)onsets.push((p+offset)/sampleRate);lastRms=rms;}
  const {samples:mono,sampleRate:rate}=resample(samples.subarray(a,b),sampleRate);let chroma=null;
  if(mono.length>=2048){const win=new Float32Array(2048);for(let i=0;i<2048;i++)win[i]=mono[i]*(.5-.5*Math.cos(2*Math.PI*i/2047));const mag=fft(win),vector=new Array(12).fill(0);for(let k=1;k<mag.length;k++){const hz=k*rate/2048;if(hz<80||hz>1600)continue;const pc=((Math.round(69+12*Math.log2(hz/440))%12)+12)%12;vector[pc]+=mag[k];}const max=Math.max(...vector);if(max>1e-5&&(max-Math.min(...vector))/max>.12)chroma=vector.map(v=>v/max);}
  priorRms=lastRms;features.push({lastRms,start:(a+offset)/sampleRate,end:(b+offset)/sampleRate,energy:energy/Math.max(1,b-a),peak,onsets,chroma,head:samples[a]||0,tail:samples[b-1]||0});
 }return features;
}
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const cosine=(a,b)=>{let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa*bb?dot/Math.sqrt(aa*bb):null;};
export function rankCandidates(features,duration,settings={}){
 const grid=settings.grid||{},bar=barSeconds(grid),aligned=bar&&Number.isFinite(grid.anchor)&&grid.anchorOrigin==='user-set'&&!settings.gridStale;
 const lengths=aligned?[1,2,4,8].map(n=>n*bar):[2,4,8,16],pool=[],families=settings.family&&settings.family!=='all'?[settings.family]:['repeat','transient','break','tonal'];
 for(const length of lengths){if(length>duration||length<=0)continue;const available=duration-length,per=64;for(let i=0;i<Math.min(per,Math.floor(available/.25)+1);i++){
  let start=available*i/Math.max(1,Math.min(per,Math.floor(available/.25)+1)-1);if(aligned)start=grid.anchor+Math.floor((start-grid.anchor)/bar)*bar;start=Math.max(0,start);if(start+length>duration)continue;
  const end=start+length;if(pool.some(p=>Math.abs(p.start-start)<.02&&Math.abs(p.end-end)<.02))continue;
  const bucket=features.filter(f=>f.end>start&&f.start<end);if(!bucket.length)continue;const energy=mean(bucket.map(f=>f.energy));if(!(energy>1e-10))continue;
  const rmsDb=10*Math.log10(energy),onsets=bucket.flatMap(f=>f.onsets).filter(t=>t>=start&&t<end),intervals=onsets.slice(1).map((v,j)=>v-onsets[j]),avg=mean(intervals),regularity=avg?Math.max(0,1-Math.sqrt(mean(intervals.map(v=>(v-avg)**2)))/avg):null;
  const vectors=bucket.map(f=>f.chroma).filter(Boolean);const chromaStability=vectors.length>1?mean(vectors.slice(1).map((v,j)=>cosine(vectors[j],v)).filter(Number.isFinite)):vectors.length?1:null;
  const boundary=1/(1+Math.abs(bucket[0].head)+Math.abs(bucket.at(-1).tail)),stability=1/(1+Math.sqrt(mean(bucket.map(f=>(f.energy-energy)**2)))/(energy+1e-12));
  const adjacent=features.filter(f=>f.end>Math.max(0,start-length)&&f.start<Math.min(duration,end+length)&&!(f.end>start&&f.start<end));const neighbor=mean(adjacent.map(f=>f.energy));const contrast=neighbor!=null?(neighbor-energy)/(neighbor+energy+1e-12):null;
  let repeat=null;const referenceStarts=Array.from({length:16},(_,j)=>(duration-length)*j/15).filter(s=>s+length<=start||s>=end);
  const pattern=bucket.map(f=>[Math.sqrt(f.energy),f.onsets.length,...(f.chroma||new Array(12).fill(0))]);
  for(const s of referenceStarts){const other=features.filter(f=>f.end>s&&f.start<s+length);if(!other.length)continue;const values=pattern.map((v,j)=>cosine(v,[Math.sqrt(other[Math.min(other.length-1,Math.floor(j*other.length/pattern.length))].energy),other[Math.min(other.length-1,Math.floor(j*other.length/pattern.length))].onsets.length,...(other[Math.min(other.length-1,Math.floor(j*other.length/pattern.length))].chroma||new Array(12).fill(0))])).filter(Number.isFinite);const similarity=mean(values);if(similarity!=null)repeat=Math.max(repeat??0,similarity);}
  pool.push({start,end,length,bars:bar?length/bar:null,basis:aligned?'user-anchored constant-tempo grid':'seconds',rmsDb,features:{repeat,boundary,stability,density:onsets.length/length,regularity,energy,contrast,chromaStability,duration:length}});if(pool.length===256)break;
 }if(pool.length===256)break;}
 const definitions={repeat:[['repeat',.6,false],['boundary',.25,false],['stability',.15,false]],transient:[['density',.6,false],['regularity',.25,false],['boundary',.15,false]],break:[['energy',.6,true],['contrast',.25,false],['duration',.15,false]],tonal:[['chromaStability',.5,false],['density',.3,true],['boundary',.2,false]]},ranked=[];
 for(const family of families){if(!definitions[family])continue;const usable=pool.filter(p=>(family!=='tonal'||p.features.chromaStability!=null)&&(family!=='repeat'||p.features.repeat!=null));const bounds={};for(const [name] of definitions[family]){const values=usable.map(p=>p.features[name]).filter(Number.isFinite);bounds[name]=values.length?[Math.min(...values),Math.max(...values)]:null;}
  for(const p of usable){let score=0,weight=0,missing=[];for(const [name,w,invert] of definitions[family]){const range=bounds[name],value=p.features[name];if(!range||!Number.isFinite(value)){missing.push(name);continue;}let normalized=range[1]===range[0]? .5 :(value-range[0])/(range[1]-range[0]);if(invert)normalized=1-normalized;score+=normalized*w;weight+=w;}if(!weight)continue;score=score/weight*(p.rmsDb<-70?.2:1);
   const reason=family==='repeat'?'Similar non-overlapping coarse patterns; boundary/energy stability':family==='transient'?'Onset density and spacing; boundary continuity':family==='break'?'Lower relative energy and neighbor contrast; silence excluded':'Stable chroma and lower onset density; boundary continuity';ranked.push({...p,id:family+':'+p.start.toFixed(4)+':'+p.end.toFixed(4),family,score,reason,missing,algorithm:'coarse-region-v1'});
  }
 }
 ranked.sort((a,b)=>b.score-a.score||a.start-b.start||a.end-b.end||a.family.localeCompare(b.family));const selected=[],neighborhoods=new Map(),width=Math.max(...lengths,duration/8);
 for(const c of ranked){const neighborhood=Math.floor(c.start/width);if((neighborhoods.get(neighborhood)||0)>=2)continue;if(selected.some(s=>{const intersection=Math.max(0,Math.min(c.end,s.end)-Math.max(c.start,s.start));return intersection/(c.length+s.length-intersection)>.65;}))continue;selected.push(c);neighborhoods.set(neighborhood,(neighborhoods.get(neighborhood)||0)+1);if(selected.length===8)break;}
 return {candidates:selected,poolSize:pool.length,algorithm:'coarse-region-v1',settings,bucketSeconds:.25,reason:selected.length?null:'Nothing strong found. Manual selection remains available.'};
}
