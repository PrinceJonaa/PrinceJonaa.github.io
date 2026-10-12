// One source owner; switching views never invokes this service's source switch.
export function createAudioService(audio, {onChange=()=>{}, onError=()=>{}}={}) {
  let owner=null, revision=0;const companions=new Set();const stopCompanions=()=>{for(const stop of companions)stop();};
  audio.addEventListener('pause',stopCompanions);
  const remember=()=>{if(owner){owner.playback.position=Number.isFinite(audio.currentTime)?audio.currentTime:0;owner.playback.rate=audio.playbackRate;}onChange(owner);};
  for(const event of ['timeupdate','play','pause','ended','ratechange'])audio.addEventListener(event,remember);
  audio.addEventListener('error',()=>onError('This browser cannot play that format. Try WAV, MP3 or M4A.'));
  function select(track) {
    if(owner===track)return;
    stopCompanions();audio.pause();remember();owner=track;const rev=++revision;
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
    async toggle(){if(!owner)return;try {if(audio.paused)await audio.play();else audio.pause();}catch {onError('Playback paused — tap to resume, or try another format.');}},
    pause(){stopCompanions();audio.pause();},
    seek(seconds){if(!owner||!Number.isFinite(seconds))return;audio.currentTime=Math.max(0,Math.min(seconds,owner.duration||audio.duration||0));remember();},
    setRate(rate){if(Number.isFinite(rate)&&rate>0)audio.playbackRate=rate;},
    stop(){stopCompanions();audio.pause();if(owner)this.seek(0);},
    clear(){select(null);}
  };
}
