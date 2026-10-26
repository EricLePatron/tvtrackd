// Génère les icônes PWA/favicon dans public/ depuis docs/design/logo/.
// Usage : node scripts/generate-icons.mjs  (Playwright/Chromium déjà installés,
// non déclarés dans package.json ; NODE_PATH peut être nécessaire).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logo = (f) => readFileSync(join(root, "docs/design/logo", f), "utf8");
const out = (f) => join(root, "public", f);

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(svg, size, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg.replace(/ width="\d+" height="\d+"/, "")}`,
  );
  return page.screenshot({ type: "png", omitBackground: transparent });
}

const appIcon = logo("app-icon.svg");
writeFileSync(out("apple-touch-icon.png"), await render(appIcon, 180, false));
writeFileSync(out("icon-192.png"), await render(appIcon, 192, false));
writeFileSync(out("icon-512.png"), await render(appIcon, 512, false));
// Même visuel : le symbole est déjà dans la safe zone maskable de 80 %.
writeFileSync(out("icon-512-maskable.png"), await render(appIcon, 512, false));

// favicon.ico : 16/32/48, PNG embarqués (ICONDIR).
const favicon = logo("favicon.svg");
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await render(favicon, s, true));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e[0] = s;
  e[1] = s;
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});
writeFileSync(out("favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));

await browser.close();
console.log("icons written to public/");
