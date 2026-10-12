
import {siteUpdates} from './site-updates.js';
const list=document.querySelector('[data-updates-list]'),filter=document.querySelector('[data-updates-filter]');
if(list&&filter){
 function render(){
  list.replaceChildren();
  const selected=siteUpdates.filter(x=>filter.value==='all'||x.category===filter.value);
  const count=document.querySelector('[data-updates-count]');if(count)count.textContent=selected.length+' reviewed public updates';
  for(const record of selected){
   if(record.status!=='published')continue;
   const card=document.createElement('article');card.className='memory-card';card.id=record.id;
   const meta=document.createElement('p');meta.className='eyebrow';meta.textContent=record.date+' · '+record.category+' · public release';
   const heading=document.createElement('h2');heading.textContent=record.title;
   const summary=document.createElement('p');summary.textContent=record.summary;
   const proof=document.createElement('a');proof.href=record.evidence;proof.target='_blank';proof.rel='noopener noreferrer';proof.textContent='View reviewed change ↗';
   card.append(meta,heading,summary,proof);list.append(card);
  }
  if(!list.children.length){const p=document.createElement('p');p.textContent='No approved updates in this category.';list.append(p);}
 }
 filter.addEventListener('change',render);render();
}
