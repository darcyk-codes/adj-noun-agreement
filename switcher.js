(function () {
  // 🔴 BUMP ONLY HERE
  const VERSION = '2025-10-23-12';
  window.__APP_VERSION = VERSION;

  const MODES = { EN: 'en', SL: 'sl' };
  const frameEN = document.getElementById('frame-en');
  const frameSL = document.getElementById('frame-sl');
  const btnEN   = document.getElementById('btn-en');
  const btnSL   = document.getElementById('btn-sl');
  const LS_KEY  = 'prompter:mode';

  function setFrameSrcOnce(frame, url) {
    if (!frame) return;
    const current = new URL(frame.src || location.href, location.href).href;
    const next    = new URL(url, location.href).href;
    if (current !== next) frame.src = url;
  }

  function apply(mode, { updateUrl = true, replaceUrl = false } = {}) {
    // Version the iframe docs with one value
    setFrameSrcOnce(frameEN, `en/index.html?v=${VERSION}`);
    setFrameSrcOnce(frameSL, `sl/index.html?v=${VERSION}`);

    const isEN = (mode === MODES.EN);
    frameEN.classList.toggle('hidden', !isEN);
    frameSL.classList.toggle('hidden', isEN);

    btnEN.classList.toggle('active', isEN);
    btnSL.classList.toggle('active', !isEN);

    try { localStorage.setItem(LS_KEY, mode); } catch {}

    if (updateUrl) {
      const u = new URL(location.href);
      u.searchParams.set('mode', isEN ? 'en' : 'sl');
      (replaceUrl ? history.replaceState : history.pushState).call(history, {}, '', u);
    }
  }

  btnEN?.addEventListener('click', () => apply(MODES.EN));
  btnSL?.addEventListener('click', () => apply(MODES.SL));
  window.addEventListener('popstate', () => {
    const m = new URLSearchParams(location.search).get('mode');
    apply(m === 'en' ? MODES.EN : MODES.SL, { updateUrl: false });
  });

  // boot
  const urlMode = new URLSearchParams(location.search).get('mode');
  const saved   = (()=>{ try { return localStorage.getItem(LS_KEY); } catch { return null; }})();
  const initial = urlMode || saved || MODES.SL;
  apply(initial, { replaceUrl: !urlMode });
})();
