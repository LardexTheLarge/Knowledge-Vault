import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so the
// deploy workflow builds with BASE_PATH=/Knowledge-Vault. Local dev and a plain
// `npm run build` keep an empty base and work at the domain root.
const basePath = (process.env.BASE_PATH ?? "").replace(/^\/+|\/+$/g, "");
const base: "" | `/${string}` = basePath ? `/${basePath}` : "";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      alias: { $lib: "src/lib" },
      preprocess: vitePreprocess(),
      paths: { base },
      adapter: adapter({
        pages: "build",
        assets: "build",
        fallback: "index.html",
        precompress: false,
        strict: false,
      }),
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
});
