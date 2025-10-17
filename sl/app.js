// Resolve repo root even when this page is served from /sl/ or /en/
const ROOT = location.pathname.replace(/\/(sl|en)(?:\/.*)?$/, '');

/* ---------- Base adjective forms (flat) ---------- */
const ADJECTIVES_RAW = [
  { form:"moj",   gender:"m", number:"sg", owner:"my" },
  { form:"moja",  gender:"f", number:"sg", owner:"my" },
  { form:"moje",  gender:"n", number:"sg", owner:"my" },
  { form:"moji",  gender:"m", number:"pl", owner:"my" },
  { form:"moje",  gender:"f", number:"pl", owner:"my" },
  { form:"moja",  gender:"n", number:"pl", owner:"my" },

  { form:"tvoj",   gender:"m", number:"sg", owner:"your" },
  { form:"tvoja",  gender:"f", number:"sg", owner:"your" },
  { form:"tvoje",  gender:"n", number:"sg", owner:"your" },
  { form:"tvoji",  gender:"m", number:"pl", owner:"your" },
  { form:"tvoje",  gender:"f", number:"pl", owner:"your" },
  { form:"tvoja",  gender:"n", number:"pl", owner:"your" },

  { form:"njegov",   gender:"m", number:"sg", owner:"his" },
  { form:"njegova",  gender:"f", number:"sg", owner:"his" },
  { form:"njegovo",  gender:"n", number:"sg", owner:"his" },
  { form:"njegovi",  gender:"m", number:"pl", owner:"his" },
  { form:"njegove",  gender:"f", number:"pl", owner:"his" },
  { form:"njegova",  gender:"n", number:"pl", owner:"his" },

  { form:"njen",   gender:"m", number:"sg", owner:"her" },
  { form:"njena",  gender:"f", number:"sg", owner:"her" },
  { form:"njeno",  gender:"n", number:"sg", owner:"her" },
  { form:"njeni",  gender:"m", number:"pl", owner:"her" },
  { form:"njene",  gender:"f", number:"pl", owner:"her" },
  { form:"njena",  gender:"n", number:"pl", owner:"her" },

  { form:"naš",   gender:"m", number:"sg", owner:"our" },
  { form:"naša",  gender:"f", number:"sg", owner:"our" },
  { form:"naše",  gender:"n", number:"sg", owner:"our" },
  { form:"naši",  gender:"m", number:"pl", owner:"our" },
  { form:"naše",  gender:"f", number:"pl", owner:"our" },
  { form:"naša",  gender:"n", number:"pl", owner:"our" },

  { form:"vaš",   gender:"m", number:"sg", owner:"your-pl" },
  { form:"vaša",  gender:"f", number:"sg", owner:"your-pl" },
  { form:"vaše",  gender:"n", number:"sg", owner:"your-pl" },
  { form:"vaši",  gender:"m", number:"pl", owner:"your-pl" },
  { form:"vaše",  gender:"f", number:"pl", owner:"your-pl" },
  { form:"vaša",  gender:"n", number:"pl", owner:"your-pl" },

  { form:"njihov",   gender:"m", number:"sg", owner:"their" },
  { form:"njihova",  gender:"f", number:"sg", owner:"their" },
  { form:"njihovo",  gender:"n", number:"sg", owner:"their" },
  { form:"njihovi",  gender:"m", number:"pl", owner:"their" },
  { form:"njihove",  gender:"f", number:"pl", owner:"their" },
  { form:"njihova",  gender:"n", number:"pl", owner:"their" },
];

