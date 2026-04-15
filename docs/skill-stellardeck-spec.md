# Skill `stellardeck` — Design Spec (draft)

Skill for Claude Code that transforms a source text into a StellarDeck presentation.

## Scope

**What it does:** transform a complete source text (blog post, tweet thread, meeting
notes, audio transcript, document) into Deckset-compatible markdown slides.

**What it doesn't do:** "create a presentation about X" from nothing. If the source
text doesn't exist or is too thin, the skill refuses. No fabrication.

## Principles

### Preserve the author's words
Restructure, don't rewrite. Slide text should be recognizable fragments of the
original. Only edit: colloquialisms, filler conjunctions, excessive abbreviations,
spelling/grammar errors.

### One idea per slide
Long paragraphs become multiple slides. Each slide should have 1-4 short lines.
Autoflow works best with short, clear content.

### Let autoflow handle layout
Default `autoflow: true`. Only add explicit directives (`![right]`, `:::columns`,
`[.background-color]`) when the content genuinely needs them (e.g., a photo should
be a split, a process needs a diagram).

### Balance images and references
If the source mentions a person, tool, or concept with a well-known image, suggest
`![right](image.jpg)`. Don't overdo it — not every slide needs an image.

### Validate after generating
Run `npm run export -- --json --validate deck.md`, react to overflow warnings
(split the slide or add `[.autoscale: true]`).

## Snippet → slide examples

```
Source (blog excerpt):
  "Na minha visão, nos próximos anos vamos ver uma explosão de desenvolvedores
   que não vieram da formação tradicional. Gente de marketing, de produto, de
   design, todos usando IA para criar software."

Slide 1 (statement — autoflow makes it #[fit]):
  Nos próximos anos vamos ver uma explosão
  de desenvolvedores fora da formação tradicional

  ---

Slide 2 (list — autoflow picks alternating-colors):
  Gente de marketing, de produto, de design
  — todos usando IA para criar software
```

Note: words preserved from source. Only removed "Na minha visão" (filler) and
"todos" shortened context. The author would recognize their own text.

## Scoring (0-100)

At the end of generation, score the deck and give feedback on BOTH the deck
AND the source text. The goal: help the author improve the original text so the
next generation produces a better deck.

### Example output

```
Score: 72/100
- Conciseness: 22/25 (median 11 words/slide — good, 2 slides over 40 words)
- Visual balance: 15/25 (only 25% of slides have images — could use more)
- Narrative: 20/25 (clear opening, good sections, but no closing statement)
- Autoflow fit: 15/25 (3 slides too wordy for autoflow — consider splitting)

To improve the DECK:
  - slide 8: add ![right](image.jpg) with a relevant photo
  - slide 12: split into 2 slides (too dense for autoflow)
  - add a closing slide after slide 15

To improve the SOURCE TEXT (for a better deck next time):
  - The section about market size (became slides 5-7) is dense prose.
    If you rewrite it as 3 separate short observations, autoflow can
    do more with it.
  - No visual references in the text. Mentioning a chart, a photo,
    or a person by name gives the skill something to turn into images.
  - The text ends mid-argument. A concluding sentence ("So the takeaway
    is...") would become a natural closing slide.
```

### Scoring benchmarks

Based on analysis of 331 real decks (6,930 slides) from presentations-paulo.

| Dimension | Points | Good | Paulo's actual |
|-----------|--------|------|----------------|
| **Conciseness** | 0-25 | median words/slide ≤15, no slide >50 words | median 9 |
| **Visual balance** | 0-25 | image density 30-60%, splits ~15% | 51% images, 15% splits |
| **Narrative structure** | 0-25 | title slide + conclusion + section mix | 28% title, 24% bullets, 15% split, 11% statement, 10% image-only |
| **Autoflow readiness** | 0-25 | short slides, no manual directives, #[fit] 20-40% | 37.5% #[fit], 0% directives |

### Other patterns from analysis
- Slides per deck: median 18, IQR 14-26
- `![right]` outnumbers `![left]` 2.4:1
- `![inline]` is the most common image modifier (32%)
- Code blocks: 0% (stage presentations, not tutorials)
- Speaker notes: 4.3% (very sparse)
- Frontmatter: ~0% (configuration via .stellar.json sidecars)

