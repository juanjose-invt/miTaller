/**
 * Prueba de humo de extremo a extremo en Chromium real.
 *   node scripts/e2e.mjs                 → contra un servidor de desarrollo propio
 *   node scripts/e2e.mjs https://…/      → contra una web ya desplegada
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

let base = process.argv[2];
let server = null;
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  base = `http://127.0.0.1:${server.httpServer.address().port}/`;
}
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => errors.push(`FALLO ${r.url()}`));
let fails = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`);
};
const go = async (hash) => {
  await page.goto(`${base}#${hash}`);
  await page.waitForTimeout(1200);
};

try {
  await go('/');
  ok('portada: título y elementos', (await page.locator('h1').innerText()).includes('pieza a pieza') && (await page.locator('.element').count()) >= 14, `${await page.locator('.element').count()} elementos`);

  await go('/plantillas');
  ok('plantillas listadas', (await page.locator('.tpl').count()) >= 40, `${await page.locator('.tpl').count()}`);

  // configurador: cambiar una opción y deshacer
  await go('/crear/mesa');
  await page.waitForSelector('.viewer canvas');
  await page.getByRole('button', { name: 'Todo a la vista' }).click();
  await page.locator('label.switch', { hasText: 'Balda inferior' }).click();
  await page.waitForTimeout(700);
  ok('configurador: la opción llega a la URL', page.url().includes('balda=true'));
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await page.waitForTimeout(300);
  ok('configurador: deshacer', !page.url().includes('balda=true'));
  ok('configurador: miniaturas en opciones', (await page.locator('.options.visual .option').count()) > 3);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.locator('.save-bar button[type=submit]').click();

  // mueble modular: el editor de distribución cambia el diseño
  await go('/crear/modular');
  await page.getByRole('button', { name: 'Todo a la vista' }).click();
  const before = page.url();
  await page.getByRole('button', { name: /Añadir.*derecha/i }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  ok('modular: el editor de distribución está y modifica el diseño', (await page.locator('svg').count()) > 0 && page.url() !== before);

  // forja: editor de patrones
  await go('/crear/puerta-verja?plantilla=forja');
  await page.getByRole('button', { name: 'Todo a la vista' }).click();
  ok('forja: editor de patrones', (await page.locator('.pattern').count()) >= 1, `${await page.locator('.pattern').count()} patrones`);

  // proyecto: progreso, plan de corte, compra y PDFs
  await go('/proyecto/puerta-verja?plantilla=forja');
  await page.waitForSelector('.viewer canvas');
  await page.getByRole('button', { name: /Hecho, siguiente/ }).click();
  await page.waitForTimeout(400);
  ok('proyecto: marca el paso y avanza', page.url().includes('paso=2') && (await page.locator('.progress span').first().innerText()).includes('1 de'));
  await page.getByRole('tab', { name: /Plan de corte/ }).click();
  await page.waitForTimeout(900);
  ok('proyecto: plan de corte dibujado', (await page.locator('.proj svg').count()) > 0);
  const [tpl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name: /Plantillas 1:1/ }).click()]);
  ok('proyecto: plantillas 1:1 en PDF', tpl.suggestedFilename().endsWith('.pdf'), tpl.suggestedFilename());
  await page.getByRole('tab', { name: /Compra/ }).click();
  const price = page.locator('.price input').first();
  await price.fill('12,5');
  await price.blur();
  await page.waitForTimeout(400);
  ok('proyecto: coste con precio propio', (await page.locator('.total-bar strong').innerText()).includes('€'), await page.locator('.total-bar strong').innerText());
  const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.getByRole('button', { name: 'Manual en PDF', exact: true }).click()]);
  ok('proyecto: manual en PDF', pdf.suggestedFilename().endsWith('.pdf'), pdf.suggestedFilename());

  // técnica con ensamble en 3D
  await go('/proyecto/mesa?plantilla=auxiliar&paso=2');
  ok('proyecto: ensamble 3D junto a la técnica', (await page.locator('.tech-joint').count()) === 1);

  // modo libre → paso a paso
  await go('/libre');
  await page.getByRole('button', { name: /Banco de listones/ }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Ver paso a paso/ }).click();
  await page.waitForTimeout(1500);
  ok('modo libre: genera el paso a paso', page.url().includes('/proyecto/libre') && (await page.locator('.steprule li').count()) >= 3, `${await page.locator('.steprule li').count()} pasos`);

  await go('/consejos/ensambles');
  ok('consejos: ensambles con visor 3D', (await page.locator('.joint, [class*=joint]').count()) >= 20);

  await go('/aprende');
  ok('aprende: itinerarios', (await page.locator('.path > li').count()) >= 16, `${await page.locator('.path > li').count()} paradas`);

  await go('/mi-taller');
  ok('mi taller: diseño guardado', (await page.locator('.saved > li').count()) >= 1);
  await go('/mi-taller/precios');
  ok('mi taller: precio recordado', (await page.locator('.price input').count()) >= 1);

  // móvil: sin desborde horizontal en las páginas principales
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 800 });
  for (const r of ['/', '/crear/modular', '/crear/puerta-verja?plantilla=forja', '/proyecto/mesa?plantilla=comedor', '/libre', '/consejos/ensambles', '/aprende', '/mi-taller']) {
    await m.goto(`${base}#${r}`);
    await m.waitForTimeout(1500);
    const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`móvil sin desborde: ${r}`, over <= 0, over > 0 ? `${over}px` : '');
  }
} catch (e) {
  fails++;
  console.error('✗ excepción:', e.message.split('\n')[0]);
} finally {
  const real = [...new Set(errors)].filter((e) => !/favicon/.test(e));
  ok('sin errores de consola ni recursos fallidos', real.length === 0, real.slice(0, 4).join(' | '));
  await browser.close();
  await server?.close();
  console.log(fails ? `\n${fails} comprobaciones fallidas` : '\nTodo correcto');
  process.exit(fails ? 1 : 0);
}
