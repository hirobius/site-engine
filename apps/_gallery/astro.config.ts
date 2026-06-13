import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Internal preview app — renders the real template components across every
// preset and both hero variants. Not a client site; not deployed publicly
// without gating (use Vercel Authentication if you put it online).
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
