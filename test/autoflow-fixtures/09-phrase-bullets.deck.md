footer: autoflow rules · phrase-bullets
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

# Cover

(slide 0 — sets up the deck before the palette starts cycling)

---

<!--
RULE: phrase-bullets (priority 75)
TRIGGERS WHEN:
  - The slide has exactly 1 heading line (h1/h2/h3)
  - 2-3 bullet items, each ≤6 words
  - The headline ≤8 words
  - No images, no extra paragraphs
EFFECT:
  - Picks layout from a 4-variant palette via ctx.state.lastPhraseBulletsLayout
  - cycles: cards → pills → alternating → staggered → cards → ...
  - Injects [.bullets-layout: <variant>] which the parser turns into
    data-bullets-layout="..." on the section, and CSS renders the variant.

The 4 slides below show one full cycle of the palette.
-->

# Three forces reshaping work

- AI agents that write code
- Vibe coders without CS
- Hiring for problems

---

# Three skills the new dev needs

- Curiosity
- Taste and judgment
- Speed and rhythm

---

# What good engineers do

- Read docs and source
- Reject mediocre output
- Throw away failed work

---

# How to ship faster

- Smaller commits
- Earlier reviews
- Tests as you go
