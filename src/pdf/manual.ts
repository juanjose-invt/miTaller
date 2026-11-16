import { jsPDF } from 'jspdf';
import type { Project, Step } from '../core/types';
import { cutList, fmtCut, hardwareList, stockList, toolList, type CutLine } from '../core/derive';
import { snapshot } from '../three/snapshot';

/**
 * Manual de construcción en PDF (A4 vertical), generado en el navegador.
 * Portada · antes de empezar · lista de la compra · despiece y lista de corte · un bloque por paso · fuentes.
 */

const W = 210, H = 297, M = 16, CW = W - M * 2;
const INK: RGB = [29, 27, 24], INK2: RGB = [84, 77, 67], LINE: RGB = [211, 200, 178];
const RULE: RGB = [242, 194, 48], RED: RGB = [199, 52, 27], PAPER: RGB = [246, 241, 231], DARK: RGB = [29, 27, 24];
type RGB = [number, number, number];

const KIND = { preparar: 'Preparación', cortar: 'Corte', montar: 'Montaje', soldar: 'Soldadura', acabar: 'Acabado' } as const;
const LEVEL = ['', 'Para empezar', 'Con algo de práctica', 'Exigente'];

/** Las fuentes estándar del PDF no tienen todos los símbolos: se sustituyen los que faltan. */
const clean = (s: string) =>
  s.replace(/≥/g, 'mín. ').replace(/≤/g, 'máx. ').replace(/→/g, '->').replace(/[   ]/g, ' ').replace(/[“”]/g, '"').replace(/’/g, "'").replace(/≈/g, 'aprox. ').replace(/−/g, '-');

class Doc {
  pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  y = M;
  constructor(private title: string) {}

  fill(c: RGB) { this.pdf.setFillColor(c[0], c[1], c[2]); }
  stroke(c: RGB) { this.pdf.setDrawColor(c[0], c[1], c[2]); }
  color(c: RGB) { this.pdf.setTextColor(c[0], c[1], c[2]); }
  font(size: number, style: 'normal' | 'bold' = 'normal') { this.pdf.setFont('helvetica', style); this.pdf.setFontSize(size); }
  lh(size: number) { return size * 0.3528 * 1.38; }

  newPage() { this.pdf.addPage(); this.y = M + 6; }
  /** Salta de página si no caben `h` mm. */
  ensure(h: number) { if (this.y + h > H - M - 8) this.newPage(); }

  /** Párrafo con salto de página línea a línea. Devuelve la altura usada. */
  text(str: string, o: { x?: number; w?: number; size?: number; style?: 'normal' | 'bold'; color?: RGB; gap?: number } = {}) {
    const { x = M, w = CW, size = 10, style = 'normal', color = INK, gap = 1.5 } = o;
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
    this.stroke(INK);
    this.pdf.setLineWidth(0.5);
    this.pdf.line(M, this.y, W - M, this.y);
    this.y += 5;
  }

  sub(str: string) {
    this.ensure(12);
    this.y += 2;
    this.text(str, { size: 11.5, style: 'bold', gap: 1.5 });
  }

  bullets(items: string[], o: { x?: number; w?: number; size?: number; numbered?: boolean; box?: boolean } = {}) {
    const { x = M, w = CW, size = 10, numbered = false, box = false } = o;
    const pad = numbered ? 7 : box ? 6.5 : 4.5;
    items.forEach((it, i) => {
      const h = this.measure(it, w - pad, size);
      this.ensure(Math.min(h, 30));
      const top = this.y;
      if (numbered) {
        this.font(size, 'bold');
        this.color(RED);
        this.pdf.text(String(i + 1), x + 4.5, top + this.lh(size) * 0.76, { align: 'right' });
      } else if (box) {
        this.stroke(INK);
        this.pdf.setLineWidth(0.3);
        this.pdf.rect(x, top + 0.7, 3.4, 3.4);
      } else {
        this.fill(INK2);
        this.pdf.circle(x + 1.2, top + this.lh(size) * 0.5, 0.65, 'F');
      }
      this.text(it, { x: x + pad, w: w - pad, size, gap: 1.2 });
    });
  }

