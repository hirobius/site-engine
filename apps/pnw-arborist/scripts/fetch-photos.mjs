#!/usr/bin/env node
/**
 * fetch-photos — populate this app's image slots from the Pexels API.
 *
 * Invoked from astro.config.ts on the `astro:build:start` hook (so it runs
 * inside `astro build` however the build is triggered — Vercel uses its own
 * `astro build` command, not our package.json script). Also runnable directly:
 *   PEXELS_API_KEY=xxx node scripts/fetch-photos.mjs
 *
 * The dev sandbox can't reach api.pexels.com — Vercel's build network can.
 * Downloads a curated photo per slot into ./public/photos/<name>.jpg, which the
 * bespoke homepage picks up automatically (present → real photo, missing →
 * gradient placeholder).
 *
 * NON-FATAL BY DESIGN: no key, or any network/API error, logs a warning and
 * returns without throwing, so the build still succeeds (with placeholders).
 * Free key: https://www.pexels.com/api/new/. Pexels photos are stock — swap for
 * the client's OWN photos before go-live.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "photos");

/** slot filename → { query, orientation } */
const SLOTS = {
  "hero.jpg": { query: "large lush green oak tree", orientation: "portrait" },
  "canopy.jpg": { query: "sunlight through green forest canopy", orientation: "landscape" },
  "v2-hero.jpg": { query: "misty evergreen forest pacific northwest", orientation: "landscape" },
};

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
    await mkdir(OUT, { recursive: true });
    for (const [name, spec] of Object.entries(SLOTS)) {
      const src = await pick(key, spec);
      const img = await fetch(src);
      if (!img.ok) throw new Error(`download failed (${img.status}) for ${name}`);
      const buf = Buffer.from(await img.arrayBuffer());
      await writeFile(join(OUT, name), buf);
      console.log(`✓ fetch-photos: ${name} ← "${spec.query}" (${Math.round(buf.length / 1024)} KB)`);
    }
  } catch (err) {
    console.warn(`• fetch-photos: skipped (${err.message}) — placeholders stay.`);
  }
}

// Allow direct CLI use too.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await fetchPhotos();
}
