# Attributions — harvested section variants

Every section variant ported from an external source is recorded here, per the
harvest conversion contract in `docs/harvesting.md`. Only permissively
licensed sources (MIT / Apache-2.0 / BSD / CC0) may be code-ported; each entry
records the source name, repo URL, commit SHA, and license. Patterns
re-implemented from scratch (layout idea only, no code copied) are listed for
provenance but carry no attribution obligation.

| Variant | Source type | Source / inspiration | License | Notes |
| --- | --- | --- | --- | --- |
| `hero/classic.astro` | original | — (factory's original two-column hero, formerly `layout.variant: "A"`) | n/a | |
| `hero/video.astro` | original | — (factory's original full-bleed video hero, formerly `layout.variant: "B"`) | n/a | |
| `hero/split-card.astro` | from-scratch | common "split with image card" marketing-hero pattern (Tailwind-UI-style); layout idea only, no code copied | n/a | 2026-07-12 |
| `hero/banner.astro` | from-scratch | common "centered statement + framed screenshot" marketing-hero pattern; layout idea only, no code copied | n/a | 2026-07-12 |
| `services/grid.astro` | original | — (factory's original service card grid, formerly `ServicesGrid.astro`) | n/a | 2026-07-16 |
| `gallery/grid.astro` | original | — (factory's original responsive photo grid, formerly `Gallery.astro`) | n/a | 2026-07-16 |
| `reviews/cards.astro` | original | — (factory's original rating + quote card grid, formerly `Reviews.astro`) | n/a | 2026-07-16 |
| `services/cards.astro` | from-scratch | common "numbered service card grid" pattern (Tailwind-UI-style); layout idea only, no code copied | n/a | 2026-07-16 |
| `services/alternating.astro` | from-scratch | common "alternating zig-zag feature rows" marketing pattern; layout idea only, no code copied | n/a | 2026-07-16 |
| `reviews/masonry.astro` | open-source-theme | [AstroWind](https://github.com/onwidget/astrowind), `Testimonials.astro` widget — commit `14e1a691f80548dcc36370847b1a02c0d0b12821` | [MIT](#mit-license--astrowind) | 2026-09-18 — ported the CSS-columns masonry layout + rating/quote/divider/author card structure; unavailable fields (avatar image, job title, logo) dropped since `ReviewSchema` has no equivalent, colors/typography/radius converted to this factory's semantic tokens per the conversion contract |

## License texts

### MIT License — AstroWind

Verbatim from the source repo's `LICENSE.md` at the commit recorded above.

```
MIT License

Copyright (c) 2023 onWidget

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
