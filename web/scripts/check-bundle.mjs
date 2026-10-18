// Post-build guard for the iOS 12 iPad. Fails the build if:
//  - any JS uses syntax newer than ES2019 (e.g. `?.`, `??`, class fields), which Safari 12 can't parse;
//  - the gzipped JS + CSS exceeds the 150 KB budget;
//  - anything references an external URL (the iPad has no internet).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parse } from 'acorn';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const BUDGET = 150 * 1024;
// SVG/XML namespace identifiers are not network requests.
const ALLOWED_URL = /^https?:\/\/www\.w3\.org\//;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = resolve(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const errors = [];
let gzipped = 0;

for (const file of walk(dist)) {
  const ext = extname(file);
  if (!['.js', '.css', '.html'].includes(ext)) continue;
  const rel = relative(dist, file);
  const text = readFileSync(file, 'utf8');

  if (ext === '.js') {
    try {
      parse(text, { ecmaVersion: 2019, sourceType: 'module' });
    } catch (err) {
      const around = text.slice(Math.max(0, err.pos - 40), err.pos + 40);
      errors.push(`${rel}: not valid ES2019 (${err.message}) near: ${around}`);
    }
  }
  if (ext === '.js' || ext === '.css') gzipped += gzipSync(text).length;

  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
    if (!ALLOWED_URL.test(m[0])) errors.push(`${rel}: external URL ${m[0]}`);
  }
}

const kb = (gzipped / 1024).toFixed(1);
if (gzipped > BUDGET) errors.push(`bundle is ${kb} KB gzipped; budget is ${BUDGET / 1024} KB`);

if (errors.length) {
  console.error(`check-bundle: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-bundle: OK — ES2019 syntax, no external URLs, ${kb} KB gzipped`);
