// JonaAudio browser analyzer: estimates are descriptive, not calibrated probabilities.
export const KEYS = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const MAJOR=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR=[6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
// Cached twiddle factors and Hann windows avoid repeat trig inside each FFT frame.
const twiddleCache = new Map(), hannCache = new Map();
function twiddles(size){
 let table=twiddleCache.get(size);if(table)return table;
 const half=size>>>1,cos=new Float64Array(half),sin=new Float64Array(half);
 for(let k=0;k<half;k++){const angle=-2*Math.PI*k/size;cos[k]=Math.cos(angle);sin[k]=Math.sin(angle);}
 table={cos,sin};twiddleCache.set(size,table);return table;
}
function hann(n){let table=hannCache.get(n);if(!table){table=new Float32Array(n);for(let i=0;i<n;i++)table[i]=.5-.5*Math.cos(2*Math.PI*i/(n-1));hannCache.set(n,table);}return table;}
// Worker-side extraction scans original audio only once, preserving brief peaks.
export function extractForAnalysis(left,right,sampleRate,targetRate=11025){
 if(!left?.length||!Number.isFinite(sampleRate)||sampleRate<=0)throw Error('Invalid decoded audio');
 const stereo=Boolean(right&&right.length===left.length);
 const step=Math.max(1,Math.round(sampleRate/targetRate)),n=Math.ceil(left.length/step);
 const mono=new Float32Array(n),peaks=new Float32Array(1200);
 for(let i=0;i<left.length;i++){
  const a=left[i],b=stereo?right[i]:a,block=Math.floor(i/step);
  mono[block]+=(a+b)*.5;
  const peakIndex=Math.min(1199,Math.floor(i/left.length*1200));
  const value=Math.max(Math.abs(a),Math.abs(b));if(value>peaks[peakIndex])peaks[peakIndex]=value;
 }
 for(let i=0;i<n;i++)mono[i]/=Math.min(step,left.length-i*step);
 return {mono,peaks,sampleRate:sampleRate/step};
}
export function fft(samples) {
 const n=samples.length,real=new Float64Array(samples),imag=new Float64Array(n);
 let j=0;
 for(let i=1;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const t=real[i];real[i]=real[j];real[j]=t;}}
 for(let size=2;size<=n;size<<=1){const half=size>>1,{cos,sin}=twiddles(size);
  for(let start=0;start<n;start+=size){for(let k=0;k<half;k++){const wr=cos[k],wi=sin[k],l=start+k,r=l+half,tr=wr*real[r]-wi*imag[r],ti=wr*imag[r]+wi*real[r];real[r]=real[l]-tr;imag[r]=imag[l]-ti;real[l]+=tr;imag[l]+=ti;}}}
 const out=new Float32Array(n>>1);for(let k=0;k<out.length;k++)out[k]=Math.hypot(real[k],imag[k]);return out;
}
export function rankKeys(chroma){
 const total=chroma.reduce((a,b)=>a+b,0);if(total<0.00001)return[];
 const results=[];for(let mode=0;mode<2;mode++){const template=mode?MINOR:MAJOR;
 for(let root=0;root<12;root++){let dot=0,x=0,y=0;for(let k=0;k<12;k++){const a=chroma[(k+root)%12],b=template[k];dot+=a*b;x+=a*a;y+=b*b;}results.push({key:KEYS[root]+' '+(mode?'minor':'major'),score:dot/(Math.sqrt(x*y)||1)});}}
 return results.sort((a,b)=>b.score-a.score);
}
export function computeChroma(samples,sampleRate,segments){
 const n=4096,hop=2048,chroma=new Float64Array(12),window=new Float32Array(n),weights=hann(n);
 for(const segment of segments){const start=Math.max(0,Math.floor(segment.start*sampleRate)),end=Math.min(samples.length,Math.floor(segment.end*sampleRate));
  for(let pos=start;pos+n<=end;pos+=hop){for(let i=0;i<n;i++)window[i]=samples[pos+i]*weights[i];
   const mag=fft(window);let max=0;for(let k=30;k<Math.min(mag.length,600);k++)if(mag[k]>max)max=mag[k];if(max<0.0001)continue;
   for(let k=1;k<mag.length;k++){const hz=k*sampleRate/n;if(hz<80||hz>1600)continue;const midi=Math.round(69+12*Math.log2(hz/440));const pc=((midi%12)+12)%12;chroma[pc]+=Math.pow(mag[k]/max,1.15)/Math.sqrt(hz/110);}
  }
 }
 const max=Math.max(...chroma,1e-10);return Array.from(chroma,v=>v/max);
}
export function onsetCurve(samples,sampleRate,segment){
 const frame=1024,hop=256,start=Math.max(0,Math.floor(segment.start*sampleRate)),end=Math.min(samples.length,Math.floor(segment.end*sampleRate));
 const env=[];let last=0;
 for(let p=start;p+frame<end;p+=hop){let sum=0;for(let i=0;i<frame;i+=4){const x=samples[p+i];sum+=x*x;}const rms=Math.sqrt(sum/(frame/4));env.push(Math.max(0,rms-last));last=rms;}
 if(env.length<30)return {values:[],hop};
 const smooth=new Float32Array(env.length);for(let i=0;i<env.length;i++){let avg=0,count=0;for(let t=-9;t<=9;t++){if(i+t>=0&&i+t<env.length){avg+=env[i+t];count++;}}smooth[i]=Math.max(0,env[i]-avg/count*.48);}
 return {values:smooth,hop};
}
export function detectTempo(samples,sampleRate,segments){
 const candidates=[],perSection=[],curves=[];
 for(const seg of segments){const {values,hop}=onsetCurve(samples,sampleRate,seg);curves.push({seg,values,hop});
 const scored=[];if(values.length<30){perSection.push({start:seg.start,end:seg.end,bpm:null});continue;}
 let norm=0;for(const v of values)norm+=v*v;
 for(let bpm=55;bpm<=210;bpm++){const lag=Math.round(60*sampleRate/(hop*bpm));if(lag<2||lag>=values.length/2)continue;let sum=0;
  for(let k=lag;k<values.length;k++)sum+=values[k]*values[k-lag];
  const score=sum/(norm+1e-9);scored.push({bpm,score});}
 scored.sort((a,b)=>b.score-a.score);perSection.push({start:seg.start,end:seg.end,bpm:scored[0]?.bpm??null,score:scored[0]?.score??0});candidates.push(...scored.slice(0,25));
 }
 const pool=[];for(let bpm=55;bpm<=210;bpm++){let score=0;for(const candidate of candidates){const delta=Math.abs(candidate.bpm-bpm);if(delta<=2)score+=candidate.score*(1-delta/3);}
  // No preferred tempo band; half/double interpretation remains a musician choice.
  pool.push({bpm,score});}
 pool.sort((a,b)=>b.score-a.score);const choice=pool[0];
 const alternatives=[];for(const candidate of pool){if(!alternatives.some(v=>Math.abs(v.bpm-candidate.bpm)<4))alternatives.push(candidate);if(alternatives.length===5)break;}
 let bpm=choice?.score>0?choice.bpm:null;
 const beatMarkers=[];if(bpm){const secPerBeat=60/bpm;for(const {seg,values,hop} of curves){if(values.length<5)continue;
 let bestPhase=0,bestScore=-1;for(let phase=0;phase<32;phase++){let score=0;for(let t=phase/32*secPerBeat;t<seg.end-seg.start;t+=secPerBeat){const idx=Math.round(t*sampleRate/hop);score+=values[idx]||0;}if(score>bestScore){bestScore=score;bestPhase=phase/32*secPerBeat;}}
 for(let t=seg.start+bestPhase;t<seg.end;t+=secPerBeat)beatMarkers.push(+t.toFixed(3));}}
 return {bpm,alternatives:alternatives.map(x=>({bpm:x.bpm,score:+x.score.toFixed(3)})),sections:perSection,beats:beatMarkers};
}
export function sampleSections(duration,mode='quick'){
 const seconds=mode==='verify'?24:12,starts=[0,Math.max(0,duration*.5-seconds/2),Math.max(0,duration-seconds)];
 const found=[];for(const start of starts){const seg={start:+start.toFixed(2),end:+Math.min(duration,start+seconds).toFixed(2)};
 if(seg.end-seg.start>2&&!found.some(x=>Math.abs(x.start-seg.start)<seconds*.45))found.push(seg);}return found;
}
export function computeSpectrogram(samples,sampleRate,segment,columns=180,rows=80){
 const n=2048,start=Math.floor(segment.start*sampleRate),end=Math.min(samples.length,Math.floor(segment.end*sampleRate)),pixels=new Uint8Array(columns*rows),win=new Float32Array(n),weights=hann(n);
 for(let col=0;col<columns;col++){const pos=Math.max(0,Math.min(samples.length-n,Math.round(start+(end-start-n)*col/Math.max(1,columns-1))));
  for(let k=0;k<n;k++)win[k]=samples[pos+k]*weights[k];
  const mag=fft(win);for(let r=0;r<rows;r++){const f=40*Math.pow(135,1-r/rows),bin=Math.max(1,Math.min(mag.length-1,Math.round(f*n/sampleRate)));const a=Math.max(mag[bin-1]||0,mag[bin],mag[bin+1]||0);const db=20*Math.log10(a/(n/2)+1e-8);pixels[r*columns+col]=Math.max(0,Math.min(255,Math.round((db+90)/80*255)));}}
 return {pixels:Array.from(pixels),columns,rows,start:segment.start,end:segment.end};
}
export function computeQuality(left,right,sampleRate){
 if(!left?.length||!(sampleRate>0))return null;
 const n=left.length,stereo=Boolean(right&&right.length===n);
 let midSquared=0,energySquared=0,peak=0,nearCeiling=0,ab=0,aa=0,bb=0,lead=0,tail=0;
 const threshold=Math.pow(10,-50/20);
 for(let i=0;i<n;i++){
  const a=Number.isFinite(left[i])?left[i]:0,b=stereo?(Number.isFinite(right[i])?right[i]:0):a;
  const mid=stereo?(a+b)/2:a;
  midSquared+=mid*mid;energySquared+=stereo?(a*a+b*b)/2:a*a;
  peak=Math.max(peak,Math.abs(a),Math.abs(b));
  if(Math.abs(a)>=.999||(stereo&&Math.abs(b)>=.999))nearCeiling++;
  if(stereo){ab+=a*b;aa+=a*a;bb+=b*b;}
 }
 while(lead<n&&Math.abs(left[lead])<threshold&&(!stereo||Math.abs(right[lead])<threshold))lead++;
 while(tail<n-lead&&Math.abs(left[n-1-tail])<threshold&&(!stereo||Math.abs(right[n-1-tail])<threshold))tail++;
 const midRms=Math.sqrt(midSquared/n),energyRms=Math.sqrt(energySquared/n),toDb=v=>v>0?20*Math.log10(v):null;
 const leftRms=Math.sqrt(stereo?aa/n:energySquared/n),rightRms=stereo?Math.sqrt(bb/n):null;
 return {rmsDb:toDb(midRms),rmsDefinition:'mono sum (L+R)/2 RMS; mono uses source channel',
  monoSumRmsDb:toDb(midRms),stereoEnergyRmsDb:toDb(energyRms),
  leftRmsDb:toDb(leftRms),rightRmsDb:stereo?toDb(rightRms):null,
  samplePeakDb:toDb(peak),crestDb:peak&&energyRms?20*Math.log10(peak/energyRms):null,
  crestReference:'sample peak / channel-energy RMS',
  nearCeilingSamples:nearCeiling,nearCeilingDefinition:'sample frames where any channel reaches |0.999|; review signal, not audible clipping',
  stereoCorrelation:stereo&&aa>0&&bb>0?Math.max(-1,Math.min(1,ab/Math.sqrt(aa*bb))):null,
  stereoCorrelationReason:!stereo?'mono source':aa===0||bb===0?'one or both channels silent':null,
  leadingSilence:lead/sampleRate,trailingSilence:tail/sampleRate,channels:stereo?2:1,sampleRate,n};
}
export function analyse(mono,left,right,sampleRate,mode='quick'){
 const duration=mono.length/sampleRate,segments=sampleSections(duration,mode),tempo=detectTempo(mono,sampleRate,segments),chroma=computeChroma(mono,sampleRate,segments),keys=rankKeys(chroma),quality=computeQuality(left,right,sampleRate);
 return {duration,mode,segments,tempo,chroma,keys:keys.slice(0,5),quality,spectrogram:computeSpectrogram(mono,sampleRate,segments[0]||{start:0,end:Math.min(8,duration)})};
}