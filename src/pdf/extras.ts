import { jsPDF } from 'jspdf';
import * as THREE from 'three';
import type { Part, Project } from '../core/types';
import { cutPlan, pct, PLAN_KEY, type BoardPlan, type LinearPlan, type PlanOptions, type SheetPlan } from '../core/cutplan';
import { MATERIALS } from '../core/materials';
import { alturaArco, longitudArco, radioArco } from '../core/builder';
import { corazonPoints, polyLength, romboPoints, volutaPoints, type Pt } from '../core/curves';
import { load } from '../core/store';

/**
 * PDFs de taller: plan de corte (barras y tableros a escala) y plantillas 1:1 de las piezas curvas de forja.
 * Unidades de jsPDF = milímetros, así que una cota de 100 mm mide 100 mm en el papel si se imprime al 100 %.
 */

type RGB = [number, number, number];
const INK: RGB = [29, 27, 24], INK2: RGB = [84, 77, 67], INK3: RGB = [130, 121, 106], LINE: RGB = [211, 200, 178];
const RULE: RGB = [242, 194, 48], RED: RGB = [199, 52, 27], PAPER: RGB = [246, 241, 231], DARK: RGB = [29, 27, 24];
const WOOD: RGB = [240, 226, 204], STEEL: RGB = [223, 229, 232], WASTE: RGB = [150, 140, 125];
const M = 16;

/** Las fuentes estándar del PDF no tienen todos los símbolos: se sustituyen los que faltan. */
const clean = (s: string) =>
  s.replace(/≥/g, 'mín. ').replace(/≤/g, 'máx. ').replace(/→/g, '->').replace(/[   ]/g, ' ').replace(/[“”]/g, '"').replace(/’/g, "'")
    .replace(/≈/g, 'aprox. ').replace(/−/g, '-').replace(/↻/g, '');
const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const n1 = (v: number) => nf.format(v);

const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- guardado (igual que downloadManual) ----------

type SaveFn = (r: { filename: string; data: Blob }) => Promise<{ status: string }>;
interface Host { claude?: { use?: (name: string) => Promise<{ save: SaveFn } | null> } }

/**
 * Guarda un PDF. Devuelve false si la persona cancela el guardado.
 * En un navegador normal es una descarga directa; cuando la web se sirve dentro de un
 * visor que bloquea las descargas (artefacto de claude.ai) se usa su capacidad `downloads`.
 */
export async function savePdf(pdf: jsPDF, filename: string): Promise<boolean> {
  const use = (window as unknown as Host).claude?.use;
  if (typeof use === 'function') {
    const downloads = await Promise.race([use('downloads'), new Promise<null>((r) => setTimeout(() => r(null), 4000))]).catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename, data: pdf.output('blob') });
        return true;
      } catch (e) {
        if ((e as { code?: string }).code === 'declined') return false;
        throw e;
      }
    }
  }
  pdf.save(filename);
  return true;
}

// ---------- base común ----------

interface PageInfo { w: number; h: number }

