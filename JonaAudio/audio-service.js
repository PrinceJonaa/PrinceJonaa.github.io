// One source owner; switching views never invokes this service's source switch.
export function createAudioService(audio, {onChange=()=>{}, onError=()=>{}}={}) {
  let owner=null, revision=0,rangeEnd=null;const companions=new Set();const stopCompanions=()=>{for(const stop of companions)stop();};
  audio.addEventListener('pause',stopCompanions);audio.addEventListener('play',stopCompanions);
  audio.addEventListener('timeupdate',()=>{if(rangeEnd!=null&&audio.currentTime>=rangeEnd){rangeEnd=null;audio.pause();}});
  const remember=()=>{if(owner){owner.playback.position=Number.isFinite(audio.currentTime)?audio.currentTime:0;owner.playback.rate=audio.playbackRate;}onChange(owner);};
  for(const event of ['timeupdate','play','pause','ended','ratechange'])audio.addEventListener(event,remember);
  audio.addEventListener('error',()=>onError('This browser cannot play that format. Try WAV, MP3 or M4A.'));
  function select(track) {
    if(owner===track)return;
    rangeEnd=null;stopCompanions();audio.pause();remember();owner=track;const rev=++revision;
    audio.onloadedmetadata=()=>{
      if(rev!==revision||owner!==track||!track)return;
      track.duration=Number.isFinite(audio.duration)?audio.duration:track.duration;
      audio.currentTime=Math.min(track.playback.position||0,track.duration||0);
      audio.playbackRate=track.playback.rate||1;onChange(track,'metadata');
    };
    if(track)audio.src=track.url;else audio.removeAttribute('src');
    audio.load();onChange(owner);
  }
  return {
    select,registerCompanion(stop){companions.add(stop);return ()=>companions.delete(stop);},stopCompanions, get owner(){return owner;},
    async audition(track,{start=0,end=null}={}){
      stopCompanions();audio.pause();select(track);const token=revision;
      try{
        if(!Number.isFinite(audio.duration)||audio.readyState<1)await new Promise((resolve,reject)=>{
          const cleanup=()=>{clearTimeout(timer);audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',failed);};
          const ready=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(new Error('Metadata unavailable'));};
          const timer=setTimeout(failed,4000);audio.addEventListener('loadedmetadata',ready);audio.addEventListener('error',failed);
        });
        if(token!==revision||owner!==track)return false;
        audio.currentTime=Math.max(0,Math.min(start,track.duration||audio.duration||0));rangeEnd=Number.isFinite(end)?Math.min(end,track.duration||audio.duration):null;audio.playbackRate=1;
        await audio.play();remember();return true;
      }catch{if(token===revision)onError('Playback paused — tap the player to resume, or choose another source.');return false;}
    },
    async toggle(){if(!owner)return;try {if(audio.paused)await audio.play();else audio.pause();}catch {onError('Playback paused — tap to resume, or try another format.');}},
    pause(){stopCompanions();audio.pause();},
    seek(seconds){if(!owner||!Number.isFinite(seconds))return;audio.currentTime=Math.max(0,Math.min(seconds,owner.duration||audio.duration||0));remember();},
    setRate(rate){if(Number.isFinite(rate)&&rate>0)audio.playbackRate=rate;},
    stop(){rangeEnd=null;stopCompanions();audio.pause();if(owner)this.seek(0);},
    clear(){select(null);}
  };
}
