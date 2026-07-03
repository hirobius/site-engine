import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { client } from "./client.config";

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