class Doc {
  pdf: jsPDF;
  pages: PageInfo[] = [{ w: 210, h: 297 }];
  y = M + 6;
  constructor(public title: string, orientation: 'p' | 'l' = 'p') {
    this.pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientation === 'l' ? 'landscape' : 'portrait', compress: true });
    if (orientation === 'l') this.pages = [{ w: 297, h: 210 }];
  }
  get W() { return this.pages[this.pages.length - 1].w; }
  get H() { return this.pages[this.pages.length - 1].h; }
  get CW() { return this.W - M * 2; }

  fill(c: RGB) { this.pdf.setFillColor(c[0], c[1], c[2]); }
  stroke(c: RGB) { this.pdf.setDrawColor(c[0], c[1], c[2]); }
  color(c: RGB) { this.pdf.setTextColor(c[0], c[1], c[2]); }
  font(size: number, style: 'normal' | 'bold' = 'normal') { this.pdf.setFont('helvetica', style); this.pdf.setFontSize(size); }
  lh(size: number) { return size * 0.3528 * 1.38; }
  lw(w: number) { this.pdf.setLineWidth(w); }

  addPage(orientation: 'p' | 'l' = 'p') {
    this.pdf.addPage('a4', orientation === 'l' ? 'landscape' : 'portrait');
    this.pages.push(orientation === 'l' ? { w: 297, h: 210 } : { w: 210, h: 297 });
    this.y = M + 6;
  }
  newPage() { this.addPage('p'); }
  ensure(h: number) { if (this.y + h > this.H - M - 8) this.newPage(); }

  text(str: string, o: { x?: number; w?: number; size?: number; style?: 'normal' | 'bold'; color?: RGB; gap?: number } = {}) {
    const { x = M, w = this.CW, size = 10, style = 'normal', color = INK, gap = 1.5 } = o;
    this.font(size, style);
    this.color(color);
    const lines = this.pdf.splitTextToSize(clean(str), w) as string[];
    const lh = this.lh(size);
    for (const line of lines) {
      this.ensure(lh);
      this.pdf.text(line, x, this.y + lh * 0.76);
      this.y += lh;
    }
    this.y += gap;
  }
  measure(str: string, w: number, size: number, style: 'normal' | 'bold' = 'normal') {
    this.font(size, style);
    return (this.pdf.splitTextToSize(clean(str), w) as string[]).length * this.lh(size);
  }
  heading(str: string) {
    this.ensure(16);
    this.text(str, { size: 17, style: 'bold', gap: 1 });
    this.stroke(INK); this.lw(0.5);
    this.pdf.line(M, this.y, this.W - M, this.y);
    this.y += 5;
  }
  sub(str: string) {
    this.ensure(14);
    this.y += 2;
    this.text(str, { size: 11.5, style: 'bold', gap: 1.5 });
  }

  /** Tabla con cabecera repetida; la columna `badge` dibuja la referencia en un círculo amarillo. */
  table(cols: { label: string; w: number; align?: 'left' | 'right'; bold?: boolean; badge?: boolean }[], rows: string[][]) {
    const size = 9;
    const head = () => {
      this.fill(DARK);
      this.pdf.rect(M, this.y, this.CW, 7, 'F');
      this.font(8, 'bold'); this.color([255, 255, 255]);
      let x = M;
      for (const c of cols) {
        this.pdf.text(clean(c.label), c.align === 'right' ? x + c.w - 2 : x + 2, this.y + 4.7, { align: c.align === 'right' ? 'right' : 'left' });
        x += c.w;
      }
      this.y += 7;
    };
    this.ensure(22);
    head();
    rows.forEach((row, ri) => {
      const hs = row.map((cell, i) => this.measure(cell, cols[i].w - 4, size, cols[i].bold ? 'bold' : 'normal'));
      const h = Math.max(...hs, 5) + 3;
      if (this.y + h > this.H - M - 8) { this.newPage(); head(); }
      if (ri % 2 === 1) { this.fill(PAPER); this.pdf.rect(M, this.y, this.CW, h, 'F'); }
      let x = M;
      row.forEach((cell, i) => {
        const c = cols[i];
        if (c.badge) {
          this.fill(RULE); this.stroke(INK); this.lw(0.3);
          this.pdf.circle(x + 5.5, this.y + h / 2, 3.1, 'FD');
          this.font(8.5, 'bold'); this.color(INK);
          this.pdf.text(clean(cell), x + 5.5, this.y + h / 2 + 1.1, { align: 'center' });
        } else {
          this.font(size, c.bold ? 'bold' : 'normal'); this.color(INK);
          const lines = this.pdf.splitTextToSize(clean(cell), c.w - 4) as string[];
          lines.forEach((ln, k) => this.pdf.text(ln, c.align === 'right' ? x + c.w - 2 : x + 2, this.y + 1.5 + this.lh(size) * (k + 0.76), { align: c.align === 'right' ? 'right' : 'left' }));
        }
        x += c.w;
      });
      this.y += h;
      this.stroke(LINE); this.lw(0.15);
      this.pdf.line(M, this.y, this.W - M, this.y);
    });
    this.y += 5;
  }

  /** Lista numerada con el número en rojo. */
  bullets(items: string[], x: number, w: number) {
    items.forEach((it, i) => {
      const h = this.measure(it, w - 7, 9.5);
      this.ensure(Math.min(h, 30));
      const top = this.y;
      this.font(9.5, 'bold'); this.color(RED);
      this.pdf.text(String(i + 1), x + 4.5, top + this.lh(9.5) * 0.76, { align: 'right' });
      this.text(it, { x: x + 7, w: w - 7, size: 9.5, gap: 1.3 });
    });
  }

  /** Texto girado 90° (de abajo arriba) centrado en (x, yc). Se centra a mano: `align` y `angle` juntos descentran el texto en jsPDF. */
  textUp(str: string, x: number, yc: number) {
    const t = clean(str);
    this.pdf.text(t, x, yc + this.pdf.getTextWidth(t) / 2, { angle: 90 });
  }

  /** Letra de referencia en un círculo amarillo, como la clase `.ref` de la web. */
  ref(label: string, cx: number, cy: number, r = 2.6) {
    this.fill(RULE); this.stroke(INK); this.lw(0.25);
    this.pdf.circle(cx, cy, r, 'FD');
    this.font(r * 2.75, 'bold'); this.color(INK);
    this.pdf.text(clean(label), cx, cy + r * 0.38, { align: 'center' });
  }

  /** Líneas a 45° dentro de un rectángulo (recortadas a mano, sin máscara). */
  hatch(x: number, y: number, w: number, h: number, gap: number, color: RGB = WASTE, lw = 0.12) {
    this.stroke(color); this.lw(lw);
    for (let k = -h; k < w; k += gap) {
      // recta que va de (x+k, y+h) a (x+k+h, y), recortada a [x, x+w]
      const t0 = Math.max(0, -k / h), t1 = Math.min(1, (w - k) / h);
      if (t1 <= t0) continue;
      this.pdf.line(x + k + t0 * h, y + h - t0 * h, x + k + t1 * h, y + h - t1 * h);
    }
  }

  /** Cabecera amarilla con escala de metro y pies de página. */
  frame(subtitle = '') {
    const n = this.pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.pdf.setPage(i);
      const { w, h } = this.pages[i - 1];
      this.fill(RULE); this.pdf.rect(0, 0, w, 9, 'F');
      this.stroke(INK); this.lw(0.4); this.pdf.line(0, 9, w, 9);
      this.lw(0.15);
      for (let x = 0; x <= w; x += 2) this.pdf.line(x, x % 10 === 0 ? 6.4 : 7.8, x, 9);
      this.font(9, 'bold'); this.color(INK);
      this.pdf.text('miTaller', M, 5.2);
      this.font(8); this.pdf.text(clean(this.title), w - M, 5.2, { align: 'right' });
      this.color(INK2); this.font(8);
      this.pdf.text(`Página ${i} de ${n}`, w - M, h - 8, { align: 'right' });
      this.pdf.text(clean(subtitle), M, h - 8);
    }
  }
}

// =====================================================================================
//  PLAN DE CORTE
// =====================================================================================

