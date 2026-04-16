# StellarDeck vs Deckset, Marp, Reveal.js

StellarDeck exists because each of these tools does something great, but none
covers the full workflow from *content creation* to *agent-assisted authoring*
to *live presenting*. This page explains when to use what — not why one is
"better" than another.

All four projects are actively maintained and worth trying. We link to each
project because we want you to pick the best tool for your context.

## The tools

| | [Deckset](https://www.deckset.com) | [Marp](https://marp.app) | [Reveal.js](https://revealjs.com) | [StellarDeck](https://stellardeck.dev) |
|---|---|---|---|---|
| **Type** | Native macOS/iOS app | CLI + VS Code extension | JavaScript library | CLI + desktop app + web viewer |
| **License** | Proprietary ($29) | MIT | MIT | MIT |
| **Platform** | macOS, iOS | Cross-platform | Cross-platform | macOS (Win/Linux planned) |
| **Active** | Yes | Yes | Yes | In development |

## When to use each

### Deckset — Best native experience on macOS

Use Deckset when you want a polished macOS app with beautiful built-in themes,
real-time preview, and zero configuration. It's the tool Paulo Silveira used for
344 presentations before building StellarDeck.

**Strengths:**
- 25+ professional themes with multiple color schemes
- Real-time split-pane preview (edit left, see right)
- Rehearsal mode with timer
- iOS companion app for presenting

**Trade-offs:**
- macOS only, proprietary, closed themes (no custom CSS)
- No CLI, no automation, no agent integration
- Export limited to PDF (no PNG, no HTML)

### Marp — Best for developers who live in VS Code

Use Marp when your workflow is VS Code + Git and you want a markdown-to-slides
pipeline that fits into CI/CD. The VS Code extension gives instant preview;
the CLI handles export.

**Strengths:**
- Excellent VS Code integration (preview, IntelliSense)
- Clean CLI with `--html`, `--pdf`, `--pptx` export
- CommonMark compliant — standard markdown
- Marpit framework for custom theme development
- Active community, well-documented

**Trade-offs:**
- No layout inference (all positioning is manual via directives)
- No desktop app or presenter mode outside VS Code
- 3 built-in themes (vs Deckset's 25+ or StellarDeck's 8)
- No structured JSON output for agent/automation workflows

### Reveal.js — Best for interactive web presentations

Use Reveal.js when you need maximum flexibility: animations, plugins, embedded
iframes, interactive code demos, audience voting. It's a full web framework
for presentations.

**Strengths:**
- Largest ecosystem (71k+ GitHub stars)
- Plugin architecture (multiplexing, code highlighting, math, etc.)
- Full HTML/CSS/JS control per slide
- Server-side speaker notes with remote control
- Self-hosted — no vendor dependency

**Trade-offs:**
- Not markdown-first (markdown is a plugin, not the core)
- Requires web development knowledge for customization
- Heavy setup for simple text-and-image decks
- No CLI export without third-party tools (decktape, etc.)

### StellarDeck — Best for agent-assisted authoring

Use StellarDeck when you want AI agents to create and iterate on presentations
from source text, or when you want convention-over-configuration layout without
manual directives.

**Strengths:**
- **Autoflow**: 8 layout rules that infer positioning from content structure.
  Write plain text, get `#[fit]`, split layouts, z-patterns, anti-monotony.
  Zero directives needed.
- **Agent-native CLI**: `--json` structured output, stdin support, `--validate`
  for diagnostics, `--preview` for instant viewing. Designed for LLM tool use.
- **Deckset compatibility**: migrates 66 Deckset features directly. If you have
  Deckset decks, they render in StellarDeck.
- **Skill + scoring**: the `stellardeck` Claude skill converts source text
  (blog posts, transcripts) into slides with quality scoring against benchmarks
  from 347 real-world decks.
- **Multiple render targets**: same `.md` renders in the desktop app (Tauri),
  browser viewer, embeddable component, and CLI export.

**Trade-offs:**
- macOS only for now (CLI is cross-platform)
- Fewer themes than Deckset (8 vs 25+)
- No VS Code extension yet (planned)
- Not CommonMark — uses Deckset's dialect (`#[fit]`, `![right]`, `^notes`)
- Young project, smaller community

## Feature comparison

| Capability | Deckset | Marp | Reveal.js | StellarDeck |
|---|:---:|:---:|:---:|:---:|
| Markdown-first | ✅ | ✅ | 🔶 plugin | ✅ |
| CLI export (PDF) | ❌ | ✅ | 🔶 via decktape | ✅ |
| CLI export (PNG) | ❌ | ✅ | 🔶 via decktape | ✅ |
| CLI export (HTML) | ❌ | ✅ | ✅ native | 🔶 planned |
| JSON output | ❌ | ❌ | ❌ | ✅ |
| stdin/pipe | ❌ | ✅ | ❌ | ✅ |
| Structured diagnostics | ❌ | ❌ | ❌ | ✅ |
| Layout inference | ❌ | ❌ | ❌ | ✅ autoflow |
| Themes | 25+ | 3 | 11 | 8 |
| Color schemes per theme | ✅ | ❌ | ❌ | ✅ (3-7 each) |
| Split layouts (`![right]`) | ✅ | 🔶 manual CSS | ✅ plugin | ✅ |
| `#[fit]` auto-sizing | ✅ | ❌ | ❌ | ✅ |
| Presenter mode | ✅ | 🔶 VS Code only | ✅ | ✅ |
| Desktop app | ✅ | ❌ | ❌ | ✅ Tauri |
| Embeddable component | ❌ | ❌ | ✅ | ✅ |
| VS Code extension | ❌ | ✅ | ❌ | 🔶 planned |
| Custom CSS themes | ❌ | ✅ | ✅ | ✅ |
| Agent/LLM integration | ❌ | ❌ | ❌ | ✅ skill + CLI |
| Live preview (`--preview`) | ✅ native | ✅ VS Code | ✅ dev server | ✅ CLI |
| Batch export | ❌ | ✅ | ❌ | ✅ |
| Cross-platform | ❌ macOS | ✅ | ✅ | 🔶 CLI yes, app macOS |

## Collaboration, not competition

These tools solve different problems for different workflows:

- **Writing a quick deck for a team meeting?** Deckset or Marp.
- **Building an interactive conference talk with demos?** Reveal.js.
- **Having an AI agent create slides from a blog post?** StellarDeck.
- **Migrating 300+ Deckset decks to an open format?** StellarDeck.
- **Need a CI pipeline that exports slides on push?** Marp or StellarDeck.

StellarDeck's Deckset parser exists because Deckset proved that markdown
presentations work. Marp proved that CLI-first is the right developer
experience. Reveal.js proved that the browser is a capable rendering engine.
StellarDeck builds on all three ideas.
