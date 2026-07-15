#!/usr/bin/env node
/**
 * fetch-photos — populate this app's image slots from the Pexels API.
 *
 * Runs as a BUILD STEP (see package.json `build`) because the dev sandbox can't
 * reach api.pexels.com — Vercel's build network can. Downloads a curated photo
 * per slot into ./public/photos/<name>.jpg, which the bespoke homepage picks up
 * automatically (present file → real photo, missing file → gradient placeholder).
 *
 * NON-FATAL BY DESIGN: no key, or any network/API error, logs a warning and
 * exits 0 so the build still succeeds (with placeholders). Get a free key at
 * https://www.pexels.com/api/new/ and set PEXELS_API_KEY on the Vercel project.
 * Pexels photos are stock — swap for the client's OWN photos before go-live.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) {
  console.warn("• fetch-photos: PEXELS_API_KEY not set — skipping (placeholders stay). ");
  process.exit(0);
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "photos");

/** slot filename → { query, orientation } */
const SLOTS = {
  "hero.jpg": { query: "arborist tree climber", orientation: "portrait" },
  "canopy.jpg": { query: "forest canopy from below", orientation: "landscape" },
};

async function pick({ query, orientation }) {
  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&orientation=${orientation}&per_page=5`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
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

try {
  await mkdir(OUT, { recursive: true });
  for (const [name, spec] of Object.entries(SLOTS)) {
    const src = await pick(spec);
    const img = await fetch(src);
    if (!img.ok) throw new Error(`download failed (${img.status}) for ${name}`);
    const buf = Buffer.from(await img.arrayBuffer());
    await writeFile(join(OUT, name), buf);
    console.log(`✓ fetch-photos: ${name} ← "${spec.query}" (${Math.round(buf.length / 1024)} KB)`);
  }
} catch (err) {
  // Never fail the build over imagery — fall back to placeholders.
  console.warn(`• fetch-photos: skipped (${err.message}) — placeholders stay.`);
  process.exit(0);
}
