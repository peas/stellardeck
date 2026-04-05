# StellarDeck

**Markdown presentations for storytellers.**

StellarDeck turns plain markdown into slides without getting in the way. The constraints — short slides, sequential flow, no pixel-fiddling — keep you focused on what you're actually saying. Scan your deck, see if the narrative flows, cut or rearrange in seconds.

Built on four ideas:

## Story first

A slide is a moment in the story. Markdown's constraints are the feature: one idea per slide, a clear sequence, nothing to tweak. You can read through the whole deck like a script and feel the pacing immediately. The tool stays out of your way so you can work on what matters — the message.

## Autoflow

Write text. Get good slides. No directives required.

Autoflow reads your content and picks a layout: four short lines become a Z-pattern, one bare image next to text becomes a split, two paragraphs ending in questions become a diagonal. Anti-monotony varies rhythm across slides automatically. Eight rules, convention-over-configuration.

Opt out per slide (explicit directives always win) or globally (`autoflow: false` in frontmatter).

## Agent-native

Markdown is what LLMs generate. StellarDeck treats that as a design input.

- **CLI**: `npm run export -- slides.md` with `--pdf`, `--png`, `--grid`, `--input-dir` (batch), `--slides 1-5` (range)
- **Stdin**: `cat deck.md | npm run export -- --pdf - out.pdf` — pipe from any generator
- **Structured warnings** (`--json`): typed diagnostics for content overflow, missing images, theme mismatches, deck-level issues. Agents can react programmatically without string-matching
- **Embed API**: `StellarEmbed.renderDeck(container, md, { onDiagnostics })` lets host pages surface deck health
- **Deckset-compatible**: the parser handles an existing open format with no lock-in

## Simple by design

- No build step. No bundler. Dev server + browser.
- Render parity across Tauri, browser, embed, and CLI — same output everywhere
- The `.md` file is the artifact. PDFs are regenerable. Git-friendly diffs
- 9 themes × 4 color schemes, dark/light, no CSS required

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
python3 scripts/dev-server.py 3031
# Open http://localhost:3031/viewer.html?file=demo/getting-started.md
```

No build step. No bundler. Just a dev server and a browser.

## Desktop app (Tauri)

```bash
npm install
cargo tauri dev
```

Requires [Rust](https://rustup.rs/) and the [Tauri CLI](https://tauri.app/start/).

## CLI

```bash
npm run export -- slides.md                          # → slides.pdf
npm run export -- --png slides.md                    # → slides-slides/001.png...
npm run export -- --grid slides.md                   # → slides-grid.png composite
npm run export -- --input-dir decks --output dist    # batch export a tree
npm run export -- --json --pdf slides.md             # machine-readable output
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

Apache 2.0 — see [LICENSE](LICENSE).

Built by [Paulo Silveira](https://paulo.com.br).
