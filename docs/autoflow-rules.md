# Autoflow Rules Reference

> Auto-generated from rule metadata in `packages/core/src/autoflow/`.
> Run `node scripts/autoflow-docs.js > docs/autoflow-rules.md` to regenerate.

Autoflow is convention-over-configuration layout inference. Write plain
markdown, and autoflow infers the best layout based on content structure.
Rules are evaluated in priority order — first match wins.

## On by default

Autoflow runs unless the deck opts out with `autoflow: false` in the
frontmatter. The toolbar toggle (desktop app) and the CLI flags
`--autoflow` / `--no-autoflow` override the deck.

## Pipeline

observers → skip checks → empty → preprocessors → rules (priority order) → default

## Pre-processing

After the skip checks and before the rules, preprocessors rewrite the slide
and let the pipeline continue:

- **explicit-image**: An explicit split (`![left]`/`![right]`) or background (`![fit]`/`![filtered]` on the first line) image with text: the image line stays exactly as written and leaves the text analysis, so text rules still apply. Rules that need the whole slide opt out with skipIfDirective: ['split-image'].
- **bare-image-background**: Hero slide: one bare image plus a few words (≤ heroMaxWords, default 8). The image becomes a ![filtered] background (dark overlay) and leaves the text analysis, so text rules (statement, divider, …) apply on top. With more text, the image keeps its own space instead (bare-image-position-variation).

## When autoflow does NOT touch a slide

Even with autoflow enabled, these slides are left exactly as written:

### Skip: explicit

Slide has user-authored text layout: `#[fit]`, `#[top-left]`/`#[bottom-right]`/etc., `[.autoscale: true]`, or `[.alternating-colors: true]`. Also an explicit image (`![left]`/`![right]`/`![fit]`/`![filtered]`) with no text beside it, or one autoflow can't lay text around (several images, a background image mid-slide). An explicit split or background image WITH text is not skipped: the image stays as written and the text still gets autoflow.

### Skip: code

Slide contains a fenced code block (`` ``` ``). Code blocks have fixed formatting that autoflow should not alter.

### Skip: custom-block

Slide uses a block directive: `:::columns`, `:::diagram`, `:::steps`, `:::center`, or `:::math`. These are custom layouts that autoflow should not override.


## Rules (9)

| # | Rule | Priority | Detection |
|---|------|----------|-----------|
| 1 | **title** | 10 | First slide with a short title (≤6 words) followed by longer subtitle text |
| 2 | **divider** | 20 | Single line of plain text (≤2 words) |
| 3 | **diagonal** | 30 | Two short paragraphs where at least one ends with "?" |
| 4 | **z-pattern** | 40 | Exactly 4 short paragraphs (≤8 words, ≤2 lines each) |
| 5 | **alternating** | 50 | 3+ short paragraphs (≤10 words, ≤2 lines each) |
| 6 | **statement** | 60 | Short plain-text slides — 1-4 lines, up to 15 words/line |
| 7 | **bare-image-position-variation** | 70 | One bare image beside more text than a hero slide holds (> heroMaxWords) |
| 8 | **phrase-bullets** | 75 | One short headline (≤8 words) plus 2-3 short bullets (≤6 words each) and nothing else |
| 9 | **autoscale** | 80 | Dense slide with >8 lines or >80 words |

### title

**Priority:** 10 (guarded)

First slide with a short title (≤6 words) followed by longer subtitle text. Centers and applies #[fit] to the title line.

**Example input:**

```markdown
The Art of Balancing

A journey from wall handstands
to freestanding practice.
```

---

### divider

**Priority:** 20
  
**Anti-monotony:** yes (varies across consecutive uses)

Single line of plain text (≤2 words). Becomes a full-screen #[fit] heading. Great for section breaks.

**Example input:**

```markdown
BUILDERS
```

---

### diagonal

**Priority:** 30
  
**Anti-monotony:** yes (varies across consecutive uses)
  
**Sits out on:** `split-image` slides

Two short paragraphs where at least one ends with "?". Places them at opposing corners (top-left + bottom-right) for dramatic tension. Anti-monotony mirrors corners.

**Example input:**

```markdown
What language are you
writing code in?

The answer has changed.
```

---

### z-pattern

**Priority:** 40
  
**Sits out on:** `split-image` slides

Exactly 4 short paragraphs (≤8 words, ≤2 lines each). Places them at the four corners: top-left, top-right, bottom-left, bottom-right. Uses h1 for short text (≤3 words), h2 for longer.

**Example input:**

```markdown
TXT

Markdown

YAML

JSONL
```

---

### alternating

**Priority:** 50
  
**Sits out on:** `split-image` slides

3+ short paragraphs (≤10 words, ≤2 lines each). Applies alternating accent colors for visual rhythm.

**Example input:**

```markdown
Speed

Cost

Barrier to entry

Disposable software
```

---

### statement

**Priority:** 60
  
**Anti-monotony:** yes (varies across consecutive uses)

Short plain-text slides — 1-4 lines, up to 15 words/line. Three tiers prevent the "cliff" where adding one word silently breaks the layout: T1 (≤2 lines, ≤5 words) renders centered + #[fit]; T2 (≤8 words/line) renders #[fit]; T3 (9-15 words/line) drops #[fit] and uses [.autoscale: true] so the whole slide scales as a block instead of each line shrinking independently.

**Example input:**

```markdown
You are not paid
to write code.
```

---

### bare-image-position-variation

**Priority:** 70
  
**Cross-slide:** observes every slide (state carries across the deck)

One bare image beside more text than a hero slide holds (> heroMaxWords). The image position cycles across the deck — inline → left → right, inline only with ≤2 text lines — and explicit ![left]/![right]/![inline] images on other slides count, so neighbors never repeat a side. A few words over a bare image is a hero instead (filtered background, see the bare-image-background preprocessor).

**Example input:**

```markdown
![](scaffold-construction.webp)

# Scaffolding

Temporary structure that lets you build the permanent one.
```

---

### phrase-bullets

**Priority:** 75

One short headline (≤8 words) plus 2-3 short bullets (≤6 words each) and nothing else. Picks a layout from a palette — cards → pills → alternating → staggered — cycling across the deck so neighbors differ.

**Example input:**

```markdown
# What changes

- Teamwork
- Orchestrating the build
- Understanding the full scope
```

---

### autoscale

**Priority:** 80

Dense slide with >8 lines or >80 words. Applies [.autoscale: true] to shrink text to fit. Three tiers: light (9-12 lines), moderate (13-18), dense (19+).

**Example input:**

```markdown
(any slide with >8 lines or >80 words of content)
```

---

## Defaults

| Setting | Value |
|---------|-------|
| `statementMaxWords` | 8 |
| `statementDenseMaxWords` | 15 |
| `statementMaxLines` | 4 |
| `dividerMaxWords` | 2 |
| `autoscaleMinLines` | 9 |
| `autoscaleMinWords` | 80 |
| `heroMaxWords` | 8 |