## Skill also teaches
- Deckset markdown syntax reference (separators, `#[fit]`, image modifiers, directives)
- CLI commands:
  - `--preview deck.md` — open deck in browser for live viewing (starts temp server, Ctrl+C stops)
  - `--serve` — start dev server and open viewer (for browsing all decks)
  - `--pdf/--png/--grid deck.md` — export to file
  - `--validate deck.md` — render and collect diagnostics without exporting
  - `--list-themes` / `--list-schemes <theme>` — introspection (JSON)
  - All modes support `--theme`, `--scheme`, `--autoflow` overrides
- Interpreting --json: overflow → split or autoscale, missing-image → fix path
- Theme/scheme guide (when to suggest each)

## TODO — findings from the first real test run (2026-04-09)

Tested the skill on `apresentacao-codex-feature-busca-gnarus.deck.md` (33 slides).
Output was valid and loaded fine, but the visual result was too uniform and
didn't use the engine's best tricks. Specific findings to address in the next
skill iteration:

### 1. Image side alternation
The generated `.md` had every `![right](...)` on the same side of the deck.
Real decks alternate split direction — Paulo's real-world ratio is `![right]`
2.4× more often than `![left]`, but the two still mix. The skill should
alternate sides across consecutive split slides to create visual rhythm.

**Fix direction**: when emitting multiple split-layout slides in a row,
track the previous side and flip. Every 3rd-4th split can repeat the dominant
side; the rest should alternate.

### 2. Monotony across the whole deck
Slides all felt like the same type (heading + paragraphs). No variety of
layouts, no rhythm shift. Autoflow's anti-monotony only kicks in when there's
raw content for it to pick from — but the skill was emitting explicit
structure that bypassed autoflow entirely ("autoflow skipped: has explicit
directives" on every slide).

**Fix direction**: the skill should deliberately VARY slide shapes across
the deck. Target distribution (from 331-deck analysis):
- ~28% title-like (short, big, `#[fit]`)
- ~24% bullets
- ~15% split (image + text)
- ~11% statement (1-4 short lines, no bullets)
- ~10% image-only (background)
- rest: dividers, quotes, others
The skill should consciously pick different types across consecutive slides.

### 3. Anti-monotony signals to autoflow
The skill should LEAN ON autoflow instead of writing explicit directives
everywhere. The first iteration put explicit `#[fit]` and position markers
on most slides, which disabled autoflow ("has explicit directives" seen in
the status bar on every slide).

**Fix direction**: default to `autoflow: true` in frontmatter AND avoid
explicit directives when the content shape alone would trigger the right
autoflow rule. Only add directives when the author's intent can't be
inferred from text structure.

### 4. Accents and autoflow effects never showed
The test deck never used:
- **Bold accent color** (`**word**` → accent color) — this is the main
  visual tool when no images. Real decks use it heavily.
- **`[.alternating-colors: true]`** — 3+ short paragraphs with different
  accents. Autoflow would have applied this if content wasn't pre-structured.
- **Z-pattern** layout — 4 short paragraphs get auto-arranged on a grid.
- **Diagonal** layout — question/answer pairs get auto-positioned on
  top-left / bottom-right.
- **Divider slides** — single-word or 2-word slides with autoflow `divider`
  rule become huge section transitions.

**Fix direction**: the skill should actively look for these patterns in the
source text and emit content that triggers them. Examples:
- Find rhetorical questions → two adjacent paragraphs, second ending in `?`
  → diagonal rule fires
- Find emphasized words in the source ("the important thing", "what matters")
  → wrap them in `**bold**` to get the accent color
- Find 3-4 short related points → emit as 3-4 short paragraphs (not bullets)
  → alternating-colors rule fires
- Find section transitions → emit 1-2 word slide → divider rule fires

### 5. Next steps
When we return to this: read Paulo's real decks in `1bi-devs/`, `vibe-coding/`,
`storytelling/` to see the patterns he uses, then update the skill's
"Common patterns" section with concrete snippets that consciously trigger
each autoflow rule. Add a "Rhythm checklist" near the end of the skill that
the agent must go through before finishing: "Did you emit at least one
accent bold? At least one divider slide? Any question→answer diagonal?
Any 3-short-paragraph alternating slide?"
