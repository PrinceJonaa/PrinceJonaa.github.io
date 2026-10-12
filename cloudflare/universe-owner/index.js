const TEAM='https://jbonner.cloudflareaccess.com';
const AUD='36506af8a602d7150b9d552a8f4ad7ae5589e51d2f99e22c36dd4e74fa605665';
const HOST='https://princejona-universe-owner.jbonner.workers.dev';
const SAFE={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(),microphone=(),geolocation=()'};
const answer=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...SAFE,'Content-Type':'application/json'}});
const deny=(status=403,error='Not authorized')=>answer({error},status);
const unb64=s=>atob(s.replace(/-/g,'+').replace(/_/g,'/'));
async function principal(request,db){
 const jwt=request.headers.get('Cf-Access-Jwt-Assertion');if(!jwt||jwt.length>8192)return null;
 const parts=jwt.split('.');if(parts.length!==3)return null;
 try{
  const h=JSON.parse(unb64(parts[0])),p=JSON.parse(unb64(parts[1]));
  if(h.alg!=='RS256'||!h.kid||p.iss!==TEAM||!Array.isArray(p.aud)||!p.aud.includes(AUD)||typeof p.email!=='string')return null;
  const now=Date.now()/1000;if(!(p.exp>now&&p.nbf<=now&&p.iat<=now+60))return null;
  const response=await fetch(TEAM+'/cdn-cgi/access/certs',{cf:{cacheTtl:1800,cacheEverything:true}});
  if(!response.ok)return null;const keys=(await response.json()).keys||[];
  const jwk=keys.find(k=>k.kid===h.kid&&k.kty==='RSA');if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(unb64(parts[2]),c=>c.charCodeAt(0));
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes,new TextEncoder().encode(parts[0]+'.'+parts[1])))return null;
  const email=p.email.toLowerCase(),row=await db.prepare('SELECT role FROM principals WHERE email=? AND active=1').bind(email).first();
  return row?{email,role:row.role}:null;
 }catch{return null;}
}
const validId=x=>typeof x==='string'&&/^(article|relation|world|update|caseStudy):[a-z0-9][a-z0-9-]{1,60}$/.test(x);
async function audit(db,actor,action,id,info={}){await db.prepare('INSERT INTO audit_events(id,actor,action,target_id,details) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,id,JSON.stringify(info)).run();}
function normalize(x){
 if(!validId(x.id)||x.id.split(':')[0]!==x.kind)throw Error('Typed ID/kind mismatch');
 for(const [key,max]of [['title',160],['summary',700],['body',10000]])if(typeof x[key]!=='string'||!x[key].trim()||x[key].length>max)throw Error('Invalid '+key);
 if(!['verifiedPrimary','sourcedSecondary','authoredInterpretation','hypothesis','pendingReview'].includes(x.evidenceClass))throw Error('Evidence class required');
 if(!Array.isArray(x.sourceRefs)||x.sourceRefs.length>8||x.sourceRefs.some(url=>typeof url!=='string'||url.length>500||!/^https:\/\/[^\s]+$/.test(url)))throw Error('Invalid public source link');
 return {id:x.id,kind:x.kind,title:x.title.trim(),summary:x.summary.trim(),body:x.body.trim(),refs:JSON.stringify(x.sourceRefs),evidence:x.evidenceClass,revision:String(x.sourceRevision||'').slice(0,120)};
}
async function respond(req,env){
 const user=await principal(req,env.DB);if(!user)return deny(401,'Verified owner identity required');
 const url=new URL(req.url),path=url.pathname;
 if(req.method==='GET'&&path==='/')return new Response(HTML,{headers:{...SAFE,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
 if(req.method==='GET'&&path==='/app.js')return new Response(APP_JS,{headers:{...SAFE,'Content-Type':'text/javascript; charset=utf-8'}});
 if(!path.startsWith('/api/'))return deny(404,'Not found');
 if(req.method==='POST'&&(req.headers.get('Origin')!==HOST||req.headers.get('X-Universe-Action')!=='1'||!/^application\/json/.test(req.headers.get('Content-Type')||'')||Number(req.headers.get('Content-Length')||0)>18000))return deny(403,'Invalid request origin/shape');
 try{
  if(req.method==='GET'&&path==='/api/overview'){
   const [count,review]=await Promise.all([env.DB.prepare('SELECT COUNT(*) n FROM editorial_items').first(),env.DB.prepare("SELECT COUNT(*) n FROM editorial_items WHERE state='review'").first()]);
   return answer({principal:user,items:count.n,reviewCount:review.n,inquiryTransport:'not connected',analytics:'disabled'});
  }
  if(req.method==='GET'&&path==='/api/items')return answer({items:(await env.DB.prepare('SELECT * FROM editorial_items ORDER BY updated_at DESC LIMIT 60').all()).results});
  if(req.method==='GET'&&path==='/api/audit')return answer({events:(await env.DB.prepare('SELECT actor,action,target_id,created_at FROM audit_events ORDER BY created_at DESC LIMIT 80').all()).results});
  if(req.method==='GET'&&path==='/api/proposals')return answer({items:(await env.DB.prepare('SELECT id,title,state FROM agent_proposals ORDER BY created_at DESC LIMIT 30').all()).results});
  if(req.method==='GET'&&path==='/api/export'){
   const item=await env.DB.prepare("SELECT * FROM editorial_items WHERE id=? AND state='approved'").bind(url.searchParams.get('id')).first();
   if(!item)return deny(404,'Approval required before export');await audit(env.DB,user.email,'snapshot_exported',item.id,{revision:item.revision});
   return answer({schema:1,publicationStatus:'approved_not_deployed',publicExportReady:false,item});
  }
  if(req.method==='POST'&&path==='/api/items'){
   if(!['owner','editor'].includes(user.role))return deny();
   const x=await req.json(),v=normalize(x),n=Number(x.expectedRevision);
   if(!Number.isSafeInteger(n)||n<0)return deny(422,'Expected revision required');
   const prev=await env.DB.prepare('SELECT revision,state FROM editorial_items WHERE id=?').bind(v.id).first();
   if(!prev&&n!==0||prev&&(prev.revision!==n||prev.state==='approved'))return deny(409,'Revision conflict, or approved content must be withdrawn first');
   if(!prev)await env.DB.prepare('INSERT INTO editorial_items(id,kind,title,body,summary,source_refs,evidence_class,source_revision,updated_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(v.id,v.kind,v.title,v.body,v.summary,v.refs,v.evidence,v.revision,user.email).run();
   else{const result=await env.DB.prepare("UPDATE editorial_items SET title=?,body=?,summary=?,source_refs=?,evidence_class=?,source_revision=?,updated_by=?,revision=revision+1,state='draft',updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?").bind(v.title,v.body,v.summary,v.refs,v.evidence,v.revision,user.email,v.id,n).run();if(!result.meta.changes)return deny(409,'Stale revision');}
   const item=await env.DB.prepare('SELECT * FROM editorial_items WHERE id=?').bind(v.id).first();
   await env.DB.prepare('INSERT INTO editorial_history(item_id,revision,data,actor,action) VALUES(?,?,?,?,?)').bind(v.id,item.revision,JSON.stringify(item),user.email,'draft_saved').run();
   await audit(env.DB,user.email,'draft_saved',v.id,{revision:item.revision});return answer({id:v.id,revision:item.revision,state:'draft'},201);
  }
  if(req.method==='POST'&&path==='/api/transition'){
   const x=await req.json(),steps={submit:['draft','review'],approve:['review','approved'],withdraw:['approved','withdrawn']};
   if(!validId(x.id)||!Number.isSafeInteger(x.expectedRevision)||!steps[x.action])return deny(422,'Invalid transition');
   if(x.action!=='submit'&&user.role!=='owner'||x.action==='submit'&&!['editor','owner'].includes(user.role))return deny();
   const [before,after]=steps[x.action];
   const result=await env.DB.prepare('UPDATE editorial_items SET state=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP,approved_by=CASE WHEN ?=\'approved\' THEN ? ELSE approved_by END,approved_at=CASE WHEN ?=\'approved\' THEN CURRENT_TIMESTAMP ELSE approved_at END WHERE id=? AND revision=? AND state=?').bind(after,after,user.email,after,x.id,x.expectedRevision,before).run();
   if(!result.meta.changes)return deny(409,'State/revision conflict');
   const item=await env.DB.prepare('SELECT * FROM editorial_items WHERE id=?').bind(x.id).first();
   await env.DB.prepare('INSERT INTO editorial_history(item_id,revision,data,actor,action) VALUES(?,?,?,?,?)').bind(x.id,item.revision,JSON.stringify(item),user.email,x.action).run();
   await audit(env.DB,user.email,x.action,x.id,{revision:item.revision,state:after});return answer({id:x.id,state:after,revision:item.revision});
  }
  return deny(404,'Unknown route');
 }catch(error){return deny(error instanceof SyntaxError?422:500,error instanceof SyntaxError?'Invalid JSON':'Request failed; review the submitted data or service state');}
}
const HTML="<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>Prince Jona Universe — Owner Console</title><style>\n:root{color-scheme:dark}body{margin:0 auto;max-width:1100px;padding:clamp(1rem,4vw,3rem);font:16px/1.5 system-ui;background:#0c0b17;color:#efe8f8}h1{font-size:clamp(2rem,5vw,3.7rem);margin:.3rem 0}h2{margin:.3rem 0}a{color:#e5c0ed}section{border:1px solid #59496d;background:#171527;border-radius:1rem;margin:1.2rem 0;padding:1.3rem}nav{display:flex;flex-wrap:wrap;gap:1.4rem;margin:2rem 0}.meta{color:#bcb2d0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:1rem}.grid section{margin:0}label{display:block;margin:.8rem 0}input,textarea,select,button{box-sizing:border-box;font:inherit;border:1px solid #a58db5;color:#fff;background:#272039;border-radius:.5rem;padding:.65rem}input,textarea,select{display:block;width:100%}textarea{min-height:90px}button{cursor:pointer;min-height:44px;margin:.25rem}.item{padding:1rem 0;border-bottom:1px solid #514361}.item p{margin:.3rem 0}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #ffdfec;outline-offset:3px}#status{min-height:2rem}small{color:#c2b1d0}pre{white-space:pre-wrap;word-break:break-word}</style><main>\n<p class=\"meta\">PRIVATE / PRINCE JONA UNIVERSE / REVIEW BEFORE RELEASE</p><h1>Universe Control</h1><p>Protected by Cloudflare Access and verified signed identity. Approving content here does not silently publish the GitHub Pages site.</p>\n<nav><a href=\"https://princejona.me/atlas/\">Public Atlas ↗</a><a href=\"https://princejona.me/operations/\">Public operations ↗</a><a href=\"https://github.com/PrinceJonaa/PrinceJonaa.github.io\">Source repository ↗</a></nav>\n<p role=\"status\" aria-live=\"polite\" id=\"status\">Checking authorization…</p>\n<div class=\"grid\"><section><h2>Overview</h2><p id=\"overview\">Loading…</p></section><section><h2>Inquiry inbox</h2><p id=\"inquiries\">Private intake is not connected; no fabricated receipts.</p></section><section><h2>Releases</h2><p>GitHub release evidence remains the publishing source. No unverified deployed claims.</p></section><section><h2>Analytics</h2><p>Disabled. No visitor telemetry is collected by this console.</p></section></div>\n<section><h2>Editorial drafts & Atlas review</h2><p>Revision-checked stages: draft → review → approved for GitHub export. Withdrawal is recorded; deploy must happen separately.</p>\n<form id=\"editor\"><label>Stable typed ID<input name=\"id\" required placeholder=\"article:example-public-concept\" pattern=\"(article|relation|world|update|caseStudy):[a-z0-9-]+\"></label><label>Kind<select name=\"kind\"><option>article</option><option>relation</option><option>world</option><option>update</option><option>caseStudy</option></select></label><label>Title<input name=\"title\" maxlength=\"160\" required></label><label>Summary<textarea name=\"summary\" maxlength=\"700\" required></textarea></label><label>Body<textarea name=\"body\" maxlength=\"10000\" required></textarea></label><label>Evidence class<select name=\"evidenceClass\"><option>authoredInterpretation</option><option>sourcedSecondary</option><option>verifiedPrimary</option><option>hypothesis</option><option>pendingReview</option></select></label><label>Evidence URLs, one per line<textarea name=\"sourceRefs\"></textarea></label><label>Source revision<input name=\"sourceRevision\"></label><label>Expected revision (0 for new)<input name=\"expectedRevision\" type=\"number\" value=\"0\" min=\"0\" required></label><button type=\"submit\">Save private draft</button></form>\n<h3>Private editorial items</h3><div id=\"items\"></div></section>\n<section><h2>Agent proposals</h2><p>No agent can execute automatically. A reviewed proposal is still not permission to act on an external system.</p><div id=\"proposals\"></div></section>\n<section><h2>Audit</h2><pre id=\"audit\">Loading…</pre></section></main><script src=\"/app.js\" defer></script></html>";
const APP_JS="const $=s=>document.querySelector(s),status=s=>$('#status').textContent=s;\nasync function api(p,opts={}){const r=await fetch('/api/'+p,{credentials:'same-origin',...opts,headers:{'Content-Type':'application/json','X-Universe-Action':'1',...(opts.headers||{})}});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');return j;}\nasync function run(item,action){try{if(action==='edit'){const form=$('#editor');const values={id:item.id,kind:item.kind,title:item.title,summary:item.summary,body:item.body,evidenceClass:item.evidence_class,sourceRefs:JSON.parse(item.source_refs||'[]').join('\\n'),sourceRevision:item.source_revision||'',expectedRevision:item.revision};for(const [k,v]of Object.entries(values))form.elements.namedItem(k).value=v;form.scrollIntoView();return;}\nif(action==='export'){const result=await api('export?id='+encodeURIComponent(item.id));const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='approved-'+item.id.replace(':','-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);status('Approved content exported for separate GitHub review; not publicly deployed.');return;}\nawait api('transition',{method:'POST',body:JSON.stringify({id:item.id,expectedRevision:item.revision,action})});await reload();\n}catch(e){status('Operation not applied: '+e.message);}}\nasync function reload(){try{const [overview,data,logs,proposals]=await Promise.all([api('overview'),api('items'),api('audit'),api('proposals')]);$('#overview').textContent=overview.principal.role+' · '+overview.items+' items · '+overview.reviewCount+' awaiting review';$('#inquiries').textContent='Transport: '+overview.inquiryTransport+'. No server-confirmed new Universe receipts.';$('#audit').textContent=logs.events.map(x=>[x.created_at,x.actor,x.action,x.target_id].join(' · ')).join('\\n')||'No audit events yet.';\nconst root=$('#items');root.replaceChildren();for(const item of data.items){const card=document.createElement('article');card.className='item';const h=document.createElement('h3');h.textContent=item.title+' — '+item.state+' (r'+item.revision+')';const sub=document.createElement('p');sub.textContent=item.id+' · '+item.evidence_class;card.append(h,sub);for(const [label,action]of [['Edit','edit'],['Request review','submit'],['Approve','approve'],['Withdraw','withdraw'],['Export approved','export']]){const b=document.createElement('button');b.textContent=label;b.type='button';b.addEventListener('click',()=>run(item,action));card.append(b);}root.append(card);}\n$('#proposals').textContent=proposals.items.length?proposals.items.map(x=>x.title+' · '+x.state).join(' / '):'No agent proposals recorded.';status('Authorized session; operations ready.');}catch(e){status('Private control plane unavailable: '+e.message);}}\n$('#editor').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,x=Object.fromEntries(new FormData(form));x.expectedRevision=Number(x.expectedRevision);x.sourceRefs=x.sourceRefs.split('\\n').map(s=>s.trim()).filter(Boolean);try{await api('items',{method:'POST',body:JSON.stringify(x)});form.reset();await reload();status('Draft saved privately; not published.');}catch(e){status('Draft not saved: '+e.message);}});\nreload();";
export default {fetch:respond};
