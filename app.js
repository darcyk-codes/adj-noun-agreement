/* app.js — robust init order, mode toggle, reel swap (EN↔SL), sort toggles, CSV load, hints, provided lists */

(() => {
  // -----------------------------
  // DOM helpers
  // -----------------------------
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // -----------------------------
  // Global-ish state (scoped in IIFE but defined before use)
  // -----------------------------
  let mode      = localStorage.getItem('mode') || 'en2sl'; // 'en2sl' or 'sl2en'
  let hintsOn   = localStorage.getItem('hintsOn') === 'true';
  let adjSortMode  = localStorage.getItem('adjSort')  || 'random'; // 'alpha' | 'random'
  let nounSortMode = localStorage.getItem('nounSort') || 'random'; // 'alpha' | 'random'

  // Canonical data (IDs stay stable across modes)
  let possAdj = [];  // { id, sl, en }
  let nouns   = [];  // { id, sl, en, gender, number }

  // Render order arrays
  let adjOrder  = [];  // array of adj IDs in display order
  let nounOrder = [];  // array of noun IDs in display order

  // Current selections (by ID)
  let selectedAdjId  = null;
  let selectedNounId = null;

  // Expected pair for current prompt (by ID)
  let expected = { adjId: null, nounId: null };

  // Fallback demo data (used if no CSV yet)
  const DEMO_NOUNS = [
    { sl: 'hiša',   en: 'house',    gender: 'f', number: 'sg' },
    { sl: 'mesto',  en: 'city',     gender: 'n', number: 'sg' },
    { sl: 'mački',  en: 'kittens',  gender: 'm', number: 'pl' },
    { sl: 'knjiga', en: 'book',     gender: 'f', number: 'sg' },
    { sl: 'otroci', en: 'children', gender: 'm', number: 'pl' },
  ];

  const DEMO_ADJ = [
    { sl: 'moja',    en: 'my' },
    { sl: 'tvoja',   en: 'your' },
    { sl: 'njegova', en: 'his' },
    { sl: 'njena',   en: 'her' },
    { sl: 'naša',    en: 'our' },
    { sl: 'vaša',    en: 'your(pl)' },
    { sl: 'njihova', en: 'their' },
  ];

  // -----------------------------
  // Utilities
  // -----------------------------
  function shuffleIds(ids) {
    const a = ids.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function alphaSortByKey(ids, arr, key) {
    return ids.slice().sort((ida, idb) =>
      arr[ida][key].localeCompare(arr[idb][key], undefined, { sensitivity: 'base' })
    );
  }

  function ensureDataReady() {
    if (nouns.length === 0) {
      nouns = DEMO_NOUNS.map((n, i) => ({ id: i, ...n }));
    }
    if (possAdj.length === 0) {
      possAdj = DEMO_ADJ.map((a, i) => ({ id: i, ...a }));
    }
  }

  function setBadgeTexts(adjBadge, nounBadge) {
    const useEnglish = (mode === 'sl2en');
    const a = possAdj.find(x => x.id === selectedAdjId);
    const n = nouns.find(x => x.id === selectedNounId);
    adjBadge.textContent  = `Selected: ${a ? (useEnglish ? a.en : a.sl) : '—'}`;
    nounBadge.textContent = `Selected: ${n ? (useEnglish ? n.en : n.sl) : '—'}`;
  }

  function buildOrderArrays() {
    const useEnglish = (mode === 'sl2en');
    const adjIds  = possAdj.map(a => a.id);
    const nounIds = nouns.map(n => n.id);

    adjOrder  = (adjSortMode  === 'alpha') ? alphaSortByKey(adjIds,  possAdj, useEnglish ? 'en' : 'sl') : shuffleIds(adjIds);
    nounOrder = (nounSortMode === 'alpha') ? alphaSortByKey(nounIds, nouns,   useEnglish ? 'en' : 'sl') : shuffleIds(nounIds);
  }

  function labelForAdj(id) {
    const useEnglish = (mode === 'sl2en');
    const a = possAdj.find(x => x.id === id);
    return a ? (useEnglish ? a.en : a.sl) : '';
  }

  function labelForNoun(id) {
    const useEnglish = (mode === 'sl2en');
    const n = nouns.find(x => x.id === id);
    return n ? (useEnglish ? n.en : n.sl) : '';
  }

  function renderTrack(trackEl, order, labelFn, selectedId, onClick) {
    trackEl.innerHTML = '';
    order.forEach((id) => {
      const item = document.createElement('div');
      item.className = 'reelItem';
      item.setAttribute('role', 'option');
      item.setAttribute('data-id', String(id));
      item.textContent = labelFn(id);
      if (id === selectedId) item.classList.add('selected');
      item.addEventListener('click', () => onClick(id));
      trackEl.appendChild(item);
    });
  }

  function stepSelection(kind, delta) {
    const order = (kind === 'adj') ? adjOrder : nounOrder;
    let selId   = (kind === 'adj') ? selectedAdjId : selectedNounId;

    if (selId == null) {
      selId = order[0];
    } else {
      const idx = order.indexOf(selId);
      const nextIdx = (idx + delta + order.length) % order.length;
      selId = order[nextIdx];
    }
    if (kind === 'adj') selectedAdjId = selId;
    else selectedNounId = selId;
  }

  function parseCSVText(text) {
    const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const header = lines[0].split(',').map(s => s.trim().toLowerCase());
    const idxNoun    = header.indexOf('noun');
    const idxGender  = header.indexOf('gender');
    const idxNumber  = header.indexOf('number');
    const idxEnglish = header.indexOf('english');

    if (idxNoun < 0 || idxGender < 0 || idxNumber < 0 || idxEnglish < 0) {
      throw new Error('Missing required columns. Expected: noun,gender,number,english');
    }

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      if (cols.length < header.length) continue;
      const sl = cols[idxNoun];
      const en = cols[idxEnglish];
      const gender = cols[idxGender];
      const number = cols[idxNumber];
      if (!sl || !en) continue;
      out.push({ sl, en, gender, number });
    }
    return out;
  }

  // -----------------------------
  // Main init after DOM ready
  // -----------------------------
  window.addEventListener('DOMContentLoaded', () => {
    // Grab DOM now (safe)
    const newPromptBtn   = $('#newPromptBtn');
    const checkBtn       = $('#checkBtn');

    const promptText     = $('#promptText');
    const promptHint     = $('#promptHint');

    const resultLine     = $('#resultLine');
    const explain        = $('#explain');

    const toggleHintsBtn = $('#toggleHints');
    const toggleModeBtn  = $('#toggleMode');

    const toggleAdjSort  = $('#toggleAdjSort');
    const toggleNounSort = $('#toggleNounSort');

    const adjPrevBtn     = $('#adjPrev');
    const adjNextBtn     = $('#adjNext');
    const nounPrevBtn    = $('#nounPrev');
    const nounNextBtn    = $('#nounNext');

    const adjTrack       = $('#adjTrack');
    const nounTrack      = $('#nounTrack');

    const adjBadge       = $('#adjBadge');
    const nounBadge      = $('#nounBadge');

    const providedSelect = $('#providedSelect');
    const loadProvidedBtn= $('#loadProvidedBtn');
    const providedHint   = $('#providedHint');

    const fileInput      = $('#fileInput');
    const fileNameLabel  = $('#fileName');
    const encodingLabel  = $('#encodingLabel');
    const csvWarn        = $('#csvWarn');

    // Seed data if needed
    ensureDataReady();
    // Assign IDs if not present (safety)
    possAdj = possAdj.map((a, i) => ({ id: (a.id ?? i), ...a }));
    nouns   = nouns.map((n, i) => ({ id: (n.id ?? i), ...n }));

    // ---- UI helpers bound to current DOM ----
    function applyModeUI() {
      if (toggleModeBtn) {
        toggleModeBtn.textContent =
          (mode === 'en2sl')
            ? 'Prompt: English → Slovene'
            : 'Prompt: Slovene → English';
      }
      if (toggleHintsBtn) {
        toggleHintsBtn.textContent = hintsOn ? 'Show Hints: ON' : 'Show Hints: OFF';
        toggleHintsBtn.setAttribute('aria-pressed', String(hintsOn));
      }
      if (toggleAdjSort) {
        toggleAdjSort.textContent = `Adj order: ${adjSortMode === 'alpha' ? 'A–Z' : 'Random'}`;
      }
      if (toggleNounSort) {
        toggleNounSort.textContent = `Noun order: ${nounSortMode === 'alpha' ? 'A–Z' : 'Random'}`;
      }
    }

    function buildOrderAndRender() {
      buildOrderArrays();
      renderTrack(adjTrack,  adjOrder,  (id) => labelForAdj(id),  selectedAdjId,  (id) => { selectedAdjId = id; buildOrderAndRender(); });
      renderTrack(nounTrack, nounOrder, (id) => labelForNoun(id), selectedNounId, (id) => { selectedNounId = id; buildOrderAndRender(); });
      setBadgeTexts(adjBadge, nounBadge);
    }

    function pickRandomFrom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function generatePrompt() {
      ensureDataReady();

      // Pick expected pair (simple random; extend with agreement if desired)
      const noun = pickRandomFrom(nouns);
      const adj  = pickRandomFrom(possAdj);
      expected = { adjId: adj.id, nounId: noun.id };

      // clear selection so user spins
      selectedAdjId = null;
      selectedNounId = null;

      if (mode === 'en2sl') {
        promptText.textContent = noun.en;
        promptHint.textContent = hintsOn ? 'Select the correct Slovene possessive + noun.' : '';
      } else {
        const adjSL = possAdj.find(a => a.id === adj.id)?.sl || '';
        promptText.textContent = `${adjSL} ${noun.sl}`;
        promptHint.textContent = hintsOn ? 'Select the correct English possessive + noun.' : '';
      }

      resultLine.textContent = '—';
      explain.textContent = 'Spin both reels to match the prompt, then press “Check”.';

      buildOrderAndRender();
    }

    function evaluate() {
      const ok = (selectedAdjId === expected.adjId) && (selectedNounId === expected.nounId);
      if (ok) {
        resultLine.textContent = '✅ Correct!';
        const a = possAdj.find(x => x.id === expected.adjId);
        const n = nouns.find(x => x.id === expected.nounId);
        if (mode === 'en2sl') {
          explain.textContent = `You matched: ${a?.sl || '?'} ${n?.sl || '?'} (for “${n?.en || '?'}”).`;
        } else {
          explain.textContent = `You matched: ${a?.en || '?'} ${n?.en || '?'} (for “${a?.sl || '?'} ${n?.sl || '?'}”).`;
        }
      } else {
        resultLine.textContent = '❌ Try again';
        if (hintsOn) {
          const a = possAdj.find(x => x.id === expected.adjId);
          const n = nouns.find(x => x.id === expected.nounId);
          if (mode === 'en2sl') {
            explain.textContent = `Target was: ${a?.sl || '?'} ${n?.sl || '?'} (English: ${a?.en || '?'} ${n?.en || '?'}).`;
          } else {
            explain.textContent = `Target was: ${a?.en || '?'} ${n?.en || '?'} (Slovene: ${a?.sl || '?'} ${n?.sl || '?'}).`;
          }
        } else {
          explain.textContent = 'Hint is OFF. Toggle hints if you want more guidance.';
        }
      }
    }

    function updateAdjSort() {
      adjSortMode = (adjSortMode === 'alpha') ? 'random' : 'alpha';
      localStorage.setItem('adjSort', adjSortMode);
      applyModeUI();
      buildOrderAndRender();
    }

    function updateNounSort() {
      nounSortMode = (nounSortMode === 'alpha') ? 'random' : 'alpha';
      localStorage.setItem('nounSort', nounSortMode);
      applyModeUI();
      buildOrderAndRender();
    }

    // ---- Provided lists (optional). Looks for ./provided/manifest.json
    async function initProvidedLists() {
      if (!providedSelect || !loadProvidedBtn || !providedHint) return;

      try {
        const res = await fetch('./provided/manifest.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const manifest = await res.json(); // expect [{name, url}, ...]
        if (!Array.isArray(manifest) || manifest.length === 0) {
          providedHint.textContent = 'No provided lists found.';
          providedSelect.disabled = true;
          loadProvidedBtn.disabled = true;
          return;
        }
        providedSelect.innerHTML = '';
        manifest.forEach((item, idx) => {
          const opt = document.createElement('option');
          opt.value = item.url;
          opt.textContent = item.name || `List ${idx + 1}`;
          providedSelect.appendChild(opt);
        });
        providedSelect.disabled = false;
        loadProvidedBtn.disabled = false;
        providedHint.textContent = `Loaded ${manifest.length} provided list${manifest.length > 1 ? 's' : ''}.`;
      } catch {
        providedSelect.disabled = true;
        loadProvidedBtn.disabled = true;
        providedHint.textContent = 'Provided lists are not configured.';
      }
    }

    async function loadProvided(url) {
      try {
        providedHint.textContent = 'Loading…';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const rows = parseCSVText(text);
        nouns = rows.map((r, i) => ({ id: i, sl: r.sl, en: r.en, gender: r.gender, number: r.number }));

        // Reset selection/expected and rebuild UI
        selectedAdjId = selectedNounId = null;
        expected = { adjId: null, nounId: null };
        generatePrompt();
        providedHint.textContent = `Loaded ${nouns.length} nouns from provided list.`;
      } catch (e) {
        providedHint.textContent = `Failed to load provided list: ${e.message}`;
      }
    }

    // ---- Event wiring
    if (toggleModeBtn) {
      toggleModeBtn.addEventListener('click', () => {
        mode = (mode === 'en2sl') ? 'sl2en' : 'en2sl';
        localStorage.setItem('mode', mode);
        applyModeUI();
        // Preserve selection; only labels swap
        buildOrderAndRender();
        generatePrompt();
      });
    }

    if (toggleHintsBtn) {
      toggleHintsBtn.addEventListener('click', () => {
        hintsOn = !hintsOn;
        localStorage.setItem('hintsOn', String(hintsOn));
        applyModeUI();
        generatePrompt();
      });
    }

    if (toggleAdjSort) toggleAdjSort.addEventListener('click', updateAdjSort);
    if (toggleNounSort) toggleNounSort.addEventListener('click', updateNounSort);

    if (adjPrevBtn)  adjPrevBtn.addEventListener('click', () => { stepSelection('adj', -1); buildOrderAndRender(); });
    if (adjNextBtn)  adjNextBtn.addEventListener('click', () => { stepSelection('adj', +1); buildOrderAndRender(); });
    if (nounPrevBtn) nounPrevBtn.addEventListener('click', () => { stepSelection('noun', -1); buildOrderAndRender(); });
    if (nounNextBtn) nounNextBtn.addEventListener('click', () => { stepSelection('noun', +1); buildOrderAndRender(); });

    if (newPromptBtn) newPromptBtn.addEventListener('click', generatePrompt);
    if (checkBtn)     checkBtn.addEventListener('click', evaluate);

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        fileNameLabel.textContent = file.name;
        encodingLabel.textContent = '(UTF-8 expected)';
        csvWarn.style.display = 'none';

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const text = reader.result;
            if (String(text).includes('\ufffd')) csvWarn.style.display = 'block';
            const rows = parseCSVText(text);
            nouns = rows.map((r, i) => ({ id: i, sl: r.sl, en: r.en, gender: r.gender, number: r.number }));

            selectedAdjId = selectedNounId = null;
            expected = { adjId: null, nounId: null };
            generatePrompt();
            providedHint.textContent = `Loaded ${nouns.length} nouns from CSV.`;
          } catch (err) {
            providedHint.textContent = 'CSV parse error: ' + err.message;
            console.error(err);
          }
        };
        reader.readAsText(file, 'utf-8');
      });
    }

    if (loadProvidedBtn) {
      loadProvidedBtn.addEventListener('click', () => {
        const url = providedSelect?.value;
        if (url) loadProvided(url);
      });
    }

    // ---- Boot sequence
    applyModeUI();
    initProvidedLists();

    // Default selection
    selectedAdjId  = possAdj[0]?.id ?? null;
    selectedNounId = nouns[0]?.id ?? null;

    buildOrderAndRender();
    generatePrompt();
  });
})();
