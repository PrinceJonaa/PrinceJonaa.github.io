export const TOOLS=['tune','sample','engineer','compare'];
export function normalizeRoute(hash, lastTool='tune') {
  let raw;try {raw=decodeURIComponent(hash.replace(/^#/, '')).toLowerCase();}catch {raw='';}
  const legacy={analyze:'quick','analyze/overview':'quick','analyze/rhythm':'studio/tune?evidence','analyze/spectrum':'studio/engineer?spectrum','analyze/quality':'studio/engineer?levels','analyze/corrections':'quick?corrections',compare:'studio/compare'};
  raw=legacy[raw]||raw;
  if(raw==='studio')raw='studio/'+(TOOLS.includes(lastTool)?lastTool:'tune');
  const [path, sheet]=raw.split('?');
  const [page, tool]=path.split('/');
  const valid=['quick','library','settings'].includes(path)||(page==='studio'&&TOOLS.includes(tool)&&path==='studio/'+tool);
  if(!valid)return {page:'quick',tool:null,sheet:null,hash:'#quick'};
  const allowed={quick:['corrections'],tune:['evidence'],engineer:['spectrum','levels']};
  const detail=(allowed[tool||page]||[]).includes(sheet)?sheet:null;
  return {page,tool:tool||null,sheet:detail,hash:'#'+path+(detail?'?'+detail:'')};
}
export function createRouter(render) {
  let lastTool='tune',current=null;
  const sync=()=>{const next=normalizeRoute(location.hash,lastTool);if(next.tool)lastTool=next.tool;if(location.hash!==next.hash)history.replaceState(history.state,'',next.hash);const previous=current;current=next;render(next,previous);};
  const go=(route,{replace=false}={})=>{const next=normalizeRoute('#'+route,lastTool);if(location.hash===next.hash)return;history[replace?'replaceState':'pushState']({jona:true},'',next.hash);sync();};
  window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);
  return {go,sync,get current(){return current;}};
}
