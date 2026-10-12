const get=s=>document.querySelector(s),root=get('[data-atlas-public]'),graph=get('[data-atlas-graph]'),list=get('[data-atlas-list]'),dialog=get('[data-atlas-window]'),panel=get('[data-atlas-detail]'),info=get('[data-atlas-status]');
const HREF='/atlas/?article=',allowedStatus=new Set(['published']);
let articles=[],edges=[],lookup=new Map(),focusBefore=null,current=null;
const create=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const validId=id=>typeof id==='string'&&/^article:[a-z0-9-]+$/.test(id);
const link=(label,href)=>{const a=create('a',label);a.href=href;return a;};
const getSlug=()=>new URL(location.href).searchParams.get('article');
function navigate(slug,record=true){const article=lookup.get('article:'+slug);if(!article){if(slug)info.textContent='This article is no longer in the public edition. Explore another public concept.';close(false);return;}
 focusBefore=document.activeElement;current=article.id;
 panel.replaceChildren();
 panel.append(create('span','Public Atlas / '+article.evidenceClass,'eyebrow'),create('h2',article.title),create('p',article.body),create('p','Revision '+article.revision+' · published '+article.publishedAt+' · '+article.author,'fineprint'));
 const sources=create('section');sources.append(create('h3','Source & status'));article.sourceRefs.forEach(url=>{const a=link('Public source ↗',url);a.target='_blank';a.rel='noopener noreferrer';sources.append(a);});sources.append(create('p','Source revision: '+article.sourceRevision+'. This is public site-authored interpretation, not a claim that the private Notion Atlas has been published.','fineprint'));panel.append(sources);
 const relations=edges.filter(e=>e.fromId===article.id||e.toId===article.id);
 if(relations.length){const related=create('section');related.append(create('h3','Related public lenses'));const ul=create('ul');for(const e of relations){const id=e.fromId===article.id?e.toId:e.fromId;const other=lookup.get(id);if(!other)continue;const li=create('li');const a=link(other.title+' — '+e.label,HREF+encodeURIComponent(other.slug));a.onclick=event=>{event.preventDefault();navigate(other.slug,true);};li.append(a);ul.append(li);}related.append(ul);panel.append(related);}
 panel.append(create('p',article.history?.length?'Correction history available below.':'No public correction record for this edition.','fineprint'));
 if(!dialog.open)dialog.showModal();
 if(record){const url=new URL(location.href);url.searchParams.set('article',slug);history.pushState({atlasArticle:slug},'',url);}
 const matching=graph.querySelectorAll('[data-atlas-node]');matching.forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.atlasNode===article.id)));
}
function close(updateUrl){if(dialog.open)dialog.close();current=null;graph.querySelectorAll('[data-atlas-node]').forEach(x=>x.setAttribute('aria-pressed','false'));if(updateUrl){const u=new URL(location.href);u.searchParams.delete('article');history.replaceState({},'',u);}if(focusBefore?.isConnected)focusBefore.focus();}
function render(){graph.replaceChildren();list.replaceChildren();
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.classList.add('atlas-lines');
 for(const edge of edges){const a=lookup.get(edge.fromId),b=lookup.get(edge.toId);if(!a||!b)continue;const line=document.createElementNS(ns,'line');for(const [k,v]of Object.entries({x1:a.position.x,y1:a.position.y,x2:b.position.x,y2:b.position.y}))line.setAttribute(k,String(v));svg.append(line);}graph.append(svg);
 for(const article of articles){const b=create('button',article.title,'atlas-node');b.type='button';b.dataset.atlasNode=article.id;b.style.left=article.position.x+'%';b.style.top=article.position.y+'%';b.setAttribute('aria-pressed','false');b.onclick=()=>navigate(article.slug);graph.append(b);
 const entry=create('article',undefined,'atlas-list-entry');const a=link(article.title,HREF+encodeURIComponent(article.slug));a.onclick=e=>{e.preventDefault();navigate(article.slug);};entry.append(a,create('p',article.summary),create('small',article.evidenceClass+' · revision '+article.revision));list.append(entry);
 }info.textContent=articles.length+' reviewed public concepts · '+edges.length+' labeled navigation links';}
function filter(){const value=get('[data-atlas-search]').value.toLowerCase().trim();list.querySelectorAll('.atlas-list-entry').forEach(card=>card.hidden=!card.textContent.toLowerCase().includes(value));graph.querySelectorAll('[data-atlas-node]').forEach(b=>b.hidden=!lookup.get(b.dataset.atlasNode).title.toLowerCase().includes(value));}
if(root){
 get('[data-atlas-search]').addEventListener('input',filter);
 get('[data-atlas-close]').onclick=()=>close(true);
 dialog.addEventListener('close',()=>{if(current)close(true);});
 window.addEventListener('popstate',()=>{const slug=getSlug();if(slug&&lookup.has('article:'+slug))navigate(slug,false);else close(false);});
 fetch('/assets/atlas-public.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('unavailable');return r.json();}).then(data=>{
 if(data.schema!==1)throw Error('unknown edition');
 articles=(Array.isArray(data.articles)?data.articles:[]).filter(a=>a.kind==='article'&&a.status==='published'&&validId(a.id)&&a.id==='article:'+a.slug&&Array.isArray(a.sourceRefs)&&a.sourceRefs.every(s=>/^https:\/\//.test(s)));
 lookup=new Map(articles.map(a=>[a.id,a]));
 edges=(Array.isArray(data.edges)?data.edges:[]).filter(e=>e.status==='published'&&lookup.has(e.fromId)&&lookup.has(e.toId)&&e.evidenceClass&&e.label&&e.direction);
 render();const slug=getSlug();if(slug)navigate(slug,false);
 }).catch(()=>info.textContent='Public Atlas edition unavailable. The original introduction remains accessible through site navigation.');
}
