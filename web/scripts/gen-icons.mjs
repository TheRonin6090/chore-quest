// iOS 12 needs PNG home-screen icons, so render them from the original SVG.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(root, 'assets/icon.svg'));
const outDir = resolve(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

const sizes = { 'apple-touch-icon-180.png': 180, 'apple-touch-icon-152.png': 152, 'favicon-32.png': 32 };
for (const [name, size] of Object.entries(sizes)) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(resolve(outDir, name), png);
}
console.log(`icons: wrote ${Object.keys(sizes).length} PNGs to public/icons`);
