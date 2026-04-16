# StellarDeck

Convention-first, agent-first markdown presentations.

Write content, get layouts. StellarDeck infers slide structure from what you write — no directives needed. The same `.md` file renders in a desktop app, a browser, an embeddable viewer, or the CLI. When you need more control, Deckset-compatible markdown and custom directives are there.

If you're coming from [Deckset](https://www.deckset.com), [Marp](https://marp.app), or [Reveal.js](https://revealjs.com), see the [comparison](docs/comparison.md) for when to use what.

Four ideas shape the project:

**Storytelling.** A deck is a sequence of moments. Markdown's constraints (one file, short slides, linear order) keep focus on what you're saying. Reading through the deck feels like reading a script.

**Autoflow.** Reads each slide's content and picks a layout — [9 rules](docs/autoflow-rules.md), zero configuration. A slide with four short lines gets a Z-pattern. An image next to text becomes a filtered background with auto-sized headings. Consecutive slides don't repeat the same treatment (anti-monotony). Explicit directives always win.

**Agent-native.** Markdown is what LLMs produce. The [CLI](docs/comparison.md) takes stdin, exports PDF/PNG/grid, previews in the browser, validates diagnostics, and emits structured JSON. The [stellardeck skill](docs/skill-stellardeck-spec.md) converts source text (blog posts, transcripts, meeting notes) into scored slide decks.

**Simple.** `npm run preview -- deck.md` and you're presenting. No build step, no bundler. The `.md` file is the artifact, PDFs are regenerable.

9 themes, up to 7 color schemes each, dark and light.

## Try it

Six example decks you can navigate and edit live — right in your browser:

**Learn the features:**
- [Getting Started](https://stellardeck.dev/examples/getting-started/) — headings, images, splits, code blocks
- [Kitchen Sink](https://stellardeck.dev/examples/kitchen-sink/) — every supported feature in one deck
- [Autoflow](https://stellardeck.dev/examples/autoflow/) — zero-config layout inference in action

**See it in action (real talks):**
- [Bean to Bar Chocolate](https://stellardeck.dev/examples/bean-to-bar/) — diagrams, columns, custom backgrounds
- [Hand Balancing](https://stellardeck.dev/examples/hand-balancing/) — split layouts with portraits
- [Vibe Coding](https://stellardeck.dev/examples/vibe-coding/) — a keynote about AI and coding

## Quick start

```bash
git clone https://github.com/peas/stellardeck.git
cd stellardeck
npm run preview -- demo/getting-started.md
```

## Desktop app (Tauri)

```bash
npm install
cargo tauri dev
```

Requires [Rust](https://rustup.rs/) and the [Tauri CLI](https://tauri.app/start/).

## CLI

```bash
# Live
npm run preview -- deck.md                           # open in browser, Ctrl+C stops
npm run export -- --serve                            # dev server + viewer

# Export
npm run export -- deck.md                            # → deck.pdf
npm run export -- --png deck.md                      # → deck-slides/001.png, 002.png...
npm run export -- --grid deck.md                     # → deck-grid.png
npm run export -- --input-dir decks --output dist    # batch

# Inspect
npm run export -- --validate deck.md                 # diagnostics without export
npm run export -- --list-themes                      # available themes (JSON)
npm run export -- --list-schemes alun                # color schemes for a theme

# Agent
npm run export -- --json --pdf deck.md               # machine-readable output
cat deck.md | npm run export -- --pdf - out.pdf      # stdin
npm run export -- --help                             # full reference
```

## Format

StellarDeck uses Deckset-compatible markdown. See [format-spec.yaml](docs/format-spec.yaml) for the full 66-feature spec.

```markdown
footer: My Talk
slidenumbers: true

#[fit] Hello, World

---

![right](photo.jpg)

# Split Layout

Text on the left, image on the right.

---

[.background-color: #1e3a5f]

#[fit] Custom Colors
```

## Testing

```bash
npm test              # 318 unit tests (~3s)
npm run test:e2e      # 70 E2E tests (Chromium)
npm run test:layout   # 32 layout + consistency tests
npm run test:export   # 40 CLI integration tests
npm run test:visual   # 18 visual regression tests
npm run test:all      # all of the above
```

## License

MIT — see [LICENSE](LICENSE).

Built by [Paulo Silveira](https://paulo.com.br).
