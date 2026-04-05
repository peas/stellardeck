# Autoflow — Convention Over Configuration for StellarDeck

> "A deck builder for storytellers. Focus on the story, not on pixel positioning."

## The Problem

Today, creating a good-looking slide in StellarDeck requires knowing directives:
`#[fit]`, `![right]`, `[.background-color: #hex]`, `[.alternating-colors: true]`, `#[top-left]`, etc.

A storyteller shouldn't need to think about this. They should write:

```markdown
Software is not solved.
```

And StellarDeck should figure out that a 4-word statement on a dark slide deserves `#[fit]` treatment, centered, bold, with accent on "not".

## Paulo's Slide Patterns (195 slides analyzed)

| Pattern | Count | % | Autoflow should... |
|---------|-------|---|-------------------|
| **fit-only** (bold statement) | 48 | 25% | Auto-detect short text → fit |
| **text-heavy** (paragraphs) | 32 | 16% | Auto-scale font, add spacing |
| **split-layout** (image + text) | 27 | 14% | Auto-detect image + text → split |
| **fit-with-text** (fit + body) | 21 | 11% | Auto-fit heading, flow body below |
| **diagram/code** | 18 | 9% | Detect `→` arrows or ``` → format |
| **image-only** (background) | 12 | 6% | Single image alone → background |
| **list-slide** | 12 | 6% | Heading + bullets → standard list |
| **columns** | 8 | 4% | Detect parallel structure → columns |
| **quote** | 6 | 3% | Detect `>` → quote styling |
| **statement** (positioned) | 6 | 3% | Detect question/answer → diagonal |
| **section-divider** (number/year) | 5 | 3% | Detect lone number → centered divider |

**Key insight**: 75% of Paulo's slides can be auto-detected from content structure alone.

## How Competitors Handle It

| Tool | Approach | Verdict |
|------|----------|---------|
| **Deckset** | Modifiers (`![left]`, `[.autoscale]`) — explicit | Works but verbose |
| **Slidev** | 19 named layouts via frontmatter (`layout: quote`) | Powerful but manual |
| **Beautiful.ai** | 300+ smart templates, AI constraint enforcement | Best auto-layout but proprietary |
| **Marp** | Theme-controlled auto-scale, no layout inference | Minimal |
| **Rails/Next.js** | File structure IS the config | Inspiration for our approach |

**No markdown tool does true auto-layout.** This is a differentiator.

## Proposed Design

### The `autoflow` Directive

```markdown
autoflow: true
```

In frontmatter or per-slide with `[.autoflow: true]`. When active, the parser analyzes each slide's content and applies layout rules automatically.

### Detection Rules (Deterministic, No AI)

Rules are applied in order of precedence. First match wins.

```
RULE 1: SECTION DIVIDER
  IF slide has only 1 line AND it's a number or single word (≤2 words)
  THEN → #[fit], centered, accent color on background
  Example: "2026" → big centered year
           "1" → section number

RULE 2: STATEMENT (Punch Slide)
  IF slide has 1-3 short lines (each ≤8 words) AND no images
  THEN → #[fit] each line, left-aligned
  Example: "Software\nis not solved." → two fit lines

RULE 3: QUESTION/ANSWER (Diagonal)
  IF slide has exactly 2 text blocks separated by blank line,
     each 1-3 lines, ending with "?"
  THEN → first block #[top-left], second block #[bottom-right]
  Example: "What is distraction?\n\nArrogance or procrastination?"

RULE 4: IMAGE-ONLY (Background)
  IF slide has only image references (no text except notes)
  THEN → background image (already works)

RULE 5: IMAGE + TEXT (Split)
  IF slide has 1 image + text content
  THEN → alternate left/right based on slide index (odd=right, even=left)
  Already works with ![right], autoflow just adds the modifier

RULE 6: ALTERNATING QUESTIONS
  IF slide has 3+ paragraphs, no headings, ≥2 end with "?"
  THEN → alternating-colors: true
  Example: "Are we welcoming?\nDo we fear discomfort?\nAre we fragile?"

RULE 7: ARROW DIAGRAM
  IF any line contains " -> " or " --> " (arrow syntax)
  AND no :::diagram block
  THEN → wrap in :::diagram with flowchart LR
  Example: "Markdown -> Parser -> Slides" → Mermaid flowchart

RULE 8: COMPARISON (Columns)
  IF slide has 2-3 sections with parallel structure (same heading level,
     similar bullet counts) separated by blank lines
  THEN → :::columns layout

RULE 9: LIST WITH HEADING
  IF slide has exactly 1 heading + bullet list
  THEN → standard layout (already works), no changes needed

RULE 10: BLOCKQUOTE
  IF slide starts with ">" (already detected)
  THEN → quote styling (already works)

RULE 11: TEXT-HEAVY (Auto-Scale)
  IF slide content exceeds ~70% of available space
  THEN → reduce font-size progressively (min 18px)

