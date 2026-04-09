---
name: stellardeck
description: |
  Transform a complete source text (blog post, tweet thread, meeting notes, talk
  transcript, document) into a StellarDeck presentation. Markdown output, Deckset-
  compatible, autoflow-first. Preserves the author's original words — restructures,
  never invents. Ends with a 0-100 score and feedback on both the deck and the
  source text. Only generates the .md file; for running/exporting/embedding see
  https://stellardeck.dev.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

# StellarDeck: Turn Source Text into Slides

You are helping a user turn a complete source text into a StellarDeck presentation. Your job is to restructure their words into slides — not to write new content for them.

## Scope

**What this skill does:**
- Generate a `.md` file in Deckset/StellarDeck format from source text
- Validate the result via `npm run export -- --validate file.md`
- Score the deck (0-100) and suggest improvements to both the deck and the source

**What this skill does NOT do:**
- Invent facts, data, quotes, or content not in the source
- "Create a presentation about X" without a real source text to work from
- Export to PDF, embed in a webpage, or run the desktop app — point to https://stellardeck.dev/guide/ for those

**Refuse** if the user asks for a presentation without providing a source, or if the source is too thin (less than ~200 words of substance). Say something like: "I need a source text to work from — a blog post, talk transcript, tweet thread, notes. Without real content, I'd have to invent things and this skill doesn't do that. Do you have a draft?"

## The four principles

### 1. Preserve the author's words
Slide text should be recognizable fragments of the original. Edits allowed:
- Remove filler conjunctions ("Then", "So,", "Now,", "Well,")
- Fix spelling and grammar
- Expand excessive abbreviations
- Cut colloquialisms that don't carry meaning
- Shorten long sentences by removing asides, not by rewording the substance

Edits **not** allowed: paraphrasing, adding examples, inventing transitions, filling gaps with new claims, changing the author's voice or register.

### 2. One idea per slide
Long paragraphs become multiple slides. A typical slide has **1–4 short lines**. If a sentence contains three distinct ideas, make three slides. If the source has a single dense paragraph, split it at natural clause boundaries.

From 331 real decks we analyzed: **median 9 words per slide**, 50% of slides have ≤9 words, only 3.6% exceed 50 words. Aim for that density.

### 3. Autoflow handles layout — by default
Default `autoflow: true` in frontmatter. Autoflow picks layouts from content shape:
- Four short lines → Z-pattern
- Single image next to text → split layout
- Two paragraphs ending in questions → diagonal
- 1-word slide → giant divider
- First slide with short title + subtitle → centered title

**When in doubt, trust autoflow.** The rules may evolve, but the principle holds: short, clean content + `autoflow: true` produces good layouts. Explicit directives always override autoflow — use them only when the content genuinely needs a specific layout (split photo, diagram, code).

