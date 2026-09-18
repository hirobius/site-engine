# Spec previews — speculative brand concepts

Two self-contained HTML design references. Each is one standalone file — open it
in a browser. These are **design references**, not factory client apps: no
`apps/<slug>`, no `client.config.ts`, nothing here is deployed or built.

| File | Direction |
|---|---|
| `meridian.html` | Modern-grotesk, paper + clay, near-black inversion; home-forward (Buy / Sell / Build / Contact) |
| `ironridge.html` | Rugged, no-photo, type-forward, ember accent (Buy / Sell / Invest / Contact) |

Both brands are invented. Each page says so in its own metadata and footer
("speculative concept, not a real brokerage"), and every contact detail in them
is a placeholder: all-zeros phone numbers, `@<brand>` addresses on the invented
brand's own domain, `you@email.com` in form fields, and sample listing addresses.
Photography is rendered as CSS treatments with labelled photo slots rather than
real images.

## Why they were recovered

They were committed to a branch that was then deleted from the remote under
ops#27, because *other* files on that branch carried an individual's real
contact block. These two did not. Both were re-scanned file-by-file against the
full sweep needle list — every contact-class needle, every lead and client
needle — and returned **zero** hits, so the deletion cost ~1,000 lines of
PII-free work for a reason that never applied to them.

Restoring them here gives that work a durable home on the remote, which matters
because the deleted branch's objects are scheduled to be purged and the only
other copy is a local patch file in a temp directory.

The third mockup from that branch is **not** restored: it is one person's
personal brand, name and contact block throughout, so bringing it back is a
decision about that person's data rather than a recovery of design work.

## Companion specs

The design system these implement is documented in `../realtor-template.md`,
`../aura-hirobius-core.md` and `../hirobius-core-brief.md` on the
`claude/realtor-starter` branch (site-engine #23/#24).
