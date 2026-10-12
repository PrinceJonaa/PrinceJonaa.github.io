import {validateInquiry, receiptIsValid} from '../../../assets/inquiry-core.js';

const allowed=new Set(['https://princejona.me','https://www.princejona.me']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function boundedBody(request) {
 const reader=request.body?.getReader();if(!reader)throw new Error('body');
 const chunks=[];let bytes=0;
 try {for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>24576){await reader.cancel();throw new Error('large');}chunks.push(value);}}
 finally {reader.releaseLock();}
 const data=new Uint8Array(bytes);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
}

export function createInquiryHandler({ready,receive,notify,recordEmail}) {
 return async request=>{
  const origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(allowed.has(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type, Idempotency-Key';}
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(!allowed.has(origin))return reply(403,{error:'Origin not allowed.'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method==='GET'){try{return reply(200,{ready:await ready()});}catch{return reply(503,{ready:false});}}
  if(request.method!=='POST')return reply(405,{error:'Use POST for an inquiry.'});
  if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return reply(415,{error:'Use JSON project inquiry fields.'});
  const key=request.headers.get('Idempotency-Key');if(!uuid.test(key||''))return reply(400,{error:'A valid retry key is required.'});
  let input;try{input=await boundedBody(request);}catch{return reply(400,{error:'Use a bounded JSON project brief.'});}
  const validation=validateInquiry(input);if(!validation.ok)return reply(400,{error:validation.error});
  try {
   const stored=await receive(validation.value,key,request);
   let receipt={requestId:stored.request_id,receivedAt:stored.received_at,state:'received',emailState:stored.email_state};
   if(!receiptIsValid(receipt))throw new Error('Invalid storage receipt');
   // A replay never generates a second mail attempt. Failed notifications can be
   // retried by the owner separately using the receipt's provider idempotency key.
   if(!stored.duplicate && receipt.emailState==='queued' && notify){
    let state='failed';try{state=await notify(validation.value,receipt);if(state!=='sent')state='failed';}catch{}
    try {await recordEmail(receipt.requestId,state);receipt.emailState=state;}catch{/* Receipt stays queued if the state write is not confirmed. */}
   }
   return reply(stored.duplicate?200:201,receipt);
  }catch(error){
   if(error.code==='RATE_LIMIT')return reply(429,{error:'Too many attempts. Retry later.'});
   if(error.code==='IDEMPOTENCY_CONFLICT')return reply(409,{error:'Retry key belongs to a different brief.'});
   return reply(503,{error:'No stored receipt confirmed. Retry the same brief.'});
  }
 };
}
