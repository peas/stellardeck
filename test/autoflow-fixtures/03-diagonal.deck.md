footer: autoflow rules · diagonal
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

# Cover

(slide 0 so the diagonal rule isn't suppressed by title rule)

---

<!--
RULE: diagonal (priority 30)
TRIGGERS WHEN:
  - The slide has exactly 2 paragraphs
  - Each paragraph is short (≤10 words, ≤3 lines)
  - At least one paragraph ends with a question mark
EFFECT:
  - First paragraph gets #[top-left]
  - Second paragraph gets #[bottom-right]
  - Reads as a question and an answer pulling diagonally across the slide

Anti-monotony: every other diagonal slide mirrors the corners
(top-right + bottom-left).
-->

How do you know when a startup works?

Usually by how fast the team ships.

---

What separates a good engineer from a great one?

Knowing when to throw code away.
