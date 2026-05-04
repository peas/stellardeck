# stellardeck

A markdown presentation tool: write Deckset-flavored markdown, get a polished slideshow with auto-inferred layouts, no build step, render parity across desktop (Electron), browser, embed, and CLI export.

## What StellarDeck is

Built on four ideas:

1. **Storytelling.** Slides are moments. Markdown's constraints keep focus on what you're saying.
2. **Autoflow.** Convention over configuration. Write content, get layouts. 9 rules, anti-monotony. Default ON — opt-out with `autoflow: false`.
3. **Agent-native.** CLI with JSON output, stdin, batch mode, structured diagnostics. `--preview` opens browser, `--serve` starts dev server. Agents create decks from source text, export, validate, iterate.
4. **Simple.** No build step, no bundler. The `.md` file is the artifact. Render parity across Electron, browser, embed, CLI.

Design principle: **"Can an LLM generate this?"** If yes, it belongs. If no, it doesn't.

## Working with your own decks

StellarDeck doesn't bundle decks — they live wherever you keep them. Most users have a directory of `.md` files separate from this repo.

**To tell Claude Code (or any agent) where your decks live**, create a `CLAUDE.local.md` at the repo root (it's gitignored). For example:

```markdown
## My deck directory

My personal decks live in `~/my-decks/`. When working on engine features, smoke
test against decks in that directory before committing.

When I say "open my deck X" or "validate my decks", look there first.
```

This pattern keeps personal paths out of the public repo while still giving agents enough context to navigate.

**Repo relationship with `~/presentations-paulo`:**

| | This repo (`~/stellardeck`) | `~/presentations-paulo` |
|---|---|---|
| **Purpose** | Engine, CLI, tests, demo decks, site | Paulo's actual talk decks |
| **Sample decks** | `demo/` (bean-to-bar, hand-balancing, vibe-coding) | NOT here (removed) |
| **Paulo's talks** | NOT here | `vibe/`, `1bi-dev/`, `vibecoders-builders-hipsters/`, etc. |
| **Engine code** | Canonical source | Copy (synced via `sync-to-stellardeck.sh`) |
| **Recent decks index** | N/A | `recent-decks.jsonl` |

When Paulo says "open my talk X" → look in `~/presentations-paulo/recent-decks.jsonl`.
When editing engine/CLI/autoflow → edit here in `~/stellardeck`.

## Commands

```bash
npm install                # install deps (sharp, pdf-lib)
npm run serve              # python3 dev-server.py 3031 (no-cache headers)
npm test                   # 318 unit tests (~3s): parser, helpers, autoflow, structure, CLI, diagnostics
npm run test:e2e           # 70 Playwright E2E tests (chromium)
npm run test:layout        # 32 layout + consistency tests
npm run test:export        # 40 CLI integration tests (PDF, PNG, grid, batch, warnings)
npm run test:export:unit   # export unit tests only (no browser)
npm run test:visual        # 18 visual regression tests
npm run test:all           # all of the above
npm run preview -- deck.md # open in browser (starts server, Ctrl+C stops)
npm run export -- deck.md  # export (--pdf default, --png, --grid, --json, --help)
npm run export -- --serve  # start dev server + open viewer
npm run pdf -- deck.md     # alias for --pdf
npm run electron -- deck.md     # fast desktop dev (menu says "Electron")
npm run electron:dev -- deck.md # same + ELECTRON_DEV=1 (hot reload, devtools)
npm run app -- deck.md          # packaged StellarDeck.app (menu says "StellarDeck")
npm run package                 # build .app without launching
npm run make                    # produce .dmg + .zip via electron-forge
```

## Project structure

```
.
├── viewer.html               # App shell
├── autoflow.js               # Autoflow layout inference (browser global + CommonJS)
├── slides2.js / slides2.css  # StellarSlides engine (sole engine)
├── deckset-parser.js         # Markdown → slide HTML
├── diagnostics.js            # Deck health checks: overflow, missing-image, empty-slide, code-no-lang
├── print-mode.js             # Shared enter/exit print mode (used by CLI + in-browser export)
├── constants.js              # CDN URLs + slide dimensions
├── css/                      # themes.css, layout.css, chrome.css, presenter.css
├── js/                       # Main app modules (ES modules)
├── embed/                    # Embeddable API (stellar-embed.js, playground)
├── scripts/                  # CLI export, dev-server, helpers
├── test/                     # Unit + integration tests
├── docs/                     # format-spec.yaml, autoflow plan, roadmap
├── electron/                 # Electron 40 desktop shell (main + preload + icons)
├── demo/                     # Demo decks (bean-to-bar, hand-balancing, vibe-coding)
└── .claude/skills/stellardeck/ # Claude Code skill: source text → slides
```

## Architecture (1-paragraph version)

A `.md` file is parsed by `deckset-parser.js` into a list of `<section>` HTML, optionally pre-processed by `autoflow.js` (which infers layouts from content shape), then rendered by `slides2.js` (the StellarSlides engine — vanilla JS, ~380 lines). The same pipeline runs in 4 environments: Electron (Chromium + Node), browser (`viewer.html`), embed (`stellar-embed.js`), and CLI (`scripts/export.js` via Playwright). `stellar-embed.js` is the shared rendering layer for embed; the other three reuse the engine modules directly. **Render parity is a hard rule** — never add a feature in one environment without the others.

## Module system gotcha

Plain scripts (`autoflow.js`, `deckset-parser.js`, `slides2.js`, `diagnostics.js`, `print-mode.js`, `constants.js`) expose **both** browser globals AND `module.exports` for Node tests. ES modules (`js/*.js`) import from each other and access globals via `window`. Why: WKWebView + ES modules fail silently on 404. Don't convert these to ES modules.

## Format

Deckset markdown: `---` = separator, `![right]()` / `![left]()` = split, `![filtered]()` = dark overlay background, `![inline]()` = inline image, `![fit]()` = contain background, `#[fit]` = auto-fit heading, `#[top-left]` = positioned, `^` = speaker note, `[.background-color: #hex]` = per-slide. Full spec: `docs/format-spec.yaml` (66 features).

## Autoflow

Convention-over-configuration layout inference. Adding a rule = 1 function + 1 entry in the `RULES` array.

| Rule | Detection | Transform |
|------|-----------|-----------|
| title | First slide, 2+ paragraphs, short title | `#[fit]` centered + subtitle |
| divider | 1-2 word slide | `#[fit]` heading |
| diagonal | 2 paragraphs, ≥1 ends "?" | `#[top-left]` + `#[bottom-right]` |
| z-pattern | 4 short paragraphs | 4-corner grid |
| alternating | 3+ short paragraphs | `[.alternating-colors: true]` |
| statement | 1-4 short lines (≤8 words) | `#[fit]`, varied alignment |
| split | 1 bare image + text | `![right]`/`![left]` alternating |
| autoscale | >8 lines OR >80 words | `[.autoscale: true]` |

Anti-monotony: statements vary alignment, diagonals mirror corners. Skip checks: explicit directives, code fences, custom blocks.

## CLI (`scripts/export.js`)

Multi-format export built on a shared `captureSlides()` → `exportByFormat()` pipeline.

- Formats: `--pdf` (default), `--png` (one per slide), `--grid` (composite via sharp)
- Filters: `--slides 1-5,7` (range/list), `--theme`, `--scheme`, `--autoflow`, `--scale`
- Batch: `--input-dir dir --output dir` (shared browser session across files)
- Validation: `--validate` (no export, just diagnostics), `--list-themes`, `--list-schemes <theme>`
- Agent: `--json` (typed output), stdin (`-`), structured warnings
- Throws `CLIError` / `HelpRequested` (testable, no `process.exit` in `parseArgs`)

## Diagnostics

Structured warnings (`{type, severity, slide, message}`) consumed by:

- **CLI**: per-slide checks during capture + network-level image detection
- **App**: toolbar badge + floating panel, incremental on navigation
- **Embed**: `onDiagnostics` callback in `renderDeck()` options

Types: `overflow`, `missing-image`, `empty-slide`, `code-no-lang`, `theme-mismatch`, `slide-out-of-range`.

## Working Conventions

- All scripts have `--help`
- CSS/layout changes require `npm run test:visual` before committing
- `test/smoke-test.md` is the reference for all supported features
- PDFs are gitignored (regenerable)
- StellarDeck NEVER edits the `.md` file — config lives in `.stellar.json` sidecars
- **Adding a dependency**: update `package.json` AND run `npm install` to refresh `package-lock.json`. CI runs `npm ci` and will fail with `EUSAGE` if the lockfile drifts.

## Roadmap

### Immediate (0.9)
- GitHub Actions CI: green
- Tag v0.9.0 + release
- Skill `stellardeck`: source text → slides with scoring (in `.claude/skills/stellardeck/`)
- **Pre-release audit: hunt for any leftover reference to `presentations-paulo`** in code, docs, comments, tests, fixtures, or scripts. If unit/e2e tests pass on a fresh CI clone there shouldn't be any (verified 2026-04-09 with run `24203683873`), but do a final `grep -r presentations-paulo` and `grep -r /Users/peas` over the repo before tagging the first public release. Only `CLAUDE.md` (intentional historical note) and `CLAUDE.local.md` (gitignored) are allowed to mention it.

### Cleanup before VS Code + npm (sequenced — do in this order, 2026-05-04)

The `core-extraction` branch shipped `@stellardeck/core@0.1.0` (steps 1-8 of `project_core_extraction_plan.md`, tag `@stellardeck/core@0.1.0`). Three things need to happen before merging that branch and moving on to the VS Code extension + the public `@stellardeck` npm scope claim:

1. **Fix the `Reveal.on('ready', fn)` race in `slides2.js`.** Investigation on 2026-05-04 confirmed the `e2e.test.js` "syntax-highlight" failure is a real bug, not a flake: `Reveal.initialize()` schedules `setTimeout(() => emit('ready'), 0)` and main.js registers SIX `Reveal.on('ready', …)` handlers AFTER it runs. Trace-instrumentation showed every handler registers when `Reveal.isReady() === true` — the emit already ran, so none of them fire. Symptoms beyond the test: hljs syntax highlighting, QR codes, MathJax, Mermaid, sidebar thumbnails, chrome counter, presenter broadcasting all fail to initialise on first load (they only get covered up by later events: smartReload, slidechanged, resize). Fix: make the 'ready' handler "sticky" inside `slides2.js::on()` — if `event === 'ready'` and `this._state.ready`, schedule the handler with `setTimeout(handler, 0)`. Idempotency check: existing handlers (renderExtras, rebuildThumbnails, etc.) are safe to fire-on-late-register because they're idempotent and only act on un-processed elements (`pre code:not(.hljs)`, etc.). Add a unit test: register `Reveal.on('ready', fn)` AFTER `initialize()` resolves and assert `fn` fires.

2. **Fix the position-grid e2e test.** Same investigation: the "non-positioned content next to #[top-left] spans 2/3 width" test fails because `Reveal.slide(7)` followed by `waitForTimeout(200)` isn't enough — slide 7 hasn't been laid out yet, `getBoundingClientRect().width` returns 0, and `0 / 0 = NaN`. The `expect(widthRatio).toBeGreaterThan(0.5)` then fails on `NaN`. Fix at the test level: `await page.waitForSelector('.deckset-pos-left', { timeout: 5000 })` after `Reveal.slide(7)` instead of a fixed timeout. Validation: probe at 1500ms shows ratio = 0.57 — well above 0.5 — so the underlying CSS is fine.

3. **Refresh the 18 stale visual baselines.** Audit on 2026-05-04: ALL 18 failures are classified as stale baselines, not regressions. Evidence: 17 of 18 baseline PNGs are 1280×650 (captured before commit `b4e3bdc` on 2026-04-15) but the current slide-area renders at 1280×694 — toolbar/chrome shrunk somewhere between then and now. The 18th (grid-smoke) is 1280×720 baseline vs 1280×684 actual (chrome got slightly larger when grid view active). The accent-nordic baselines additionally show pre-`b4e3bdc` cyan-on-`<strong>` colouring which the new CSS rule `.sd-slide :is(h1,h2,h3,h4,h5,h6) strong { color: var(--r-main-color); }` correctly overrides. Plan: visually compare 2-3 actuals against current intent (done: default-dark-01 confirmed clean, accent-nordic-02 confirmed CSS-rule-driven), then run `npm run test:visual:update` to regenerate. CI will need a follow-up PR commit if it runs visuals.

Only after 1, 2 and 3 above are green:

4. **Merge `core-extraction` → `electron-migration`.** Confirm with Paulo first.
5. **Begin VS Code extension scaffold** (steps 9-11 of `project_core_extraction_plan.md`). The `@stellardeck/core/dist/browser-globals.global.js` is the consumer artifact the webview will load.
6. **Claim the `@stellardeck` npm scope + first public publish of `@stellardeck/core`.** Currently `private: true`. Plan recommends keeping private through the VS Code MVP so the first published version has a real consumer driving API stability — but the scope itself can be claimed any time (free, ~30s, prevents anyone else from grabbing the name).

### Post-0.9
- **VSCode + Obsidian extensions** (live preview, IntelliSense, diagnostics). Shared problem: how to tell a StellarDeck `.md` from any other markdown file. Can't activate on every `.md`. Options: (a) file extension convention `.deck.md`; (b) detect `.stellar.json` sidecar in same directory; (c) detect StellarDeck-specific frontmatter (`theme:`, `autoflow:`, `slidenumbers:`); (d) explicit activation via command palette / file-type override. Likely **(a) + (c)**: activate when file is `*.deck.md` OR contains Deckset/StellarDeck frontmatter. Both extensions share the same detection logic.
- Config file `.stellarrc` (workspace defaults)
- Server mode `stellardeck serve` (`?pdf`, `?pptx` endpoints)
- `@stellardeck/core` npm package
- `headingDivider` directive (auto-split at H1/H2)
- Custom slide sizes (4:3, 16:10)
- `--html` self-contained export
- `--parallel N` for batch
- Runtime theme registration
- **Autoflow rule: lone-URL → QR + clickable link below.** If a slide has only one URL line (optionally with a short label), autoflow renders the URL as a large centered QR code AND keeps the clickable link rendered below it in small text. Solves both use cases at once: the audience scans, the presenter clicks during demo. Heuristic: trigger when URL is the only meaningful content. No new directive needed — pure autoflow inference. Prototype behind a flag first.
- **REFACTOR (do this first): autoflow → declarative data-as-code.** Today `autoflow.js` is one ~600-line imperative file with rules embedded as functions. The new shape: an `autoflow/` directory with `engine.js` + `analyze.js` + `rules/<name>.js`, each rule a plain JS object with `name`, `priority`, `match(info, ctx)`, `transform(info, ctx)`, `skipIfDirective`. The `ctx` carries `state` (mutable across slides — `lastBareImageSide`, `lastSplitSide`, etc) and `history` (which rule fired on each previous slide), so rules can express "after 3 bullet slides in a row, switch to alternating-colors" naturally. Migration: add new dir alongside old file, migrate rule-by-rule keeping tests green, delete old file last. **Don't add new autoflow rules until this is done** — they'd just need rewriting. Sketch in `/tmp/autoflow-declarative-sketch.md` (2026-04-09).
- **Autoflow rule (post-refactor): bare images rotate position across deck.** When a slide has a bare `![](src)` (no `right/left/inline/qr/fit/filtered/bg` modifier), the autoflow assigns a position based on the LAST bare-image position used in the deck: rotate `center → left → right → center → ...`. The `center` variant leaves room for a 1-2 line title above the image (large hero treatment). NO aspect-ratio measurement in v1 — just rotate. This gives natural rhythm without the user thinking about it. Skip if a rule earlier in priority order already handled the slide.
- **Autoflow rule (post-refactor + later): bare image aspect-ratio aware layout.** Enhancement on top of bare-image-rotate. Measure the image at render time (in `js/render.js`, NOT in autoflow which is sync markdown→markdown), set a class on the parent slide (`is-portrait` / `is-landscape` / `is-square`), and let CSS pick the visual treatment: portrait → split (left or right), landscape → centered hero with text below. Needs a small JS helper (~10 lines) using `img.naturalWidth/Height`. Parser also needs to mark bare images with a class so the JS can find them.
- **Autoflow rule (post-refactor): rescue "1 phrase + 2-3 short bullets" slides.** Open question for the design: a slide with one headline and 2-3 short bullets renders as title + bulleted list, which feels flat in the middle of a deck. Pick from a small palette of layouts (`cards`, `pills`, `split-large-headline`, `alternating-bullets`) biased away from whatever was used last (anti-monotony). Each layout needs CSS + maybe a `[.layout: name]` directive in the parser. Sketch 2-3 layouts on a real deck before committing. Same approach for "4 short standalone phrases".
- **Diagnostic: distinguish "expected fit" from "real overflow".** The current `diagnostics.js` overflow check fires when any descendant goes past the slide frame. It does NOT misfire for `![fit]` images that letterbox (those stay inside the frame). But it's missing a positive signal: "image is fit-with-letterbox here, autoflow could choose a better layout". Useful for the bare-image-aspect rule above. Add a new diagnostic type `expected-fit` (or similar) — same severity as `info`, not `warn`.
- **Diagnostic: `statement-degraded` (info severity).** Emit when the statement rule used tier 3 (9-15 words/line, autoscale fallback). Tells the user the slide *did* render but lost the #[fit] impact treatment because the line is denser than ideal. Click navigates to the slide. Message: "tier-3 statement: line N has X words — consider splitting for stronger impact". Pairs with the existing graceful tier degradation in `autoflow.js::statementRule` so users get visual + textual feedback about why their slide looks smaller than other statement slides. (Step C of the 2026-05-02 design discussion; A shipped, C deferred.)

### 1.0
- Windows build + CI
- Polish from early adopter feedback
- MCP server (when interactive use cases emerge)
- ASCII art directive (`:::ascii` block, `figlet.js`)

### 2.0+
- PPTX/Google Slides importer → markdown + autoflow
- Web platform: GitHub OAuth + static editor

## Electron Dev Gotchas

- `npm run electron -- <deck.md> [<deck.md> …]` opens 1+ decks in a session — **fast**, but macOS menu bar says "Electron" because it reads the name from the unmodified Electron framework binary's Info.plist (`app.setName()` cannot rewrite it at runtime)
- `npm run app -- <deck.md> [<deck.md> …]` packages once (cached via mtime check) + opens `out/StellarDeck-<platform>-<arch>/StellarDeck.app`, so the menu bar correctly says "StellarDeck". Pass `--rebuild` after `--` to force a re-package
- `npm run package` builds the .app without launching it; `npm run make` builds distributable artifacts under `out/make/` (zip + .dmg on macOS) via `forge.config.js`
- The desktop runtime exposes `window.stellardeck.invoke(cmd, args)` (preload, sandboxed)
- `app://./viewer.html` serves the repo with a real origin (ES modules + fetch work)
- `deck://./<absolute-path>` serves any local file the markdown references — no allowlist (legacy Tauri parity, kept since real decks reference shared `assets/` outside their own folder)
- File watcher (chokidar) emits `file-changed` IPC events; renderer subscribes via `window.stellardeck.onFileChanged`
- Native menus: a small `menu-action` IPC pipes the menu item id to the renderer; handlers live in `js/main.js`
- Test isolation: pass `--user-data-dir=<tmp>` to `electron.launch()` so userData/localStorage doesn't leak between runs
- `[.background-color: #hex]` overrides scheme (correct Deckset behavior)

## Repo origin

This repo is a sync target from `peas/presentations-paulo`, where the engine was originally developed alongside Paulo Silveira's personal decks. As of 2026-04, work is shifting to `peas/stellardeck` as the primary development base. The sync script in the source repo skips `assets/`, `demo/`, `site/`, `LICENSE`, `README.md`, and `.github/` so they remain stable here.

## TODO — Invert source of truth (in progress, 2026-04-09)

The historical flow was: engine developed in `~/presentations-paulo` (Paulo's
deck repo), `scripts/sync-to-stellardeck.sh` rsync'd engine files to this repo
on demand. As of 2026-04-09, work is migrating: this repo (`~/stellardeck`)
becomes the primary development base. Inversion is **not yet executed** — it
needs a dedicated session because:

1. **Where do the engine files live afterwards?** Today both repos have them.
   Options:
   - (a) Delete engine files from presentations-paulo entirely; that repo
     becomes pure `.md` decks. To preview/export, Paulo opens `~/stellardeck`
     and runs the CLI from there with `--input-dir ~/presentations-paulo`.
   - (b) Keep engine files in presentations-paulo as a stale read-only mirror
     so Paulo can run `npm run serve` locally without leaving the deck dir.
     Mirror updates via a new `sync-from-stellardeck.sh`.
   - (c) Make `stellardeck` an npm-installable package and have presentations-
     paulo `npm install stellardeck` instead of mirroring source.

2. **CLI invocation from presentations-paulo.** Today `npm run export -- deck.md`
   in presentations-paulo runs the local copy. After inversion, it has to point
   somewhere — either a globally installed CLI, or a relative `../stellardeck`
   path, or the npm package.

3. **Tests on real decks.** Some integration tests in this repo use Paulo's
   real decks as fixtures (via the test/batch-fixture/ dir). After inversion,
   we may want to add a test mode that points at `$STELLARDECK_DECKS` (env
   var) or at the path in `CLAUDE.local.md`, so engine changes can still be
   smoke-tested against real content without committing the decks here.

4. **Skill location.** The `.claude/skills/stellardeck/` dir exists in both
   repos today (synced). After inversion, this repo is canonical. The
   presentations-paulo copy can be deleted or kept as a read-only convenience.

5. **CI surface area.** This repo's CI already runs the engine tests on
   Node 20/22 + e2e (chromium). After inversion, presentations-paulo needs
   either no CI (just deck content) or a deck-validation CI that uses
   stellardeck (npm or git submodule) to lint/render the decks.

**Recommended first session of inversion:**
1. Decide between (a)/(b)/(c) above (favor (a) — simplest, cleanest).
2. Delete engine files from presentations-paulo on a branch, run all its
   tests, see what breaks. Most likely: nothing important if presentations-
   paulo becomes pure decks.
3. Update presentations-paulo CLAUDE.md to say "decks only — engine lives
   in `~/stellardeck`".
4. Delete `scripts/sync-to-stellardeck.sh` from presentations-paulo (it
   becomes meaningless).
5. Keep this repo's CI green throughout.

The migration is **not urgent** — the current dual-repo + sync setup works.
Plan it deliberately when there's time to test thoroughly.
