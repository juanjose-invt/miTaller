/**
 * Empaqueta `dist/` como página de artefacto: el alojamiento envuelve la página en su
 * propio <html>/<head>, así que se escribe solo el contenido (título, estilos, raíz y script).
 *   npm run build && node scripts/artifact.mjs  →  dist/artifact.html + dist/artifact-files.json
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const script = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+)"/)[1];
const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+)"/)[1];
const page = `<title>miTaller</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="./${css}">
<style>html{color-scheme:light}body{background:#f6f1e7;color:#1d1b18}</style>
<div id="root"></div>
<script type="module" src="./${script}"></script>
`;
writeFileSync('dist/artifact.html', page);
const files = Object.fromEntries(readdirSync('dist/assets').map((f) => [`assets/${f}`, `dist/assets/${f}`]));
writeFileSync('dist/artifact-files.json', JSON.stringify(files, null, 2));
console.log(`dist/artifact.html + ${Object.keys(files).length} archivos`);
