footer: autoflow rules · title
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

<!--
RULE: title (priority 10)
TRIGGERS WHEN:
  - First slide of the deck (guard: index === 0)
  - First paragraph is a single line, ≤6 words, plain text
  - There's at least one more paragraph below it
  - The total subtitle words are GREATER than the title words
EFFECT:
  - Wraps the title line in #[fit]
  - Adds [.heading-align: center]
  - The result is a centered, fit-sized title with a subtitle below
-->

The Middle Path

Between speed and craft.

A talk about how to know when to ship and when to refactor.

---

# Just a regular slide

This second slide proves the title rule only fires on slide 0.
