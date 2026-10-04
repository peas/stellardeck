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
npm install                # install deps + build packages/core/dist (workspace prepare → tsup)
npm run serve              # python3 dev-server.py 3031 (no-cache headers)
npm test                   # ~600 unit tests (~3s): parser, autoflow (+ golden snapshot), structure, CLI, diagnostics
npm run test:e2e           # 51 Playwright E2E tests (chromium)
npm run test:layout        # 40 layout + consistency tests
npm run test:export        # 48 CLI integration tests (PDF, PNG, grid, batch, warnings)
npm run test:export:unit   # export unit tests only (no browser)
npm run test:visual        # 18 visual regression tests
npm run test:all           # all of the above (+ diagnostics); test:electron = 41 Electron smoke tests
npm run preview -- deck.md # open in browser (starts server, Ctrl+C stops)
npm run export -- deck.md  # export (--pdf default, --png, --grid, --json, --help)
npm run export -- --serve  # start dev server + open viewer
npm run pdf -- deck.md     # alias for --pdf
npm run electron -- deck.md     # fast desktop dev (menu says "Electron")
npm run electron:dev -- deck.md # same + ELECTRON_DEV=1 (hot reload, devtools)
npm run app -- deck.md          # packaged StellarDeck.app (menu says "StellarDeck")
npm run package                 # build .app without launching
npm run make                    # produce .dmg + .zip via electron-forge (out/make/dmg/<arch>/, out/make/zip/<platform>/<arch>/)
```

## Project structure

```
.
├── viewer.html               # App shell (loads packages/core/dist/browser-globals.global.js)
├── slides2.js / slides2.css  # StellarSlides engine (sole engine)
├── packages/core/            # @stellardeck/core (npm) — the pure engine
│   └── src/
│       ├── autoflow.js       # Autoflow entry point (facade; browser global + CommonJS)
│       ├── autoflow/         # engine.js, analyze.js, lines.js, skip-checks.js,
│       │                     # preprocessors.js, rules/<name>.js + rules/index.js
│       ├── deckset-parser.js # Markdown → slide HTML
│       ├── diagnostics.js    # Deck health checks (DOM) + diagnose-rules.js (pure)
│       ├── style-lint.js     # Deck-level metrics vs the 331-deck corpus
│       ├── print-mode.js     # Shared enter/exit print mode (CLI + in-browser export)
│       └── constants.js      # CDN URLs, slide dimensions, THEMES (schemes)
├── packages/vscode-ext/      # VS Code extension MVP (live preview, diagnostics)
├── css/                      # themes.css, layout.css (engine), chrome.css (viewer only), presenter.css
├── js/                       # Main app modules (ES modules)
├── embed/                    # Embeddable API (stellar-embed.js, playground)
├── scripts/                  # CLI (export.js), dev servers, autoflow-docs/-snapshot, helpers
├── test/                     # Unit + integration tests (autoflow-golden.json pins autoflow output)
├── docs/                     # format-spec.yaml, autoflow-rules.md (generated), roadmap
├── electron/                 # Electron 44 desktop shell (main + preload + icons)
├── demo/                     # Demo decks (getting-started ships in the npm tarball for --demo)
├── site/                     # Starlight docs site (stellardeck.dev)
└── .claude/skills/stellardeck/ # Claude Code skill: source text → slides
```

## Architecture (1-paragraph version)

A `.md` file is parsed by `deckset-parser.js` into a list of `<section>` HTML, optionally pre-processed by autoflow (`packages/core/src/autoflow/`, which infers layouts from content shape), then rendered by `slides2.js` (the StellarSlides engine — vanilla JS, ~380 lines). The same pipeline runs in 4 environments: Electron (Chromium + Node), browser (`viewer.html`), embed (`stellar-embed.js`), and CLI (`scripts/export.js` via Playwright). `stellar-embed.js` is the shared rendering layer for embed; the other three reuse the engine modules directly. **Render parity is a hard rule** — never add a feature in one environment without the others.

## Module system gotcha

Plain scripts (`deckset-parser.js`, `slides2.js`, `diagnostics.js`, `print-mode.js`, `constants.js`, and the `autoflow.js` facade) expose **both** browser globals AND `module.exports` for Node tests. ES modules (`js/*.js`) import from each other and access globals via `window`. Why: WKWebView + ES modules fail silently on 404. Don't convert these to ES modules.

`packages/core/src/autoflow/` is plain CommonJS (`require` between files) — it only reaches the browser through the tsup IIFE bundles (`dist/browser-globals.global.js`, `dist/autoflow.global.js`). After editing core, run `npm run build -w @stellardeck/core` before e2e/visual tests or the viewer serves the stale bundle. `npm install` builds it too (workspace `prepare`).

## Format

Deckset markdown: `---` = separator, `![right]()` / `![left]()` = split, `![filtered]()` = dark overlay background, `![inline]()` = inline image, `![fit]()` = contain background, `![bordered]()` = framed image (inline unless left/right), `#[fit]` = auto-fit heading, `#[top-left]` = positioned, `^` = speaker note, `[.background-color: #hex]` = per-slide. Full spec: `docs/format-spec.yaml` (66 features).

## Autoflow

Convention-over-configuration layout inference, declarative: `packages/core/src/autoflow/` (see the header of `packages/core/src/autoflow.js`). Adding a rule = one file in `rules/` + one line in `rules/index.js`. Pipeline per slide: observers → skip checks → empty → preprocessors → rules by priority (`skipIfDirective` → `guard` → `match` → `transform` → `vary`) → default.

| Rule | Detection | Transform |
|------|-----------|-----------|
| title | First slide, 2+ paragraphs, short title | `#[fit]` centered + subtitle |
| divider | 1-2 word slide | `#[fit]` heading |
| diagonal | 2 paragraphs, ≥1 ends "?" | `#[top-left]` + `#[bottom-right]` (not on splits) |
| z-pattern | 4 short paragraphs | 4-corner grid (not on splits) |
| alternating | 3+ short paragraphs | `[.alternating-colors: true]` (not on splits) |
| statement | 1-4 short lines (≤8 words; ≤15 = tier 3) | `#[fit]`, varied alignment; tier 3 = autoscaled block |
| bare-image-position-variation | 1 bare image + >8 words | `![inline]` → `![left]` → `![right]` across the deck (inline only with ≤2 text lines) |
| phrase-bullets | heading + 2-3 short bullets | `[.bullets-layout: cards/pills/alternating/staggered]`, cycling |
| autoscale | >8 lines OR >80 words | `[.autoscale: true]` |

Preprocessors: `explicit-image` (explicit split/background image + text → image untouched, text still autoflowed) and `bare-image-background` (bare image + ≤8 words → `![filtered]` hero). Skip checks: text you laid out (`#[fit]`, positions, `[.autoscale]`, `[.alternating-colors]`), code fences, `:::` blocks, explicit images with no text or that the parser renders in flow.

**Changing autoflow behavior:** `test/autoflow-golden.json` pins the output for every repo deck. Regenerate with `UPDATE_GOLDEN=1 node test/autoflow-golden.test.js` and review the JSON diff in the commit. To measure impact on real decks, snapshot before/after with `node scripts/autoflow-snapshot.js <dir> --out x.json` and `--diff a.json b.json` (Paulo's corpus path is in CLAUDE.local.md). Refactors must diff to zero.

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

### Done
- **0.9.0 (2026-07/08):** GitHub release (.dmg/.zip/demo decks), site with install tracks, `stellardeck` + `@stellardeck/core` on npm (2026-08-21), VS Code extension MVP (`packages/vscode-ext/`), core extracted to `packages/core/`. Pre-release audit for `presentations-paulo` / `/Users/peas` references: clean.
- **0.10.0 session (2026-10-03):** `stellardeck --demo`; npm-first quick start (README/site); autoflow declarative refactor (#6) with golden snapshot + corpus diff tooling; explicit images no longer skip autoflow for the text; bare-image rotation + hero threshold (#4); `![bordered]` (#5); nested lists; `#Title` (no space) is a heading in autoflow; Default theme schemes 2/3 CSS; Electron Forge 8 (yauzl override gone); trusted-publishing workflow; site fixes (404 example pages, light-mode gray page from engine CSS, engine loaded once per page). `statement-degraded` (#7) had shipped earlier (`aaf88d9`).

### Next
1. **Releases go through trusted publishing (live since 0.10.0, 2026-10-04).** Bump `version` in `package.json` AND `packages/core/package.json`, commit, `git tag vX.Y.Z && git push origin vX.Y.Z` → `.github/workflows/publish.yml` tests and publishes both with provenance. npmjs.com Trusted Publisher on each package: `peas/stellardeck`, `publish.yml`, "Allow npm publish" ON (Paulo's call; the npm default is staged-only). Registry takes a few minutes ("being processed") before the version shows. Push only the tag — a GitHub Release without the .dmg would hijack the site's "latest release" download link. Desktop .dmg is still 0.9.0.
2. **hand-balancing.md storytelling rework.** Same treatment as bean-to-bar (3 acts, characters, invitation ending — commit 3ddeb66 as reference). Propose the arc first.
3. **Remaining issues:** #3 accent highlighter (needs visual dialing), #8 CLI native screenshots (1.0 — also unblocks `color-mix()` in engine CSS, which html2canvas can't parse).
4. **Design follow-ups (2026-10-04):** (a) DONE — readable text on slides with their own background (`slides2.js::applyReadableColors`, runtime contrast check, only overrides failing colors). (b) DONE — statements beside a split image cap at 3 lines, no dense tier. (c) `**bold**` inside headings uses `--r-main-color` (two-tone headings), so statement-ized text loses its accent — see the decision recorded below when made.

### Post-0.9
- **VSCode + Obsidian extensions** (live preview, IntelliSense, diagnostics). Shared problem: how to tell a StellarDeck `.md` from any other markdown file. Can't activate on every `.md`. Options: (a) file extension convention `.deck.md`; (b) detect `.stellar.json` sidecar in same directory; (c) detect StellarDeck-specific frontmatter (`theme:`, `autoflow:`, `slidenumbers:`); (d) explicit activation via command palette / file-type override. Likely **(a) + (c)**: activate when file is `*.deck.md` OR contains Deckset/StellarDeck frontmatter. Both extensions share the same detection logic.
- Config file `.stellarrc` (workspace defaults)
- Server mode `stellardeck serve` (`?pdf`, `?pptx` endpoints)
- `headingDivider` directive (auto-split at H1/H2)
- Custom slide sizes (4:3, 16:10)
- `--html` self-contained export
- `--parallel N` for batch
- Runtime theme registration
- **PPTX export from screenshots (`--pptx` flag on the main CLI).** Today there's `scripts/export-pptx.js` (native PowerPoint elements — editable text, images) and the main `scripts/export.js` does PDF/PNG/grid via Playwright. Add `--pptx` to the main pipeline so screenshots-PPTX shares the captureSlides() infra (just wraps each PNG in a fullbleed `slide.addImage` via `pptxgenjs`, layout `LAYOUT_WIDE` 13.333×7.5in 16:9). Use case: handing the deck to a non-technical client / event organizer who only opens PowerPoint. Verified manually 2026-05-06: works perfectly (Paulo's vibecoders-builders-hipsters deck → 26-slide pptx, 23MB). Open question: name `--pptx` (parity with `--pdf`/`--png`) vs `--pptx-screenshots` to leave room for a future `--pptx-native` mode — recommend `--pptx` (default = screenshots) and `--pptx-native` for the native variant.
- **Right-click context menu on a deck → Export submenu.** In the Electron app sidebar (and later VS Code ext tree view), right-click on a deck card should expose Export → PDF / PNGs / PPTX (screenshots) / PPTX (native). Wire to existing `scripts/export.js` via `desktopInvoke('export-deck', { path, format })`.
- **Accent as highlighter (marker stroke), not just colored text** (issue #3). Per-theme opt-in `--accent-mode: highlight`; serif themes get rounded corners (~0.15em). Test on Letters from Brazil (serif), Borneli (display), and a sans theme to dial the proportions. Asked by Paulo 2026-05-06.
- **Autoflow rule: lone-URL → QR + clickable link below.** If a slide has only one URL line (optionally with a short label), render it as a large centered QR code AND keep the clickable link below in small text. Today a lone URL hits the divider rule and becomes a giant `#[fit]` line. Now just one file in `packages/core/src/autoflow/rules/`.
- **Autoflow (later): bare image aspect-ratio aware layout.** On top of the rotation: measure the image at render time (in `js/render.js`, NOT in autoflow which is sync markdown→markdown), set `is-portrait` / `is-landscape` on the slide, and let CSS pick: portrait → split, landscape → centered hero with text below.
- **Diagnostic: distinguish "expected fit" from "real overflow".** New info-level `expected-fit` type: "image is fit-with-letterbox here, autoflow could choose a better layout". Useful for the aspect-ratio rule above.

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
- **Node 26 + zip extraction (resolved 2026-10-03).** `extract-zip@2` + `yauzl@2` silently stop mid-extraction on Node ≥ 26 (exit 0, no error). Forge 7 pulled them via `@electron/packager@18`; we carried `overrides.yauzl ^3.2` until Forge 8 (`@electron/packager` 20, no yauzl at all). Override removed. If `electron-forge package` ever prints "Finalizing package" and leaves no `out/`, suspect this class of bug first. Forge 8 also writes the DMG to `out/make/dmg/<arch>/` (was `out/make/`).
- **tsup needs `typescript` installed** even with `dts: false` (it `require`s it eagerly). It's an explicit devDependency of `packages/core` — Forge 7 used to bring it transitively.
- **Playwright + Node 26:** `playwright-core` ≤ 1.59 bundles the same broken zip lib — `npx playwright install chromium` downloads in seconds and then hangs at "extracting archive" forever (`DEBUG=pw:install` shows it). `@playwright/test` ≥ 1.63 is fine; keep it current.
- **Electron ≥ 42 has no postinstall.** The binary downloads lazily on the first `electron .` / `npm run electron` / `npm run app` (see `node_modules/electron/index.js`), so a fresh `npm ci` leaves `node_modules/electron/dist/` empty — that's expected. If the download gets interrupted: `rm -rf node_modules/electron/dist node_modules/electron/path.txt` and run again. Cached zips live in `~/Library/Caches/electron/<sha>/`.
- **npm ≥ 11 `install-scripts` gate.** npm skips install scripts of packages not listed in `package.json` → `allowScripts` (it only warns). The repo lists `esbuild`, `sharp`, `fs-xattr`, `macos-alias`. When a new dep with an install script shows up, `npm install-scripts approve --no-allow-scripts-pin <pkg>` (unpinned, so version bumps don't need re-approval); `npm install-scripts prune` drops stale entries.
- **Sandboxed shells (Claude Code Bash sandbox, seatbelt):** Chromium aborts with exit 134 inside the sandbox. Launch `npm run electron` / `npm run app` with the sandbox disabled, in the background (`nohup … &`), and check the log file instead of waiting on stdout.
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
