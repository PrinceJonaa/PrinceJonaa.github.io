import {sampleSections,detectTempo,computeChroma,rankKeys,computeSpectrogram} from './engine.js';
self.onmessage=({data})=>{
 try{
  const {id,mono,sampleRate,mode,quality}=data;
  const segments=sampleSections(mono.length/sampleRate,mode);
  const tempo=detectTempo(mono,sampleRate,segments);
  const chroma=computeChroma(mono,sampleRate,segments);
  const keys=rankKeys(chroma).slice(0,5);
  const spectrogram=computeSpectrogram(mono,sampleRate,segments[0]||{start:0,end:Math.min(8,mono.length/sampleRate)});
  self.postMessage({id,result:{tempo,chroma,keys,spectrogram,quality,segments,mode}});
 }catch(error){self.postMessage({id,error:error?.message||'Analysis failed'});}
};