function drawBars(d: Doc, plan: LinearPlan) {
  const metal = MATERIALS[plan.material].kind === 'metal';
  const maxLen = Math.max(...plan.bars.map((b) => b.length));
  const sc = d.CW / maxLen;
  const BH = 11;
  for (const b of plan.bars) {
    d.ensure(BH + 13);
    const x0 = M, y = d.y + 5;
    d.font(8.5, 'bold'); d.color(INK);
    d.pdf.text(`Barra ${b.index}`, x0, d.y + 3.3);
    d.font(8, 'normal'); d.color(INK2);
    d.pdf.text(clean(`${b.special ? 'largo especial · ' : ''}${n1(b.length)} mm · sobran ${n1(b.leftover)} mm`), x0 + b.length * sc, d.y + 3.3, { align: 'right' });
    d.fill(PAPER); d.stroke(INK); d.lw(0.35);
    d.pdf.rect(x0, y, b.length * sc, BH, 'FD');
    let x = x0;
    b.cuts.forEach((c, k) => {
      const w = c.length * sc;
      d.fill(metal ? STEEL : WOOD); d.stroke(INK); d.lw(0.3);
      d.pdf.rect(x, y, w, BH, 'FD');
      const cx = x + w / 2;
      if (w >= 6.4) d.ref(c.ref, cx, y + 3.4, 2.5);
      if (w >= 13) { d.font(7, 'bold'); d.color(INK); d.pdf.text(n1(c.length), cx, y + 9.1, { align: 'center' }); }
      x += w;
      if (k < b.cuts.length - 1 || b.leftover > 0.5) {
        // el disco: una línea roja fina donde se pierde el kerf
        d.stroke(RED); d.lw(Math.max(0.2, plan.kerf * sc));
        d.pdf.line(x + (plan.kerf * sc) / 2, y - 0.8, x + (plan.kerf * sc) / 2, y + BH + 0.8);
      }
      x += plan.kerf * sc;
    });
    const wl = x0 + b.length * sc - x;
    if (b.leftover > 0.5 && wl > 0.6) {
      d.hatch(x, y, wl, BH, 1.8);
      d.stroke(INK); d.lw(0.3); d.pdf.rect(x, y, wl, BH, 'S');
      if (wl >= 14) {
        d.fill([255, 255, 255]); d.pdf.rect(x + wl / 2 - 5.5, y + BH / 2 - 2.2, 11, 4.4, 'F');
        d.font(7, 'normal'); d.color(INK2); d.pdf.text(n1(b.leftover), x + wl / 2, y + BH / 2 + 1.1, { align: 'center' });
      }
    }
    // regla: marca cada 100 mm (cada 500 mm más larga)
    d.stroke(INK3); d.lw(0.12);
    for (let t = 0; t <= b.length; t += 100) {
      const tx = x0 + t * sc;
      if (t % 500 === 0 || 100 * sc >= 1.6) d.pdf.line(tx, y + BH, tx, y + BH + (t % 500 === 0 ? 2 : 1));
    }
    d.y += BH + 10;
  }
}

function drawSheet(d: Doc, plan: BoardPlan, s: SheetPlan, total: number) {
  const metal = MATERIALS[plan.material].kind !== 'madera';
  const left = 9, top = 8;
  const sc = Math.min((d.CW - left) / s.length, 112 / s.width);
  const w = s.length * sc, h = s.width * sc;
  d.ensure(h + top + 14);
  const x0 = M + left, y0 = d.y + top;
  d.font(8.5, 'bold'); d.color(INK);
  d.pdf.text(`Tablero ${s.index} de ${total}`, M, d.y + 3);
  d.font(8, 'normal'); d.color(INK2);
  d.pdf.text(clean(`${s.placed.length} ${s.placed.length === 1 ? 'pieza' : 'piezas'} · ${pct(s.utilisation)} aprovechado`), M + d.CW, d.y + 3, { align: 'right' });
  // fondo y cotas
  d.fill(PAPER); d.pdf.rect(x0, y0, w, h, 'F');
  d.hatch(x0, y0, w, h, 2.4, WASTE, 0.1);
  d.stroke(INK2); d.lw(0.2);
  d.pdf.line(x0, y0 - 3, x0 + w, y0 - 3);
  d.pdf.line(x0, y0 - 4.5, x0, y0 - 1.5); d.pdf.line(x0 + w, y0 - 4.5, x0 + w, y0 - 1.5);
  d.pdf.line(x0 - 3, y0, x0 - 3, y0 + h);
  d.pdf.line(x0 - 4.5, y0, x0 - 1.5, y0); d.pdf.line(x0 - 4.5, y0 + h, x0 - 1.5, y0 + h);
  d.font(7.5, 'bold'); d.color(INK2);
  d.fill([255, 255, 255]);
  d.pdf.text(`${n1(s.length)} mm`, x0 + w / 2, y0 - 3.8, { align: 'center' });
  d.textUp(`${n1(s.width)} mm`, x0 - 4, y0 + h / 2);
  for (const p of s.placed) {
    const x = x0 + p.x * sc, y = y0 + p.y * sc, pw = p.w * sc, ph = p.h * sc;
    d.fill(metal ? STEEL : WOOD); d.stroke(INK); d.lw(0.3);
    d.pdf.rect(x, y, pw, ph, 'FD');
    if (plan.grain && !metal) {
      d.stroke([196, 160, 112]); d.lw(0.08);
      for (let gy = y + 1.8; gy < y + ph - 0.5; gy += 1.8) d.pdf.line(x + 0.4, gy, x + pw - 0.4, gy);
    }
    const cx = x + pw / 2, cy = y + ph / 2;
    if (Math.min(pw, ph) >= 6.4) {
      const big = ph >= 12 && pw >= 24;
      d.ref(p.ref, cx, big ? cy - 1.9 : cy, 2.5);
      if (big) { d.font(6.8, 'bold'); d.color(INK); d.pdf.text(`${n1(p.w)} x ${n1(p.h)}`, cx, cy + 4.4, { align: 'center' }); }
    }
  }
  if (plan.grain) {
    d.stroke(INK2); d.lw(0.25);
    d.pdf.line(x0, y0 + h + 4, x0 + 26, y0 + h + 4);
    d.pdf.line(x0 + 26, y0 + h + 4, x0 + 24.2, y0 + h + 3.2); d.pdf.line(x0 + 26, y0 + h + 4, x0 + 24.2, y0 + h + 4.8);
    d.font(7.5); d.color(INK2); d.pdf.text('veta', x0 + 28, y0 + h + 5.2);
  }
  d.y += top + h + (plan.grain ? 9 : 6);
}

