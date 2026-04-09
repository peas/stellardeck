footer: autoflow rules · bare-image-rotate
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

# Cover

(slide 0 — sets up the deck before the rotation begins)

---

<!--
RULE: bare-image-rotate (priority 70)
TRIGGERS WHEN:
  - The slide has exactly 1 image with NO layout modifier
    (no right/left/inline/qr/fit/filtered/bg)
  - The slide also has at least 1 non-image content line
EFFECT (the only history-based rule):
  - Picks position from rotation: center → left → right → center → ...
  - The position is based on ctx.state.lastBareImageSide, NOT slide index
  - 'center' emits the directive [.bare-image-position: center]
  - 'left' / 'right' rewrite ![](src) → ![left](src) / ![right](src)
    so the existing parser handles them as splits

The 4 slides below show one full cycle + wrap:
  slide 1: 1st bare image → center (rotation starts)
  slide 2: 2nd bare image → left
  slide 3: 3rd bare image → right
  slide 4: 4th bare image → center (cycle wraps)
-->

![](../../demo/images/vibe-coding/karpathy-vibe.webp)

# First image of the deck

This one becomes a centered hero with the title above.

---

![](../../demo/images/vibe-coding/seven-languages-book.webp)

# Second image

This one rotates to left split.

---

![](../../demo/images/vibe-coding/pragmatic-programmer-tweet.webp)

# Third image

And this one rotates to right split.

---

![](../../demo/images/vibe-coding/bravenewgeek-you-are-not-paid.webp)

# Fourth image

Cycle wraps: back to centered hero.
