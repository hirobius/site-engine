import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { armAcceptanceGate, ogImageIntegration } from "@hirobius/template";
import { client } from "./client.config";
import { fetchPhotos } from "./scripts/fetch-photos.mjs";

// Arms checkClientAcceptance's realData checks on SITE_LIVE=true /
// VERCEL_ENV=production — throws to fail the build, never fails a preview.
armAcceptanceGate(client);

// Populate image slots from Pexels at the start of every `astro build` (so it
// runs however the build is invoked — Vercel calls `astro build` directly, not
// our package.json script). Non-fatal: no key / any error keeps placeholders.
const pexelsPhotos = {
  name: "pexels-fetch-photos",
  hooks: { "astro:build:start": async () => { await fetchPhotos(); } },
};

// Static output (default). The preview gate is a Vercel Routing Middleware at
// ./middleware.ts — NOT Astro middleware, which does not run on static output.
export default defineConfig({
  site: client.seo.siteUrl,
  integrations: [pexelsPhotos, sitemap(), ogImageIntegration(client)],
  vite: {
    plugins: [tailwindcss()],
  },
  // astro:assets uses the default sharp service to produce responsive,
  // modern-format images at build time from src/assets/photos. The <Image>
  // `widths`/`sizes` props (see ResponsiveImage.astro) generate the srcset.
});