/* ---------- Utilities ---------- */
function shuffle(arr){ const a = arr.slice(); for (let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
function mod(n,m){ return ((n % m) + m) % m; }

/* ---------- Grouping ---------- */
function groupAdjectives(rows){
  const map = new Map();
  for(const r of rows){
    const key = `${r.form}||${r.owner}`;
    if(!map.has(key)) map.set(key, { form:r.form, owner:r.owner, variants:[] });
    map.get(key).variants.push({ gender:r.gender, number:r.number });
  }
  const gOrder = {m:0,f:1,n:2};
  const nOrder = {sg:0,pl:1,du:2};
  return Array.from(map.values()).map(x=>{
    const seen = new Set();
    x.variants = x.variants
      .filter(v=>{ const k=`${v.gender}|${v.number}`; if(seen.has(k)) return false; seen.add(k); return true; })
      .sort((a,b)=> (gOrder[a.gender]-gOrder[b.gender]) || (nOrder[a.number]-nOrder[b.number]));
    return x;
  });
}

function groupNouns(rows){
  const map = new Map();
  const conflicts = [];
  const gOrder = {m:0,f:1,n:2};
  const nOrder = {sg:0,pl:1,du:2};

  for(const r of rows){
    if(!r || !r.noun) continue;
    const key = r.noun.normalize('NFC');
    if(!map.has(key)){
      map.set(key, { noun:key, english:r.english, variants:[{gender:r.gender, number:r.number}] });
    } else {
      const entry = map.get(key);
      if (entry.english !== r.english){
        conflicts.push({ noun:key, first:entry.english, other:r.english });
      }
      entry.variants.push({ gender:r.gender, number:r.number });
    }
  }
  const groups = Array.from(map.values()).map(x=>{
    const seen = new Set();
    x.variants = x.variants
      .filter(v=>{ const k=`${v.gender}|${v.number}`; if(seen.has(k)) return false; seen.add(k); return true; })
      .sort((a,b)=> (gOrder[a.gender]-gOrder[b.gender]) || (nOrder[a.number]-nOrder[b.number]));
    return x;
  });

  if (conflicts.length){
    const msg = conflicts
      .slice(0,6)
      .map(c=>`• “${c.noun}”: using "${c.first}", ignoring "${c.other}"`)
      .join('\n');
    alert('Some nouns had conflicting English glosses. Using the first value found.\n' + msg + (conflicts.length>6?'\n…':''));
  }
  return groups;
}

/* ---------- Starter nouns (flat) ---------- */
const NOUNS_START = [
  { noun:"hiša",  gender:"f", number:"sg", english:"house" },
  { noun:"mesto", gender:"n", number:"sg", english:"city" },
  { noun:"maček", gender:"m", number:"sg", english:"kitten" },
  { noun:"mački", gender:"m", number:"pl", english:"kittens" },
  { noun:"sestre",gender:"f", number:"pl", english:"sisters" },
];

/* ---------- State ---------- */
let showHints = true;

// Sorting modes: 'random' or 'alpha'
let adjSortMode = 'random';
let nounSortMode = 'random';

// Keep a stable base list for each; rebuild ordered copies from these
let ADJ_GROUPS_BASE = groupAdjectives(ADJECTIVES_RAW);
let NOUN_GROUPS_BASE = groupNouns(NOUNS_START);

let ADJ_GROUPS = []; // ordered working copies
let NOUN_GROUPS = [];

let adjLen = 0;
let nounLen = 0;
let adjPos = 0;
let nounPos = 0;

/* ---------- DOM ---------- */
const adjReel = document.getElementById('adjReel');
const nounReel = document.getElementById('nounReel');
const adjTrack = document.getElementById('adjTrack');
const nounTrack = document.getElementById('nounTrack');
const adjBadge = document.getElementById('adjBadge');
const nounBadge = document.getElementById('nounBadge');
const adjKeys  = document.getElementById('adjKeys');
const nounKeys = document.getElementById('nounKeys');
const btnShowHints = document.getElementById('toggleHints');
const promptText = document.getElementById('promptText');
const resultLine = document.getElementById('resultLine');
const explain = document.getElementById('explain');
const fileNameEl = document.getElementById('fileName');
const encodingLabel = document.getElementById('encodingLabel');
const csvWarn = document.getElementById('csvWarn');
const providedSelect = document.getElementById('providedSelect');
const loadProvidedBtn = document.getElementById('loadProvidedBtn');
const providedHint = document.getElementById('providedHint');

const btnAdjSort  = document.getElementById('toggleAdjSort');
const btnNounSort = document.getElementById('toggleNounSort');

const buttons = {
  newPromptBtn: document.getElementById('newPromptBtn'),
  checkBtn: document.getElementById('checkBtn'),
  adjPrev: document.getElementById('adjPrev'),
  adjNext: document.getElementById('adjNext'),
  nounPrev: document.getElementById('nounPrev'),
  nounNext: document.getElementById('nounNext'),
  fileInput: document.getElementById('fileInput'),
};

/* ---------- Helpers ---------- */
function clearPromptUI(){
  window.promptState = null;
  promptText.textContent = 'Tap “New Prompt”';
  resultLine.textContent = '—';
  explain.textContent = 'Spin both reels to match the prompt, then press “Check”.';
}

/* ---------- Reels rendering ---------- */
function centerOffsetFor(trackEl){
  const ITEM_H = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--itemH')) || 44;
  const reelEl = trackEl.parentElement; const reelH = reelEl.clientHeight || 240;
  return { ITEM_H, centerOffset: (reelH/2 - ITEM_H/2) };
}
function buildReel(trackEl, items, renderFn){
  const repeated=[];
  for (let r=0;r<5;r++){
    for (let i=0;i<items.length;i++){
      repeated.push(`<div class="reelItem">${renderFn(items[i])}</div>`);
    }
  }
  trackEl.innerHTML = repeated.join('');
}
function renderByPos(trackEl, len, pos){
  const { ITEM_H, centerOffset } = centerOffsetFor(trackEl);
  const y = -(pos*ITEM_H - centerOffset); trackEl.style.transform=`translateY(${y}px)`;
  const items = trackEl.querySelectorAll('.reelItem'); items.forEach(el=>el.classList.remove('selected'));
  const selectedEl = items[pos]; if (selectedEl) selectedEl.classList.add('selected');
  if (pos < 1*len || pos > 4*len){
    const newPos = 2*len + mod(pos, len);
    const prev = trackEl.style.transition; trackEl.style.transition='none';
    const y2 = -(newPos*ITEM_H - centerOffset); trackEl.style.transform=`translateY(${y2}px)`; trackEl.offsetHeight; trackEl.style.transition = prev; return newPos;
  }
  return pos;
}
function stepAdj(delta){ adjPos = renderByPos(adjTrack, adjLen, adjPos + (delta>0?1:-1)); updateBadges(); }
function stepNoun(delta){ nounPos = renderByPos(nounTrack, nounLen, nounPos + (delta>0?1:-1)); updateBadges(); }

/* Wheel, touch, keyboard handlers */
function wheelHandlerFactory(kind){
  let acc = 0, ticking = false;
  return function(e){
    e.preventDefault(); acc += e.deltaY;
    if (ticking) return; ticking = true;
    setTimeout(()=>{ if (acc > 6) (kind==='adj'?stepAdj(+1):stepNoun(+1));
                     else if (acc < -6) (kind==='adj'?stepAdj(-1):stepNoun(-1));
                     acc = 0; ticking = false; }, 50);
  }
}
function touchHandlerFactory(kind){
  let startY=null;
  return {
    start(e){ startY = e.touches[0].clientY; },
    move(e){
      if(startY==null) return;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > 18){ (kind==='adj'?stepAdj(dy<0?+1:-1):stepNoun(dy<0?+1:-1)); startY = e.touches[0].clientY; }
      e.preventDefault();
    },
    end(){ startY=null; }
  }
}
function keyHandlerFactory(kind){
  return function(e){
    if (['ArrowDown','ArrowRight','ArrowUp','ArrowLeft',' '].includes(e.key)){
      e.preventDefault();
      if (e.key==='ArrowDown' || e.key==='ArrowRight' || e.key===' ') (kind==='adj'?stepAdj(+1):stepNoun(+1));
      if (e.key==='ArrowUp'   || e.key==='ArrowLeft')                 (kind==='adj'?stepAdj(-1):stepNoun(-1));
    }
  }
}

/* ---------- Chips rendering ---------- */
function chip(cls){ const d=document.createElement('div'); d.className=`keychip ${cls}`; d.textContent=cls.toUpperCase(); return d; }
function renderAdjVariants(container, variants){
  container.innerHTML='';
  if(!showHints){ container.classList.add('hidden'); return; }
  container.classList.remove('hidden');
  for(const v of variants){
    const line = document.createElement('div'); line.className='keyline';
    line.appendChild(chip(v.gender)); line.appendChild(chip(v.number));
    container.appendChild(line);
  }
}
function renderNounVariants(container, variants){
  container.innerHTML='';
  if(!showHints){ container.classList.add('hidden'); return; }
  container.classList.remove('hidden');
  for(const v of variants){
    const line = document.createElement('div'); line.className='keyline';
    line.appendChild(chip(v.gender)); line.appendChild(chip(v.number));
    container.appendChild(line);
  }
}

/* ---------- Current selections ---------- */
function currentAdj(){ return ADJ_GROUPS[mod(adjPos, adjLen)]; }
function currentNoun(){ return NOUN_GROUPS[mod(nounPos, nounLen)]; }

function updateBadges(){
  const a=currentAdj(), n=currentNoun();
  adjBadge.textContent = a ? `Selected: ${a.form}` : 'Selected: —';
  nounBadge.textContent = n ? `Selected: ${n.noun}` : 'Selected: —';
  if (a) renderAdjVariants(adjKeys, a.variants); else adjKeys.innerHTML='';
  if (n) renderNounVariants(nounKeys, n.variants); else nounKeys.innerHTML='';
  btnShowHints.textContent = `Show Hints: ${showHints?'ON':'OFF'}`;
}

/* ---------- Prompt & feedback ---------- */
function ownerLabel(owner){ return owner === 'your-pl' ? 'YOU ALL' : String(owner).toUpperCase(); }
function featAbbrev(g, n){ return `${g}/${n}`.toLowerCase(); }

function newPrompt(){
  if(!NOUN_GROUPS.length){ promptText.textContent='Upload your noun list (CSV) to start'; return; }
  const nounIdx=Math.floor(Math.random()*NOUN_GROUPS.length);
  const chosen=NOUN_GROUPS[nounIdx];
  const owners=[...new Set(ADJECTIVES_RAW.map(a=>a.owner))];
  const owner=owners[Math.floor(Math.random()*owners.length)];
  window.promptState={ owner, targetNounIndex: nounIdx, nounEnglish: chosen.english };
  promptText.textContent=`${owner.replace('-pl',' (you all)')} ${chosen.english}`;
  resultLine.textContent='—';
  explain.textContent='Spin both reels to match the prompt, then press “Check”.';
}

function check(){
  const st = window.promptState; if(!st){ explain.textContent='Create a prompt first.'; return; }
  const a=currentAdj(), n=currentNoun(), target=NOUN_GROUPS[st.targetNounIndex];

  const ownerOK  = (a.owner===st.owner);
  const agreeOK  = a.variants.some(av => n.variants.some(nv => av.gender===nv.gender && av.number===nv.number));
  const nounOK   = (n.noun===target.noun);
  const allOK    = ownerOK && agreeOK && nounOK;

  resultLine.textContent=allOK?'✅ Correct!':'❌ Not quite';

  if (showHints){
    const adjFeat = a.variants.map(v => featAbbrev(v.gender, v.number)).join(', ');
    const nounFeat = n.variants.map(v => featAbbrev(v.gender, v.number)).join(', ');
    const parts=[];
    parts.push(`Prompt: ${st.owner} + “${target.english}”`);
    parts.push(`You chose adj: “${a.form}” (${ownerLabel(a.owner)} ${adjFeat})`);
    parts.push(`and noun: “${n.noun}” (${String(n.english).toUpperCase()} ${nounFeat}).`);
    explain.textContent = parts.join(' ');
  } else {
    explain.textContent = allOK ? '' : 'Try again.';
  }
}

/* ---------- Sorting logic ---------- */
function sortAdj(mode){
  adjSortMode = mode;
  btnAdjSort.textContent = `Adj order: ${mode==='alpha'?'A–Z':'Random'}`;

  const current = currentAdj(); // remember current selection to preserve it
  let next = [];
  if (mode === 'alpha') {
    next = [...ADJ_GROUPS_BASE].sort((a,b)=> a.form.localeCompare(b.form,'sl',{sensitivity:'base'}));
  } else {
    next = shuffle(ADJ_GROUPS_BASE);
  }
  ADJ_GROUPS = next;
  adjLen = ADJ_GROUPS.length;

  // rebuild track
  const targetIndex = current ? ADJ_GROUPS.findIndex(x => x.form===current.form && x.owner===current.owner) : 0;
  buildReel(adjTrack, ADJ_GROUPS, a=>a.form);
  adjPos = 2*adjLen + (targetIndex>=0?targetIndex:0);
  requestAnimationFrame(()=>{ adjPos = renderByPos(adjTrack, adjLen, adjPos); updateBadges(); });
}

function sortNoun(mode){
  nounSortMode = mode;
  btnNounSort.textContent = `Noun order: ${mode==='alpha'?'A–Z':'Random'}`;

  const current = currentNoun();
  let next = [];
  if (mode === 'alpha') {
    next = [...NOUN_GROUPS_BASE].sort((a,b)=> a.noun.localeCompare(b.noun,'sl',{sensitivity:'base'}));
  } else {
    next = shuffle(NOUN_GROUPS_BASE);
  }
  NOUN_GROUPS = next;
  nounLen = NOUN_GROUPS.length;

  const targetIndex = current ? NOUN_GROUPS.findIndex(x => x.noun===current.noun) : 0;
  buildReel(nounTrack, NOUN_GROUPS, n=>n.noun);
  nounPos = 2*nounLen + (targetIndex>=0?targetIndex:0);
  requestAnimationFrame(()=>{ nounPos = renderByPos(nounTrack, nounLen, nounPos); updateBadges(); });
}

/* ---------- Build ---------- */
function buildAll(){
  // initialize ordered copies from BASE using current sort modes
  sortAdj(adjSortMode);
  sortNoun(nounSortMode);
}

/* ---------- Provided lists loader (nouns/manifest.json) ---------- */
async function loadProvidedIndex(){
  try{
    const res = await fetch(`${ROOT}/nouns/manifest.json`, {cache:'no-cache'});
    if(!res.ok) throw new Error('manifest.json not found');
    const items = await res.json();
    if (!Array.isArray(items) || !items.length) throw new Error('no items');

    providedSelect.innerHTML = '';
    for (const it of items){
      const path = (it.file && it.file.startsWith('nouns/')) ? it.file : `nouns/${it.file}`;
      const label = it.label || (it.file ? it.file : path.split('/').pop());
      if (!path) continue;
      const o = document.createElement('option');
      o.value = `${ROOT}/${path}`;
      o.textContent = label;
      providedSelect.appendChild(o);
    }
    providedSelect.disabled = false;
    loadProvidedBtn.disabled = false;
    providedHint.textContent = 'Pick a list and click Load Selected.';
  }catch(e){
    providedSelect.innerHTML = '<option>No provided lists found</option>';
    providedSelect.disabled = true;
    loadProvidedBtn.disabled = true;
    providedHint.textContent = 'Tip: add nouns/manifest.json to list your CSVs.';
  }
}

async function loadProvidedCSV(path){
  try{
    fileNameEl.textContent = path.split('/').pop();
    encodingLabel.textContent = '(provided)';
    csvWarn.classList.remove('show');

    const res = await fetch(path, {cache:'no-cache'});
    if(!res.ok) throw new Error('CSV not found');
    const text = await res.text();

    const rows = parseCSV(text);
    const header=rows.shift()||[];
    const idxN=header.findIndex(h=>h.trim().toLowerCase()==='noun');
    const idxG=header.findIndex(h=>h.trim().toLowerCase()==='gender');
    const idxU=header.findIndex(h=>h.trim().toLowerCase()==='number');
    const idxE=header.findIndex(h=>h.trim().toLowerCase()==='english');
    const parsed=[];
    for(const r of rows){
      if(!r.length) continue;
      const noun=r[idxN]?.trim();
      const gender=(r[idxG]||'').trim().toLowerCase();
      const number=(r[idxU]||'').trim().toLowerCase();
      const english=(r[idxE]||'').trim();
      if(noun && ['m','f','n'].includes(gender) && ['sg','pl'].includes(number) && english){
        parsed.push({ noun, gender, number, english });
      }
    }

    NOUN_GROUPS_BASE = groupNouns(parsed);   // update base with new dataset
    sortNoun(nounSortMode);                  // reapply current sort mode
    clearPromptUI();                         // reset prompt/feedback
    providedHint.textContent = `Loaded ${parsed.length} entries.`;
  }catch(err){
    providedHint.textContent = `Couldn’t load list: ${err.message}`;
  }
}

/* ---------- Custom CSV upload ---------- */
buttons.fileInput.addEventListener('change', async (e)=>{
  const file=e.target.files?.[0]; if(!file) return;
  fileNameEl.textContent=file.name; csvWarn.classList.remove('show'); encodingLabel.textContent='';

  const res = await readFileAsTextSmart(file, ['utf-8','windows-1250','iso-8859-2']);
  const text = res.text; if (res.enc) encodingLabel.textContent = `Encoding detected: ${res.enc.toUpperCase()}`;

  const rows=parseCSV(text);
  const header=rows.shift()||[];
  const idxN=header.findIndex(h=>h.trim().toLowerCase()==='noun');
  const idxG=header.findIndex(h=>h.trim().toLowerCase()==='gender');
  const idxU=header.findIndex(h=>h.trim().toLowerCase()==='number');
  const idxE=header.findIndex(h=>h.trim().toLowerCase()==='english');
  const parsed=[];
  for(const r of rows){
    if(!r.length) continue;
    const noun=r[idxN]?.trim();
    const gender=(r[idxG]||'').trim().toLowerCase();
    const number=(r[idxU]||'').trim().toLowerCase();
    const english=(r[idxE]||'').trim();
    if(noun && ['m','f','n'].includes(gender) && ['sg','pl'/*,'du'*/].includes(number) && english){
      parsed.push({ noun, gender, number, english });
    }
  }

  const replacedCount = parsed.filter(x => x.noun.includes('?')).length;
  const hasDiacritics = /[čšžČŠŽ]/.test(text);
  if (parsed.length && replacedCount >= 2 && !hasDiacritics){
    csvWarn.classList.add('show');
  }

  NOUN_GROUPS_BASE = groupNouns(parsed); // update base
  sortNoun(nounSortMode);                // reapply current sort
  clearPromptUI();                       // reset prompt/feedback
});

/* ---------- Heuristic decoder + CSV parser ---------- */
async function readFileAsTextSmart(file, encodings=['utf-8']){
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let best = {text:'', score:Infinity, hasDiacritics:false, enc:''};
  const dia = /[čšžČŠŽ]/;
  for(const enc of encodings){
    try{
      const dec = new TextDecoder(enc, {fatal:false});
      const text = dec.decode(bytes);
      const replacements = (text.match(/\uFFFD/g)||[]).length;
      const hasDia = dia.test(text);
      const score = replacements;
      if (score < best.score || (score===best.score && hasDia && !best.hasDiacritics)){
        best = {text, score, hasDiacritics:hasDia, enc};
      }
    }catch{}
  }
  if (!best.text){
    const fallback = new TextDecoder().decode(bytes);
    best = {text:fallback, enc:'utf-8', score:0, hasDiacritics:dia.test(fallback)};
  }
  return best;
}

function parseCSV(text){
  const out=[]; let row=[], val='', inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(c==='"'){ if(inQ&&n==='"'){ val+='"'; i++; } else inQ=!inQ; }
    else if(c===','&&!inQ){ row.push(val); val=''; }
    else if((c=== '\n' || c=== '\r') && !inQ){
      if(val.length||row.length){ row.push(val); out.push(row); row=[]; val=''; }
      if(c=== '\r' && n=== '\n') i++;
    } else { val+=c; }
  }
  if(val.length||row.length){ row.push(val); out.push(row); }
  return out;
}

