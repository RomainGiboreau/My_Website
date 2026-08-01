# Rendering test

A throwaway page to check that everything renders properly. Nothing here means anything.

---

## Text and emphasis

Plain text looks like this. **Bold text** for emphasis, *italic text* for the mastery marker, and `inline code` for parameters or filenames.

A longer paragraph to see how line length and spacing behave on a phone versus a laptop. The Material theme caps the content width, so this should stay readable rather than stretching across the whole screen.

---

## Lists

- First item
- Second item
    - Nested item
    - Another one
- Third item

1. Ordered one
2. Ordered two
3. Ordered three

---

## Table

| Method | Year | Notes |
|---|---|---|
| Alpha | 1972 | Simple, needs calibration |
| Beta | 1995 | Handles the awkward case |
| Gamma | 2016 | Slower but general |

---

## Maths

Inline maths: the relation \(y = ax + b\) should render on the same line.

Display maths:

\[
\phi = \phi_0 \, e^{-cz}
\]

And something with more furniture:

\[
\lambda_{\text{bulk}} = \lambda_f^{\phi} \cdot \lambda_m^{(1-\phi)}
\]

If these show as raw text, MathJax isn't loading.

---

## Admonitions

!!! note
    This is a note block. Useful for side remarks.

!!! warning
    This is a warning block. Useful for the "don't do this" cases.

??? info "Click to expand"
    Collapsible content. Good for long derivations you don't want cluttering the page.

---

## Code

```python
import numpy as np

def decay(z, phi0=0.55, c=4e-4):
    """Nothing meaningful — just checking syntax highlighting."""
    return phi0 * np.exp(-c * z)

print(decay(np.array([0, 1000, 2000])))
```

---

## Images

Remote image, fixed width:

![Placeholder](https://picsum.photos/id/1015/800/400){ width="600" }

*Caption text sits underneath in italics.*

Local image — put a file at `docs/images/test.png` and uncomment:

<!-- ![Local test](images/test.png){ width="400" } -->

---

## Links

- [External link](https://www.mkdocs.org/)
- [Internal link to the CV page](cv.md)

---

## Footnotes

Here is a claim that needs a source.[^1]

[^1]: The footnote text appears at the bottom of the page.

---

*If all of the above renders correctly, the pipeline works and real content can go in.*