/** PDF A4 con el plan de corte: barras y tableros a escala, con cotas, y tabla de cortes por barra. */
export function buildCutPlan(project: Project, title: string, options: PlanOptions = {}): jsPDF {
  const d = new Doc(title);
  const plan = cutPlan(project, options);
  const { pdf } = d;

  d.y = 18;
  d.text('Plan de corte', { size: 24, style: 'bold', gap: 1 });
  d.text(title, { size: 13, color: INK2, gap: 3 });
  const bits: string[] = [];
  if (plan.linear.length) bits.push(`${plan.totals.bars} ${plan.totals.bars === 1 ? 'barra' : 'barras'} (${pct(plan.totals.linearUtilisation ?? 0)} aprovechado)`);
  if (plan.boards.length) bits.push(`${plan.totals.sheets} ${plan.totals.sheets === 1 ? 'tablero' : 'tableros'} (${pct(plan.totals.boardUtilisation ?? 0)} aprovechado)`);
  if (bits.length) d.text(bits.join('  ·  '), { size: 11, style: 'bold', gap: 3 });
  d.text(
    'Largos de barra y medidas de tablero habituales: sustitúyelos por los de tu almacén y vuelve a generar el plan en la web. ' +
    'Cada corte pierde el grueso del disco (línea roja); las zonas rayadas son sobrante. Las letras son las referencias de la lista de corte.',
    { size: 9, color: INK2, gap: 3 },
  );
  if (plan.warnings.length) {
    for (const w of plan.warnings) d.text(`Atención: ${w}`, { size: 9, style: 'bold', color: RED, gap: 1 });
    d.y += 2;
  }
  if (!plan.linear.length && !plan.boards.length) d.text('Este proyecto no tiene piezas que se corten de barra o de tablero.', { gap: 4 });

  for (const l of plan.linear) {
    d.ensure(40);
    d.heading(l.stock);
    d.text(
      `Barra de ${n1(l.barLength)} mm (habitual: ${n1(l.defaultBarLength)} mm) · ${l.bars.length} ${l.bars.length === 1 ? 'barra' : 'barras'} · ${l.pieces} ${l.pieces === 1 ? "pieza" : "piezas"} · ` +
      `${pct(l.utilisation)} aprovechado · disco ${n1(l.kerf)} mm por corte`,
      { size: 9, color: INK2, gap: 3 },
    );
    drawBars(d, l);
    d.sub('Cortes de cada barra, en orden');
    d.table(
      [{ label: 'Barra', w: 16, bold: true }, { label: 'Cortes (ref. largo en mm)', w: d.CW - 16 - 26 }, { label: 'Sobrante', w: 26, align: 'right' }],
      l.bars.map((b) => [String(b.index), b.cuts.map((c) => `${c.ref} ${n1(c.length)}`).join('  ·  '), `${n1(b.leftover)} mm`]),
    );
  }
  for (const b of plan.boards) {
    d.ensure(60);
    d.heading(b.stock);
    d.text(
      `Tablero de ${n1(b.sheet.length)} × ${n1(b.sheet.width)} mm (habitual: ${n1(b.defaultSheet.length)} × ${n1(b.defaultSheet.width)} mm) · ${b.sheets.length} ${b.sheets.length === 1 ? 'tablero' : 'tableros'} · ` +
      `${b.pieces} ${b.pieces === 1 ? "pieza" : "piezas"} · ${pct(b.utilisation)} aprovechado · disco ${n1(b.kerf)} mm` +
      `${b.grain ? ` · veta a lo largo${b.canRotate ? ', se permite girar' : ', sin girar piezas'}` : ''}`,
      { size: 9, color: INK2, gap: 3 },
    );
    if (b.oversize.length) d.text(`No caben: ${b.oversize.map((o) => `${o.ref} (${n1(o.w)} x ${n1(o.h)} mm)`).join(', ')}.`, { size: 9, style: 'bold', color: RED, gap: 2 });
    for (const s of b.sheets) drawSheet(d, b, s, b.sheets.length);
    d.sub('Piezas de cada tablero');
    d.table(
      [{ label: 'Tab.', w: 12, bold: true }, { label: 'Ref.', w: 13, badge: true }, { label: 'Pieza', w: 56 }, { label: 'Medida (mm)', w: 30, align: 'right' }, { label: 'Posición x, y (mm)', w: 40, align: 'right' }, { label: 'Veta', w: d.CW - 151 }],
      b.sheets.flatMap((s) => s.placed.map((p) => [String(s.index), p.ref, p.name, `${n1(p.w)} x ${n1(p.h)}`, `${n1(p.x)}, ${n1(p.y)}`, p.rotated ? 'Girada 90°' : b.grain ? 'A lo largo' : 'Sin girar'])),
    );
  }

  d.frame('Medidas en milímetros. Comprueba tu material antes de cortar y usa siempre el equipo de protección.');
  pdf.setProperties({ title: `Plan de corte · ${title} · miTaller`, subject: 'Plan de corte optimizado', creator: 'miTaller' });
  return pdf;
}

/** Genera y guarda el plan de corte. Sin `options` usa los ajustes guardados en el navegador (largos de barra y medida de tablero). */
export async function downloadCutPlan(project: Project, title: string, options?: PlanOptions): Promise<boolean> {
  const pdf = buildCutPlan(project, title, options ?? load<PlanOptions>(PLAN_KEY, {}));
  return savePdf(pdf, `mitaller-plan-de-corte-${slug(title)}.pdf`);
}

// =====================================================================================
//  PLANTILLAS 1:1
// =====================================================================================

const AX = { x: 0, y: 1, z: 2 } as const;
const TEMPLATE_SHAPES: Part['shape'][] = ['voluta', 'corazon', 'rombo', 'arco'];

interface Tpl {
  key: string;
  label: string;
  shape: Part['shape'];
  refs: string[];
  count: number;
  mirrored: number;
  /** Caja que ocupa, mm. */
  W: number;
  H: number;
  /** Grueso de la barra en el plano (mm) o del prisma. */
  bar: number;
  /** Líneas centrales de la barra (u hacia la derecha, v hacia arriba), mm. */
  paths: Pt[][];
  /** Contorno cerrado (prismas). */
  outline?: Pt[];
  /** Desarrollo de la barra, mm. */
  length?: number;
  info: string[];
  thickness?: number;
}

const isTemplatePart = (p: Part) => TEMPLATE_SHAPES.includes(p.shape) || (p.shape === 'prisma' && !!p.poly && p.poly.length >= 3);