/* ---------- Events & Init ---------- */
buttons.newPromptBtn.addEventListener('click', newPrompt);
buttons.checkBtn.addEventListener('click', check);
btnShowHints.addEventListener('click', ()=>{ showHints=!showHints; updateBadges(); });

buttons.adjPrev.addEventListener('click', ()=>stepAdj(-1));
buttons.adjNext.addEventListener('click', ()=>stepAdj(+1));
buttons.nounPrev.addEventListener('click', ()=>stepNoun(-1));
buttons.nounNext.addEventListener('click', ()=>stepNoun(+1));

adjReel.addEventListener('wheel', wheelHandlerFactory('adj'), {passive:false});
nounReel.addEventListener('wheel', wheelHandlerFactory('noun'), {passive:false});
const adjTouch = touchHandlerFactory('adj'); const nounTouch = touchHandlerFactory('noun');
adjReel.addEventListener('touchstart', adjTouch.start, {passive:true});
adjReel.addEventListener('touchmove', adjTouch.move, {passive:false});
adjReel.addEventListener('touchend', adjTouch.end, {passive:true});
nounReel.addEventListener('touchstart', nounTouch.start, {passive:true});
nounReel.addEventListener('touchmove', nounTouch.move, {passive:false});
nounReel.addEventListener('touchend', nounTouch.end, {passive:true});
adjReel.addEventListener('keydown', keyHandlerFactory('adj'));
nounReel.addEventListener('keydown', keyHandlerFactory('noun'));