  /** Caja con título y contenido; se mide antes para no partirla si cabe en una página. */
  callout(title: string, body: string[], o: { bg: RGB; fg?: RGB; accent?: RGB; list?: boolean; lead?: string }) {
    const fg = o.fg ?? INK;
    const inner = CW - 10;
    let h = 9;
    if (o.lead) h += this.measure(o.lead, inner, 9.5) + 1.5;
    for (const b of body) h += this.measure(b, inner - (o.list ? 4.5 : 0), 9.5) + 1.2;
    h += 3;
    this.ensure(Math.min(h, 90));
    const top = this.y;
    this.fill(o.bg);
    this.pdf.roundedRect(M, top, CW, h, 2, 2, 'F');
    if (o.accent) { this.fill(o.accent); this.pdf.rect(M, top, CW, 1.1, 'F'); }
    this.y = top + 3.5;
    this.text(title, { x: M + 5, w: inner, size: 10, style: 'bold', color: fg, gap: 1 });
    if (o.lead) this.text(o.lead, { x: M + 5, w: inner, size: 9.5, color: fg, gap: 1.5 });
    for (const b of body) {
      if (o.list) {
        this.fill(o.accent ?? fg);
        this.pdf.circle(M + 6.2, this.y + this.lh(9.5) * 0.5, 0.6, 'F');
        this.text(b, { x: M + 9.5, w: inner - 4.5, size: 9.5, color: fg, gap: 1.2 });
      } else this.text(b, { x: M + 5, w: inner, size: 9.5, color: fg, gap: 1.2 });
    }
    this.y = Math.max(this.y, top + h) + 4;
  }

  /** Tabla sencilla con cabecera repetida en cada página. */
  table(cols: { label: string; w: number; align?: 'left' | 'right'; bold?: boolean; badge?: boolean }[], rows: string[][]) {
    const size = 9.2;
    const head = () => {
      this.fill(DARK);
      this.pdf.rect(M, this.y, CW, 7, 'F');
      this.font(8, 'bold');
      this.color([255, 255, 255]);
      let x = M;
      for (const c of cols) {
        this.pdf.text(clean(c.label), c.align === 'right' ? x + c.w - 2 : x + 2, this.y + 4.7, { align: c.align === 'right' ? 'right' : 'left' });
        x += c.w;
      }
      this.y += 7;
    };
    this.ensure(20);
    head();
    rows.forEach((row, ri) => {
      const hs = row.map((cell, i) => this.measure(cell, cols[i].w - 4, size, cols[i].bold ? 'bold' : 'normal'));
      const h = Math.max(...hs, 5) + 3;
      if (this.y + h > H - M - 8) { this.newPage(); head(); }
      if (ri % 2 === 1) { this.fill(PAPER); this.pdf.rect(M, this.y, CW, h, 'F'); }
      let x = M;
      row.forEach((cell, i) => {
        const c = cols[i];
        if (c.badge) {
          this.fill(RULE); this.stroke(INK); this.pdf.setLineWidth(0.3);
          this.pdf.circle(x + 5.5, this.y + h / 2, 3.1, 'FD');
          this.font(8.5, 'bold'); this.color(INK);
          this.pdf.text(clean(cell), x + 5.5, this.y + h / 2 + 1.1, { align: 'center' });
        } else {
          this.font(size, c.bold ? 'bold' : 'normal');
          this.color(INK);
          const lines = this.pdf.splitTextToSize(clean(cell), c.w - 4) as string[];
          lines.forEach((ln, k) => this.pdf.text(ln, c.align === 'right' ? x + c.w - 2 : x + 2, this.y + 1.5 + this.lh(size) * (k + 0.76), { align: c.align === 'right' ? 'right' : 'left' }));
        }
        x += c.w;
      });
      this.y += h;
      this.stroke(LINE); this.pdf.setLineWidth(0.15);
      this.pdf.line(M, this.y, W - M, this.y);
    });
    this.y += 5;
  }

  image(data: string, w: number, h: number, x = M) {
    this.ensure(h + 2);
    this.pdf.addImage(data, 'JPEG', x, this.y, w, h, undefined, 'FAST');
    this.stroke(INK); this.pdf.setLineWidth(0.35);
    this.pdf.roundedRect(x, this.y, w, h, 1.5, 1.5, 'S');
    this.y += h + 4;
  }

  /** Cabeceras y pies en todas las páginas menos la portada. */
  finish() {
    const n = this.pdf.getNumberOfPages();
    for (let i = 2; i <= n; i++) {
      this.pdf.setPage(i);
      this.fill(RULE); this.pdf.rect(0, 0, W, 9, 'F');
      this.stroke(INK); this.pdf.setLineWidth(0.4); this.pdf.line(0, 9, W, 9);
      // escala de metro
      this.pdf.setLineWidth(0.15);
      for (let x = 0; x <= W; x += 2) this.pdf.line(x, x % 10 === 0 ? 6.4 : 7.8, x, 9);
      this.font(9, 'bold'); this.color(INK);
      this.pdf.text('miTaller', M, 5.2);
      this.font(8); this.pdf.text(clean(this.title), W - M, 5.2, { align: 'right' });
      this.color(INK2); this.font(8);
      this.pdf.text(`Página ${i} de ${n}`, W - M, H - 8, { align: 'right' });
      this.pdf.text('Medidas en milímetros. Comprueba tu material antes de cortar y usa siempre el equipo de protección.', M, H - 8);
    }
  }
}

