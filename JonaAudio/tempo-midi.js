// Plain Standard MIDI File format 0: tempo + time signature, no note events.
// Import into Logic explicitly; this function NEVER changes the current project.
export function makeTempoMidi(bpm,{numerator=4,denominator=4,ppq=480}={}){
 if(!Number.isFinite(bpm)||bpm<20||bpm>400)throw Error('Set a reviewed BPM between 20 and 400.');
 if(!Number.isInteger(numerator)||numerator<1||numerator>32||
   !Number.isInteger(denominator)||denominator<1||denominator>32||(denominator&(denominator-1))!==0)
  throw Error('Invalid MIDI time signature');
 if(!Number.isInteger(ppq)||ppq<24||ppq>32767)throw Error('Invalid MIDI ticks-per-quarter');
 const micros=Math.round(60000000/bpm);
 const track=[
  0x00,0xff,0x03,0x0f,...new TextEncoder().encode('JonaAudio tempo'),
  0x00,0xff,0x51,0x03,(micros>>16)&255,(micros>>8)&255,micros&255,
  0x00,0xff,0x58,0x04,numerator,Math.log2(denominator),24,8,
  0x00,0xff,0x2f,0x00
 ];
 const out=new Uint8Array(22+track.length),view=new DataView(out.buffer);
 const ascii=(offset,text)=>{for(let i=0;i<text.length;i++)out[offset+i]=text.charCodeAt(i)};
 ascii(0,'MThd');view.setUint32(4,6,false);view.setUint16(8,0,false);
 view.setUint16(10,1,false);view.setUint16(12,ppq,false);
 ascii(14,'MTrk');view.setUint32(18,track.length,false);
 out.set(track,22);
 return out;
}
export function saveTempoMidi(bytes,name='JonaAudio-tempo.mid'){
 if(!(bytes instanceof Uint8Array)||!bytes.length)throw Error('No MIDI tempo bytes');
 const url=URL.createObjectURL(new Blob([bytes],{type:'audio/midi'}));
 const link=document.createElement('a');link.href=url;link.download=name;
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
}
