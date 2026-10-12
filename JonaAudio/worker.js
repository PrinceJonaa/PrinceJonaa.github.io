import {sampleSections,detectTempo,computeChroma,rankKeys,computeSpectrogram,computeQuality,extractForAnalysis} from './engine.js';
self.onmessage=({data})=>{
 try{
  const {id,left,right,sampleRate,mode}=data;
  const extracted=extractForAnalysis(left,right,sampleRate);
  self.postMessage({id,phase:'wave',peaks:extracted.peaks},[extracted.peaks.buffer]);
  const quality=computeQuality(left,right,sampleRate);
  const {mono}=extracted, rate=extracted.sampleRate;
  const segments=sampleSections(mono.length/rate,mode);
  const tempo=detectTempo(mono,rate,segments);
  const chroma=computeChroma(mono,rate,segments);
  const keys=rankKeys(chroma).slice(0,5);
  const spectrogram=computeSpectrogram(mono,rate,segments[0]||{start:0,end:Math.min(8,mono.length/rate)});
  self.postMessage({id,phase:'complete',result:{tempo,chroma,keys,spectrogram,quality,segments,mode}});
 }catch(error){self.postMessage({id,phase:'error',error:error?.message||'Analysis failed'});}
};
