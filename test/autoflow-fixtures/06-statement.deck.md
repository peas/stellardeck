footer: autoflow rules · statement
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

# Cover

---

<!--
RULE: statement (priority 60)
TRIGGERS WHEN:
  - The slide has 1-4 content lines
  - Each line is plain text (no heading, no image, no list)
  - Each line is ≤8 words (config.statementMaxWords)
EFFECT:
  - Each line gets wrapped in #[fit]
  - For very short slides (≤2 lines, max 5 words each):
    also adds [.heading-align: center]

Anti-monotony: when statement fires multiple times in a row,
the alignment cycles. Short slides cycle left/right; longer
ones cycle center/right.
-->

Culture eats strategy for breakfast

---

Execution eats culture for lunch

---

Compounding eats execution for dinner
