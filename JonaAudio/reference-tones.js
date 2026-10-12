import {referenceFrequency} from './tuning-model.js';
export function createReferenceTones({makeContext=()=>new (window.AudioContext||window.webkitAudioContext)(),onState=()=>{}}={}){
 let context=null,revision=0;const voices=new Set();
 function stop(){revision++;for(const voice of voices){try{voice.osc.stop();}catch{}voice.osc.disconnect();voice.gain.disconnect();}voices.clear();const old=context;context=null;if(old)void old.close().catch(()=>{});onState(false,null);}
 async function play(midis,referenceHz){
  stop();if(!midis.length)return false;const token=revision;let ctx;
  try{ctx=makeContext();context=ctx;await ctx.resume();if(token!==revision)return false;
   const frequencies=midis.map(midi=>referenceFrequency(midi,referenceHz));if(frequencies.some(f=>!Number.isFinite(f)||f<20||f>=Math.min(20000,ctx.sampleRate/2))){stop();return false;}
   const start=ctx.currentTime+.025,spacing=midis.length===1?0:.3;
   for(let i=0;i<frequencies.length;i++){
    const osc=ctx.createOscillator(),gain=ctx.createGain(),voice={osc,gain};voices.add(voice);const when=start+i*spacing,duration=midis.length===1?.6:.24;
    osc.type='sine';osc.frequency.value=frequencies[i];gain.gain.setValueAtTime(.001,when);gain.gain.exponentialRampToValueAtTime(.12,when+.015);gain.gain.exponentialRampToValueAtTime(.001,when+duration);
    osc.connect(gain);gain.connect(ctx.destination);osc.onended=()=>{voices.delete(voice);osc.disconnect();gain.disconnect();if(!voices.size&&token===revision){const old=context;context=null;if(old)void old.close().catch(()=>{});onState(false,null);}};
    osc.start(when);osc.stop(when+duration+.01);
   }
   onState(true,midis.length===1?midis[0]:null);return true;
  }catch{if(token===revision)stop();return false;}
 }
 return {play,stop,get running(){return voices.size>0;}};
}
