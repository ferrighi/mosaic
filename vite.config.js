import { defineConfig } from "vite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const metsis = [
  process.env.METSIS_DRUPAL_PATH,
  "../metsis_drupal",
  "web/modules/custom/metsis_drupal",
].filter(Boolean).map((path) => resolve(path)).find((path) =>
  existsSync(`${path}/js/metsis/metsis-map-app/src/utils/wmsResources.js`),
);
if (!metsis) {
  throw new Error("Set METSIS_DRUPAL_PATH to the installed metsis_drupal module.");
}

export default defineConfig({
  base: "./",
  resolve: {
    alias: { "@metsis-map": `${metsis}/js/metsis/metsis-map-app/src` },
    dedupe: ["ol", "proj4"],
  },
  build: {
    manifest: true,
    rolldownOptions: { input: "js/app.js" },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    origin: "https://mosaic.ddev.site:5173",
    allowedHosts: ["mosaic.ddev.site"],
    cors: { origin: "https://mosaic.ddev.site" },
    hmr: { host: "mosaic.ddev.site", protocol: "wss", clientPort: 5173 },
  },
});