RULE 12: DEFAULT
  No special treatment — render as-is
```

### Slide Variety (Anti-Monotony)

When autoflow detects consecutive slides of the same type, it varies positioning:

```
3 consecutive statements:
  Slide N:   → top-left
  Slide N+1: → bottom-right
  Slide N+2: → center

3 consecutive split-layouts:
  Slide N:   → image right
  Slide N+1: → image left
  Slide N+2: → image right
```

This creates visual rhythm without the author specifying anything.

### Configuration: `autoflow.json`

Optional file at project root or `~/.config/stellardeck/autoflow.json`:

```json
{
  "statement_max_words": 8,
  "statement_max_lines": 3,
  "divider_patterns": ["^\\d{4}$", "^\\d{1,2}$", "^[A-Z]{1,3}$"],
  "auto_scale_min_font": 18,
  "auto_scale_max_ratio": 0.7,
  "alternate_split_images": true,
  "detect_arrows_as_diagrams": true,
  "detect_questions_as_diagonal": true,
  "detect_parallel_as_columns": true
}
```

Defaults are sensible — override only when needed.

### What Autoflow Does NOT Do

- **Does not move content between slides** (splitting long slides is the author's job)
- **Does not choose themes or colors** (that's theme + scheme selection)
- **Does not rearrange bullet order** (content order is sacred)
- **Does not add content** (no AI generation, no "smart suggestions")
- **Does not change images** (no cropping, filtering, or resizing beyond fit)

Autoflow is **layout inference**, not content generation.

## Implementation Architecture

```
Markdown → parseDecksetMarkdown() → HTML
                 ↓
         [if autoflow: true]
                 ↓
         analyzeSlide(lines) → { type, layout, modifiers }
                 ↓
         applyAutoflow(lines, analysis, slideIndex, prevTypes)
                 ↓
         Modified lines (with injected directives)
                 ↓
         Normal parseSlide() pipeline
```

Autoflow runs BEFORE the existing parser. It analyzes raw markdown lines and injects directives (`#[fit]`, `[.alternating-colors: true]`, `![right]`, etc.) that the parser already understands. No new rendering code needed.

### Key Files

| File | Change |
|------|--------|
| `js/autoflow.js` (new) | Analysis rules + directive injection |
| `deckset-parser.js` | Call autoflow before parseSlide when enabled |
| `autoflow.json` (new, optional) | Rule configuration |
| `test/autoflow.test.js` (new) | Unit tests for each rule |

## Pros & Cons

### Pros
- **Zero-friction deck creation** — write text, get good slides
- **Differentiator** — no other markdown tool does this
- **Deterministic** — same input always produces same output (no AI randomness)
- **Opt-in** — doesn't affect existing decks unless `autoflow: true`
- **Configurable** — override any rule via JSON or per-slide directive
- **Testable** — each rule is a pure function with clear input/output

### Cons
- **Heuristics can be wrong** — "is this a statement or a list item?" is ambiguous
- **Surprise layouts** — author may not expect the auto-detected layout
- **Debugging** — "why did it choose this layout?" needs a debug mode
- **Maintenance** — rules accumulate complexity over time
- **Cultural bias** — rules assume Western presentation style (left-to-right, statement-heavy)

### Mitigations
- **Override always wins** — any explicit directive cancels autoflow for that slide
- **Debug mode** — `autoflow: debug` shows which rule matched per slide
- **Conservative defaults** — when in doubt, do nothing (Rule 12: DEFAULT)
- **Gradual rollout** — start with 3-4 rules, add more based on feedback

## Phased Rollout

### Phase 1: Core (4 rules)
1. Section divider detection (single number/word → fit + center)
2. Statement detection (1-3 short lines → fit)
3. Image + text → auto split (alternate left/right)
4. Auto-scale for text-heavy slides

### Phase 2: Smart (4 rules)
5. Question/answer → diagonal positioning
6. Alternating questions → accent colors
7. Arrow syntax → auto-diagram
8. Parallel structure → auto-columns

### Phase 3: Variety (2 rules)
9. Anti-monotony: vary consecutive same-type slides
10. Config file support

## Example: Before and After

### Before (manual directives)
```markdown
#[fit] 2026

---

#[fit] Software
#[fit] is not solved.

---

![right](photo.jpg)

# The Pragmatic Programmer

Hunt & Thomas, 1999.

---

[.alternating-colors: true]

Are we welcoming or fragile?

Does discomfort weaken culture?

Are we running a daycare?
```

### After (autoflow: true)
```markdown
autoflow: true

2026

---

Software
is not solved.

---

![](photo.jpg)

The Pragmatic Programmer

Hunt & Thomas, 1999.

---

Are we welcoming or fragile?

Does discomfort weaken culture?

Are we running a daycare?
```

Same visual result. 60% fewer directives. The story speaks louder.

## Tagline

**StellarDeck + Autoflow: Write the story. We handle the stage.**
