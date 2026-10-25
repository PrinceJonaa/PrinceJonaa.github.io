import {fft, rankKeys} from './engine.js';

export const PEAK_ENGINE_VERSION = 'spectral-peaks-experimental-0.1.0';
const FRAME = 4096, HOP = 2048;
const WINDOW = Float32Array.from({length:FRAME}, (_,i)=>.5-.5*Math.cos(2*Math.PI*i/(FRAME-1)));
const clamp = (x,min,max)=>Math.min(max,Math.max(min,x));
const pitchClass = midi => ((midi%12)+12)%12;

/**
 * Alternative tonal *evidence*, not an independent ML model or a calibrated key probability.
 * Unlike the original every-FFT-bin chroma, this takes interpolated local spectral peaks,
 * discounts peaks that look like overtones, and normalizes each usable frame separately.
 * The FFT and key templates are shared with the baseline: agreement is correlated evidence.
 */
export function spectralPeakProfile(samples,sampleRate,segments,{maxFrames=96}={}) {
  const totals=new Float64Array(12),frame=new Float32Array(FRAME);
  let frames=0,peaksSeen=0,weightedCents=0,centsWeight=0;
  if(!samples?.length||!Number.isFinite(sampleRate)||sampleRate<=0)
    return {chroma:null,frames:0,peaks:0,tuningCents:null,reason:'No decoded audio'};
  for(const section of segments||[]) {
    const start=clamp(Math.floor(section.start*sampleRate),0,samples.length);
    const end=clamp(Math.floor(section.end*sampleRate),start,samples.length);
    const available=Math.max(0,Math.floor((end-start-FRAME)/HOP)+1);
    if(!available)continue;
    const stride=Math.max(1,Math.ceil(available/Math.max(1,maxFrames-frames)));
    for(let pos=start;pos+FRAME<=end&&frames<maxFrames;pos+=HOP*stride) {
      for(let n=0;n<FRAME;n++)frame[n]=samples[pos+n]*WINDOW[n];
      const spectrum=fft(frame),binHz=sampleRate/FRAME;
      const first=Math.max(2,Math.ceil(70/binHz)),last=Math.min(spectrum.length-2,Math.floor(1800/binHz));
      let framePeak=0;
      for(let bin=first;bin<=last;bin++)framePeak=Math.max(framePeak,spectrum[bin]);
      if(framePeak<1e-5)continue;
      const evidence=new Float64Array(12);
      let validPeaks=0;
      for(let bin=first;bin<=last;bin++) {
        const mag=spectrum[bin];
        if(mag<framePeak*.045 || mag<=spectrum[bin-1] || mag<spectrum[bin+1])continue;
        // Parabolic interpolation on log magnitude reduces semitone mistakes near FFT-bin edges.
        const left=Math.log(Math.max(1e-9,spectrum[bin-1]));
        const center=Math.log(Math.max(1e-9,mag));
        const right=Math.log(Math.max(1e-9,spectrum[bin+1]));
        const denominator=left-2*center+right;
        const offset=Math.abs(denominator)>1e-9?clamp(.5*(left-right)/denominator,-.5,.5):0;
        const hz=(bin+offset)*binHz;
        if(hz<70||hz>1800)continue;
        const semitone=69+12*Math.log2(hz/440);
        const closest=Math.round(semitone);
        const cents=(semitone-closest)*100;
        // Narrow, but tolerant enough for ordinary detuned samples.
        if(Math.abs(cents)>47)continue;
        // Suppress harmonics that have appreciable energy at their lower fundamental.
        let harmonicPenalty=1;
        for(const harmonic of [2,3]) {
          const fundamental=hz/harmonic,k=Math.round(fundamental/binHz);
          if(fundamental>=65&&k>1&&spectrum[k]>mag*.48)harmonicPenalty*=.5;
        }
        const weight=Math.sqrt(mag/framePeak)*harmonicPenalty/Math.sqrt(Math.max(.5,hz/220));
        evidence[pitchClass(closest)]+=weight;
        weightedCents+=cents*weight;centsWeight+=weight;
        validPeaks++;peaksSeen++;
      }
      const norm=Math.hypot(...evidence);
      if(norm<1e-5||!validPeaks)continue;
      for(let pc=0;pc<12;pc++)totals[pc]+=evidence[pc]/norm;
      frames++;
    }
    if(frames>=maxFrames)break;
  }
  if(!frames)return {chroma:null,frames:0,peaks:peaksSeen,tuningCents:null,reason:'No stable spectral peaks'};
  const top=Math.max(...totals),chroma=Array.from(totals,x=>x/(top||1));
  const active=chroma.filter(v=>v>.14).length;
  return {chroma,frames,peaks:peaksSeen,activePitchClasses:active,
    tuningCents:centsWeight>0?Math.round(weightedCents/centsWeight*10)/10:null,
    reason:active<3?'Too few active pitch classes to identify a key':null};
}

export function analyzePeakKey(samples,sampleRate,segments,options={}) {
  const profile=spectralPeakProfile(samples,sampleRate,segments,options);
  if(!profile.chroma||profile.reason)return {...profile,keys:[],status:'unavailable',method:PEAK_ENGINE_VERSION};
  return {...profile,keys:rankKeys(profile.chroma).slice(0,5),status:'experimental',method:PEAK_ENGINE_VERSION};
}

export function compareKeyFamilies(primary,secondary) {
  const first=primary?.[0]?.key??null,other=secondary?.keys?.[0]?.key??null;
  if(!first||!other)return {status:'unavailable',baseline:first,peak:other,reason:'Insufficient comparable evidence'};
  const exact=first===other;
  return {status:exact?'agreement':'disagreement',baseline:first,peak:other,
    reason:exact?'Same top ranked key (not independent validation)':'Peak-filtered and baseline profiles choose different keys; review by ear'};
}