/** ¿Hay piezas curvas de forja (o prismas) de las que sacar plantilla? */
export function hasTemplates(project: Project): boolean {
  return project.parts.some(isTemplatePart);
}

/** Igual que el visor: el plano de la pieza son los dos ejes más grandes; si entra Y, el eje vertical es Y. */
function planeOf(part: Part) {
  const thin = part.size.indexOf(Math.min(...part.size));
  const plane = [0, 1, 2].filter((k) => k !== thin);
  const [ui, vi] = plane.includes(1) ? [plane.find((k) => k !== 1)!, 1] : [plane[0], plane[1]];
  return { thin, ui, vi };
}

const smooth = (pts: Pt[]): Pt[] =>
  new THREE.CatmullRomCurve3(pts.map(([u, v]) => new THREE.Vector3(u, v, 0)), false, 'centripetal')
    .getSpacedPoints(Math.max(300, pts.length * 8)).map((q): Pt => [q.x, q.y]);

function templateOf(part: Part): Omit<Tpl, 'refs' | 'count' | 'mirrored' | 'key'> & { key: string } {
  const bar = part.deco?.bar ?? Math.min(...part.size);
  const r = (v: number) => Math.round(v * 10) / 10;
  if (part.shape === 'prisma') {
    const poly = part.poly!;
    const W = Math.max(...poly.map((q) => q[0])), H = Math.max(...poly.map((q) => q[1]));
    const t = part.size[AX[part.polyNormal ?? 'z']];
    const metal = MATERIALS[part.material].kind === 'metal';
    return {
      key: `prisma|${r(W)}|${r(H)}|${r(t)}|${part.material}|${JSON.stringify(poly.map((q) => [r(q[0]), r(q[1])]))}`,
      label: part.name, shape: 'prisma', W, H, bar: t, thickness: t, paths: [], outline: poly,
      info: [`${metal ? 'Chapa' : 'Pieza'} de ${n1(t)} mm de grueso · ${part.stock}`, `Contorno de ${n1(polyLength([...poly, poly[0]]))} mm`],
    };
  }
  const { ui, vi } = planeOf(part);
  const w = part.size[ui], h = part.size[vi];
  const curve = part.deco?.curve ?? 'C';
  if (part.shape === 'voluta') {
    const raw = volutaPoints(w, h, curve, bar);
    const pts = smooth(raw);
    return {
      key: `voluta|${r(w)}|${r(h)}|${r(bar)}|${curve}`,
      label: curve === 'espiral' ? 'Voluta en espiral' : `Voluta en ${curve}`, shape: 'voluta', W: w, H: h, bar, paths: [pts], length: polyLength(pts),
      info: [`Barra de ${n1(bar)} mm de grueso`, `Desarrollo de la barra: aprox. ${n1(polyLength(pts))} mm, medido sobre el eje de la barra`],
    };
  }
  if (part.shape === 'corazon') {
    const pts = smooth(corazonPoints(w, h, bar));
    return {
      key: `corazon|${r(w)}|${r(h)}|${r(bar)}`, label: 'Corazón', shape: 'corazon', W: w, H: h, bar, paths: [pts], length: polyLength(pts),
      info: [`Barra de ${n1(bar)} mm de grueso`, `Desarrollo de la barra: aprox. ${n1(polyLength(pts))} mm, medido sobre el eje de la barra`],
    };
  }
  if (part.shape === 'rombo') {
    const pts = romboPoints(w, h, bar);
    return {
      key: `rombo|${r(w)}|${r(h)}|${r(bar)}`, label: 'Rombo', shape: 'rombo', W: w, H: h, bar, paths: [pts], length: polyLength(pts),
      info: [`Barra de ${n1(bar)} mm de grueso`, `Desarrollo de la barra: ${n1(polyLength(pts))} mm, con cuatro tramos rectos`],
    };
  }
  // arco: circular de luz `w` y flecha `rise` (la misma curva que dibuja el visor)
  const rise = h - bar;
  const N = 120;
  const pts: Pt[] = Array.from({ length: N + 1 }, (_, i) => {
    const x = (w * i) / N;
    return [x, (rise > 0 ? alturaArco(x, w, rise) : 0) + bar / 2];
  });
  return {
    key: `arco|${r(w)}|${r(h)}|${r(bar)}`, label: 'Arco', shape: 'arco', W: w, H: h, bar, paths: [pts], length: longitudArco(w, rise),
    info: [
      `Barra de ${n1(bar)} mm de canto`,
      `Luz ${n1(w)} mm · flecha ${n1(rise)} mm${rise > 0 ? ` · radio ${n1(radioArco(w, rise))} mm` : ''} · desarrollo aprox. ${n1(longitudArco(w, rise))} mm`,
    ],
  };
}

/** Agrupa las piezas idénticas: una plantilla por forma distinta. */
function collectTemplates(project: Project): Tpl[] {
  const map = new Map<string, Tpl>();
  for (const part of project.parts) {
    if (!isTemplatePart(part)) continue;
    const t = templateOf(part);
    const cur = map.get(t.key);
    if (cur) {
      cur.count++;
      if (!cur.refs.includes(part.ref)) cur.refs.push(part.ref);
      if (part.deco?.mirror) cur.mirrored++;
    } else map.set(t.key, { ...t, refs: [part.ref], count: 1, mirrored: part.deco?.mirror ? 1 : 0 });
  }
  return [...map.values()];
}

// ----- trazado -----

/** Margen alrededor de la caja para ejes y cotas, mm: izquierda, arriba, derecha, abajo. */
const PL = 8, PT = 8, PR = 16, PB = 16;

interface Frame { d: Doc; ox: number; oy: number; s: number; t: Tpl }
/** Punto (u, v) de la plantilla en la página. v crece hacia arriba. */
const px = (f: Frame, u: number) => f.ox + (PL + u) * f.s;
const py = (f: Frame, v: number) => f.oy + (PT + f.t.H - v) * f.s;

