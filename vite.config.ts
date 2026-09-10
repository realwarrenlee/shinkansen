import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "node:path";
const root = process.cwd();
const cesiumRoot = path.resolve(root, "node_modules/cesium/Build/Cesium");
const flatFile = (_name: string, _extension: string, source: string) =>
  path.join(path.relative(path.dirname(source), root), path.basename(source));
export default defineConfig({
  define: { CESIUM_BASE_URL: JSON.stringify("/cesium") },
  plugins: [
    viteStaticCopy({
      targets: [
        ...["Workers", "ThirdParty", "Assets", "Widgets"].map((name) => ({
          src: `node_modules/cesium/Build/Cesium/${name}`,
          dest: "cesium",
          // v4 preserves source directories. Use native path operations because its
          // stripBase implementation splits only on '/', which fails on Windows.
          rename: (_name: string, _extension: string, source: string) =>
            path.join(
              path.relative(path.dirname(source), root),
              path.relative(cesiumRoot, source),
            ),
        })),
        {
          src: [
            "public/assets/supplied-*.glb",
            "public/assets/train-manifest.json",
            "public/assets/train-preview.png",
          ],
          dest: "assets",
          rename: flatFile,
        },
        {
          src: "public/data/fuji-railways.geojson",
          dest: "data",
          rename: flatFile,
        },
      ],
    }),
  ],
  // Keep original and alternative models locally; publish only active ride assets.
  build: { chunkSizeWarningLimit: 1500, copyPublicDir: false },
});
