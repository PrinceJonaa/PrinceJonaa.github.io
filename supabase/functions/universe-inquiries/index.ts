import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import {createInquiryHandler} from './handler.js';
import {briefText} from '../../../assets/inquiry-core.js';

const url=Deno.env.get('SUPABASE_URL')||'';
let keys:Record<string,string>={};try{keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');}catch{}
const secret=Deno.env.get('SUPABASE_SECRET_KEY')||keys.default||Object.values(keys)[0]||'';
const salt=Deno.env.get('UNIVERSE_RATE_SALT')||'';
const mailKey=Deno.env.get('RESEND_API_KEY')||'', from=Deno.env.get('UNIVERSE_MAIL_FROM')||'';
const configured=!!url && !!secret && salt.length>=32;
const db=configured?createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async(text:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
const hmacKey=salt?await crypto.subtle.importKey('raw',new TextEncoder().encode(salt),{name:'HMAC',hash:'SHA-256'},false,['sign']):null;
const hmac=async(text:string)=>hex(await crypto.subtle.sign('HMAC',hmacKey!,new TextEncoder().encode(text)));

Deno.serve(createInquiryHandler({
 ready:async()=>{if(!db)return false;const {error}=await db.from('universe_inquiries').select('id').limit(0);return !error;},
 receive:async(value:any,key:string,request:Request)=>{
  if(!db)throw new Error('Not configured');
  // The gateway must overwrite x-real-ip. If absent, use one shared bucket;
  // never trust a client-selected X-Forwarded-For value as a rate-limit identity.
  const network=request.headers.get('x-real-ip')||'unknown';
  const day=new Date().toISOString().slice(0,10);
  const {data,error}=await db.rpc('receive_universe_inquiry',{
   p_key:key,p_fingerprint:await digest(JSON.stringify(value)),p_payload:value,
   p_ip_bucket:await hmac('ip:'+day+':'+network),p_email_bucket:await hmac('email:'+day+':'+value.replyEmail.toLowerCase()),
   p_email_state:mailKey && from?'queued':'unconfigured'
  });
  if(error){const code=error.message?.includes('IDEMPOTENCY_CONFLICT')?'IDEMPOTENCY_CONFLICT':error.message?.includes('RATE_LIMIT')?'RATE_LIMIT':'STORAGE';throw Object.assign(new Error('Storage unavailable'),{code});}
  return data;
 },
 notify:async(value:any,receipt:any)=>{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(7000),headers:{Authorization:'Bearer '+mailKey,'Content-Type':'application/json','Idempotency-Key':'universe/'+receipt.requestId},body:JSON.stringify({from,to:['contact@intervised.com'],reply_to:value.replyEmail,subject:'Prince Jona project inquiry · '+receipt.requestId,text:briefText(value)+'\n\nReceipt: '+receipt.requestId})});
  if(!response.ok)return 'failed';const data=await response.json();return typeof data.id==='string'?'sent':'failed';
 },
 recordEmail:async(id:string,state:string)=>{const {error}=await db!.from('universe_inquiries').update({email_state:state}).eq('id',id);if(error)throw new Error('State not stored');}
}));
