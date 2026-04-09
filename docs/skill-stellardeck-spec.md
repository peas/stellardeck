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
- CLI commands: export (--pdf/--png/--grid), validate, list-themes, list-schemes
- Interpreting --json: overflow → split or autoscale, missing-image → fix path
- Theme/scheme guide (when to suggest each)
