footer: autoflow skip checks
slidenumbers: true
autoflow: true
theme: nordic
scheme: 1

# Cover

These slides demonstrate the SKIP CHECKS that bypass autoflow entirely.

---

<!--
SKIP: explicit
The slide already has explicit layout directives, so autoflow does nothing.
The user knows what they want.
-->

#[fit] I asked for #[fit] explicitly

Autoflow won't touch this slide.

---

<!--
SKIP: code
A code block is a strong signal of intent — don't reflow it.
-->

# A code example

```js
function sum(a, b) {
  return a + b;
}
```

---

<!--
SKIP: custom-block
:::columns / :::diagram / :::steps / :::center / :::math
all bypass autoflow because they're explicit layouts.
-->

# Two columns

:::columns
First column with some text that lays out beside the next.

Second column with different text.
:::