loadProvidedBtn.addEventListener('click', ()=>{
  const val = providedSelect.value;
  if (val && !providedSelect.disabled) loadProvidedCSV(val);
});

btnAdjSort.addEventListener('click', ()=>{
  sortAdj(adjSortMode==='random' ? 'alpha' : 'random');
});
btnNounSort.addEventListener('click', ()=>{
  sortNoun(nounSortMode==='random' ? 'alpha' : 'random');
});

/* Build & load lists */
buildAll();
loadProvidedIndex();

/* ---------- PWA: service worker registration with update flow ---------- */
(function registerSWWithUpdates(){
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;

  function showUpdateToast(onClick){
    if (document.querySelector('.update-toast')) return;
    const bar = document.createElement('div');
    bar.className = 'update-toast';
    bar.innerHTML = `
      <span>🔄 An update is available.</span>
      <button class="btn" id="laterBtn">Later</button>
      <button class="btn primary" id="applyBtn">Update now</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('#laterBtn').addEventListener('click', ()=> bar.remove());
    bar.querySelector('#applyBtn').addEventListener('click', ()=> onClick?.());
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try{
      const reg = await navigator.serviceWorker.register(`${ROOT}/service-worker.js`);
      console.log('[SW] registered', reg.scope);

      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(() => {
              if (reg.waiting) {
                reg.waiting.postMessage('SKIP_WAITING');
              } else if (reg.installing && reg.installing.state === 'installed') {
                reg.installing.postMessage('SKIP_WAITING');
              }
            });
          }
        });
      });

      setInterval(() => reg.update().catch(()=>{}), 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(()=>{});
      });
    }catch(err){
      console.warn('[SW] registration failed', err);
    }
  });
})();
