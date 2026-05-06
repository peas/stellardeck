# StellarDeck — VS Code extension

Live preview, autoflow, and engine-driven diagnostics for [StellarDeck](https://stellardeck.dev) presentations directly in VS Code.

> **Status: 0.0.1 dev preview.** Not on the marketplace yet. Run from source via F5.

## Features

- **Live preview side-by-side** (`StellarDeck: Open Preview to the Side`, default `Cmd+K V` / `Ctrl+K V` on a markdown file). The preview re-renders as you type.
- **Render parity with the desktop app** — same `@stellardeck/core` engine, same `slides2` renderer, same themes.
- **Diagnostics → Problems panel** — engine warnings (overflow, missing-image, code-no-lang, statement-degraded, etc.) appear inline; click jumps to the slide source line.

## Try it (F5 dev)

From the repo root:

```bash
npm install                                  # symlinks @stellardeck/core into the extension
code packages/vscode-ext                     # open this dir in VS Code
# Inside that VS Code window, press F5 — Extension Development Host launches.
# In the new window, open any .md (e.g. ~/stellardeck/test/smoke-test.md), then:
#   Cmd+Shift+P → "StellarDeck: Open Preview to the Side"
```

## Architecture

```
extension.js  (Node ext host)
   │  postMessage(setMarkdown, text)          ▲
   ▼                                          │ postMessage(diagnostics)
webview (Chromium, sandboxed)                 │
   ├─ packages/core/dist/browser-globals.global.js  (engine: parser, autoflow, diagnostics)
   ├─ slides2.js / slides2.css                       (DOM renderer)
   ├─ css/themes.css + layout.css
   └─ media/preview.js                                (bridges window.postMessage ↔ engine)
```

Markdown flows host → webview on every debounced `onDidChangeTextDocument` (120 ms). Diagnostics flow webview → host after each render; the host translates each warning to a `vscode.Diagnostic` with the line of the relevant slide.

## What's not here yet

- Theme picker / scheme picker (use frontmatter for now)
- Export commands (PDF / PNG)
- `.deck.md` language registration
- Marketplace publish

See `~/.claude/projects/-Users-peas-stellardeck/memory/project_core_extraction_plan.md` for the full roadmap.