function path(f: Frame, pts: Pt[], close = false) {
  const { pdf } = f.d;
  pdf.moveTo(px(f, pts[0][0]), py(f, pts[0][1]));
  for (let i = 1; i < pts.length; i++) pdf.lineTo(px(f, pts[i][0]), py(f, pts[i][1]));
  if (close) pdf.close();
}

function arrowDim(f: Frame, x1: number, y1: number, x2: number, y2: number, label: string, side: 'h' | 'v') {
  const { d } = f;
  const { pdf } = d;
  d.stroke(INK2); d.lw(0.2);
  pdf.line(x1, y1, x2, y2);
  const a = 1.6, b = 0.6;
  if (side === 'h') {
    pdf.line(x1, y1, x1 + a, y1 - b); pdf.line(x1, y1, x1 + a, y1 + b);
    pdf.line(x2, y2, x2 - a, y2 - b); pdf.line(x2, y2, x2 - a, y2 + b);
    pdf.line(x1, y1 - 2.5, x1, y1 + 2.5); pdf.line(x2, y2 - 2.5, x2, y2 + 2.5);
    d.font(8.5, 'bold'); d.color(INK);
    pdf.text(label, (x1 + x2) / 2, y1 - 1.2, { align: 'center' });
  } else {
    pdf.line(x1, y1, x1 - b, y1 + a); pdf.line(x1, y1, x1 + b, y1 + a);
    pdf.line(x2, y2, x2 - b, y2 - a); pdf.line(x2, y2, x2 + b, y2 - a);
    pdf.line(x1 - 2.5, y1, x1 + 2.5, y1); pdf.line(x2 - 2.5, y2, x2 + 2.5, y2);
    d.font(8.5, 'bold'); d.color(INK);
    d.textUp(label, x1 - 1.4, (y1 + y2) / 2);
  }
}

/** Dibuja la plantilla completa (forma, ejes y cotas) con la esquina de su lienzo en (ox, oy) y escala `s`. */
function drawTemplate(f: Frame, o: { dims?: boolean } = {}) {
  const { d, t, s } = f;
  const { pdf } = d;
  const dims = o.dims ?? true;
  const x0 = px(f, 0), x1 = px(f, t.W), yTop = py(f, t.H), yBot = py(f, 0);

  // ejes de simetría de la caja
  d.stroke(INK3); d.lw(0.15 * Math.max(s, 0.6));
  pdf.setLineDashPattern([4 * s, 1 * s, 0.6 * s, 1 * s], 0);
  pdf.line((x0 + x1) / 2, yTop - 5 * s, (x0 + x1) / 2, yBot + 5 * s);
  pdf.line(x0 - 5 * s, (yTop + yBot) / 2, x1 + 5 * s, (yTop + yBot) / 2);
  // caja envolvente
  pdf.setLineDashPattern([1.6 * s, 1.2 * s], 0);
  d.stroke(INK3);
  pdf.rect(x0, yTop, x1 - x0, yBot - yTop, 'S');
  pdf.setLineDashPattern([], 0);

  pdf.setLineJoin('round');
  pdf.setLineCap('butt');
  if (t.outline) {
    d.fill([232, 238, 240]); d.stroke(INK); d.lw(0.45 * Math.max(s, 0.6));
    path(f, t.outline, true);
    pdf.fillStroke();
  } else {
    for (const pts of t.paths) {
      const closed = t.shape === 'rombo';
      // la barra real: borde oscuro de ancho `bar` y relleno claro un poco más estrecho
      d.stroke(INK); d.lw(t.bar * s);
      path(f, pts, closed);
      pdf.stroke();
      if (t.bar * s > 1.2) {
        d.stroke([250, 244, 222]); d.lw(t.bar * s - 0.55 * Math.max(s, 0.6));
        path(f, pts, closed);
        pdf.stroke();
      }
      // eje de la barra
      d.stroke(RED); d.lw(0.2 * Math.max(s, 0.6));
      pdf.setLineDashPattern([1.5 * s, 1 * s], 0);
      path(f, pts, closed);
      pdf.stroke();
      pdf.setLineDashPattern([], 0);
    }
  }
  pdf.setLineJoin('miter');

  if (dims) {
    arrowDim(f, x0, yBot + 8 * s, x1, yBot + 8 * s, `${n1(t.W)} mm`, 'h');
    arrowDim(f, x1 + 8 * s, yBot, x1 + 8 * s, yTop, `${n1(t.H)} mm`, 'v');
    d.stroke(INK3); d.lw(0.12);
    pdf.line(x0, yBot, x0, yBot + 10 * s); pdf.line(x1, yBot, x1, yBot + 10 * s);
    pdf.line(x1, yBot, x1 + 10 * s, yBot); pdf.line(x1, yTop, x1 + 10 * s, yTop);
  }
}

// ----- hojas -----

const OV = 15; // solape entre hojas, mm
const MX = 14, TOP = 32, BOT = 34; // márgenes de la zona de dibujo en cada hoja

interface Layout { orient: 'p' | 'l'; cols: number; rows: number; TW: number; TH: number }

function layoutFor(cw: number, ch: number): Layout {
  const opts: Layout[] = (['p', 'l'] as const).map((orient) => {
    const PW = orient === 'p' ? 210 : 297, PH = orient === 'p' ? 297 : 210;
    const TW = PW - MX * 2, TH = PH - TOP - BOT;
    const cols = cw <= TW + 1e-6 ? 1 : Math.ceil((cw - TW) / (TW - OV)) + 1;
    const rows = ch <= TH + 1e-6 ? 1 : Math.ceil((ch - TH) / (TH - OV)) + 1;
    return { orient, cols, rows, TW, TH };
  });
  return opts[1].cols * opts[1].rows < opts[0].cols * opts[0].rows ? opts[1] : opts[0];
}

