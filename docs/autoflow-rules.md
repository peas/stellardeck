# Autoflow Rules Reference

> Auto-generated from `autoflow.js` rule metadata.
> Run `node scripts/autoflow-docs.js` to regenerate.

Autoflow is convention-over-configuration layout inference. Write plain
markdown, and autoflow infers the best layout based on content structure.
Rules are evaluated in priority order — first match wins.

## How to enable

Add `autoflow: true` to the frontmatter:

```markdown
autoflow: true
theme: Alun, 1
```

Or toggle in the toolbar (desktop app), or pass `--autoflow` to the CLI.

## Pre-processing

Before rules run, autoflow applies one pre-processing step:

- **Bare image + text → filtered background**: When a slide has one bare
  image (`![](src)`) alongside text, the image becomes `![filtered](src)`
  (dark overlay background). Text rules then apply normally on top.

## When autoflow does NOT touch a slide

Even with autoflow enabled, these slides are left exactly as written:

### Skip: explicit

Slide has user-authored layout directives: `#[fit]`, `#[top-left]`/`#[bottom-right]`/etc., `![left]`/`![right]`/`![fit]`/`![filtered]`, `[.autoscale: true]`, or `[.alternating-colors: true]`. Autoflow respects explicit intent.

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
| 6 | **statement** | 60 | 1-4 lines of short plain text (≤8 words/line) |
| 7 | **bare-image-position-variation** | 70 | Bare image without text — cycles position across the deck (inline → left → right) for visual variety |
| 8 | **phrase-bullets** | 75 | Bullet list where items are short phrases (≤12 words, 3-8 items) |
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

1-4 lines of short plain text (≤8 words/line). Applies #[fit] to each line for maximum impact. Short statements (≤2 lines, ≤5 words) are centered. Anti-monotony varies alignment.

**Example input:**

```markdown
You are not paid
to write code.
```

---

### bare-image-position-variation

**Priority:** 70

Bare image without text — cycles position across the deck (inline → left → right) for visual variety. NOTE: bare image WITH text is handled by pre-processing (→ ![filtered] background + text rules).

**Example input:**

```markdown
![](scaffold-construction.webp)
```

---

### phrase-bullets

**Priority:** 75

Bullet list where items are short phrases (≤12 words, 3-8 items). Applies a visual bullet style (pills, staggered, or alternating) that varies across the deck.

**Example input:**

```markdown
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
| `statementMaxLines` | 4 |
| `dividerMaxWords` | 2 |
| `autoscaleMinLines` | 9 |
| `autoscaleMinWords` | 80 |

