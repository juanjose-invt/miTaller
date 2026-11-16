/**
 * Capturas de página completa para revisar el diseño en escritorio y móvil.
 *   node scripts/pages.mjs "/" "/consejos" …      (rutas de la app; por defecto, las principales)
 */
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/proyecto/mesa?plantilla=escritorio&paso=2', '/crear/mesa', '/consejos/soldadura', '/consejos/ensambles'];
mkdirSync('shots', { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [tag, viewport] of [['desktop', { width: 1366, height: 860 }], ['movil', { width: 390, height: 800 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag}: ${m.text()}`));
  for (const r of routes) {
    await page.goto(`http://127.0.0.1:${port}/#${r}`);
    await page.waitForTimeout(r === '/' || r.startsWith('/crear') && !r.includes('/crear/') ? 5000 : 1800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const name = `shots/pagina-${tag}-${r.replace(/[^a-z0-9]+/gi, '_') || 'inicio'}.png`;
    await page.screenshot({ path: name, fullPage: tag === 'desktop' ? r !== '/consejos/soldadura' && r !== '/consejos/ensambles' : false });
    console.log(name, overflow > 0 ? `¡DESBORDA ${overflow}px!` : 'ok');
  }
  await page.close();
}
if (errors.length) console.error('ERRORES:\n' + [...new Set(errors)].join('\n'));
await browser.close();
await server.close();
