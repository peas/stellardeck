# Markdown Presentation Tools — Feature Comparison

Last updated: 2026-03-27

## Tool Overview

| Tool | Type | Platform | Pricing | GitHub Stars | Active Dev |
|------|------|----------|---------|-------------|------------|
| **Deckset** | Native app | macOS, iOS/iPadOS | $29 (macOS), $2.99/mo or $19.99/yr (iOS) | N/A (proprietary) | Yes |
| **Marp** | CLI + VS Code ext | Cross-platform | Free, MIT | ~10.7k (marp) | Yes (Mar 2026) |
| **Slidev** | Dev server (Vue) | Cross-platform (web) | Free, MIT | ~44k | Yes (Mar 2026) |
| **MDX Deck** | React framework | Cross-platform (web) | Free, MIT | ~11k | No (last publish ~2020) |
| **Reveal.js** | JS library | Cross-platform (web) | Free, MIT | ~71k | Yes |
| **Remark.js** | JS library | Cross-platform (web) | Free, MIT | ~5.7k (gnab/remark) | Low (maintenance) |
| **Obsidian Slides** | Obsidian plugin | Cross-platform | Free (Obsidian req.) | ~800 (Slides Extended) | Yes (Oct 2025) |
| **iA Presenter** | Native app | macOS, iOS/iPadOS | $89 (one-time) | N/A (proprietary) | Yes (2025) |
| **Marpit** | Framework (lib) | Cross-platform (Node) | Free, MIT | ~1.1k | Yes (Mar 2026) |
| **StellarDeck** | Tauri desktop + web | macOS (Win/Linux planned) | Free (in dev) | N/A (not released) | Active |

## Feature Matrix

### Authoring Format

| Feature | Deckset | Marp | Slidev | MDX Deck | Reveal.js | Remark.js | Obsidian Slides | iA Presenter | Marpit | StellarDeck |
|---------|---------|------|--------|----------|-----------|-----------|-----------------|-------------|--------|-------------|
| Markdown | ✅ Custom dialect | ✅ CommonMark + directives | ✅ Extended MD + YAML frontmatter | ✅ MDX (MD + JSX) | ✅ Standard MD | ✅ Standard MD + properties | ✅ Obsidian MD | ✅ Custom MD | ✅ CommonMark + directives | ✅ Deckset dialect |
| Slide separator | `---` | `---` | `---` | `---` | `---` (in MD mode) | `---` | `---` | Auto (headings) | `---` | `---` |
| Custom components | ❌ | ❌ | ✅ Vue components | ✅ React/JSX | ✅ HTML/plugins | ❌ | 🔶 Callouts | ❌ | ❌ | ❌ |
| Frontmatter/directives | ✅ `footer:`, `theme:`, etc. | ✅ Global + local directives | ✅ YAML frontmatter per slide | 🔶 Theme in MDX | 🔶 data attributes | 🔶 Slide properties | ✅ YAML + annotations | 🔶 Limited | ✅ Global + scoped directives | ✅ Deckset frontmatter |

### Themes & Styling

| Feature | Deckset | Marp | Slidev | MDX Deck | Reveal.js | Remark.js | Obsidian Slides | iA Presenter | Marpit | StellarDeck |
|---------|---------|------|--------|----------|-----------|-----------|-----------------|-------------|--------|-------------|
| Built-in themes | 25+ | 3 (default, gaia, uncover) | ~20 (community) | ~10 | 11 | 0 (CSS only) | Reveal.js themes | ~10 (city-named) | 0 (framework) | 7 (custom CSS) |
| Custom CSS themes | ❌ (closed) | ✅ Plain CSS | ✅ UnoCSS/CSS | ✅ Theme UI/Emotion | ✅ SCSS/CSS | ✅ CSS | ✅ Custom CSS | ✅ CSS/HTML | ✅ CSS | ✅ CSS variables |
| Color schemes per theme | ✅ Multiple per theme | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Per theme | ❌ | ✅ Up to 7 per theme |
| Per-slide styling | ✅ `[.background-color:]` | ✅ `<!-- _class: -->` | ✅ YAML per slide | ✅ Layout components | ✅ `data-` attributes | ✅ Slide properties | ✅ Annotations | 🔶 Limited | ✅ Scoped `_` directives | ✅ `[.background-color:]` |

