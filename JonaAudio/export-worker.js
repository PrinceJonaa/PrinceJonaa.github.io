import {encodeWav} from './sample-dsp.js';
self.onmessage=({data})=>{const {exportId,signature}=data;try{const result=encodeWav(data.channels,data.sampleRate,data.maxBytes);self.postMessage({exportId,signature,type:'ready',...result},[result.buffer]);}catch(error){self.postMessage({exportId,signature,type:'error',reason:error.message});}};
