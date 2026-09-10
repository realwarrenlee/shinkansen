import assert from "node:assert/strict";
import { readFile, stat, readdir } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("dist");
async function checkFile(relative) {
  const file = path.resolve(output, relative.replace(/^\//, ""));
  assert.ok(
    file.startsWith(`${output}${path.sep}`),
    `Asset escapes dist: ${relative}`,
  );
  assert.ok((await stat(file)).isFile(), `Missing file: ${relative}`);
}
const html = await readFile(path.join(output, "index.html"), "utf8");
for (const [, url] of html.matchAll(/(?:src|href)="(\/[^\"]+)"/g))
  await checkFile(url);
const manifest = JSON.parse(
  await readFile(path.join(output, "assets/train-manifest.json"), "utf8"),
);
for (const key of ["lead", "tail", "middle", "pantograph"])
  await checkFile(`assets/${manifest[key]}`);
await checkFile("data/fuji-railways.geojson");
for (const directory of ["Workers", "Assets", "Widgets", "ThirdParty"]) {
  assert.ok(
    (await readdir(path.join(output, "cesium", directory))).length,
    `Empty Cesium directory: ${directory}`,
  );
}
console.log("Production asset paths verified.");
