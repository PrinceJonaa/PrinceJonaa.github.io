// Optional article affordances. All reading and navigation work without JavaScript.
const article = document.querySelector('.article');
if (article) {
  const bar = document.createElement('div');
  bar.className = 'reading-progress';
  bar.setAttribute('aria-hidden','true');
  document.body.append(bar);
  const refresh = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = `${max ? Math.min(100, Math.max(0, scrollY / max * 100)) : 100}%`;
  };
  addEventListener('scroll',refresh,{passive:true});
  addEventListener('resize',refresh);
  refresh();
  const button = document.querySelector('[data-copy-link]');
  const status = document.querySelector('[data-copy-status]');
  if (button && status && navigator.clipboard?.writeText) {
    button.hidden = false;
    button.addEventListener('click',async()=>{
      try { await navigator.clipboard.writeText(location.href); status.textContent='Link copied'; }
      catch { status.textContent='Unable to copy. Use the browser address bar.'; }
    });
  }
}
