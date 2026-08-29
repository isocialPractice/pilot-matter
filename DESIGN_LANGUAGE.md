# Design Language

The documentation site under `docs/` is not styled to taste. Its palette, its
proportions, and its composition are read off `logo.png`, the mark this
project already carries, so the site looks like the thing it documents rather
than like a template the documentation was poured into.

There is no vector art in the repository, so the palette is sampled from the
raster mark: every colour below is a colour that is actually in the file, at
the frequency it occurs there.

## Palette

### Sampled from `logo.png`

The eight colours the mark is drawn with, in order of how much of the image
each covers.

| Colour | Hex | Where it is in the mark |
| --- | --- | --- |
| Sky | `#87CEEB` | The disc the aircraft is flying out of, and the `Pilot` wordmark |
| Paper | `#FFFFFF` | The banner the `Matter` wordmark sits on |
| Sage | `#90C090` | The banner's edge, and the ground the mountains stand on |
| Tan | `#8B7355` | The shaded face of each mountain |
| Tan light | `#A0826D` | The lit face of each mountain |
| Navy mid | `#1E3C5C` | The lit top of the fuselage and the wings |
| Navy | `#133059` | The aircraft, and the `Matter` wordmark |
| Navy deep | `#061D43` | The shaded underside of the near wing |

Two of them cannot carry text. `#87CEEB` reaches 1.74:1 against white and
`#90C090` reaches 2.07:1, so both are held back for fills, rules, and marks,
and darker tones of the same two hues are used wherever a reader has to read
something. Compliance beats fidelity: the site keeps the mark's hues, not its
luminances.

### Roles

Assigned by contrast rather than by preference, and stated as the custom
properties `docs/assets/site.css` declares.

#### Light

| Property | Hex | Role |
| --- | --- | --- |
| `--bg` | `#F5FAFD` | The page, sky at the far end of its own hue |
| `--surface` | `#FFFFFF` | Cards, tables, and the content column |
| `--surface-alt` | `#EAF4FA` | Table headers, callouts, and the code background |
| `--text` | `#133059` | Body text and headings, the mark's own navy |
| `--text-muted` | `#4A5F7A` | Captions, table notes, and the footer |
| `--link` | `#0D5F80` | Links, at the sky's hue taken down until it can be read |
| `--rule` | `#CFE4F0` | Borders and dividers |
| `--accent` | `#87CEEB` | The header band, marks, and the current menu entry |
| `--on-accent` | `#133059` | Text and buttons on the header band |
| `--note-edge` | `#3E7A3E` | The edge and the heading of a note |
| `--warn-edge` | `#7A5F3C` | The edge and the heading of a caution |

#### Dark

| Property | Hex | Role |
| --- | --- | --- |
| `--bg` | `#061D43` | The page, the mark's deepest navy |
| `--surface` | `#0C2A55` | Cards, tables, and the content column |
| `--surface-alt` | `#133059` | Table headers, callouts, and the code background |
| `--text` | `#E8F4FA` | Body text and headings |
| `--text-muted` | `#9FB8D0` | Captions, table notes, and the footer |
| `--link` | `#87CEEB` | Links, the mark's own sky, which reads directly on navy |
| `--rule` | `#1E3C5C` | Borders and dividers |
| `--accent` | `#87CEEB` | The header band, marks, and the current menu entry |
| `--on-accent` | `#133059` | Text and buttons on the header band |
| `--note-edge` | `#A8D4A8` | The edge and the heading of a note |
| `--warn-edge` | `#C8A987` | The edge and the heading of a caution |

The site opens on whichever the reader's system asks for, and the header's
toggle overrides that for as long as the choice is stored.

## Contrast

Every pair the site actually renders, measured as a WCAG 2.1 contrast ratio.
The floor is 4.5:1 for body text and 3:1 for large headings; nothing below
either is used for text.

