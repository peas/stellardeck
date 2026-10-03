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
    (no right/left/inline/qr/fit/filtered/bg/bordered)
  - The slide has MORE text than a hero slide holds (> 8 words).
    With 8 words or fewer, the image becomes a ![filtered] background
    instead (the bare-image-background preprocessor) — see the last slide.
EFFECT (history-based):
  - Picks position by varying across deck: inline → left → right → ...
  - inline only when the text is at most 2 lines (title + one line);
    with more text it alternates left/right so nothing gets pushed off
  - The position is based on ctx.state.lastBareImagePosition, NOT slide index
  - Rewrites the bare ![](src) into a parser primitive:
      ![inline](src), ![left](src), ![right](src)
  - State is also updated when an EXPLICIT ![left]/![right]/![inline]
    image appears on any slide, so neighbors never repeat a side.

The name says "position variation" because it varies the IMAGE POSITION
across slides — it doesn't rotate the image itself.

  slide 1: 1st bare image → inline  (title + one line)
  slide 2: 2nd bare image → left
  slide 3: 3rd bare image → right
  slide 4: a few words → hero (filtered background), not a position
-->

![](/demo/images/vibe-coding/karpathy-vibe.webp)

# First image of the deck

A title and one line of text: the image goes inline.

---

![](/demo/images/vibe-coding/seven-languages-book.webp)

# Second image

More text than a hero slide holds,
so the image takes the left half of a split.

---

![](/demo/images/vibe-coding/pragmatic-programmer-tweet.webp)

# Third image

The next one alternates to the right,
so neighboring slides never repeat a side.

---

![](/demo/images/vibe-coding/bravenewgeek-you-are-not-paid.webp)

You are not paid
to write code.
