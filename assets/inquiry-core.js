export const consentVersion = '2026-10-12';
const types = new Set(['general','music','video','software','show']);
const services = new Set(['','mix-master','music-video','web-software']);
const sources = new Set(['world:work','service:mix-master','service:music-video','service:web-software']);
const fields = new Set(['inquiryType','serviceId','replyEmail','projectSummary','referencedUrl','consent','consentVersion','website','sourcePublicPageId']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateInquiry(input) {
  const fail = error=>({ok:false,error});
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k=>!fields.has(k))) return fail('Use the project inquiry fields.');
  for (const k of ['inquiryType','serviceId','replyEmail','projectSummary','referencedUrl','consentVersion','website','sourcePublicPageId']) if (typeof input[k] !== 'string') return fail('Complete the project inquiry fields.');
  if (input.website) return fail('Unable to accept this inquiry.');
  if (!types.has(input.inquiryType) || !services.has(input.serviceId) || !sources.has(input.sourcePublicPageId)) return fail('Choose a listed inquiry type and service.');
  const email=input.replyEmail.trim(), summary=input.projectSummary.trim();
  if (email.length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || /[\r\n]/.test(email)) return fail('Enter a valid reply email.');
  if (summary.length<20 || summary.length>4000) return fail('Describe the project in 20–4,000 characters.');
  if (input.referencedUrl.length>1000) return fail('Use a shorter public reference link.');
  if (input.referencedUrl.trim()) {
    try {
      const url=new URL(input.referencedUrl.trim());
      const sensitive=[...url.searchParams].some(([name,value])=>/(?:email|token|key|password|secret|credential|auth)/i.test(name) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value));
      if(url.protocol!=='https:' || url.username || url.password || url.hash || sensitive) return fail('Use a public HTTPS reference without credentials, fragments or personal query data.');
    }
    catch {return fail('Enter a valid public HTTPS reference link.');}
  }
  if (input.consent!==true || input.consentVersion!==consentVersion) return fail('Agree to use your email and project brief to respond.');
  return {ok:true,value:{...input,replyEmail:email,projectSummary:summary,referencedUrl:input.referencedUrl.trim()}};
}

export function briefText(value) {
  return ['Project inquiry — Prince Jona / Intervised','',`Type: ${value.inquiryType}`,`Service: ${value.serviceId || 'General / collaboration'}`,`Reply email: ${value.replyEmail}`,'',value.projectSummary, value.referencedUrl ? `\nReference: ${value.referencedUrl}` : '',`\nConsent: reply to this inquiry (${consentVersion}).`].filter(x=>x!==null).join('\n');
}

export function receiptIsValid(value) {
  return !!value && uuid.test(value.requestId || '') && /^\d{4}-\d{2}-\d{2}T/.test(value.receivedAt || '') && Number.isFinite(Date.parse(value.receivedAt)) && value.state==='received' && ['queued','sent','failed','unconfigured'].includes(value.emailState);
}