### Speaker Notes & Presenter Mode

| Feature | Deckset | Marp | Slidev | MDX Deck | Reveal.js | Remark.js | Obsidian Slides | iA Presenter | Marpit | StellarDeck |
|---------|---------|------|--------|----------|-----------|-----------|-----------------|-------------|--------|-------------|
| Speaker notes syntax | `^` prefix | `<!-- comment -->` | `<!-- comment -->` | `<Notes>` component | `<aside class="notes">` | `???` separator | `note:` annotation | Separate text layer | (via Marp) | `^` prefix (Deckset) |
| Presenter mode | ✅ Current + next + notes + timer | ✅ (via HTML) | ✅ Current + next + notes + timer | ✅ Opt+P, next + timer + notes | ✅ Press S, separate window | ✅ Press P, clone display | ✅ (Reveal.js based) | ✅ Teleprompter + slide preview | ❌ (framework only) | 🔜 Planned (Phase 2) |
| Rehearsal mode | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Export Formats

| Feature | Deckset | Marp | Slidev | MDX Deck | Reveal.js | Remark.js | Obsidian Slides | iA Presenter | Marpit | StellarDeck |
|---------|---------|------|--------|----------|-----------|-----------|-----------------|-------------|--------|-------------|
| PDF | ✅ | ✅ (CLI) | ✅ | 🔶 (Print to PDF) | ✅ (Print to PDF) | 🔶 (Print to PDF) | ✅ | ✅ | ✅ (to print) | 🔶 Via decktape script |
| PPTX | ❌ | ✅ (CLI) | ✅ (images-based) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | 🔜 Planned |
| HTML | ❌ | ✅ | ✅ SPA | ✅ Static build | ✅ (is HTML) | ✅ (is HTML) | ✅ | ✅ | ✅ | ✅ (viewer.html) |
| Images (PNG/SVG) | ✅ (clipboard) | ✅ SVG | ✅ PNG | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Markdown export | N/A (source is MD) | N/A | N/A | N/A | N/A | N/A | N/A | ✅ (re-export) | N/A | N/A |

### Visual Features

| Feature | Deckset | Marp | Slidev | MDX Deck | Reveal.js | Remark.js | Obsidian Slides | iA Presenter | Marpit | StellarDeck |
|---------|---------|------|--------|----------|-----------|-----------|-----------------|-------------|--------|-------------|
| Split layouts (img+text) | ✅ `![left]` `![right]` | ✅ `bg left` `bg right` | ✅ `image-left` `image-right` layouts | 🔶 Custom layouts | 🔶 Manual HTML | ❌ | 🔶 HTML in slides | ❌ | ✅ `bg left/right` | ✅ `![left]` `![right]` |
| Background images | ✅ `![](img)` auto-bg | ✅ `![bg](img)` | ✅ `background:` frontmatter | 🔶 Custom CSS | ✅ `data-background-image` | 🔶 CSS only | ✅ | 🔶 Image slides | ✅ `![bg]` | ✅ Auto-bg (Deckset style) |
| Filtered/overlay backgrounds | ✅ `![filtered]` | 🔶 CSS filters | 🔶 CSS | ❌ | 🔶 CSS | ❌ | 🔶 CSS | ❌ | 🔶 CSS | ✅ `![filtered]` |
| Fit (contain) backgrounds | ✅ `![fit]` | ✅ `![bg contain]` | 🔶 CSS `background-size` | ❌ | ✅ `data-background-size` | ❌ | ✅ | ❌ | ✅ `bg contain` | ✅ `![fit]` |
| Auto-fit headings | ✅ `#[fit]` | ✅ Auto-scaling | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Auto-scaling | ✅ `#[fit]` (DOM-measured) |
| Video embeds | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (mp4, YouTube) |

### Code & Technical Content

