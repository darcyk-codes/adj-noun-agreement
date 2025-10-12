/* app.js — Mode toggle + reel swap (EN↔SL), sort toggles, CSV load, hints, prompt/check)
   Works with your current index.html structure/IDs.

   Title note: Preserves "Possessive Match — Slovene Nouns" in index.html per your request.
*/

// -----------------------------
// DOM helpers
// -----------------------------
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Buttons / controls
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

// Reels
const adjTrack       = $('#adjTrack');   // container inside #adjReel
const nounTrack      = $('#nounTrack');  // container inside #nounReel

const adjBadge       = $('#adjBadge');
const nounBadge      = $('#nounBadge');

// Provided lists UI (kept but optional)
const providedSelect   = $('#providedSelect');
const loadProvidedBtn  = $('#loadProvidedBtn');
const providedHint     = $('#providedHint');

// Custom CSV upload
const fileInput      = $('#fileInput');
const fileNameLabel  = $('#fileName');
const encodingLabel  = $('#encodingLabel');
const csvWarn        = $('#csvWarn');

// -----------------------------
// State
// -----------------------------
let mode = localStorage.getItem('mode') || 'en2sl'; // 'en2sl' or 'sl2en'
let hintsOn = localStorage.getItem('hintsOn') === 'true';

let adjSortMode  = localStorage.getItem('adjSort')  || 'random'; // 'alpha' | 'random'
let nounSortMode = localStorage.getItem('nounSort') || 'random'; // 'alpha' | 'random'

// Canonical data (IDs stay stable across modes)
let possAdj = [];  // { id, sl, en }
let nouns    = []; // { id, sl, en, gender: 'm|f|n', number: 'sg|pl' }

// Rendered (sorted) indices for each reel
let adjOrder = [];   // array of adj IDs in display order
let nounOrder = [];  // array of noun IDs in display order

// Current selection (by ID)
let selectedAdjId  = null;
let selectedNounId = null;

// Expected pair for the current prompt (by ID)
let expected = { adjId: null, nounId: null };

// Fallback demo data (used only if user hasn't loaded CSV yet)
const DEMO_NOUNS = [
  { sl: 'hiša',   en: 'house',   gender: 'f', number: 'sg' },
  { sl: 'mesto',  en: 'city',    gender: 'n', number: 'sg' },
  { sl: 'mački',  en: 'kittens', gender: 'm', number: 'pl' },
  { sl: 'knjiga', en: 'book',    gender: 'f', number: 'sg' },
  { sl: 'otroci', en: 'children',gender: 'm', number: 'pl' },
];

// Minimal possessive adjectives (base set).
// These are generic placeholders (not full Slovene agreement set).
// You can extend with exact forms later; evaluation is ID-based so it's safe.
const DEMO_ADJ = [
  { sl: 'moja',   en: 'my'   },
  { sl: 'tvoja',  en: 'your' },
  { sl: 'njegova',en: 'his'  },
  { sl: 'njena',  en: 'her'  },
  { sl: 'naša',   en: 'our'  },
  { sl: 'vaša',   en: 'your(pl)' },
  { sl: 'njihova',en: 'their'},
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
    // seed demo nouns with IDs
    nouns = DEMO_NOUNS.map((n, i) => ({ id: i, ...n }));
  }
  if (possAdj.length === 0) {
    possAdj = DEMO_ADJ.map((a, i) => ({ id: i, ...a }));
  }
}

function setBadgeTexts() {
  const useEnglish = (mode === 'sl2en');
  const adj = possAdj.find(a => a.id === selectedAdjId);
  const nou = nouns.find(n => n.id === selectedNounId);
  const adjLabel = adj ? (useEnglish ? adj.en : adj.sl) : '—';
  const nouLabel = nou ? (useEnglish ? nou.en : nou.sl) : '—';
  adjBadge.textContent  = `Selected: ${adjLabel}`;
  nounBadge.textContent = `Selected: ${nouLabel}`;
}

