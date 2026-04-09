footer: autoflow rules · bare-image-position-variation
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

# Cover

(slide 0 — sets up the deck before the variation begins)

---

<!--
RULE: bare-image-position-variation (priority 70)
TRIGGERS WHEN:
  - The slide has exactly 1 image with NO layout modifier
    (no right/left/inline/qr/fit/filtered/bg)
  - The slide also has at least 1 non-image content line
EFFECT (the only history-based rule):
  - Picks position by varying across deck: inline → left → right → ...
  - The position is based on ctx.state.lastBareImagePosition, NOT slide index
  - All three rewrite the bare ![](src) into a parser primitive:
      ![inline](src), ![left](src), ![right](src)
  - State is also updated when an EXPLICIT ![left]/![right]/![inline]
    image appears on a skipped slide, so the variation never repeats the
    same position as the previous slide.

The name says "position variation" because it varies the IMAGE POSITION
across slides — it doesn't rotate the image itself.

The 4 slides below show one full cycle + wrap:
  slide 1: 1st bare image → inline  (variation starts)
  slide 2: 2nd bare image → left
  slide 3: 3rd bare image → right
  slide 4: 4th bare image → inline  (cycle wraps)
-->

![](/demo/images/vibe-coding/karpathy-vibe.webp)

# First image of the deck

This one becomes inline (image in flow, text above).

---

![](/demo/images/vibe-coding/seven-languages-book.webp)

# Second image

This one varies to left split.

---

![](/demo/images/vibe-coding/pragmatic-programmer-tweet.webp)

# Third image

And this one varies to right split.

---

![](/demo/images/vibe-coding/bravenewgeek-you-are-not-paid.webp)

# Fourth image

Cycle wraps: back to inline.
