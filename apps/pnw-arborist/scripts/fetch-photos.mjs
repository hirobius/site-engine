#!/usr/bin/env node
/**
 * fetch-photos — populate this app's image slots from the Pexels API.
 *
 * STANDALONE ONLY — not wired into astro.config.ts (that file is a byte-for-byte
 * copy of apps/_template's, enforced by packages/template's astro-config-gate
 * test, so no per-app build hooks). Run manually before a build:
 *   PEXELS_API_KEY=xxx node scripts/fetch-photos.mjs
 *
 * The dev sandbox can't reach api.pexels.com — Vercel's build network can.
 * Downloads a curated photo per slot into ./public/photos/<name>.jpg, which the
 * bespoke homepage picks up automatically (present → real photo, missing →
 * gradient placeholder).
 *
 * Per-client queries live in `photo-queries.json` (plain JSON, not this file —
 * se#208), so this script stays byte-identical across every bespoke app.
 * `packages/schema/src/site-spec.ts`'s `photoQueries` field is the SAME data,
 * imported by this app's `site.spec.ts` — keep the two in sync.
 *
 * NON-FATAL BY DESIGN: no key, or any network/API error, logs a warning and
 * returns without throwing, so the build still succeeds (with placeholders).
 * Free key: https://www.pexels.com/api/new/. Pexels photos are stock — swap for
 * the client's OWN photos before go-live.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "photos");

/** photoQueries key → output filename. Fixed across every bespoke app. */
const FILENAMES = { hero: "hero.jpg", band: "canopy.jpg", v2Hero: "v2-hero.jpg" };

async function loadQueries() {
  const raw = await readFile(join(ROOT, "photo-queries.json"), "utf8");
  return JSON.parse(raw);
}

async function pick(key, { query, orientation }) {
  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&orientation=${orientation}&per_page=5`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) {
    throw new Error(
      `Pexels API ${res.status} for "${query}"` +
        (res.status === 401 ? " — key invalid/expired (regenerate at pexels.com/api)." : "."),
    );
  }
  const data = await res.json();
  const photo = data.photos?.[0];
  if (!photo) throw new Error(`no results for "${query}".`);
  return photo.src.large2x ?? photo.src.large ?? photo.src.original;
}

/** Fetch every slot. Never throws — warns and returns on any problem. */
export async function fetchPhotos() {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    console.warn("• fetch-photos: PEXELS_API_KEY not set — skipping (placeholders stay).");
    return;
  }
  try {
    const queries = await loadQueries();
    await mkdir(OUT, { recursive: true });
    for (const [slot, filename] of Object.entries(FILENAMES)) {
      const spec = queries[slot];
      if (!spec) continue;
      const src = await pick(key, spec);
      const img = await fetch(src);
      if (!img.ok) throw new Error(`download failed (${img.status}) for ${filename}`);
      const buf = Buffer.from(await img.arrayBuffer());
      await writeFile(join(OUT, filename), buf);
      console.log(`✓ fetch-photos: ${filename} ← "${spec.query}" (${Math.round(buf.length / 1024)} KB)`);
    }
  } catch (err) {
    console.warn(`• fetch-photos: skipped (${err.message}) — placeholders stay.`);
  }
}

// Allow direct CLI use too.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await fetchPhotos();
}