function stepPieces(project: Project, step: Step, cuts: CutLine[]): string[] {
  const m = new Map<string, number>();
  for (const id of step.parts) {
    const part = project.parts.find((p) => p.id === id)!;
    m.set(part.ref, (m.get(part.ref) ?? 0) + 1);
  }
  return [...m.entries()].map(([ref, n]) => {
    const c = cuts.find((x) => x.ref === ref)!;
    return `${n}×  ${ref}  ${c.name}  (${fmtCut(c)} mm)`;
  });
}

const pause = () => new Promise<void>((r) => setTimeout(r, 0));

export async function buildManual(project: Project, title: string): Promise<jsPDF> {
  const d = new Doc(title);
  const pdf = d.pdf;
  const cuts = cutList(project);
  const stock = stockList(project);
  const hardware = hardwareList(project);
  const tools = toolList(project);
  const IMG = { width: 1500, height: 1000 };
  const shot = (o: { step?: number; labels?: boolean; explode?: number; height?: number }) => {
    try { return snapshot(project, { ...IMG, ...o, background: '#f6f1e7' }); } catch { return null; }
  };

  // ---------- portada ----------
  d.fill(RULE); pdf.rect(0, 0, W, 34, 'F');
  d.stroke(INK); pdf.setLineWidth(0.6); pdf.line(0, 34, W, 34);
  pdf.setLineWidth(0.2);
  for (let x = 0; x <= W; x += 2) pdf.line(x, x % 10 === 0 ? 29 : 31.6, x, 34);
  d.font(22, 'bold'); d.color(INK); pdf.text('miTaller', M, 17);
  d.font(10); pdf.text('Manual de construcción paso a paso', M, 23.5);
  d.font(9); pdf.text(project.craft === 'soldadura' ? 'SOLDADURA' : 'CARPINTERÍA', W - M, 17, { align: 'right' });
  d.y = 46;
  d.text(title, { size: 30, style: 'bold', gap: 2 });
  d.text(project.summary, { size: 12, color: INK2, gap: 5 });
  const cover = shot({});
  if (cover) d.image(cover, CW, CW * (IMG.height / IMG.width));
  // datos
  const facts: [string, string][] = [
    ['Medidas (ancho × fondo × alto)', `${Math.round(project.dims[0])} × ${Math.round(project.dims[2])} × ${Math.round(project.dims[1])} mm`],
    ['Piezas', String(project.parts.length)],
    ['Pasos', String(project.steps.length)],
    ['Tiempo orientativo', `${project.hours.toLocaleString('es-ES')} h`],
    ['Nivel', LEVEL[project.difficulty]],
  ];
  const fw = CW / facts.length;
  const fy = d.y + 1;
  facts.forEach(([k, v], i) => {
    const x = M + fw * i;
    d.font(7.5); d.color(INK2); pdf.text(pdf.splitTextToSize(k, fw - 3) as string[], x, fy + 3);
    d.font(i === 0 ? 9.5 : 11.5, 'bold'); d.color(INK); pdf.text(pdf.splitTextToSize(clean(v), fw - 3) as string[], x, fy + 11.5);
  });
  d.y = fy + 22;

  // ---------- antes de empezar ----------
  d.newPage();
  d.heading('Antes de empezar');
  d.callout('Seguridad', project.safety, { bg: [251, 233, 200], accent: RED, list: true });
  if (project.notes?.length) d.callout('Notas de diseño', project.notes, { bg: PAPER, list: true });
  d.sub('Configuración de este manual');
  d.table([{ label: 'Opción', w: 62 }, { label: 'Valor', w: CW - 62, bold: true }], project.spec.map((s) => [s.label, s.value]));
  d.sub('Herramientas que vas a necesitar');
  d.bullets(tools, { box: true });

  // ---------- compra ----------
  d.y += 3;
  d.heading('Lista de la compra');
  d.sub('Material');
  d.table(
    [{ label: 'Material', w: 84, bold: true }, { label: 'Cantidad', w: 36 }, { label: 'Detalle', w: CW - 120 }],
    stock.map((s) => [s.stock, s.buy, s.detail]),
  );
  d.text('Barras calculadas con largos habituales (2,4 m en listón, 6 m en tubo de acero), contando la pérdida de cada corte. Comprueba el largo que vende tu almacén y añade un margen para errores.', { size: 8.5, color: INK2, gap: 4 });
  if (hardware.length) {
    d.sub('Tornillería y consumibles');
    d.table(
      [{ label: 'Cant.', w: 26, align: 'right', bold: true }, { label: 'Artículo', w: CW - 26 }],
      hardware.map((h) => [`${h.qty} ${h.unit ?? 'ud'}`, h.item]),
    );
  }

  // ---------- despiece ----------
  d.newPage();
  d.heading('Despiece y lista de corte');
  const exploded = shot({ explode: 0.6, labels: false, step: project.steps.findIndex((s) => s.kind === 'cortar' && !s.parts.length) });
  if (exploded) d.image(exploded, CW, CW * (IMG.height / IMG.width));
  d.table(
    [{ label: 'Ref.', w: 13, badge: true }, { label: 'Pieza', w: 50, bold: true }, { label: 'Cant.', w: 14, align: 'right', bold: true }, { label: 'Largo × ancho × grueso (mm)', w: 46 }, { label: 'Material', w: CW - 123 }],
    cuts.map((c) => [c.ref, c.note ? `${c.name} — ${c.note}` : c.name, `${c.qty}×`, fmtCut(c), c.stock]),
  );

  // ---------- pasos ----------
  for (let i = 0; i < project.steps.length; i++) {
    await pause(); // deja respirar a la interfaz entre renders
    const s = project.steps[i];
    d.newPage();
    // cabecera del paso: número grande, al estilo de un manual de montaje
    const top = d.y;
    d.fill(DARK); pdf.roundedRect(M, top, 22, 22, 2, 2, 'F');
    d.font(30, 'bold'); d.color(RULE); pdf.text(String(i + 1), M + 11, top + 15.5, { align: 'center' });
    d.font(8, 'bold'); d.color(RED); pdf.text(`${KIND[s.kind ?? 'montar'].toUpperCase()}  ·  PASO ${i + 1} DE ${project.steps.length}`, M + 27, top + 4.5);
    d.y = top + 6.5;
    d.text(s.title, { x: M + 27, w: CW - 27, size: 16, style: 'bold', gap: 0.8 });
    d.text(s.summary, { x: M + 27, w: CW - 27, size: 10, color: INK2, gap: 0 });
    d.y = Math.max(d.y, top + 22) + 5;

    const img = shot({ step: i, labels: true, height: 825 });
    if (img) d.image(img, CW, CW * 0.55);

    const pieces = stepPieces(project, s, cuts);
    if (pieces.length) {
      d.sub('Piezas de este paso');
      d.bullets(pieces, { size: 9.5 });
    }
    d.sub('Qué hacer');
    d.bullets(s.detail, { numbered: true });
    d.y += 2;
    if (s.technique) d.callout(`Técnica: ${s.technique.name}`, s.technique.how, { bg: DARK, fg: [246, 241, 231], accent: RULE, list: true, lead: s.technique.why });
    if (s.hardware?.length) {
      d.sub('Fijaciones y consumibles');
      d.bullets(s.hardware.map((h) => `${h.qty} ${h.unit ?? 'ud'} · ${h.item}`), { size: 9.5 });
    }
    if (s.tools?.length) {
      d.sub('Herramientas');
      d.text(s.tools.join(' · '), { size: 9.5, gap: 3 });
    }
    d.y += 1;
    if (s.check) d.callout('Comprueba antes de seguir', [s.check], { bg: [228, 239, 226], accent: [47, 107, 61] });
    if (s.warning) d.callout('Atención', [s.warning], { bg: [251, 233, 200], accent: RED });
    if (s.tip) d.callout('Consejo de taller', [s.tip], { bg: PAPER, accent: RULE });
  }

  // ---------- fuentes ----------
  if (project.sources?.length) {
    d.newPage();
    d.heading('Fuentes');
    d.text('Datos normativos y de seguridad usados en este diseño:', { color: INK2, gap: 3 });
    for (const src of project.sources) {
      d.text(src.label, { size: 9.5, style: 'bold', gap: 0.3 });
      d.text(src.url, { size: 8.5, color: INK2, gap: 2.5 });
    }
  }

  d.finish();
  pdf.setProperties({ title: `${title} · miTaller`, subject: 'Manual de construcción paso a paso', creator: 'miTaller' });
  return pdf;
}

type SaveFn = (r: { filename: string; data: Blob }) => Promise<{ status: string }>;
interface Host { claude?: { use?: (name: string) => Promise<{ save: SaveFn } | null> } }

/**
 * Guarda el manual. Devuelve false si la persona cancela el guardado.
 * En un navegador normal es una descarga directa; cuando la web se sirve dentro de un
 * visor que bloquea las descargas (artefacto de claude.ai) se usa su capacidad `downloads`.
 */
export async function downloadManual(project: Project, title: string): Promise<boolean> {
  const pdf = await buildManual(project, title);
  const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `mitaller-${slug}.pdf`;
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