| Feature | Deckset | Marp | Slidev | MDX Deck | Reveal.js | Remark.js | Obsidian Slides | iA Presenter | Marpit | StellarDeck |
|---------|---------|------|--------|----------|-----------|-----------|-----------------|-------------|--------|-------------|
| Syntax highlighting | ✅ Built-in | ✅ Built-in | ✅ Shiki (extensive) | ✅ Prism/custom | ✅ Plugin (highlight.js) | ✅ Built-in | ✅ (Obsidian/Reveal) | ✅ Fenced blocks | ❌ (framework) | ❌ (not yet) |
| Line numbers in code | ✅ | 🔶 | ✅ | 🔶 | ✅ (plugin) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Live coding | ❌ | ❌ | ✅ Monaco editor | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Math/LaTeX | ✅ MathJax | ✅ KaTeX | ✅ KaTeX | 🔶 (plugin) | ✅ KaTeX or MathJax | 🔶 (plugin) | ✅ MathJax | ✅ KaTeX | ❌ (framework) | ❌ (not yet) |
| Diagrams (Mermaid) | ✅ Mermaid | ❌ | ✅ Mermaid | ❌ | 🔶 Plugin | 🔶 Plugin | ✅ (plugin) | ❌ | ❌ | ❌ (not yet) |

### Animations & Transitions

| Feature | Deckset | Marp | Slidev | MDX Deck | Reveal.js | Remark.js | Obsidian Slides | iA Presenter | Marpit | StellarDeck |
|---------|---------|------|--------|----------|-----------|-----------|-----------------|-------------|--------|-------------|
| Slide transitions | ✅ Fade, push, reveal | ✅ 33 built-in (View Transitions API) | ✅ CSS transitions | ❌ | ✅ Multiple built-in | ❌ | ✅ (Reveal.js) | 🔶 Simple | ❌ | ❌ (not yet) |
| Build lists (incremental) | ✅ `[.build-lists: true]` | ✅ `*` marker fragments | ✅ `v-click` directive | ✅ `<Steps>` component | ✅ Fragments | ❌ | ✅ Fragment annotations | ❌ | ✅ `*` marker fragments | 🔶 Parsed, not animated |
| Auto-animate / morph | ❌ | ✅ Morph (View Transitions) | ✅ | ❌ | ✅ Auto-Animate | ❌ | ✅ (Reveal.js) | ❌ | ❌ | ❌ |
| Element animations | ❌ | 🔶 CSS only | ✅ Vue transitions | 🔶 | ✅ Plugins | ❌ | ✅ Fragment classes | ❌ | 🔶 CSS only | ❌ |

### Developer Experience

| Feature | Deckset | Marp | Slidev | MDX Deck | Reveal.js | Remark.js | Obsidian Slides | iA Presenter | Marpit | StellarDeck |
|---------|---------|------|--------|----------|-----------|-----------|-----------------|-------------|--------|-------------|
| Live reload on save | ✅ Native | ✅ (VS Code / CLI) | ✅ Vite HMR (instant) | ✅ Webpack HMR | 🔶 Manual or plugin | ❌ | ✅ | ✅ | N/A | ✅ Polling (1s) |
| WYSIWYG editor | ✅ (preview pane) | ❌ (VS Code) | ❌ (browser dev tools) | ❌ | ✅ slides.com (paid) | ❌ | 🔶 Live preview | ✅ | ❌ | 🔜 Planned (Phase 5) |
| File dialog (open any .md) | ✅ Native | ❌ (CLI args) | ❌ (project-based) | ❌ | ❌ | ❌ | ✅ (Obsidian vault) | ✅ Native | ❌ | ✅ Cmd+O (Tauri) |
| Grid/overview of all slides | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ (Esc/G) |
| Tabs (multiple decks) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Obsidian tabs) | ❌ | ❌ | ✅ |
| Recording/camera | ❌ | ❌ | ✅ Built-in | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Drawing/annotation | ❌ | ❌ | ✅ Built-in | ❌ | 🔶 Plugin | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Features StellarDeck Should Prioritize for 1.0

### Table Stakes (every serious competitor has these)

These are non-negotiable for a 1.0 release -- users will expect them:

1. **Syntax highlighting for code blocks** -- Every single tool has this. StellarDeck currently ships `plugins: []` in Reveal.js. Enabling `RevealHighlight` with a good theme (monokai or similar) is low effort, high impact. The Reveal.js highlight plugin is already vendored in the repo.

2. **PDF export (reliable, one-click)** -- Every tool supports PDF. StellarDeck has a decktape shell script but no UI integration. A toolbar "Export PDF" button is expected.

3. **Presenter mode with notes + timer + next slide** -- 8 of 9 competitors (all except Marpit, which is a framework) have this. StellarDeck parses `^` speaker notes correctly but has no presenter view. This is critical for anyone actually presenting.

