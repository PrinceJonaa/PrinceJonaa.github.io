import {rankKeys} from './engine.js';
import {setupFromKey} from './tuning-model.js';

// Ensemble of correlated *representations*, not an independently trained classifier.
// The measured guitar corpus must not be used to tune these weights.
export const KEY_FUSION_VERSION='equal-chroma-key-review-v0.1.0';
export function fuseKeyProfiles(baseChroma,peakChroma){
 if(!Array.isArray(baseChroma)||!Array.isArray(peakChroma)||
    baseChroma.length!==12||peakChroma.length!==12||
    !baseChroma.every(x=>Number.isFinite(x)&&x>=0)||
    !peakChroma.every(x=>Number.isFinite(x)&&x>=0)||
    Math.max(...baseChroma)<=0||Math.max(...peakChroma)<=0)
  return {status:'unavailable',keys:[],reason:'Both tonal profiles are required'};

 // Keep the evidence families equal and normalize each before averaging.
 // No weights or priors were learned from the eight GuitarSet samples.
 const norm=p=>Math.sqrt(p.reduce((s,x)=>s+x*x,0));
 const bn=norm(baseChroma),pn=norm(peakChroma);
 const chroma=baseChroma.map((v,i)=>.5*v/bn+.5*peakChroma[i]/pn);
 const keys=rankKeys(chroma).slice(0,5);
 const a=rankKeys(baseChroma)[0]?.key,b=rankKeys(peakChroma)[0]?.key;
 const aScale=setupFromKey(a),bScale=setupFromKey(b);
 const sameMask=Boolean(aScale&&bScale&&
   aScale.allowedPitchClasses.every(pc=>bScale.allowedPitchClasses.includes(pc)));
 return {status:'review',method:KEY_FUSION_VERSION,keys,chroma,
  originalTop:a,peakTop:b,relation:a===b?'exact-key':
   sameMask?'same-scale-different-tonic':'different-scale-notes',
  scores:'uncalibrated, shared FFT/key templates; never auto-apply to tuner',
  primaryKeyUnchanged:true};
}
