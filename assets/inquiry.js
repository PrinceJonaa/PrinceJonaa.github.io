import {inquiryConfig} from './inquiry-config.js';
import {validateInquiry, briefText, receiptIsValid} from './inquiry-core.js';

const form=document.querySelector('[data-inquiry-form]');
if (form) {
  const status=form.querySelector('[data-inquiry-status]'),error=form.querySelector('[data-inquiry-error]'),submit=form.querySelector('[data-inquiry-submit]'),email=form.querySelector('[data-email-brief]');
  const params=new URLSearchParams(location.search), service=params.get('service'), type=params.get('type');
  if ([...form.elements.serviceId.options].some(o=>o.value===service)) form.elements.serviceId.value=service;
  if ([...form.elements.inquiryType.options].some(o=>o.value===type)) form.elements.inquiryType.value=type;
  else if (service) form.elements.inquiryType.value=service==='mix-master'?'music':service==='music-video'?'video':'software';
  // Only shareable service/type choices may remain in the address. No draft data.
  const safe=new URLSearchParams();if (service && ['mix-master','music-video','web-software'].includes(service)) safe.set('service',service);if(type && ['general','music','video','software','show'].includes(type))safe.set('type',type);
  history.replaceState(history.state,'',location.pathname+(safe.size?'?'+safe:'')+location.hash);
  let pending=null, busy=false;
  function value() {
    const data=new FormData(form),serviceId=String(data.get('serviceId')||'');
    return {inquiryType:String(data.get('inquiryType')||'general'),serviceId,replyEmail:String(data.get('replyEmail')||''),projectSummary:String(data.get('projectSummary')||''),referencedUrl:String(data.get('referencedUrl')||''),consent:data.get('consent')!==null,consentVersion:inquiryConfig.consentVersion,website:String(data.get('website')||''),sourcePublicPageId:serviceId?'service:'+serviceId:'world:work'};
  }
  function showError(message){error.hidden=false;error.textContent=message;status.textContent='';}
  function checked(){if(!form.reportValidity())return null;const result=validateInquiry(value());if(!result.ok){showError(result.error);return null;}error.hidden=true;return result.value;}
  const inactive='Online submission is unavailable. Copy the brief or open an email draft to contact Intervised.';
  let ready=false;
  submit.disabled=true;status.textContent=inactive;
  if(inquiryConfig.endpoint && /^https:\/\//.test(inquiryConfig.endpoint)) {
    fetch(inquiryConfig.endpoint,{method:'GET',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000)}).then(async r=>{const health=await r.json();if(r.ok && health.ready===true){ready=true;submit.disabled=false;status.textContent='Ready to submit. Receipt appears only after the brief is stored.';}}).catch(()=>{});
  }
  form.addEventListener('input',()=>{if(!busy){pending=null;error.hidden=true;}});
  form.querySelector('[data-copy-brief]').addEventListener('click',async()=>{
    if(busy)return;
    const data=checked();if(!data)return;
    try {await navigator.clipboard.writeText(briefText(data));status.textContent='Brief copied. Paste it into your email to contact@intervised.com. Nothing has been submitted here.';}
    catch {showError('Clipboard unavailable. Use “Open email draft” or copy the fields manually.');}
  });
  email.addEventListener('click',e=>{
    if(busy){e.preventDefault();return;}
    const data=checked();if(!data){e.preventDefault();return;}
    // mailto contains a draft handed to the user's email app, never a receipt.
    email.href='mailto:'+inquiryConfig.email+'?subject='+encodeURIComponent('Project inquiry — '+(data.serviceId||data.inquiryType))+'&body='+encodeURIComponent(briefText(data));
    status.textContent='Opening an email draft. Send it from your email app; nothing has been submitted here.';
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;if(!ready){showError(inactive);return;}
    const data=checked();if(!data)return;
    const serialized=JSON.stringify(data);if(!pending||pending.serialized!==serialized)pending={serialized,key:crypto.randomUUID()};
    busy=true;submit.disabled=true;form.setAttribute('aria-busy','true');
    // Freeze this brief while acceptance is in flight. A retry preserves its key.
    const controls=[...form.elements].filter(el=>el!==submit && !el.disabled);controls.forEach(el=>el.disabled=true);
    status.textContent='Submitting… waiting for a stored receipt.';
    try {
      const response=await fetch(inquiryConfig.endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','Idempotency-Key':pending.key},body:serialized,signal:AbortSignal.timeout(15000)});
      const receipt=await response.json();
      if(!response.ok || !receiptIsValid(receipt))throw new Error(response.status===429?'Too many attempts. Wait before retrying; your brief is still here.':response.status===409?'This attempt conflicts with an earlier brief. Edit the brief before submitting again.':'No stored receipt was confirmed. Your brief is still here; retry or use the email draft.');
      status.textContent=`Inquiry received. Receipt ${receipt.requestId} · ${new Date(receipt.receivedAt).toLocaleString()}. `+({sent:'Email notification accepted by the mail provider; delivery is not confirmed.',queued:'Email notification queued.',failed:'Email notification failed; the inquiry is stored.',unconfigured:'The inquiry is stored; email notification is unavailable.'}[receipt.emailState]);
      form.reset();pending=null;
    } catch(e){showError(e.name==='TimeoutError'?'Receipt timed out. Retry the same brief to check acceptance without creating a duplicate.':e.message||'No receipt confirmed. Your brief is still here.');}
    finally {busy=false;form.removeAttribute('aria-busy');controls.forEach(el=>el.disabled=false);submit.disabled=!ready;}
  });
}