/** Cuadro de comprobación de escala de 100 mm, con la instrucción de impresión, al pie de cada hoja. */
function scaleBox(d: Doc) {
  const { pdf } = d;
  const x = MX, y = d.H - 29, w = 100, h = 9;
  d.fill([255, 255, 255]); d.stroke(INK); d.lw(0.3);
  pdf.rect(x, y, w, h, 'FD');
  d.lw(0.2);
  for (let k = 0; k <= 100; k += 10) pdf.line(x + k, y + h, x + k, y + h - (k % 50 === 0 ? 4.2 : 2.6));
  d.lw(0.12);
  for (let k = 0; k < 100; k += 1) if (k % 10) pdf.line(x + k, y + h, x + k, y + h - 1);
  d.font(8, 'bold'); d.color(INK);
  pdf.text('100 mm', x + w / 2, y + 3.9, { align: 'center' });
  d.font(6.5); d.color(INK2);
  pdf.text('0', x, y + h + 3); pdf.text('50', x + 50, y + h + 3, { align: 'center' }); pdf.text('100', x + w, y + h + 3, { align: 'right' });
  d.font(8, 'bold'); d.color(RED);
  pdf.text('Imprime al 100 %', x + w + 6, y + 3.4);
  d.font(8); d.color(INK2);
  const lines = pdf.splitTextToSize(clean('Tamaño real: no elijas «ajustar a página». Mide este cuadro con una regla: debe medir 100 mm.'), d.W - MX - (x + w + 6)) as string[];
  lines.forEach((ln, i) => pdf.text(ln, x + w + 6, y + 7.4 + i * 3.6));
}

function cross(d: Doc, x: number, y: number) {
  d.stroke(INK); d.lw(0.2);
  d.pdf.line(x - 4, y, x + 4, y); d.pdf.line(x, y - 4, x, y + 4);
  d.stroke(RED); d.pdf.circle(x, y, 1.4, 'S');
}

function sheetTitle(d: Doc, no: number, t: Tpl, right?: string) {
  d.font(15, 'bold'); d.color(INK);
  d.pdf.text(clean(`Plantilla ${no} · ${t.label}`), MX, 17.5);
  d.font(9); d.color(INK2);
  d.pdf.text(clean(`×${t.count}${t.refs.length ? ` · ref. ${t.refs.join(', ')}` : ''} · caja ${n1(t.W)} × ${n1(t.H)} mm · ${t.info[0]}`), MX, 23.2);
  d.font(8.5); d.color(INK2);
  if (t.info[1]) d.pdf.text(clean(t.info[1]), MX, 28);
  if (right) { d.font(13, 'bold'); d.color(INK); d.pdf.text(clean(right), d.W - MX, 18, { align: 'right' }); }
}

/** ¿Pasa el dibujo por la zona (x, y, w, h) del lienzo? Las curvas densas se comprueban punto a punto; el resto siempre se imprime. */
function hasInk(t: Tpl, x: number, y: number, w: number, h: number): boolean {
  if (t.outline || t.shape === 'rombo') return true;
  const m = t.bar / 2 + 1;
  return t.paths.some((pts) => pts.some(([u, v]) => {
    const cx = PL + u, cy = PT + t.H - v;
    return cx >= x - m && cx <= x + w + m && cy >= y - m && cy <= y + h + m;
  }));
}

/** Qué hojas de la cuadrícula llevan dibujo. */
function usedGrid(t: Tpl, L: Layout): boolean[][] {
  return Array.from({ length: L.rows }, (_, j) => Array.from({ length: L.cols }, (_, i) => hasInk(t, i * (L.TW - OV), j * (L.TH - OV), L.TW, L.TH)));
}

function templatePages(d: Doc, t: Tpl, no: number) {
  const cw = t.W + PL + PR, ch = t.H + PT + PB;
  const L = layoutFor(cw, ch);
  const tiled = L.cols * L.rows > 1;
  const { pdf } = d;
  const stepX = L.TW - OV, stepY = L.TH - OV;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const used = usedGrid(t, L);
  const total = used.flat().filter(Boolean).length;
  let seq = 0;

  if (tiled) {
    // esquema de montaje: la forma reducida con la cuadrícula de hojas
    d.addPage('p');
    d.font(15, 'bold'); d.color(INK);
    pdf.text(clean(`Plantilla ${no} · ${t.label}: esquema de montaje`), MX, 17.5);
    d.font(9); d.color(INK2);
    pdf.text(clean(`×${t.count} · ${total} hojas (${L.rows} ${L.rows === 1 ? 'fila' : 'filas'} × ${L.cols} ${L.cols === 1 ? 'columna' : 'columnas'}) · se imprimen todas al 100 %`), MX, 23.2);
    const bw = 210 - MX * 2, bh = 130;
    const k = Math.min(bw / cw, bh / ch, 1);
    const ox = MX + (bw - cw * k) / 2, oy = 38;
    const f: Frame = { d, ox, oy, s: k, t };
    // hojas (zona propia de cada una, sin el solape)
    for (let j = 0; j < L.rows; j++) {
      for (let i = 0; i < L.cols; i++) {
        const rx = ox + i * stepX * k, ry = oy + j * stepY * k;
        const rw = Math.min(stepX, cw - i * stepX) * k, rh = Math.min(stepY, ch - j * stepY) * k;
        d.fill((!used[j][i] ? [236, 232, 224] : (i + j) % 2 ? [250, 246, 236] : [255, 252, 244]) as RGB); d.stroke(INK2); d.lw(0.25);
        pdf.rect(rx, ry, rw, rh, 'FD');
      }
    }
    drawTemplate(f, { dims: false });
    for (let j = 0; j < L.rows; j++) {
      for (let i = 0; i < L.cols; i++) {
        d.font(11, 'bold'); d.color(INK3);
        pdf.text(`${letters[j]}${i + 1}${used[j][i] ? '' : ' (en blanco)'}`, ox + i * stepX * k + 2, oy + j * stepY * k + 5);
      }
    }
    d.y = oy + ch * k + 12;
    d.text('Cómo montarla', { size: 11.5, style: 'bold', gap: 1.5, x: MX, w: 210 - MX * 2 });
    const steps = [
      `Imprime las ${total} hojas al 100 % (tamaño real, sin ajustar a página) y comprueba con una regla que el cuadro de cada hoja mide 100 mm.`,
      `Cada hoja se solapa ${OV} mm con la siguiente. Las cruces con círculo rojo de cada esquina marcan los puntos de unión: haz coincidir las cruces de una hoja con las de la vecina.`,
      'Empieza por la hoja A1. Recorta el margen blanco de la hoja de la derecha (por la línea de cruces) y pégala sobre la anterior con cinta de carrocero; después añade la fila de abajo.',
      'Cada hoja lleva su nombre (fila en letra, columna en número): «hoja B2 (3 de ' + total + ')» es la segunda de la fila B. Las hojas que quedarían en blanco no se imprimen.',
      'Con la plantilla montada, pégala sobre cartón o chapa fina y recórtala: te servirá para curvar o comprobar cada pieza.',
    ];
    d.bullets(steps, MX, 210 - MX * 2);
    scaleBox(d);
  }

  for (let j = 0; j < L.rows; j++) {
    for (let i = 0; i < L.cols; i++) {
      if (!used[j][i]) continue; // hoja sin dibujo: no se imprime
      seq++;
      d.addPage(L.orient);
      sheetTitle(d, no, t, tiled ? `Hoja ${letters[j]}${i + 1} (${seq} de ${total})` : undefined);
      const x0 = MX, y0 = TOP;
      const ox = x0 - i * stepX, oy = y0 - j * stepY;
      pdf.saveGraphicsState();
      pdf.rect(x0, y0, L.TW, L.TH, null);
      pdf.clip();
      pdf.discardPath();
      drawTemplate({ d, ox, oy, s: 1, t });
      pdf.restoreGraphicsState();
      d.stroke(LINE); d.lw(0.15);
      pdf.rect(x0, y0, L.TW, L.TH, 'S');
      if (tiled) {
        const ex = x0 + Math.min(stepX, cw - i * stepX), ey = y0 + Math.min(stepY, ch - j * stepY);
        // cruces en las esquinas de la zona propia de la hoja
        for (const cx of [x0, ex]) for (const cy of [y0, ey]) cross(d, cx, cy);
        d.font(7.5); d.color(INK2);
        if (i < L.cols - 1) pdf.text(clean(`Hoja ${letters[j]}${i + 2} se une aquí`), ex - 2, y0 + L.TH - 2, { align: 'right', angle: 0 });
        if (j < L.rows - 1) pdf.text(clean(`Hoja ${letters[j + 1]}${i + 1} se une aquí`), x0 + 2, ey - 2);
      }
      scaleBox(d);
    }
  }
}

