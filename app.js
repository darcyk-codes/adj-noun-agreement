/* app.js — Language mode that ONLY swaps prompt language and reel labels.
   Fixes:
   - Hints "bubbles" reliably populate/clear (#adjKeys, #nounKeys).
   - Provided lists load from ./nouns/manifest.json.
   - Prompt shows adj + noun in BOTH modes.
*/

(() => {
  // ---------- Helpers ----------
  const $  = (sel) => document.querySelector(sel);

  // ---------- State ----------
  let mode          = localStorage.getItem('mode') || 'en2sl'; // 'en2sl' or 'sl2en'
  let hintsOn       = localStorage.getItem('hintsOn') === 'true';
  let adjSortMode   = localStorage.getItem('adjSort')  || 'random'; // 'alpha' | 'random'
  let nounSortMode  = localStorage.getItem('nounSort') || 'random'; // 'alpha' | 'random'

  // Canonical data (stable IDs across modes)
  let possAdj = [];  // { id, sl, en }
  let nouns   = [];  // { id, sl, en, gender, number }

  // Render order arrays (IDs)
  let adjOrder  = [];
  let nounOrder = [];

  // Current selection (by ID)
  let selectedAdjId  = null;
  let selectedNounId = null;

  // Expected solution IDs for current prompt
  let expected = { adjId: null, nounId: null };

  // Demo seed (shown until CSV/provided list is loaded)
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

  function ensureDataReady() {
    if (nouns.length === 0) nouns = DEMO_NOUNS.map((n, i) => ({ id: i, ...n }));
    if (possAdj.length === 0) possAdj = DEMO_ADJ.map((a, i) => ({ id: i, ...a }));
  }

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

  // ---------- DOM Ready ----------
  window.addEventListener('DOMContentLoaded', () => {
    // Grab elements once
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

    const adjKeys        = $('#adjKeys');     // hint chips container
    const nounKeys       = $('#nounKeys');    // hint chips container

    const providedSelect = $('#providedSelect');
    const loadProvidedBtn= $('#loadProvidedBtn');
    const providedHint   = $('#providedHint');

    const fileInput      = $('#fileInput');
    const fileNameLabel  = $('#fileName');
    const encodingLabel  = $('#encodingLabel');
    const csvWarn        = $('#csvWarn');

    // Seed & IDs
    ensureDataReady();
    possAdj = possAdj.map((a, i) => ({ id: (a.id ?? i), ...a }));
    nouns   = nouns.map((n, i) => ({ id: (n.id ?? i), ...n }));

    // ---------- UI helpers ----------
    function applyModeUI() {
      toggleModeBtn.textContent =
        (mode === 'en2sl') ? 'Prompt: English → Slovene' : 'Prompt: Slovene → English';
      toggleModeBtn.setAttribute('aria-pressed', String(mode === 'sl2en'));

      toggleHintsBtn.textContent = hintsOn ? 'Show Hints: ON' : 'Show Hints: OFF';
      toggleHintsBtn.setAttribute('aria-pressed', String(hintsOn));

      toggleAdjSort.textContent  = `Adj order: ${adjSortMode === 'alpha' ? 'A–Z' : 'Random'}`;
      toggleNounSort.textContent = `Noun order: ${nounSortMode === 'alpha' ? 'A–Z' : 'Random'}`;
    }

    function buildOrderArrays() {
      const useEnglish = (mode === 'sl2en');
      const adjIds  = possAdj.map(a => a.id);
      const nounIds = nouns.map(n => n.id);

      adjOrder  = (adjSortMode  === 'alpha') ? alphaSortByKey(adjIds,  possAdj, useEnglish ? 'en' : 'sl') : shuffleIds(adjIds);
      nounOrder = (nounSortMode === 'alpha') ? alphaSortByKey(nounIds, nouns,   useEnglish ? 'en' : 'sl') : shuffleIds(nounIds);
    }

    function labelAdj(id) {
      const useEnglish = (mode === 'sl2en');
      const a = possAdj.find(x => x.id === id);
      return a ? (useEnglish ? a.en : a.sl) : '';
    }
    function labelNoun(id) {
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

    function setBadgeTexts() {
      const useEnglish = (mode === 'sl2en');
      const a = possAdj.find(x => x.id === selectedAdjId);
      const n = nouns.find(x => x.id === selectedNounId);
      adjBadge.textContent  = `Selected: ${a ? (useEnglish ? a.en : a.sl) : '—'}`;
      nounBadge.textContent = `Selected: ${n ? (useEnglish ? n.en : n.sl) : '—'}`;
    }

    // ----- Hints row contents (fixes: reliably populate/clear) -----
    function renderHints() {
      if (!adjKeys || !nounKeys) return;

      if (!hintsOn) {
        adjKeys.innerHTML = '';
        nounKeys.innerHTML = '';
        return;
      }

      // Show helpful hints that do NOT reveal exact words:
      // - noun gender/number
      // - agreement note for adjective
      const n = nouns.find(x => x.id === expected.nounId);
      const gender = n?.gender || '—';
      const number = n?.number || '—';

      // Noun hints
      nounKeys.innerHTML = '';
      const ng = document.createElement('span');
      ng.className = 'badge';
      ng.textContent = `gender: ${gender}`;
      const nn = document.createElement('span');
      nn.className = 'badge';
      nn.textContent = `number: ${number}`;
      nounKeys.appendChild(ng);
      nounKeys.appendChild(nn);

      // Adjective hints (agreement reminder)
      adjKeys.innerHTML = '';
      const agr = document.createElement('span');
      agr.className = 'badge';
      agr.textContent = `agree with ${gender}/${number}`;
      adjKeys.appendChild(agr);
    }

    function renderReels() {
      buildOrderArrays();
      renderTrack(adjTrack,  adjOrder,  labelAdj,  selectedAdjId,  (id) => { selectedAdjId = id; renderReels(); });
      renderTrack(nounTrack, nounOrder, labelNoun, selectedNounId, (id) => { selectedNounId = id; renderReels(); });
      setBadgeTexts();
      renderHints(); // ensure hints refresh with every render
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
      renderReels();
    }

    function pickRandomFrom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    // ---------- Prompt + Check ----------
    function generatePrompt() {
      // Choose expected solution (same IDs in any mode)
      const noun = pickRandomFrom(nouns);
      const adj  = pickRandomFrom(possAdj);
      expected = { adjId: adj.id, nounId: noun.id };

      // Reset selection so the user spins the reels
      selectedAdjId  = null;
      selectedNounId = null;

      // Prompt now includes adj + noun in both modes
      if (mode === 'en2sl') {
        promptText.textContent = `${adj.en} ${noun.en}`;
        promptHint.textContent = hintsOn ? 'Select the correct Slovene possessive + noun.' : '';
      } else {
        promptText.textContent = `${adj.sl} ${noun.sl}`;
        promptHint.textContent = hintsOn ? 'Select the correct English possessive + noun.' : '';
      }

      resultLine.textContent = '—';
      explain.textContent = 'Spin both reels to match the prompt, then press “Check”.';

      renderReels();
    }

    function evaluate() {
      const ok = (selectedAdjId === expected.adjId) && (selectedNounId === expected.nounId);
      if (ok) {
        resultLine.textContent = '✅ Correct!';
        const a = possAdj.find(x => x.id === expected.adjId);
        const n = nouns.find(x => x.id === expected.nounId);
        if (mode === 'en2sl') {
          explain.textContent = `You matched: ${a?.sl || '?'} ${n?.sl || '?'} (for “${a?.en || '?'} ${n?.en || '?'}”).`;
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

    // ---------- Provided lists ----------
    async function initProvidedLists() {
      try {
        const res = await fetch('./nouns/manifest.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const manifest = await res.json(); // [{label, file}, ...]
        if (!Array.isArray(manifest) || manifest.length === 0) {
          providedHint.textContent = 'No provided lists found.';
          providedSelect.disabled = true;
          loadProvidedBtn.disabled = true;
          return;
        }
        providedSelect.innerHTML = '';
        for (const item of manifest) {
          const opt = document.createElement('option');
          opt.value = item.file;
          opt.textContent = item.label || item.file;
          providedSelect.appendChild(opt);
        }
        providedSelect.disabled = false;
        loadProvidedBtn.disabled = false;
        providedHint.textContent = `Loaded ${manifest.length} provided list${manifest.length > 1 ? 's' : ''}.`;
      } catch (e) {
        providedSelect.disabled = true;
        loadProvidedBtn.disabled = true;
        providedHint.textContent = 'Provided lists are not configured.';
        // console.info('Provided lists manifest not found at ./nouns/manifest.json');
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

        selectedAdjId = selectedNounId = null;
        expected = { adjId: null, nounId: null };
        generatePrompt();
        providedHint.textContent = `Loaded ${nouns.length} nouns from provided list.`;
      } catch (e) {
        providedHint.textContent = `Failed to load provided list: ${e.message}`;
      }
    }

    // ---------- CSV upload ----------
    function parseCSVText(text) {
      const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim());
      const cleaned = lines.filter(l => l.length > 0);
      if (cleaned.length === 0) return [];

      const header = cleaned[0].split(',').map(s => s.trim().toLowerCase());
      const idxNoun    = header.indexOf('noun');
      const idxGender  = header.indexOf('gender');
      const idxNumber  = header.indexOf('number');
      const idxEnglish = header.indexOf('english');

      if (idxNoun < 0 || idxGender < 0 || idxNumber < 0 || idxEnglish < 0) {
        throw new Error('Missing required columns. Expected: noun,gender,number,english');
      }

      const out = [];
      for (let i = 1; i < cleaned.length; i++) {
        const cols = cleaned[i].split(',').map(s => s.trim());
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

    // ---------- Events ----------
    toggleModeBtn.addEventListener('click', () => {
      mode = (mode === 'en2sl') ? 'sl2en' : 'en2sl';
      localStorage.setItem('mode', mode);
      applyModeUI();
      renderReels();
      generatePrompt();
    });

    toggleHintsBtn.addEventListener('click', () => {
      hintsOn = !hintsOn;
      localStorage.setItem('hintsOn', String(hintsOn));
      applyModeUI();
      renderHints();   // update hint rows immediately
      // keep current prompt; no need to regenerate unless you prefer
    });

    toggleAdjSort.addEventListener('click', () => {
      adjSortMode = (adjSortMode === 'alpha') ? 'random' : 'alpha';
      localStorage.setItem('adjSort', adjSortMode);
      applyModeUI();
      renderReels();
    });

    toggleNounSort.addEventListener('click', () => {
      nounSortMode = (nounSortMode === 'alpha') ? 'random' : 'alpha';
      localStorage.setItem('nounSort', nounSortMode);
      applyModeUI();
      renderReels();
    });

    adjPrevBtn.addEventListener('click', () => stepSelection('adj', -1));
    adjNextBtn.addEventListener('click', () => stepSelection('adj', +1));
    nounPrevBtn.addEventListener('click', () => stepSelection('noun', -1));
    nounNextBtn.addEventListener('click', () => stepSelection('noun', +1));

    newPromptBtn.addEventListener('click', generatePrompt);
    checkBtn.addEventListener('click',  evaluate);

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

    loadProvidedBtn.addEventListener('click', () => {
      const url = providedSelect?.value;
      if (url) loadProvided(url);
    });

    // ---------- Boot ----------
    applyModeUI();
    initProvidedLists();

    // Default selection (first items)
    selectedAdjId  = possAdj[0]?.id ?? null;
    selectedNounId = nouns[0]?.id ?? null;

    renderReels();
    generatePrompt();
  });
})();
