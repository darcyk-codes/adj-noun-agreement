// Persisted key for mode
const KEY = "pm_prompt_mode"; // 'sl' | 'en'

// Elements
const btnSL = document.getElementById("btn-sl");
const btnEN = document.getElementById("btn-en");
const frameSL = document.getElementById("frame-sl");
const frameEN = document.getElementById("frame-en");
const status = document.getElementById("status");

// Apply a mode to the UI
function apply(mode, announce = false) {
  const isSL = mode === "sl";
  btnSL.setAttribute("aria-pressed", String(isSL));
  btnEN.setAttribute("aria-pressed", String(!isSL));

  frameSL.classList.toggle("hidden", !isSL);
  frameEN.classList.toggle("hidden", isSL);

  // Persist + reflect in URL for shareability
  localStorage.setItem(KEY, mode);
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.history.replaceState({}, "", url.toString());

  if (announce && status) {
    status.textContent = isSL ? "Mode: Slovene → English" : "Mode: English → Slovene";
    // Clear announcement after a moment to keep header tidy
    setTimeout(() => (status.textContent = ""), 1500);
  }
}

// Handlers
btnSL.addEventListener("click", () => apply("sl", true));
btnEN.addEventListener("click", () => apply("en", true));

// Initialize from URL ?mode=… or localStorage (default 'sl')
(function init() {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("mode");
  const stored = localStorage.getItem(KEY);
  apply((fromUrl === "sl" || fromUrl === "en") ? fromUrl : (stored || "sl"));
})();