/** Instrucciones e índice: primera página del PDF de plantillas. */
function indexPage(d: Doc, tpls: Tpl[], title: string) {
  d.y = 18;
  d.text('Plantillas a tamaño real', { size: 24, style: 'bold', gap: 1 });
  d.text(title, { size: 13, color: INK2, gap: 4 });
  d.text('Cómo usarlas', { size: 11.5, style: 'bold', gap: 1.5 });
  d.bullets([
    'Imprime este PDF al 100 % («tamaño real» o «escala 100 %»), sin elegir «ajustar a página». Cada hoja lleva un cuadro de 100 mm para comprobarlo con una regla.',
    'Cada forma distinta tiene su plantilla; la cantidad («×16») dice cuántas piezas iguales lleva el proyecto. Las formas que no caben en un A4 se reparten en varias hojas con solape y cruces de registro, y llevan un esquema de montaje.',
    'La barra se dibuja con su grueso real (borde oscuro) y su eje (línea roja de trazos): marca el eje o el borde sobre la barra y curva hasta que la barra cubra el dibujo.',
    'Las plantillas están dibujadas vistas por una cara. Si una pieza va en espejo, dale la vuelta a la plantilla: la barra es igual por las dos caras.',
    'Son piezas curvadas a mano: esperan tolerancias de taller. Tras curvar, compara siempre con la plantilla y corrige antes de soldar.',
  ], MX, d.CW);
  d.y += 2;
  d.sub('Plantillas de este proyecto');
  d.table(
    [{ label: 'Nº', w: 12, bold: true }, { label: 'Forma', w: 60, bold: true }, { label: 'Cant.', w: 16, align: 'right' }, { label: 'Ref.', w: 20 }, { label: 'Caja (mm)', w: 34 }, { label: 'Hojas', w: d.CW - 142 }],
    tpls.map((t, i) => {
      const L = layoutFor(t.W + PL + PR, t.H + PT + PB);
      const n = usedGrid(t, L).flat().filter(Boolean).length;
      return [String(i + 1), t.label, `×${t.count}`, t.refs.join(', '), `${n1(t.W)} x ${n1(t.H)}`, n === 1 ? '1' : `${n} (+ esquema)`];
    }),
  );
  const mir = tpls.filter((t) => t.mirrored > 0);
  if (mir.length) d.text(`En espejo: ${mir.map((t) => `${t.label} (${t.mirrored} de ${t.count})`).join('; ')}. Dales la vuelta a la plantilla.`, { size: 9, color: INK2 });
  scaleBox(d);
}

/** PDF con las plantillas 1:1 (A4). Devuelve null si el proyecto no tiene piezas curvas de forja. */
export function buildTemplates(project: Project, title: string): jsPDF | null {
  const tpls = collectTemplates(project);
  if (!tpls.length) return null;
  const d = new Doc(`Plantillas · ${title}`);
  indexPage(d, tpls, title);
  tpls.forEach((t, i) => templatePages(d, t, i + 1));
  d.frame('Plantillas a tamaño real: imprime al 100 % y comprueba el cuadro de 100 mm.');
  d.pdf.setProperties({ title: `Plantillas · ${title} · miTaller`, subject: 'Plantillas 1:1 de piezas curvas de forja', creator: 'miTaller' });
  return d.pdf;
}

/** Genera y guarda las plantillas. Devuelve false si no hay nada que generar o si la persona cancela el guardado. */
export async function downloadTemplates(project: Project, title: string): Promise<boolean> {
  const pdf = buildTemplates(project, title);
  if (!pdf) return false;
  return savePdf(pdf, `mitaller-plantillas-${slug(title)}.pdf`);
}