| Foreground | Background | Ratio | Passes |
| --- | --- | --- | --- |
| `#133059` | `#FFFFFF` | 13.17:1 | AAA |
| `#133059` | `#F5FAFD` | 12.53:1 | AAA |
| `#133059` | `#EAF4FA` | 11.81:1 | AAA |
| `#133059` | `#87CEEB` | 7.56:1 | AAA |
| `#133059` | `#90C090` | 6.35:1 | AAA |
| `#4A5F7A` | `#FFFFFF` | 6.54:1 | AAA |
| `#4A5F7A` | `#F5FAFD` | 6.22:1 | AAA |
| `#4A5F7A` | `#EAF4FA` | 5.87:1 | AAA |
| `#0D5F80` | `#FFFFFF` | 7.08:1 | AAA |
| `#0D5F80` | `#F5FAFD` | 6.74:1 | AAA |
| `#0D5F80` | `#EAF4FA` | 6.35:1 | AAA |
| `#3E7A3E` | `#FFFFFF` | 5.17:1 | AA |
| `#7A5F3C` | `#FFFFFF` | 5.95:1 | AAA |
| `#E8F4FA` | `#061D43` | 14.83:1 | AAA |
| `#E8F4FA` | `#0C2A55` | 12.69:1 | AAA |
| `#E8F4FA` | `#133059` | 11.76:1 | AAA |
| `#9FB8D0` | `#061D43` | 8.10:1 | AAA |
| `#9FB8D0` | `#0C2A55` | 6.93:1 | AAA |
| `#9FB8D0` | `#133059` | 6.42:1 | AAA |
| `#87CEEB` | `#061D43` | 9.54:1 | AAA |
| `#87CEEB` | `#0C2A55` | 8.16:1 | AAA |
| `#87CEEB` | `#133059` | 7.56:1 | AAA |
| `#A8D4A8` | `#061D43` | 10.00:1 | AAA |
| `#C8A987` | `#061D43` | 7.50:1 | AAA |

Two pairs are deliberately absent, because they are the two the site never
draws: `#87CEEB` on `#FFFFFF` at 1.74:1, and `#90C090` on `#FFFFFF` at
2.07:1. Both colours appear only as fills behind navy text, where the ratio
above is what holds.

## Type

The mark's lettering is a rounded geometric sans, wide and lightly weighted,
over a heavy dark aircraft. Headings take the wide tracking; body text does
not, because tracking that reads well at display size costs a paragraph its
legibility.

Nothing is downloaded. The project runs with no build step and no third party
beyond its renderer, and a documentation site that blocks on a font server is
a site that is slower than the game it documents.

| Role | Stack |
| --- | --- |
| Display and body | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| Code, keys, and readouts | `"Courier New", ui-monospace, SFMono-Regular, Menlo, monospace` |

The monospace stack opens on the same face the simulator's own instruments are
drawn in, so a key, a command, or a readout on the site is set in the type the
reader is about to see on the screen.

A major third scale, 1.25, off a 1rem base:

| Step | Size | Used for |
| --- | --- | --- |
| `--step--1` | 0.833rem | Captions, table notes, the footer |
| `--step-0` | 1rem | Body |
| `--step-1` | 1.25rem | Lead paragraphs and `h4` |
| `--step-2` | 1.563rem | `h3` |
| `--step-3` | 1.953rem | `h2` |
| `--step-4` | 2.441rem | `h1` |
| `--step-5` | 3.052rem | The home page title |

Body lines run at 1.65 and are held to 72 characters, headings run at 1.2.
`h1` and `h2` carry 0.02em of tracking, taken from the wordmark; nothing
smaller does.

## Space and shape

The mark is two things at once, and the site is built out of both. The disc
behind the aircraft and the ground under the mountains are round, so surfaces
are generously rounded. The aircraft, the mountains, and the banner are
straight-edged, so borders are one flat pixel and rules are hard lines, with
no gradient and no shadow deeper than a hint.

A 4px base, doubling:

| Property | Value |
| --- | --- |
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-7` | 48px |
| `--space-8` | 64px |

| Property | Value | Taken from |
| --- | --- | --- |
| `--radius-sm` | 6px | The banner's corners |
| `--radius` | 12px | The dome of the sky disc |
| `--radius-lg` | 20px | The disc itself, at card size |
| `--radius-pill` | 999px | The disc, on anything small enough to be round |

Composition follows the mark from top to bottom: sky at the head of the page,
the content standing in the middle of it the way the aircraft and the
mountains do, and a sage rule closing the foot the way the banner closes the
mark. The one decorative graphic on the site is a mountain line drawn in SVG
from the same three tans, and it is drawn rather than sourced.

## Layout

The documentation is twenty pages, which is a side menu rather than a top one.

| Width | Menu |
| --- | --- |
| 960px and up | A fixed side menu, groups collapsible, the current page marked |
| Below 960px | A fixed top bar with a drawer, opened by a button and closed by `Esc`, a link, or a click outside it |

Fixed in both, so the menu is reachable from anywhere in a page rather than
only from the top of one. The content column is capped at 72 characters, and
every table scrolls sideways inside its own box rather than pushing the page
wider than the screen.

## Motion and state

Transitions are 150ms on colour and 200ms on the drawer, and every one of them
is dropped entirely under `prefers-reduced-motion: reduce`.

Focus is never removed. Every link, button, and menu entry carries a 2px
`--link` outline at a 2px offset, which is the same mark in both themes.
