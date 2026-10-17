// The editor owns its viewport and media. Universe navigation is optional UI,
// not an extra page row or a change to app-owned IndexedDB/OPFS.
if (window.top === window) {
  // Keep legacy viewport accommodations in other apps until individually tested.
  document.body.classList.add('universe-editor-shell');
  if (location.pathname.replace(/\/+$/,'') === '/rhythmcut') document.body.classList.add('universe-rhythmcut');
  const KEY = 'pj-universe-shortcut-size-v1';
  const modes = new Set(['icon', 'pill', 'hidden']);
  const savedMode = () => {
    try { const mode = localStorage.getItem(KEY); return modes.has(mode) ? mode : 'icon'; }
    catch { return 'icon'; }
  };
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'universe-return';
  trigger.setAttribute('aria-label', 'Open Universe navigation');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'universe-return-dialog');
  const dialog = document.createElement('dialog');
  dialog.id = 'universe-return-dialog';
  dialog.className = 'universe-return-dialog';
  dialog.setAttribute('aria-labelledby', 'return-title');
  dialog.innerHTML = `
    <h2 id="return-title">Universe navigation</h2>
    <p>Your editor stays open. Universe destinations open in a separate tab. Save or export inside the app before closing it.</p>
    <nav aria-label="Return destinations">
      <a href="/" target="_blank" rel="noopener noreferrer">Universe home ↗ <small>new tab</small></a>
      <a href="/apps/" target="_blank" rel="noopener noreferrer">Applications ↗ <small>new tab</small></a>
    </nav>
    <label for="universe-shortcut-size">Floating shortcut size</label>
    <select id="universe-shortcut-size" aria-label="Universe shortcut size">
      <option value="icon">Small icon (default)</option>
      <option value="pill">Named button</option>
      <option value="hidden">Hidden (restore from editor settings)</option>
    </select>
    <button type="button" data-return-close>Keep editing</button>
  `;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/assets/app-return.css';
  document.head.append(style);
  document.body.append(trigger, dialog);
  const select = dialog.querySelector('#universe-shortcut-size');
  const applyMode = mode => {
    const size = modes.has(mode) ? mode : 'icon';
    trigger.hidden = size === 'hidden';
    trigger.dataset.size = size;
    trigger.textContent = size === 'pill' ? 'Universe' : '✳';
    trigger.title = 'Universe navigation';
    select.value = size;
    try { localStorage.setItem(KEY, size); } catch {}
    window.dispatchEvent(new CustomEvent('universe:shortcut-mode-changed', { detail: { mode: size } }));
  };
  applyMode(savedMode());
  select.addEventListener('change', () => {
    applyMode(select.value);
    if (select.value === 'hidden') dialog.close();
  });
  window.addEventListener('universe:shortcut-mode', event => {
    applyMode(event.detail?.mode);
  });
  trigger.onclick = () => dialog.showModal();
  dialog.querySelector('[data-return-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    if (!trigger.hidden) trigger.focus();
  });
}
