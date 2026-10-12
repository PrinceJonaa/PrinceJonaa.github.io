// One source owner; switching views never invokes this service's source switch.
export function createAudioService(audio, {onChange=()=>{}, onError=()=>{}}={}) {
  let owner=null, revision=0,rangeEnd=null,loopBackend=null,loopRelease=null;const companions=new Set();const stopCompanions=()=>{for(const stop of companions)stop();};
  audio.addEventListener('pause',stopCompanions);audio.addEventListener('play',stopCompanions);
  audio.addEventListener('timeupdate',()=>{if(rangeEnd!=null&&audio.currentTime>=rangeEnd){rangeEnd=null;audio.pause();}});
  function deactivateLoop(){if(!loopBackend)return;const backend=loopBackend,release=loopRelease,position=backend.position(),source=backend.owner;loopBackend=null;loopRelease=null;if(source)source.playback.position=position;backend.stop();if(owner===source&&Number.isFinite(audio.duration))audio.currentTime=Math.min(position,audio.duration);release?.();onChange(owner);}
  const remember=()=>{if(owner){owner.playback.position=Number.isFinite(audio.currentTime)?audio.currentTime:0;owner.playback.rate=audio.playbackRate;}onChange(loopBackend?.owner||owner);};
  for(const event of ['timeupdate','play','pause','ended','ratechange'])audio.addEventListener(event,remember);
  audio.addEventListener('error',()=>onError('This browser cannot play that format. Try WAV, MP3 or M4A.'));
  function select(track) {
    if(loopBackend)deactivateLoop();if(owner===track)return;
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
    select,registerCompanion(stop){companions.add(stop);return ()=>companions.delete(stop);},stopCompanions, get owner(){return loopBackend?.owner||owner;},get position(){return loopBackend?.active?loopBackend.position():audio.currentTime||0;},get playing(){return loopBackend?.active?loopBackend.playing:!audio.paused;},get isLoop(){return !!loopBackend?.active;},activateLoop(backend,release){if(loopBackend&&loopBackend!==backend)deactivateLoop();audio.pause();stopCompanions();loopBackend=backend;loopRelease=release;onChange(backend.owner||owner);},releaseLoop(backend){if(loopBackend===backend)deactivateLoop();},notifyLoop(){if(loopBackend)onChange(loopBackend.owner,'loop');},
    async audition(track,{start=0,end=null}={}){
      deactivateLoop();stopCompanions();audio.pause();select(track);const token=revision;
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
    async toggle(){if(loopBackend?.active){stopCompanions();if(loopBackend.playing)loopBackend.pause();else await loopBackend.resume();return;}if(!owner)return;try {if(audio.paused)await audio.play();else audio.pause();}catch {onError('Playback paused — tap to resume, or try another format.');}},
    pause(){stopCompanions();if(loopBackend?.active)loopBackend.pause();audio.pause();},
    setListeningAttenuation(gain){audio.volume=Math.max(0,Math.min(1,Number.isFinite(gain)?gain:1));},get listeningAttenuation(){return audio.volume;},seek(seconds){if(loopBackend?.active){loopBackend.seek(seconds);return;}if(!owner||!Number.isFinite(seconds))return;audio.currentTime=Math.max(0,Math.min(seconds,owner.duration||audio.duration||0));remember();},
    setRate(rate){if(loopBackend?.active)return;if(Number.isFinite(rate)&&rate>0)audio.playbackRate=rate;},
    stop(){deactivateLoop();rangeEnd=null;stopCompanions();audio.pause();if(owner)this.seek(0);},
    clear(){select(null);}
  };
}
