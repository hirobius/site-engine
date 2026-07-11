import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { armAcceptanceGate } from "@hirobius/template";
import { client } from "./client.config";

// Arms checkClientAcceptance's realData checks on SITE_LIVE=true /
// VERCEL_ENV=production — throws to fail the build, never fails a preview.
armAcceptanceGate(client);

// Static output (default). The preview gate is a Vercel Routing Middleware at
// ./middleware.ts — NOT Astro middleware, which does not run on static output.
export default defineConfig({
  site: client.seo.siteUrl,
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  // astro:assets uses the default sharp service to produce responsive,
  // modern-format images at build time from src/assets/photos. The <Image>
  // `widths`/`sizes` props (see ResponsiveImage.astro) generate the srcset.
});
