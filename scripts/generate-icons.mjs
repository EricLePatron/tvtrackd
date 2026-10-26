// Génère les icônes PWA/favicon dans public/ depuis docs/design/logo/.
//
// Prérequis : Playwright + Chromium, volontairement NON déclarés dans
// package.json (outil de génération ponctuel, pas une dépendance de l'app).
//   - soit : bun add -d playwright && bunx playwright install chromium
//   - soit : pointer NODE_PATH vers une installation existante de Playwright
//
// Usage (depuis la racine du repo) :
//   node scripts/generate-icons.mjs
//   NODE_PATH=/chemin/vers/node_modules node scripts/generate-icons.mjs
//
// Sources : docs/design/logo/app-icon.svg et favicon.svg. Sorties : public/
// (apple-touch-icon.png, icon-192.png, icon-512.png, icon-512-maskable.png,
// favicon.ico). public/favicon.svg est une copie de la source, à resynchroniser
// à la main si elle change.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error(
    [
      "Erreur : le module « playwright » est introuvable.",
      "Ce script en a besoin pour rendre les SVG en PNG (il n'est pas déclaré dans package.json).",
      "Installez-le puis Chromium :",
      "  bun add -d playwright && bunx playwright install chromium",
      "ou pointez NODE_PATH vers une installation existante :",
      "  NODE_PATH=/chemin/vers/node_modules node scripts/generate-icons.mjs",
    ].join("\n"),
  );
  process.exit(1);
}

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
