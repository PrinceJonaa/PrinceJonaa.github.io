// An opaque editor has no trustworthy external save signal. Keep its tab alive.
// This shell never reads app storage, project names or media.
if (window.top === window) {
  document.body.classList.add('universe-editor-shell');
  const trigger=document.createElement('button');trigger.type='button';trigger.className='universe-return';trigger.textContent='Universe';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','universe-return-dialog');
  const dialog=document.createElement('dialog');dialog.id='universe-return-dialog';dialog.className='universe-return-dialog';dialog.setAttribute('aria-labelledby','return-title');
  dialog.innerHTML='<h2 id="return-title">Keep your workspace open</h2><p>Open the Universe in another tab. This editor stays here with your current work. Save or export inside the app before closing this tab.</p><nav aria-label="Return destinations"><a href="/" target="_blank" rel="noopener noreferrer">Universe home ↗ <small>new tab</small></a><a href="/apps/" target="_blank" rel="noopener noreferrer">Applications ↗ <small>new tab</small></a></nav><button type="button" data-return-close>Keep editing</button>';
  const style=document.createElement('link');style.rel='stylesheet';style.href='/assets/app-return.css';document.head.append(style);document.body.append(trigger,dialog);
  trigger.onclick=()=>dialog.showModal();dialog.querySelector('[data-return-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>trigger.focus());
}
