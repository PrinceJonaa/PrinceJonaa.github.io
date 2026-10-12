const filters=new Map();
export function resample(samples,sourceRate,targetRate=11025){
 if(sourceRate<=targetRate)return {samples,sampleRate:sourceRate};
 const ratio=sourceRate/targetRate,phases=64,taps=32,cutoff=.45/ratio,key=sourceRate+':'+targetRate;
 let bank=filters.get(key);
 if(!bank){bank=[];for(let phase=0;phase<phases;phase++){const coeff=new Float64Array(taps);let sum=0;for(let j=0;j<taps;j++){const x=j-(taps/2-1)-phase/phases;const sinc=x===0?2*cutoff:Math.sin(2*Math.PI*cutoff*x)/(Math.PI*x);const window=.5+.5*Math.cos(Math.PI*x/(taps/2));coeff[j]=Math.abs(x)<taps/2?sinc*window:0;sum+=coeff[j];}for(let j=0;j<taps;j++)coeff[j]/=sum;bank.push(coeff);}filters.set(key,bank);}
 const output=new Float32Array(Math.floor(samples.length/ratio));
 for(let i=0;i<output.length;i++){const position=i*ratio,center=Math.floor(position),coeff=bank[Math.min(phases-1,Math.round((position-center)*phases))];let value=0;for(let j=0;j<taps;j++)value+=(samples[Math.max(0,Math.min(samples.length-1,center+j-(taps/2-1)))]||0)*coeff[j];output[i]=value;}
 return {samples:output,sampleRate:targetRate};
}