4. **Slide transitions** -- Deckset, Marp, Slidev, and Reveal.js all have transitions. StellarDeck parses the `slide-transition:` frontmatter but doesn't apply them. Reveal.js has this built-in; it just needs to be wired up.

5. **Build lists / fragments** -- StellarDeck parses `[.build-lists: true]` but doesn't animate items incrementally. Reveal.js fragments need to be applied to list items.

6. **Math/LaTeX rendering** -- 7 of 9 tools support this. Reveal.js has KaTeX and MathJax plugins. Important for technical and academic audiences.

### Differentiators (what would set StellarDeck apart)

These features are rare or unique -- they would make StellarDeck stand out:

1. **Deckset file compatibility** -- No other open-source tool reads Deckset markdown natively. The parser is StellarDeck's biggest moat. Lean into it: `![left]`, `![filtered]`, `![fit]`, `#[fit]`, `^` notes, `[.background-color:]` -- all working already.

2. **Tabs for multiple decks** -- Only Obsidian has this (via its tab system). No presentation tool lets you flip between decks. This is already built.

3. **Color schemes per theme** -- Deckset has this, iA Presenter has this, nobody else does. StellarDeck already supports up to 7 schemes per theme via the sidebar. This is a strong visual differentiator.

4. **Desktop app with native file access** -- Deckset and iA Presenter are the only native apps. StellarDeck (via Tauri) fills the same niche but cross-platform and free. The `localfile://` protocol, `Cmd+O` file dialog, and auto-reload are already working.

5. **Free + open-source + cross-platform** -- Deckset is macOS-only and $29. iA Presenter is macOS-only and $89. StellarDeck would be the only free, open-source, cross-platform Deckset-compatible viewer.

6. **Grid overview with theme-aware thumbnails** -- Only Deckset and iA Presenter have a comparable grid. StellarDeck's grid already inherits theme colors and scheme changes. Most web tools have basic overview modes, not visual grid thumbnails.

### Suggested 1.0 Checklist

| Priority | Feature | Effort | Justification |
|----------|---------|--------|---------------|
| P0 | Enable RevealHighlight plugin | Small | Table stakes; plugin already vendored |
| P0 | Presenter mode (notes + next + timer) | Medium | Can't present without it |
| P0 | PDF export from toolbar | Medium | Table stakes; decktape script exists |
| P1 | Slide transitions (wire up Reveal.js) | Small | Frontmatter already parsed |
| P1 | Build list animation (fragments) | Small | Directive parsed, need fragment classes |
| P1 | Math/LaTeX (RevealMath plugin) | Small | Plugin available in Reveal.js |
| P2 | Mermaid diagrams | Medium | Nice-to-have; Reveal.js plugin exists |
| P2 | PPTX export | Medium | Differentiator vs Deckset; Slidev has it |
| P2 | Windows/Linux builds | Medium | Differentiator; Tauri supports it |
| P3 | Recording/camera | Large | Only Slidev has it; niche feature |
| P3 | Live coding | Large | Only Slidev has it; very niche |

---

## Sources

- [Deckset](https://www.deckset.com/) -- [Docs](https://docs.deckset.com/) -- [App Store](https://apps.apple.com/us/app/deckset-your-notes-to-slides/id6476942011)
- [Marp](https://marp.app/) -- [GitHub](https://github.com/marp-team/marp) -- [Marpit](https://marpit.marp.app/)
- [Slidev](https://sli.dev/) -- [GitHub](https://github.com/slidevjs/slidev)
- [MDX Deck](https://github.com/jxnblk/mdx-deck) -- [npm](https://www.npmjs.com/package/mdx-deck)
- [Reveal.js](https://revealjs.com/) -- [GitHub](https://github.com/hakimel/reveal.js)
- [Remark.js](https://remarkjs.com/) -- [GitHub](https://github.com/gnab/remark)
- [Obsidian Slides Extended](https://github.com/ebullient/obsidian-slides-extended) -- [Advanced Slides docs](https://mszturc.github.io/obsidian-advanced-slides/)
- [iA Presenter](https://ia.net/presenter) -- [Features](https://ia.net/presenter/support/basics/presenter-features)
- [Marpit](https://marpit.marp.app/) -- [GitHub](https://github.com/marp-team/marpit)
