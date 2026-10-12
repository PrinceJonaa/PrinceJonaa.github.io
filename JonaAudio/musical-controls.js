export function parseBpm(text){const raw=String(text).trim();if(!/^\d+(\.\d{1,2})?$/.test(raw))return null;const bpm=Number(raw);return bpm>=25&&bpm<=400?bpm:null;}
export function tempoMultiple(bpm,factor){const value=Number.isFinite(bpm)?Math.round(bpm*factor*100)/100:null;return value!=null&&value>=25&&value<=400?value:null;}
export function createTapTempo(){let last=null,intervals=[];return {reset(){last=null;intervals=[];},tap(now){if(last==null||now-last>=3000){last=now;intervals=[];return {bpm:null,taps:1,message:'Keep tapping'};}const delta=now-last;last=now;if(delta<150||delta>2400||!Number.isFinite(delta))return {bpm:null,taps:intervals.length+1,message:'Keep tapping · use a steady pulse'};intervals.push(delta);if(intervals.length>8)intervals.shift();if(intervals.length<3)return {bpm:null,taps:intervals.length+1,message:'Keep tapping'};const sorted=[...intervals].sort((a,b)=>a-b),i=Math.floor(sorted.length/2),median=sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2;return {bpm:Math.round(60000/median*100)/100,taps:intervals.length+1,message:'Tap tempo'};}};}
export function summaryText(track,values){return `${track.name} — ${values.bpm??'unavailable'} BPM — ${values.key??'key unavailable'} — BPM source: ${values.bpmSource}; key source: ${values.keySource} — scope: ${values.scope}`;}
export function createMetronome({makeContext=()=>new (window.AudioContext||window.webkitAudioContext)(),onState=()=>{}}={}){
 let context=null,timer=null,revision=0;const nodes=new Set();
 function stop(){revision++;if(timer)clearInterval(timer);timer=null;for(const osc of nodes){try{osc.stop();}catch{}osc.disconnect();}nodes.clear();const old=context;context=null;if(old)void old.close().catch(()=>{});onState(false);}
 return {stop,get running(){return !!timer;},async start({bpm,phaseMs=0,count=4}){
  stop();if(!Number.isFinite(bpm)||bpm<25||bpm>400||!Number.isFinite(phaseMs)||Math.abs(phaseMs)>1000||!Number.isInteger(count)||count<1||count>12)return false;
  const token=revision;let ctx;try{ctx=makeContext();context=ctx;await ctx.resume();}catch{if(token===revision)stop();return false;}if(token!==revision)return false;
  const period=60/bpm,phase=((phaseMs/1000)%period+period)%period;let next=ctx.currentTime+.03+phase,beat=0;count=Math.max(1,Math.min(12,Math.round(count)));
  const schedule=()=>{if(next<ctx.currentTime-.05)next=ctx.currentTime+.03;while(next<ctx.currentTime+.1){const osc=ctx.createOscillator(),gain=ctx.createGain();nodes.add(osc);osc.frequency.value=beat%count===0?1100:800;gain.gain.setValueAtTime(.12,next);gain.gain.exponentialRampToValueAtTime(.001,next+.035);osc.connect(gain);gain.connect(ctx.destination);osc.onended=()=>{nodes.delete(osc);osc.disconnect();gain.disconnect();};osc.start(next);osc.stop(next+.04);next+=period;beat++;}};
  schedule();timer=setInterval(schedule,25);onState(true);return true;
 }};
}
