import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { ClientConfig } from "@hirobius/schema";
import { OG_IMAGE_PATH, renderOgImagePng } from "./lib/og-image.js";

/**
 * Writes a branded `og-image.png` into the build output when a client
 * doesn't supply `seo.ogImage` — explicit config always wins over the
 * generated fallback. Add to an app's `astro.config.ts` `integrations`.
 */
export function ogImageIntegration(client: ClientConfig): AstroIntegration {
  return {
    name: "hirobius-og-image",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        if (client.seo.ogImage) return;
        const png = await renderOgImagePng(client);
        const outFile = fileURLToPath(new URL(`.${OG_IMAGE_PATH}`, dir));
        await writeFile(outFile, png);
        logger.info(`generated ${OG_IMAGE_PATH} (${png.length} bytes)`);
      },
    },
  };
}
