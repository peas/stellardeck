# StellarDeck

**A framework for telling stories through markdown.**

StellarDeck turns plain markdown into impactful presentations without getting in the way of your thinking. The constraints of markdown — short slides, sequential flow, no fiddling with layout — help you focus on the message. You can glance at your deck and instantly see if the narrative flows right, then quickly rearrange, add, or cut moments in the story.

Autoflow infers layouts from your content (no directives needed). Broad Deckset compatibility means existing decks just work. A built-in presenter mode, web embed system, and desktop app (Tauri) make StellarDeck useful beyond the stage.

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

Each page shows the full embedded deck at the top and a slide-by-slide breakdown below where you can edit the markdown and see changes live.

## Quick start

```bash
# Clone and open in browser
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

## Features

- **Markdown-first** — `---` separates slides, `#[fit]` auto-sizes headings, `![right]` splits layouts
- **Autoflow** — convention-over-configuration layout inference (8 rules, anti-monotony)
- **Deckset compatible** — broad support for Deckset markdown syntax
- **Themes & color schemes** — 5 themes, 4 schemes each, dark/light
- **Presenter mode** — speaker notes, timer, next slide preview
- **Grid overview** — thumbnail view of all slides, keyboard navigation
- **PDF export** — in-browser via html2canvas + pdf-lib
- **Web embed** — `StellarEmbed.renderDeck()` / `renderSlide()` for any page
- **Desktop app** — native macOS app via Tauri 2.0 with file watcher
- **410 tests** — unit, E2E, layout, visual regression

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

## License

Apache 2.0 — see [LICENSE](LICENSE).

Built by [Paulo Silveira](https://paulo.com.br).
