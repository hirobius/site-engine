#!/usr/bin/env node
/**
 * fetch-photos — populate this app's image slots from the Pexels API.
 *
 *   PEXELS_API_KEY=xxx node scripts/fetch-photos.mjs
 *
 * Downloads a curated photo per slot into ./public/photos/<name>.jpg, which the
 * bespoke homepage (src/pages/index.astro) picks up automatically — a present
 * file replaces the gradient placeholder, a missing one keeps it.
 *
 * NOTE: get a free key at https://www.pexels.com/api/new/ and export it (or set
 * PEXELS_API_KEY in the Vercel project env). Pexels photos are free to use with
 * no attribution required; still swap in the client's OWN photos before go-live.
 *
 * Written for this one-off preview; untested until a real key is available.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) {
  console.error(
    "✖ PEXELS_API_KEY is not set. Get a free key at https://www.pexels.com/api/new/\n" +
      "  then: PEXELS_API_KEY=<key> node scripts/fetch-photos.mjs",
  );
  process.exit(1);
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
      `Pexels API ${res.status} for "${query}". ` +
        (res.status === 401 ? "Key is invalid/expired — regenerate at pexels.com/api." : ""),
    );
  }
  const data = await res.json();
  const photo = data.photos?.[0];
  if (!photo) throw new Error(`No Pexels results for "${query}".`);
  return photo.src.large2x ?? photo.src.large ?? photo.src.original;
}

await mkdir(OUT, { recursive: true });
for (const [name, spec] of Object.entries(SLOTS)) {
  const src = await pick(spec);
  const img = await fetch(src);
  if (!img.ok) throw new Error(`Download failed (${img.status}) for ${name}`);
  const buf = Buffer.from(await img.arrayBuffer());
  await writeFile(join(OUT, name), buf);
  console.log(`✓ ${name}  ←  "${spec.query}"  (${Math.round(buf.length / 1024)} KB)`);
}
console.log("\nDone. Rebuild to see them: pnpm --filter @hirobius/pnw-arborist build");
