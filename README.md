# Possessive Match — Slovene / English App

A bilingual interactive language practice app that helps users learn Slovene possessive adjectives and noun agreement.  
The app now supports **two fully isolated modes** — one for *Slovene → English* and another for *English → Slovene* — managed by a safe top-level iframe shell.

---

## 🗂️ Project Structure

```
/index.html          ← Shell page (iframe switcher)
/switcher.js         ← Controls the mode toggle (SL↔EN)
/service-worker.js   ← Shared PWA service worker (optional)
/manifest.webmanifest
/styles.css
/icons/              ← Shared app icons
/nouns/              ← Shared CSV noun lists + manifest.json

/sl/                 ← Slovene → English mode
  index.html         ← App interface (Slovene prompt, English output)
  app.js             ← Stable baseline logic (unmodified core)

/en/                 ← English → Slovene mode
  index.html         ← Mirror interface (English prompt, Slovene output)
  app.js             ← Minimal diff: flipped prompt direction only
```

Both `/sl/` and `/en/` share the same data (`/nouns/manifest.json`, CSVs, and icons).  
The shell switches between them seamlessly using iframes.

---

## 🚀 Running Locally

You can open the app directly in a browser by launching the shell:

```
file:///path/to/project/index.html
```

or, to enable full PWA and service worker features, serve it with any simple local HTTP server:

```bash
# Python 3
python -m http.server 8080
# then visit: http://localhost:8080/
```

---

## 🔄 Switching Between Modes

The top-level shell provides a toggle in the header:

- **SL → EN** shows `/sl/index.html` (Slovene → English)
- **EN → SL** shows `/en/index.html` (English → Slovene)

The choice is remembered in `localStorage` and also reflected in the URL (`?mode=sl` or `?mode=en`).

Each mode runs in an isolated iframe — no shared JS context — ensuring stability and preventing regressions.

---

## 🧩 Custom Noun Lists

You can load nouns via:

- **Provided lists** listed in `nouns/manifest.json`
- **Upload CSV** (`noun,gender,number,english`)

Ensure your file is saved as **CSV UTF-8** so Slovene characters (`č, š, ž`) import correctly.

Example rows:
```
hiša,f,sg,house
mački,m,pl,kittens
mesto,n,sg,city
```

---

## ⚙️ Editing / Maintaining

| Area | File(s) | Notes |
|------|----------|-------|
| **Shell & Mode Toggle** | `/index.html`, `/switcher.js` | Controls iframe visibility and mode persistence |
| **Slovene → English logic** | `/sl/app.js` | Stable baseline |
| **English → Slovene logic** | `/en/app.js` | Minimal diff — flipped prompt direction |
| **Visual layout** | `/sl/index.html`, `/en/index.html`, `/styles.css` | Keep structure aligned; titles and labels differ |
| **Shared data** | `/nouns/manifest.json`, `/nouns/*.csv` | Used by both apps |
| **Icons / Branding** | `/icons/` | Used in both apps |

When updating logic, test both modes independently in their iframes to confirm behavior parity.

---

## 🧠 Developer Tips

- **Never merge modes into one file** — each mode should stay fully self-contained.
- If adding new shared functions (e.g., CSV parsing improvements), copy tested changes into both `app.js` files.
- You can freely refactor shared code later into a `shared/` module if desired, but keep each mode’s `init()` isolated.
- To bump the Service Worker version, increment a constant (e.g., `const SW_VERSION = 'v2';`) inside `service-worker.js`.

---

## ✅ Developer Checklist (before each commit)

- [ ] Both modes load without console errors.
- [ ] CSVs load correctly (no 404s).
- [ ] Prompt and feedback text show in the correct language direction.
- [ ] Reels scroll, click, and stay synced.
- [ ] Hint bubbles show colored chips when enabled.
- [ ] Service Worker updates on refresh (if changed).

---

## 📜 License

MIT License — freely usable and modifiable for learning or educational projects.

---

**Maintained by:**  
Darcy Ellarby  
*“Possessive Match — Slovene Nouns” bilingual version*
