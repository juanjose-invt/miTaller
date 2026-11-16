/**
 * Captura un proyecto en el navegador real (Chromium) para revisar el 3D.
 *
 *   npm run shot -- mesa                       → todas las plantillas, último paso
 *   npm run shot -- mesa "balda=true&ancho=900" → parámetros concretos
 *   npm run shot -- mesa "plantilla=comedor" all → una imagen por paso
 *
 * Las imágenes se guardan en ./shots/. Arranca su propio servidor de Vite en un puerto libre.
 */
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

// Playwright viene preinstalado en el entorno (global): se resuelve con require.
const { chromium } = createRequire(import.meta.url)('playwright');

const [id, query = '', mode = 'last'] = process.argv.slice(2);
if (!id) {
  console.error('uso: npm run shot -- <id-generador> ["query"] [all]');
  process.exit(1);
}
mkdirSync('shots', { recursive: true });
const server = await createServer({ server: { port: 0, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
try {
  await page.goto(`http://127.0.0.1:${port}/#/proyecto/${id}?${query}`);
  await page.waitForSelector('.viewer canvas', { timeout: 20000 });
  await page.waitForTimeout(900);
  const total = await page.locator('.steprule li').count();
  const steps = mode === 'all' ? [...Array(total).keys()] : [total - 1];
  for (const i of steps) {
    await page.locator('.steprule li button').nth(i).click();
    await page.waitForTimeout(1300);
    const name = `shots/${id}-${(query || 'defecto').replace(/[^a-z0-9]+/gi, '_')}-paso${String(i + 1).padStart(2, '0')}.png`;
    await page.locator('.viewer').first().screenshot({ path: name });
    console.log(name);
  }
} finally {
  if (errors.length) console.error('ERRORES DEL NAVEGADOR:\n' + errors.join('\n'));
  await browser.close();
  await server.close();
}
