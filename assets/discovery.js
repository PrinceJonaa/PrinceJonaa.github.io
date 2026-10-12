import {apps, worlds} from './registry.js';
import {publicIndex, musicTasks, searchRecords, statusLabels, privacyLabels} from './catalog.js';

const $=selector=>document.querySelector(selector);
const element=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;};
function link(label,href,className='') {
  const a=element('a',className,label);a.href=href;
  if(href.startsWith('https://')){a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',label+' (opens another site in a new tab)');}
  return a;
}

function appCard(app) {
  const card=element('article','app-card');card.id=app.publicId.replace(':','-');
  const art=element('div','app-art');art.style.setProperty('--tone',app.tone);
  const glyph=element('span','app-glyph',app.symbol);glyph.setAttribute('aria-hidden','true');art.append(glyph);
  const body=element('div','app-content'),badge=element('span','status',statusLabels[app.status]);badge.dataset.status=app.status;
  const title=element('h3','',app.name),summary=element('p','',app.description);
  const privacy=element('span','privacy-label',privacyLabels[app.privacy]);
  const actions=element('div','app-actions');actions.append(link(app.status==='planned'?'View plan →':app.status==='source-only'?'View source ↗':'Launch →',app.href,'btn btn-primary'));
  if(app.repositoryHref && app.repositoryHref!==app.href)actions.append(link('Source ↗',app.repositoryHref,'app-link'));
  const details=element('details','app-details');details.append(element('summary','','About this tool'));
  const info=element('dl');
  for(const [label,value] of [['Owner',app.owner],['Storage',app.storageKind],['Recover',app.howToRecover],['Release',app.releaseVersion?`v${app.releaseVersion}${app.builtArtifactCommit?' · '+app.builtArtifactCommit.slice(0,12):''}`:'No versioned artifact recorded'],['Checks',app.browserSupportEvidence||'Current app/device workflow not verified'],['Limit',app.lastKnownIssue]]) {
    if(value)info.append(element('dt','',label),element('dd','',value));
  }
  details.append(info);
  if(app.safeDeepLinks.length){const tasks=element('div','task-links');for(const task of musicTasks.filter(t=>t.href.startsWith(app.href)))tasks.append(link(task.name,task.href));details.append(tasks);}
  body.append(badge,title,summary,privacy,actions,details);card.append(art,body);return card;
}

function initCatalog() {
  const list=$('[data-app-grid]');if(!list)return;
  const search=$('[data-app-search]'),status=$('[data-app-status]'),reset=$('[data-app-reset]');
  const filters=[...document.querySelectorAll('[data-filter]')];
  const query=new URLSearchParams(location.search);search.value=query.get('q')||'';
  let category=filters.some(b=>b.dataset.filter===query.get('category'))?query.get('category'):'all';
  if([...status.options].some(o=>o.value===query.get('status')))status.value=query.get('status');
  const render=()=>{
    const visible=searchRecords(apps,search.value,{category,status:status.value});
    list.replaceChildren(...visible.map(appCard));
    if(!visible.length){const empty=element('div','empty');empty.append(element('h3','','No tools match yet'),element('p','','Try “BPM”, “video”, or “photo”, or reset the filters.'));const b=element('button','btn','Show all tools');b.type='button';b.onclick=clear;empty.append(b);list.append(empty);}
    $('[data-app-count]').textContent=visible.length+' of '+apps.length+' tools';
    filters.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===category)));
    const params=new URLSearchParams();if(search.value.trim())params.set('q',search.value.trim());if(category!=='all')params.set('category',category);if(status.value!=='all')params.set('status',status.value);
    history.replaceState(history.state,'',location.pathname+(params.size?'?'+params:'')+location.hash);
  };
  function clear(){category='all';search.value='';status.value='all';render();search.focus();}
  filters.forEach(b=>b.addEventListener('click',()=>{category=b.dataset.filter;render();}));
  search.addEventListener('input',render);status.addEventListener('change',render);reset.addEventListener('click',clear);render();
}

function initPalette() {
  const dialog=$('[data-search-dialog]');if(!dialog)return;
  const input=$('[data-global-query]'),results=$('[data-global-results]'),count=$('[data-global-count]');
  let previousFocus=null,selected=0,matches=[],nodes=[];
  function select(index){selected=matches.length?(index+matches.length)%matches.length:0;nodes.forEach((n,i)=>n.setAttribute('aria-selected',String(i===selected)));if(nodes[selected]){input.setAttribute('aria-activedescendant',nodes[selected].id);nodes[selected].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
  function render(){
    matches=searchRecords(publicIndex,input.value);nodes=[];results.replaceChildren();
    for(const [kind,label] of [['action','Music tasks'],['app','Applications'],['service','Services'],['caseStudy','Project proof'],['resume','Résumé & skills'],['world','Worlds'],['article','Atlas concepts']]){
      const group=matches.filter(r=>r.kind===kind);if(!group.length)continue;
      const wrapper=element('div','search-group');wrapper.setAttribute('role','group');wrapper.setAttribute('aria-label',label);
      const heading=element('div','search-group-label',label);heading.setAttribute('role','presentation');wrapper.append(heading);
      for(const r of group){const row=link('',r.href,'search-result');if(r.href.startsWith('https://'))row.setAttribute('aria-label',r.name+' (opens another site in a new tab)');row.id='search-'+r.publicId.replace(':','-');row.setAttribute('role','option');row.tabIndex=-1;row.dataset.publicId=r.publicId;
        row.addEventListener('click',()=>{previousFocus=null;dialog.close();});
        row.append(element('strong','',r.name),element('span','',r.description||r.subtitle));wrapper.append(row);nodes.push(row);
      }results.append(wrapper);
    }
    // Keep keyboard order identical to displayed groups.
    matches=nodes.map(n=>publicIndex.find(r=>r.publicId===n.dataset.publicId));
    if(!nodes.length)results.append(element('p','empty','No public results. Try a tool name, “mix”, or “music”.'));
    count.textContent=nodes.length+' public results';select(0);
  }
  function open(){if(dialog.open)return;previousFocus=document.activeElement;dialog.showModal();input.value='';render();input.focus();}
  function close(){dialog.close();}
  document.querySelectorAll('[data-open-search]').forEach(b=>b.addEventListener('click',open));
  $('[data-close-search]').addEventListener('click',close);
  dialog.addEventListener('close',()=>{previousFocus?.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)close();}});
  input.addEventListener('input',render);
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const closeButton=$('[data-close-search]');if(e.shiftKey&&document.activeElement===input){e.preventDefault();closeButton.focus();}else if(!e.shiftKey&&document.activeElement===closeButton){e.preventDefault();input.focus();}}});
  input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();select(selected+(e.key==='ArrowDown'?1:-1));}if(e.key==='Enter'&&nodes[selected]){e.preventDefault();nodes[selected].click();}});
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();dialog.open?close():open();}});
}

function initShell() {
  const current=worlds.find(w=>location.pathname.startsWith(w.href));
  if(current)$('[data-current-world]')?.replaceChildren(document.createTextNode(current.name));
  const dock=$('[data-mobile-dock]');if(dock)for(const a of dock.querySelectorAll('a')){if((a.pathname==='/'&&location.pathname==='/')||(a.pathname!=='/'&&location.pathname.startsWith(a.pathname)))a.setAttribute('aria-current','page');}
  const notice=$('[data-missing-route]');if(notice)notice.textContent=location.pathname;
}

initCatalog();initPalette();initShell();
