# StellarDeck Roadmap

Last updated: 2026-03-29

## Current state

- **46+ features implemented** (see `docs/format-spec.yaml`)
- **232 unit tests** + **63 E2E tests** — all green
- **8 themes** with up to 7 color schemes each
- **8 autoflow rules** with anti-monotony and status bar
- **3 exports**: PDF (html2canvas + pdf-lib), PPTX (PptxGenJS), Embed (stellar-embed.js)
- **Embeddable viewer** with playground pages
- **Presenter mode** with BroadcastChannel sync
- Desktop app via Tauri 2.0 (macOS), browser viewer via viewer.html

## Done

### Parser & rendering
- [x] All Deckset markdown features (split, fit, filtered, inline, build-lists, speaker notes)
- [x] Tables (GFM), code blocks with line highlights, setext headings
- [x] Header/text color directives, accent-bold
- [x] Custom blocks: `:::columns`, `:::diagram`, `:::steps`, `:::center`, `:::math`
- [x] Inline math ($...$), block math ($$...$$)
- [x] QR codes (`![qr](url)`), YouTube embeds
- [x] Marp compatibility (bg, w:h:, paginate, HTML comment directives)
- [x] Position modifiers (`#[top-left]`, `#[bottom-right]`, etc.)
- [x] Reference links across slides

### Autoflow
- [x] 8-rule pipeline: title, divider, diagonal, z-pattern, alternating, statement, split, autoscale
- [x] Anti-monotony (alignment variation, diagonal mirroring)
- [x] Center-align for short statements (Bradley radial balance)
- [x] Skip checks (explicit, code, custom blocks)
- [x] Status bar with rule + detail per slide
- [x] Toolbar toggle with sidecar persistence
- [x] Options > frontmatter precedence

### Desktop app
- [x] Tabs, toolbar, grid overview, color schemes
- [x] Fullscreen state machine
- [x] PDF export (html2canvas + pdf-lib, in-browser)
- [x] Native file watcher (notify crate)
- [x] Presenter mode (current + next slide, notes, timer, keyboard nav)
- [x] Session save/restore (localStorage)
- [x] Welcome screen with recent files
- [x] Sidecar persistence (.stellar.json)

### Embed & docs
- [x] stellar-embed.js: renderSlide, renderDeck, playground
- [x] playground.html (8 interactive feature examples)
- [x] autoflow-examples.html (all rules, OFF vs ON comparison)
- [x] Logo finalization (assets/brand/)

### Sample decks
- [x] vibe-coding.md, hand-balancing.md, bean-to-bar-chocolate.md
- [x] autoflow-demo.md, accent-demo.md, smoke-test.md

## Sprint: reliability & polish

Priority: fix daily-use friction before expanding features.

### 1. Session restore redesign
**Problem**: counter shows stale values, autoflow button not synced, tab order lost on Cmd+R, "12/11" phantom slides after re-render.

**Plan**: create `refreshUI()` function that updates ALL chrome state after any re-render:
- Slide counter, autoflow button, status bar, tab bar, document title, grid rebuild
- Call from: toggle handlers, switchTab, closeTab, smartReload, loadFile
- Save session on slidechanged + tab switch + autoflow toggle (not just beforeunload)

**Files**: `js/toolbar.js`, `js/tabs.js`, `js/main.js`, `js/reload.js`

### 2. Playground editor polish
**Problem**: textarea has no syntax highlighting, no line numbers.

**Options** (ordered by effort):
- a) CSS-only: colored placeholder hints (low effort, low impact)
- b) Overlay `<pre>` with regex-based markdown coloring (medium effort)
- c) CodeMirror 6 minimal (higher effort, proper editing UX)

**Decision**: (b) for now — regex highlights `#`, `**`, `![`, `---`, `` ``` `` in the overlay

### 3. Anti-monotony for dividers
**Problem**: 3 consecutive dividers (section numbers) look identical.

**Plan**: add `vary` function for dividers — cycle center/left/right alignment.

## Next: autoflow config

### autoflow.json
Optional config file at project root or `~/.config/stellardeck/autoflow.json`:

```json
{
  "statementMaxWords": 8,
  "statementMaxLines": 4,
  "dividerMaxWords": 2,
  "autoscaleMinLines": 9,
  "autoscaleMinWords": 80
}
```

**Scope**: thresholds only. No regex. Non-devs should be able to read and tweak.

**Loading**: Tauri reads from disk, browser mode uses defaults. Toolbar could have a "Configure Autoflow" that opens the file in the editor.

**When**: after session restore is fixed. Before adding more rules.

## Future: pre-open-source

### 4. CLI unificado
`stellardeck` with subcommands:
- `stellardeck render <file.md> --slide 3 --output slide.png` — render to image
- `stellardeck export pdf <file.md>` — PDF export
- `stellardeck export pptx <file.md>` — PPTX export
- `stellardeck serve [dir]` — dev server
- All with `--help`

Enables: docs site screenshot pipeline, CI/CD integration.

### 5. Docs site (Astro)
- Uses stellar-embed.js for interactive examples (playground already works)
- Auto-generated screenshots via CLI for static examples
- Single-slide mode for feature documentation
- Full-deck mode for showcases
- Source: `docs/` or separate repo

### 6. Theme picker
Visual preview in toolbar dropdown. Click a theme → see it applied to current slide before committing.

### 7. More autoflow rules
- Arrow syntax (`→`, `-->`) → auto `:::diagram`
- Parallel structure → auto `:::columns`
- Detect narrative arc position (setup/tension/climax) to bias layout
- Config file enables per-rule enable/disable

### 8. Code quality
- JSDoc types on public APIs
- Extract Rust modules (pdf, watcher, dialog)
- Consistent error handling (Rust Result types, not strings)
- CSS themes into separate files

## 2.0

- PPTX/Google Slides importer → markdown + autoflow
- Pretext library for server-side text measurement (no DOM)
- Configurable slide proportions (4:3, custom)
- `.dmg` / `.msi` / `.deb` packaging via GitHub Actions
- Cross-platform testing (Windows/Linux)

## Dropped

- ~~.stellar.zip export~~ — no competitor has custom bundles, PDF/PPTX cover sharing
- ~~Built-in code editor~~ — replaced by Cmd+E (open in external editor)
- ~~:::mindmap~~ — dropped from scope
- ~~Last slide detection~~ — "last slide" ≠ closing slide (extra slides after)
