// Root page mode switcher for two iframe apps.
// Expects #frame-en, #frame-sl, #btn-en, #btn-sl to exist.

(function () {
  const VERSION = '2025-10-23-4';           // bump when deploying
  const LS_KEY  = 'prompter:mode';          // persisted mode
  const MODES   = { EN: 'en', SL: 'sl' };   // URL ?mode=en|sl

  const frameEN = document.getElementById('frame-en');
  const frameSL = document.getElementById('frame-sl');
  const btnEN   = document.getElementById('btn-en');
  const btnSL   = document.getElementById('btn-sl');

  // --- Utilities -----------------------------------------------------------

  function getUrlMode() {
    const p = new URLSearchParams(location.search);
    const m = (p.get('mode') || '').toLowerCase();
    return (m === MODES.EN || m === MODES.SL) ? m : null;
  }

  function setUrlMode(mode, replace = false) {
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    if (replace) history.replaceState({}, '', url);
    else history.pushState({}, '', url);
  }

  function getPersistedMode() {
    try { return localStorage.getItem(LS_KEY); } catch { return null; }
  }
  function setPersistedMode(mode) {
    try { localStorage.setItem(LS_KEY, mode); } catch {}
  }

  function setFrameSrcOnce(frame, url) {
    if (!frame || !url) return;
    const current = new URL(frame.src || location.href, location.href).href;
    const next    = new URL(url, location.href).href;
    if (current !== next) frame.src = url;
  }

  function focusVisibleFrame(frameEl) {
    try {
      frameEl.focus();
      frameEl.contentWindow?.focus();
      // Optional: tell the child to announce mode via its own aria-live region
      frameEl.contentWindow?.postMessage({ type: 'ANNOUNCE_MODE' }, '*');
    } catch {}
  }

  function setActiveButton(mode) {
    const isEN = (mode === MODES.EN);
    btnEN.classList.toggle('active', isEN);
    btnSL.classList.toggle('active', !isEN);
    btnEN.setAttribute('aria-selected', isEN ? 'true' : 'false');
    btnSL.setAttribute('aria-selected', !isEN ? 'true' : 'false');
  }

  function showMode(mode) {
    const isEN = (mode === MODES.EN);
    frameEN.classList.toggle('hidden', !isEN);
    frameSL.classList.toggle('hidden', isEN);
    focusVisibleFrame(isEN ? frameEN : frameSL);
    setActiveButton(mode);
  }

  // --- Core apply() --------------------------------------------------------

  function apply(mode, { updateUrl = true, replaceUrl = false } = {}) {
    // 1) Persist + normalize URL
    setPersistedMode(mode);
    if (updateUrl) setUrlMode(mode, replaceUrl);

    // 2) Ensure iframe src URLs include version param (avoid stale documents)
    setFrameSrcOnce(frameEN, `en/index.html?v=${VERSION}`);
    setFrameSrcOnce(frameSL, `sl/index.html?v=${VERSION}`);

    // 3) Show/hide + focus
    showMode(mode);
  }

  // --- Button events -------------------------------------------------------

  btnEN?.addEventListener('click', () => apply(MODES.EN));
  btnSL?.addEventListener('click', () => apply(MODES.SL));

  // Handle back/forward navigation keeping state in sync
  window.addEventListener('popstate', () => {
    const urlMode = getUrlMode();
    if (urlMode) apply(urlMode, { updateUrl: false });
  });

  // --- Boot ---------------------------------------------------------------

  (function boot() {
    // Prefer URL -> then localStorage -> fallback to 'sl'
    const urlMode = getUrlMode();
    const saved   = getPersistedMode();

    const initial = urlMode || saved || MODES.SL; // start in SL→EN by default
    // Normalize URL without polluting history on first load
    apply(initial, { updateUrl: true, replaceUrl: !urlMode });
  })();
})();