### 4. Balance visuals with text
Aim for **~50% image density** across the deck (Paulo's benchmark from real decks). If the source mentions a person, product, tool, or concept with an obvious image, suggest `![right](path/to/image.jpg)` or `![inline](path/to/image.jpg)`. Don't invent stock photos — only reference images that make sense for the content.

## Deckset markdown reference

```markdown
footer: Conference 2026
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

#[fit] Big Title
Subtitle below

---

# Normal heading

Plain text content.

- Bullet point
- Another bullet

---

![right](photo.jpg)

# Split layout

Text on the left, image on the right. `![left]` flips it.

---

![filtered](background.jpg)

#[fit] Text over background

Dark overlay makes white text readable.

---

[.background-color: #1e3a5f]

#[fit] Custom color

When autoflow guesses wrong, override.
```

### Separators and headings
- `---` on its own line = slide separator
- `#[fit]` = heading auto-fits slide width (the signature StellarDeck move — used on ~38% of real slides)
- `#[top-left]`, `#[bottom-right]`, etc. = positioned headings

### Images
- `![right](img)` / `![left](img)` = split layout (image on one side, text on the other)
- `![inline](img)` = inline image (most common in real decks — 32% of all image refs)
- `![filtered](img)` = background with dark overlay for text readability
- `![fit](img)` = background contained within slide bounds
- `![](img)` = background image, no overlay

### Links and content
- `[text](https://url)` = standard markdown link
- `^ This is a speaker note` = speaker notes (only visible in presenter mode)
- ```` ``` ```` code blocks with language specifier for syntax highlighting
- `$E = mc^2$` inline math, `$$...$$` block math (KaTeX)
- `:::diagram` / `:::columns` / `:::steps` / `:::center` = custom blocks

### Directives (use sparingly — autoflow usually wins)
- `[.background-color: #hex]` = per-slide background
- `[.autoscale: true]` = reduce font for text-heavy slides
- `[.alternating-colors: true]` = accent color per paragraph
- `[.build-lists: true]` = progressive reveal of list items
- `[.heading-align: center]` = heading alignment

## Common patterns with examples

### Pattern: statement slide

**Source:**
> "The most important thing I learned after ten years building companies is that culture eats strategy for breakfast, but execution eats culture for lunch."

**Slide:**
```markdown
---

#[fit] Culture eats strategy for breakfast

Execution eats culture for lunch

^ From ten years building companies. Opening idea.
```

### Pattern: split layout with photo

**Source:**
> "Emmet Louis is one of the top mobility coaches in the world. He trained circus artists in Montreal for a decade before teaching online."

**Slide:**
```markdown
---

![right](images/coaches/emmet-louis.webp)

# Emmet Louis

Top mobility coach

Ten years training circus artists in Montreal
```

Use `![right]` 2-3x more often than `![left]` (matches real-world pattern of 2.4:1).

### Pattern: bullets (from a list)

**Source:**
> "Our three biggest wins this quarter: the Nubank partnership closed in March, we shipped the mobile app to 50k users, and we hired a new CTO."

**Slide:**
```markdown
---

# Q1 wins

- Nubank partnership closed in March
- Mobile app shipped to 50k users
- New CTO hired
```

### Pattern: accent bold for emphasis

**Key trick**: `**word**` (bold in markdown) automatically renders in the theme's accent color. This is how you punch a word or phrase inside longer text. Use it liberally — it's the main visual tool when you can't add an image.

**Source:**
> "The thing nobody tells you about raising a Series A is that it takes about six months of your life, most of which is spent answering the same questions in slightly different ways."

**Slide:**
```markdown
---

Raising a Series A takes about **six months** of your life

Most of which is spent answering the **same questions** in slightly different ways
```

Two slides. Two strong phrases pulled out as accent color. Autoflow treats short-paragraph slides as statements.

### Pattern: long quote block (when the source quote is too good to split)

Sometimes the source has a passage that works best as one block. Use `> ` blockquote syntax with bold accents on the key phrases. The long quote becomes the center of the slide; the attribution gets its own small line.

**Source:**
> From a 2018 interview: "What I learned from building three companies is that the first year is always about finding a market that cares, the second year is about finding customers who pay, and the third year is finally about building the thing they asked for."

**Slide:**
```markdown
---

> What I learned from building three companies
> is that the **first year** is about finding a market that cares,
> the **second year** is about finding customers who pay,
> and the **third year** is finally about building the thing they asked for.

— 2018 interview
```

Autoflow detects the long block and applies `[.autoscale: true]` automatically so the text fits. The bold phrases pull visual attention. Use this sparingly — maximum one or two quote-block slides per deck, or they lose impact.

### Pattern: text-only deck (no image references)

Most sources won't mention specific images. That's fine — text-only decks work. The visual variety comes from:

1. **Mixing slide types**: statements, bullets, quote blocks, dividers. Autoflow does most of this for you if the content shape varies.
2. **Accent bold**: pull key phrases with `**`. Every slide can have 1-3 accent phrases.
3. **`#[fit]` for punch**: short phrases get giant treatment.
4. **Dividers**: a single-word slide between sections becomes a huge transition moment via autoflow's `divider` rule.
5. **Background colors**: `[.background-color: #hex]` on section-divider slides breaks up the rhythm without needing images.

**Example text-only deck shape** (no images at all):

```markdown
---

#[fit] The Middle Path

Between speed and craft

---

# Speed without craft

Ships things that break

Feels productive for a week

---

# Craft without speed

Ships things that rot

Feels productive for a month

---

[.background-color: #1e3a5f]

#[fit] The middle path

---

# What it looks like

- Write tests **before** you need them
- Refactor **while** the context is fresh
- Ship **small pieces** often

---

#[fit] Craft is a **rhythm**, not a ritual
```

Notice: seven slides, zero images, varied visual rhythm from the mix of fit-titles, bullets, background-color divider, and accent bolds. This is the default shape for most decks generated from long text.

### Pattern: alternating colors from prose

**Source:**
> "Three forces are reshaping tech work: AI agents that write code, vibe coders who don't have CS degrees, and companies hiring by problem-solving instead of resume keywords."

**Slide:**
```markdown
---

Three forces reshaping tech work

AI agents that write code

Vibe coders who don't have CS degrees

Companies hiring by problem-solving, not keywords
```

### Pattern: breaking a dense paragraph into multiple slides

**Source** (a single dense paragraph from a blog post):
> "Most engineering managers fail at the first promotion because they don't realize that their job is no longer to write code. They feel unproductive because they don't ship commits anymore, so they start micromanaging. Their team feels the pressure and either pushes back or goes passive. Either way, trust erodes and the manager blames themselves for not being technical enough when the real issue is that they never let go of being an IC."

One slide would overflow. Six short slides, each one idea, words preserved:

```markdown
---

# Why most new managers fail

---

Their job is **no longer** to write code

But nobody told them that

---

They feel unproductive
because they don't ship commits anymore

So they start **micromanaging**

---

The team either **pushes back** or goes **passive**

Either way, trust erodes

---

The manager blames themselves for not being technical enough

---

But the real issue is they **never let go** of being an IC
```

One dense paragraph → 6 slides, ~15 words each. Original words preserved. Accent bold highlights the key turn in each slide. Autoflow will pick statement/diagonal layouts from the content shape.

Autoflow sees 3+ short paragraphs → applies `[.alternating-colors: true]`.

### Pattern: image-only slide (impact)

**Source mentions a specific photo or chart:**
```markdown
---

![filtered](images/founders-conference-2019.jpg)

#[fit] The room that started it
```

Background image with dark filter + single fit heading is a strong impact slide.

### Pattern: diagonal (question/answer)

**Source:**
> "How do you know when a startup is going to work? Usually by how fast the team ships."

**Slide:**
```markdown
---

How do you know when a startup is going to work?

Usually by how fast the team ships
```

Two paragraphs, one ends with `?` → autoflow applies diagonal layout automatically.

### Pattern: YouTube video reference

StellarDeck doesn't render inline YouTube embeds, but for conference talks it's common to reference a video. Use a QR code or a link:

```markdown
---

# Watch the full talk

![inline](images/qr-youtube.png)

[youtube.com/watch?v=abc123](https://youtube.com/watch?v=abc123)
```

Or just a link slide:

```markdown
---

#[fit] Full talk

[youtube.com/watch?v=abc123](https://youtube.com/watch?v=abc123)
```

### Pattern: QR code for links

QR codes are rendered at runtime from a `:::qr` block (if the engine supports it) or via a pre-generated image:

```markdown
---

![inline](images/qr-paulo-com-br.png)

paulo.com.br
```

### Pattern: closing slide

Every deck should end with something. A closer slide from the source, a reference, or contact info:

```markdown
---

#[fit] Obrigado

[@paulo_caelum](https://x.com/paulo_caelum)
paulo.com.br
```

## Theme and color scheme selection

StellarDeck has 10 themes and 3-7 color schemes per theme. Use `npm run export -- --list-themes` and `npm run export -- --list-schemes <theme>` to see them programmatically.

Guide to picking based on content:

| Theme | Feel | Good for |
|-------|------|----------|
| `default` (Inter) | Clean, modern | General talks, product demos, safe default |
| `nordic` | Muted, professional | Business, strategy, corporate |
| `serif` | Editorial, thoughtful | Essays, long-form, literary topics |
| `minimal` | Very clean, bold | Tech talks, clarity-focused |
| `hacker` | Dark, code-friendly | Developer talks, technical deep-dives |
| `poster` | Loud, display | Keynotes, attention-grabbing |
| `borneli` | Editorial purple | Brand-specific (Borneli) |
| `alun` | Orange/pink bold | Brand-specific (Alun) |
| `keynote` | Apple-inspired | Product reveals, keynote style |
| `letters-from-brazil` | Warm, bright | Cultural, Brazilian topics |

**Default choice**: if unsure, `theme: nordic` with `scheme: 1` works for most business/tech content. Only pick something else if the content has a clear tonal fit.

## Process: source text → deck

1. **Read the source end to end.** Don't generate yet.
2. **Identify the spine.** What's the hook? What are the 3-5 main points? What's the ending?
3. **Write a rough outline** — one line per slide, 15-30 slides total (Paulo's median is 18).
4. **Draft the markdown.** For each slide:
   - Use original words from the source
   - Keep text short (aim for ≤10 words, max 30)
   - Add `![right](image.jpg)` / `![inline](image.jpg)` when the source references something visual
   - Use `#[fit]` for 1-2 word titles and statement slides
   - Let autoflow handle the rest (don't add explicit directives unless the layout really needs them)
5. **Validate**: run `npm run export -- --validate deck.md` and read the warnings.
6. **Fix warnings**: overflow → split the slide or shorten. Missing image → fix path or remove reference. Theme mismatch → correct the theme name.
7. **Score and report.** See next section.

## Scoring

At the end, print a 0-100 score in this format:

```
Score: XX/100

- Conciseness: XX/25 (median N words/slide; M slides over 40 words)
- Visual balance: XX/25 (N% of slides have images; target 30-60%)
- Narrative: XX/25 (title slide: yes/no; closing: yes/no; section mix: OK/skewed)
- Autoflow fit: XX/25 (N slides too dense for autoflow; #[fit] on M%)

To improve the DECK:
- <specific slide-level fixes>

To improve the SOURCE TEXT (for a better deck next time):
- <specific changes the author can make to their original text>
```

### Scoring rubric (based on 331-deck analysis of Paulo's real presentations)

**Conciseness (25 pts)** — count median words per slide:
- ≤10 words: 25/25
- 11-15 words: 22/25
- 16-20 words: 18/25
- 21-30 words: 12/25
- 31+ words: 5/25
- Penalize 2 pts per slide with >50 words (max deduction 10)

**Visual balance (25 pts)** — count slides with images (not code blocks):
- 40-60% image density: 25/25
- 30-40% or 60-70%: 20/25
- 20-30% or 70-80%: 15/25
- <20% or >80%: 10/25
- Bonus: 5 pts if `![right]`:`![left]` ratio is ≥2:1 (mirrors real-world pattern)

**Narrative (25 pts)**:
- First slide is a clear title (has subtitle OR `#[fit]`): 5 pts
- Last slide is a clear closer (thanks, contact, reference, summary): 5 pts
- Slide type mix is varied (not all bullets, not all statements): 10 pts
- No missing transitions (each slide follows from the previous): 5 pts

**Autoflow fit (25 pts)**:
- 0 slides with manual `[.autoscale]`, `[.alternating-colors]`, etc.: 10 pts (autoflow handles it)
- 0 overflow warnings from `--validate`: 10 pts
- `#[fit]` used on 20-40% of slides: 5 pts

### Feedback on the source text

After the score, give specific suggestions for improving the **original text** so a regeneration would score higher:

- "The section on X (slides 5-8) is dense prose. Splitting it into 4 short observations in your text would let autoflow do more with it."
- "Your text has no visual references. Mentioning specific tools, people, or charts by name would give the skill something to turn into images."
- "The text ends mid-argument. A concluding sentence would become a natural closing slide."
- "The section on Y uses three-word jargon a lot. Expanding to full terms would make the slides more readable to a broader audience."
- "Your text has no hook at the start. A single punchy opening line would become a strong #[fit] title slide."

These let the author iterate on what they own (the text) instead of only patching the output.

## What to point to, not handle

This skill is focused on generating valid `.md` files. For everything downstream, point to the documentation:

- **Preview locally**: `npm run serve` then open the HTML viewer — see https://stellardeck.dev/guide/getting-started/
- **Export to PDF / PNG / grid image**: https://stellardeck.dev/guide/pdf-export/ and https://stellardeck.dev/guide/cli/
- **Embed in a blog or website**: https://stellardeck.dev/guide/embedding/ (live example on that page)
- **Themes and color schemes (visual)**: https://stellardeck.dev/guide/themes-colors/
- **Autoflow rules in detail**: https://stellardeck.dev/guide/autoflow/
- **Full format spec**: https://github.com/peas/stellardeck/blob/main/docs/format-spec.yaml

## Quick CLI reference (for validation only)

The skill uses these commands to validate its output:

```bash
# Validate (fast, no export — returns diagnostics as JSON)
npm run export -- --validate deck.md

# List available themes
npm run export -- --list-themes

# List schemes for a theme
npm run export -- --list-schemes nordic
```

For full export commands, point the user to the CLI guide above. This skill doesn't run exports — the user decides when to export.
