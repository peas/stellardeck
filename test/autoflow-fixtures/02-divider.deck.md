footer: autoflow rules · divider
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

# Cover

A regular cover slide so the divider isn't slide 0.

---

<!--
RULE: divider (priority 20)
TRIGGERS WHEN:
  - The slide has exactly 1 non-empty content line
  - That line is plain text (no heading, no image, no list)
  - That line is ≤2 words (config.dividerMaxWords)
EFFECT:
  - Wraps the line in #[fit]
  - Adds [.heading-align: center]
  - The whole slide becomes a giant section break

Anti-monotony: when several dividers fire in a row, the alignment
cycles through center → left → right (see vary).
-->

Speed

---

Craft

---

Both
