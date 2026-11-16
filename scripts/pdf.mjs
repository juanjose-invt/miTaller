/**
 * Genera el manual PDF de un proyecto en el navegador real y lo guarda en ./shots/.
 *   node scripts/pdf.mjs mesa "plantilla=escritorio"
 */
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const [id = 'mesa', query = ''] = process.argv.slice(2);
mkdirSync('shots', { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
try {
  await page.goto(`http://127.0.0.1:${port}/#/proyecto/${id}?${query}`);
  await page.waitForSelector('.viewer canvas');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name: 'Manual en PDF' }).click()]);
  const out = `shots/${id}.pdf`;
  await download.saveAs(out);
  console.log(out, download.suggestedFilename());
} finally {
  if (errors.length) console.error('ERRORES:\n' + errors.join('\n'));
  await browser.close();
  await server.close();
}
