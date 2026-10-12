// A prepared region is looped by the audio clock; media-element seeking is not used.
export function createLoopPlayer({makeContext=()=>new (window.AudioContext||window.webkitAudioContext)(),onChange=()=>{}}={}){
 let context=null,current=null,node=null,playing=false,started=0,offset=0,pending=null,timer=null,revision=0,track=null;
 const position=()=>{finishSwap();return current?current.start+((offset+(playing?Math.max(0,context.currentTime-started):0))%current.duration+current.duration)%current.duration:0;};
 function stopNode(){if(node){try{node.stop();}catch{}node.disconnect();node=null;}if(pending?.node){try{pending.node.stop();}catch{}pending.node.disconnect();}pending=null;}
 function launch(prepared,when,at=0){const source=context.createBufferSource();source.buffer=prepared.buffer;source.loop=true;source.loopStart=0;source.loopEnd=prepared.duration;source.connect(context.destination);source.start(when,at);return source;}
 function prepareBuffer(audio){const buffer=context.createBuffer(audio.channels.length,audio.frames,audio.sampleRate);for(let c=0;c<audio.channels.length;c++)buffer.copyToChannel(audio.channels[c],c);return {buffer,start:audio.start,duration:audio.frames/audio.sampleRate,audioKey:audio.audioKey};}
 function finishSwap(){if(pending&&context.currentTime>=pending.when){node=pending.node;current=pending.prepared;started=pending.when;offset=0;pending=null;onChange();}}
 function stop(){revision++;stopNode();if(timer)clearInterval(timer);timer=null;playing=false;current=null;track=null;offset=0;const old=context;context=null;if(old)void old.close().catch(()=>{});onChange();}
 return {
  async start(sourceTrack,audio){stop();const token=revision;try{context=makeContext();await context.resume();if(token!==revision)return false;track=sourceTrack;current=prepareBuffer(audio);started=context.currentTime+.025;node=launch(current,started);offset=0;playing=true;timer=setInterval(()=>{finishSwap();onChange();},50);onChange();return true;}catch{if(token===revision)stop();return false;}},
  swap(audio){if(!context||!current)return false;finishSwap();if(pending?.node){try{pending.node.stop();}catch{}pending.node.disconnect();pending=null;}const prepared=prepareBuffer(audio);if(!playing){current=prepared;offset=0;onChange();return true;}const elapsed=Math.max(0,context.currentTime-started)+offset,remaining=current.duration-(elapsed%current.duration),when=context.currentTime+(remaining<.02?remaining+current.duration:remaining);try{node.stop(when);}catch{}pending={node:launch(prepared,when),prepared,when};onChange();return true;},
  pause(){finishSwap();if(!playing)return;offset=position()-(current?.start||0);stopNode();playing=false;onChange();},
  async resume(){if(!current||!context)return false;try{await context.resume();started=context.currentTime+.025;node=launch(current,started,offset);playing=true;onChange();return true;}catch{return false;}},
  seek(seconds){finishSwap();if(!current)return;offset=Math.max(0,Math.min(seconds-current.start,current.duration-1/current.buffer.sampleRate));stopNode();if(playing){started=context.currentTime+.025;node=launch(current,started,offset);}onChange();},
  stop,position,get playing(){return playing;},get owner(){return track;},get active(){return !!current;},get audioKey(){return pending?.prepared.audioKey||current?.audioKey;},get retainedBytes(){return current?current.buffer.length*current.buffer.numberOfChannels*4+(pending?pending.prepared.buffer.length*pending.prepared.buffer.numberOfChannels*4:0):0;}
 };
}
