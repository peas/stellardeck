# StellarDeck

Markdown presentations for storytellers.

StellarDeck renders a markdown file as slides. Layouts are inferred from the content. The same deck runs in the desktop app (Tauri), a browser, an embedded viewer, or the CLI.

Four things shape the project:

**Storytelling.** A deck is a sequence of moments. Markdown's constraints (one file, short slides, linear order) keep focus on what you're saying. Reading through the deck feels like reading a script.

**Autoflow.** Reads each slide's content and picks a layout. A slide with four short lines gets a Z-pattern. An image next to text becomes a split. Two paragraphs ending in questions become a diagonal. Consecutive slides don't get the same treatment (anti-monotony). Explicit directives always win; opt out globally with `autoflow: false` in the frontmatter.

**Agent-native.** Markdown is what LLMs produce. The CLI takes stdin, exports PDF/PNG/grid, runs batch with `--input-dir`, and emits typed JSON diagnostics (content overflow, missing images, theme mismatches) that callers can act on without parsing text. The embed API exposes the same via `onDiagnostics`.

**Simple.** Python dev server, a browser. No build step. The `.md` file is the artifact, PDFs are regenerable. Deckset-compatible.

9 themes, 4 color schemes each, dark and light.

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

## Desktop app (Tauri)

```bash
npm install
cargo tauri dev
```

Requires [Rust](https://rustup.rs/) and the [Tauri CLI](https://tauri.app/start/).

## CLI

```bash
npm run export -- deck.md                            # → deck.pdf
npm run export -- --png deck.md                      # → deck-slides/001.png, 002.png...
npm run export -- --grid deck.md                     # → deck-grid.png
npm run export -- --input-dir decks --output dist    # batch
npm run export -- --json --pdf deck.md               # machine-readable
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
