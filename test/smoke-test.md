footer: Smoke Test — Deckset→Reveal.js
slidenumbers: true

# Slide 1: Heading simples
## Subtítulo h2
### Subtítulo h3

Texto normal com **bold** e *italic*.

---

#[fit] Slide 2: Fit heading único

---

#[fit] Slide 3: Dois fit headings
#[fit] Segunda linha fit

---

#[fit] Slide 4: Fit + texto abaixo
#[fit] Heading grande

Texto pequeno embaixo do fit.

- Item 1
- Item 2

---

# Slide 5: Lista simples

- Copilot
- Cursor
- Claude Code
- Replit

---

# Slide 6: Lista ordenada

1. Primeiro item
2. Segundo item
3. Terceiro item

---

> Slide 7: Blockquote — "Nós não somos estudantes de alguma disciplina, mas estudantes de problemas."

Karl Popper

---

# Slide 8: Code block

```python
def hello():
    print("Hello, world!")
    return 42
```

---

![right](../assets/20101_2c3b59.webp)

# Slide 9: Imagem right + texto

Texto na esquerda com imagem à direita.

- Item A
- Item B

---

![left](../assets/20101_2c3b59.webp)

# Slide 10: Imagem left + texto

Texto na direita com imagem à esquerda.

---

![](../assets/20101_2c3b59.webp)

^Slide 11: Background image (sem modifier = cover). Speaker note aqui.

---

![fit](../assets/20101_2c3b59.webp)

^Slide 12: Background image fit (contain).

---

![filtered](../assets/20101_2c3b59.webp)

# Slide 13: Filtered background

Texto sobre imagem com filtro escuro.

---

# Slide 14: Inline image + texto

Texto acima da imagem.

![inline](../assets/20101_2c3b59.webp)

Texto abaixo.

---

# Slide 15: Duas inline lado a lado

![inline](../assets/20101_2c3b59.webp) ![inline](../assets/20101_9669ce.webp)

---

[.background-color: #1e3a5f]

# Slide 16: Background color

Slide com cor de fundo customizada.

---

![right](../assets/20101_2c3b59.webp)

#[fit] Slide 17: Split + fit

Fit heading dentro de layout split.

---

# Slide 18: Imagem quebrada

![inline](../assets/nao-existe-teste-xyz.webp)

Deve mostrar placeholder vermelho.

---

#[fit] Slide 19: Fit com acentos
#[fit] São Paulo — café, código
#[fit] e educação!

---

#[fit] ACENTOS EM UPPERCASE
#[fit] AÇÃO, NÃO, CÓDIGO
#[fit] ÇÉDILHA, ÜBER, NAÏVE

^Slide 20: Testa diacríticos em uppercase — ã, ç, ü, ï, é devem aparecer sem cortar

---

# Slide 20: Texto longo

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

**Bold text** e _italic text_ e `inline code` e ~~strikethrough~~.

[Link exemplo](https://alura.com.br)

---

# Slide 21: Columns (2)

:::columns
## Left
- Item A
- Item B

:::
## Right
- Item C
- Item D
:::

---

# Slide 22: Columns (3)

:::columns
## One
First column content

:::
## Two
Second column content

:::
## Three
Third column content
:::