// -----------------------------
// Rendering reels
// -----------------------------
function buildOrderArrays() {
  const useEnglish = (mode === 'sl2en');

  // Build base id arrays
  const adjIds  = possAdj.map(a => a.id);
  const nounIds = nouns.map(n => n.id);

  // Sorting
  if (adjSortMode === 'alpha') {
    adjOrder = alphaSortByKey(adjIds, possAdj, useEnglish ? 'en' : 'sl');
  } else {
    adjOrder = shuffleIds(adjIds);
  }

  if (nounSortMode === 'alpha') {
    nounOrder = alphaSortByKey(nounIds, nouns, useEnglish ? 'en' : 'sl');
  } else {
    nounOrder = shuffleIds(nounIds);
  }
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

function renderTrack(trackEl, order, labelFn, selectedId) {
  trackEl.innerHTML = '';
  order.forEach((id) => {
    const item = document.createElement('div');
    item.className = 'reelItem';
    item.setAttribute('role', 'option');
    item.setAttribute('data-id', String(id));
    item.textContent = labelFn(id);
    if (id === selectedId) item.classList.add('selected');
    item.addEventListener('click', () => {
      if (trackEl === adjTrack) {
        selectedAdjId = id;
      } else {
        selectedNounId = id;
      }
      renderReels(); // rerender to apply .selected styles and badges
    });
    trackEl.appendChild(item);
  });
}

function renderReels() {
  ensureDataReady();
  buildOrderArrays();

  renderTrack(adjTrack,  adjOrder,  labelForAdj,  selectedAdjId);
  renderTrack(nounTrack, nounOrder, labelForNoun, selectedNounId);

  setBadgeTexts();
}

// -----------------------------
// Selection stepping (Prev/Next)
// -----------------------------
function stepSelection(kind, delta) {
  const order = (kind === 'adj') ? adjOrder : nounOrder;
  let selId   = (kind === 'adj') ? selectedAdjId : selectedNounId;

  if (selId == null) {
    // None selected yet → pick first
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

// -----------------------------
// Mode + Hints UI
// -----------------------------
function applyModeUI() {
  toggleModeBtn.textContent =
    (mode === 'en2sl')
      ? 'Prompt: English → Slovene'
      : 'Prompt: Slovene → English';

  toggleHintsBtn.textContent = hintsOn ? 'Show Hints: ON' : 'Show Hints: OFF';
  toggleHintsBtn.setAttribute('aria-pressed', String(hintsOn));
}

// -----------------------------
// Prompt + Check
// -----------------------------
function pickRandomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePrompt() {
  ensureDataReady();

  // Choose expected pair (IDs). If you want agreement logic, you can filter by noun gender/number.
  const noun = pickRandomFrom(nouns);
  const adj  = pickRandomFrom(possAdj);

  expected = { adjId: adj.id, nounId: noun.id };

  // Clear current selection so the user has to spin
  selectedAdjId  = null;
  selectedNounId = null;

  // Prompt language depends on mode
  if (mode === 'en2sl') {
    // Show English noun (and optionally English possessive adjective) as hint/prompt
    promptText.textContent = noun.en;
    if (hintsOn) {
      promptHint.textContent = 'Select the correct Slovene possessive + noun.';
    } else {
      promptHint.textContent = '';
    }
  } else {
    // SL→EN: show Slovene phrase prompt
    const adjSL = possAdj.find(a => a.id === adj.id)?.sl || '';
    const nounSL = noun.sl;
    promptText.textContent = `${adjSL} ${nounSL}`;
    if (hintsOn) {
      promptHint.textContent = 'Select the correct English possessive + noun.';
    } else {
      promptHint.textContent = '';
    }
  }

  // Reset feedback
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

// -----------------------------
// Sort toggles
// -----------------------------
function updateAdjSort() {
  adjSortMode = (adjSortMode === 'alpha') ? 'random' : 'alpha';
  localStorage.setItem('adjSort', adjSortMode);
  toggleAdjSort.textContent = `Adj order: ${adjSortMode === 'alpha' ? 'A–Z' : 'Random'}`;
  renderReels();
}

function updateNounSort() {
  nounSortMode = (nounSortMode === 'alpha') ? 'random' : 'alpha';
  localStorage.setItem('nounSort', nounSortMode);
  toggleNounSort.textContent = `Noun order: ${nounSortMode === 'alpha' ? 'A–Z' : 'Random'}`;
  renderReels();
}

function initSortLabels() {
  toggleAdjSort.textContent  = `Adj order: ${adjSortMode === 'alpha' ? 'A–Z' : 'Random'}`;
  toggleNounSort.textContent = `Noun order: ${nounSortMode === 'alpha' ? 'A–Z' : 'Random'}`;
}

// -----------------------------
// CSV loader
// -----------------------------
function parseCSVText(text) {
  // Very small CSV parser specialized for: noun,gender,number,english
  // Assumes commas, no embedded commas in fields.
  // Expect UTF-8 text (you warn users in UI).
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

function loadCSVFile(file) {
  fileNameLabel.textContent = file.name;
  encodingLabel.textContent = '(UTF-8 expected)';
  csvWarn.style.display = 'none';

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result;
      // Quick UTF-8 sanity — if mojibake is suspected, show the warn.
      // (Heuristic: look for replacement chars)
      if (text.includes('\ufffd')) {
        csvWarn.style.display = 'block';
      }

      const rows = parseCSVText(text);
      nouns = rows.map((r, i) => ({ id: i, sl: r.sl, en: r.en, gender: r.gender, number: r.number }));
      // Keep any existing possAdj (you can later generate per-gender forms if desired)

      // Reset any previous selection/expected; then rebuild UI
      selectedAdjId = selectedNounId = null;
      expected = { adjId: null, nounId: null };
      renderReels();
      generatePrompt();

      providedHint.textContent = `Loaded ${nouns.length} nouns from CSV.`;
    } catch (err) {
      providedHint.textContent = 'CSV parse error: ' + err.message;
      console.error(err);
    }
  };
  reader.readAsText(file, 'utf-8');
}

// -----------------------------
// Provided lists (placeholder hook)
// -----------------------------
function initProvidedLists() {
  // If you host a JSON manifest of provided noun lists, fetch and populate here.
  // For now, keep disabled to match your current UI state.
  providedSelect.disabled = true;
  loadProvidedBtn.disabled = true;
  providedHint.textContent = 'Provided lists are not configured.';
}

// -----------------------------
// Event wiring
// -----------------------------
toggleModeBtn.addEventListener('click', () => {
  mode = (mode === 'en2sl') ? 'sl2en' : 'en2sl';
  localStorage.setItem('mode', mode);
  applyModeUI();
  // Preserve selection by ID; only labels swap.
  renderReels();
  generatePrompt();
});

toggleHintsBtn.addEventListener('click', () => {
  hintsOn = !hintsOn;
  localStorage.setItem('hintsOn', String(hintsOn));
  applyModeUI();
  // Regenerate prompt to update hint message
  generatePrompt();
});

toggleAdjSort.addEventListener('click', updateAdjSort);
toggleNounSort.addEventListener('click', updateNounSort);

adjPrevBtn.addEventListener('click', () => stepSelection('adj', -1));
adjNextBtn.addEventListener('click', () => stepSelection('adj', +1));
nounPrevBtn.addEventListener('click', () => stepSelection('noun', -1));
nounNextBtn.addEventListener('click', () => stepSelection('noun', +1));

newPromptBtn.addEventListener('click', generatePrompt);
checkBtn.addEventListener('click', evaluate);

fileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) loadCSVFile(file);
});

loadProvidedBtn.addEventListener('click', () => {
  // No-op unless you wire provided lists. Kept for future.
});

// -----------------------------
// Boot
// -----------------------------
(function init() {
  // seed data if empty
  ensureDataReady();

  // assign IDs if not present (safety)
  possAdj = possAdj.map((a, i) => ({ id: (a.id ?? i), ...a }));
  nouns   = nouns.map((n, i) => ({ id: (n.id ?? i), ...n }));

  initProvidedLists();
  initSortLabels();
  applyModeUI();

  // default expected/selection:
  selectedAdjId = possAdj[0]?.id ?? null;
  selectedNounId = nouns[0]?.id ?? null;

  renderReels();
  generatePrompt();
})();
