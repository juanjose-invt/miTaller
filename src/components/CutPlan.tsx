import { useId, useMemo, useState } from 'react';
import { Download, RotateCcw, Ruler, TriangleAlert } from 'lucide-react';
import type { Project } from '../core/types';
import { cutPlan, DEFAULT_SHEET, PLAN_KEY, pct, type Bar, type BoardPlan, type LinearPlan, type PlanOptions, type SheetPlan } from '../core/cutplan';
import { MATERIALS } from '../core/materials';
import { useStored } from '../core/store';
import './cut-plan.css';

/**
 * Plan de corte: reparte las piezas del proyecto en barras y tableros y lo dibuja a escala.
 *
 *   <CutPlan project={project} />                 // sin botón de PDF
 *   <CutPlan project={project} pdfTitle="Mesa" /> // con botón «Plan de corte en PDF»
 *
 * Los largos de barra y la medida de tablero se recuerdan en el navegador (clave `plan-corte`).
 */
export interface CutPlanProps {
  project: Project;
  /** Si se da, aparece el botón de descarga del PDF con este título. */
  pdfTitle?: string;
  /** Nivel del encabezado principal (por defecto h2); los materiales usan el siguiente. */
  headingLevel?: 2 | 3;
}

const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const mm = (v: number) => `${nf.format(v)} mm`;
const metres = (v: number) => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v / 1000)} m`;

/** Campo numérico que solo confirma valores válidos y mantiene lo que la persona teclea. */
function MmField({ label, value, min, onCommit, id }: { label: string; value: number; min: number; onCommit: (n: number) => void; id: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const n = Number(draft);
  const bad = draft !== null && (!Number.isFinite(n) || n < min);
  return (
    <div className="cp-field">
      <label htmlFor={id}>{label}</label>
      <div className="numbox" data-bad={bad || undefined}>
        <input
          id={id} type="number" inputMode="numeric" min={min} step={10} value={shown}
          aria-invalid={bad || undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= min) onCommit(Math.round(v * 10) / 10);
          }}
          onBlur={() => setDraft(null)}
        />
        <span>mm</span>
      </div>
      {bad && <small className="cp-bad">Mínimo {min} mm</small>}
    </div>
  );
}

export function CutPlan({ project, pdfTitle, headingLevel = 2 }: CutPlanProps) {
  const [opts, setOpts] = useStored<PlanOptions>(PLAN_KEY, {});
  const plan = useMemo(() => cutPlan(project, opts), [project, opts]);
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const H = (headingLevel === 2 ? 'h2' : 'h3') as 'h2' | 'h3';
  const H2 = (headingLevel === 2 ? 'h3' : 'h4') as 'h3' | 'h4';
  const hasGrainBoards = plan.boards.some((b) => b.grain);
  const none = !plan.linear.length && !plan.boards.length;

  const setBar = (stock: string, v: number | null) =>
    setOpts((o) => {
      const barLengths = { ...(o.barLengths ?? {}) };
      if (v === null) delete barLengths[stock];
      else barLengths[stock] = v;
      return { ...o, barLengths };
    });
  const setSheet = (stock: string, s: { length: number; width: number } | null) =>
    setOpts((o) => {
      const sheets = { ...(o.sheets ?? {}) };
      if (s === null) delete sheets[stock];
      else sheets[stock] = s;
      return { ...o, sheets };
    });

  const download = async () => {
    if (!pdfTitle || busy) return;
    setBusy(true);
    try {
      const { downloadCutPlan } = await import('../pdf/extras');
      await downloadCutPlan(project, pdfTitle, opts);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cutplan" aria-labelledby={`${uid}-h`}>
      <header className="cp-head">
        <div>
          <H id={`${uid}-h`}>Plan de corte</H>
          <p>
            Cómo sacar todas las piezas con el menor material posible, contando lo que se come el disco en cada corte.
            Los largos de barra y las medidas de tablero son los habituales: cámbialos por los de tu almacén.
          </p>
        </div>
        {pdfTitle && (
          <button type="button" className="btn small" onClick={download} disabled={busy || none}>
            <Download size={16} aria-hidden /> {busy ? 'Preparando…' : 'Plan de corte en PDF'}
          </button>
        )}
      </header>

      {none ? (
        <p className="cp-empty">Este proyecto no tiene piezas que se corten de barra o de tablero.</p>
      ) : (
        <>
          <dl className="cp-totals">
            {plan.linear.length > 0 && (
              <>
                <div><dt>Barras</dt><dd>{plan.totals.bars}</dd></div>
                <div><dt>Aprovechamiento de barras</dt><dd>{pct(plan.totals.linearUtilisation ?? 0)}</dd></div>
              </>
            )}
            {plan.boards.length > 0 && (
              <>
                <div><dt>Tableros</dt><dd>{plan.totals.sheets}</dd></div>
                <div><dt>Aprovechamiento de tableros</dt><dd>{pct(plan.totals.boardUtilisation ?? 0)}</dd></div>
              </>
            )}
          </dl>

          {plan.warnings.length > 0 && (
            <ul className="cp-warn" role="alert">
              {plan.warnings.map((w) => (
                <li key={w}><TriangleAlert size={16} aria-hidden /> <span>{w}</span></li>
              ))}
            </ul>
          )}

          {hasGrainBoards && (
            <label className="switch cp-switch">
              <input type="checkbox" checked={!!opts.rotateGrain} onChange={(e) => setOpts((o) => ({ ...o, rotateGrain: e.target.checked }))} />
              <i aria-hidden />
              <span>Permitir girar la madera alistonada <small>(pierdes el sentido de la veta, pero a veces ahorra un tablero)</small></span>
            </label>
          )}

          {plan.linear.map((l, i) => (
            <LinearBlock key={l.stock} plan={l} H={H2} uid={`${uid}-l${i}`} onBar={(v) => setBar(l.stock, v)} />
          ))}
          {plan.boards.map((b, i) => (
            <BoardBlock key={b.stock} plan={b} H={H2} uid={`${uid}-b${i}`} onSheet={(s) => setSheet(b.stock, s)} />
          ))}
        </>
      )}
    </section>
  );
}

// ---------- barras ----------

function LinearBlock({ plan, H, uid, onBar }: { plan: LinearPlan; H: 'h3' | 'h4'; uid: string; onBar: (v: number | null) => void }) {
  const changed = plan.barLength !== plan.defaultBarLength;
  const left = plan.bars.reduce((a, b) => a + b.leftover, 0);
  return (
    <div className="cp-mat">
      <div className="cp-mat-head">
        <H>{plan.stock}</H>
        <span className={`chip ${MATERIALS[plan.material].kind === 'metal' ? 'steel' : 'wood'}`}>{plan.bars.length} {plan.bars.length === 1 ? 'barra' : 'barras'}</span>
      </div>
      <div className="cp-controls">
        <MmField id={`${uid}-len`} label="Largo de barra" value={plan.barLength} min={200} onCommit={onBar} />
        <p className="cp-hint">
          Largo habitual: {mm(plan.defaultBarLength)}.
          {changed && (
            <button type="button" className="btn ghost small" onClick={() => onBar(null)}>
              <RotateCcw size={14} aria-hidden /> Volver al habitual
            </button>
          )}
        </p>
      </div>
      <p className="cp-stats">
        {plan.pieces} {plan.pieces === 1 ? 'pieza' : 'piezas'} · {metres(plan.totalCut)} de corte · {metres(plan.totalBought)} comprados ·{' '}
        <strong>{pct(plan.utilisation)} aprovechado</strong> · sobran {metres(left)} contando el disco ({mm(plan.kerf)} por corte)
      </p>
      <BarsSvg plan={plan} uid={uid} />
      <details className="cp-table">
        <summary><Ruler size={15} aria-hidden /> Ver los cortes de cada barra en una tabla</summary>
        <div className="table-wrap">
          <table className="data">
            <caption className="sr-only">Cortes de cada barra de {plan.stock}</caption>
            <thead><tr><th scope="col">Barra</th><th scope="col">Cortes, en orden</th><th scope="col" className="r">Sobrante</th></tr></thead>
            <tbody>
              {plan.bars.map((b) => (
                <tr key={b.index}>
                  <th scope="row">{b.index}{b.special ? ' · largo especial' : ''}</th>
                  <td>{b.cuts.map((c) => `${c.ref} ${nf.format(c.length)}`).join(' · ')}</td>
                  <td className="r dim">{mm(b.leftover)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

const VW = 900;
const PAD = 8;

function barDescription(b: Bar): string {
  return `Barra ${b.index} de ${nf.format(b.length)} mm: ${b.cuts.map((c) => `${c.ref} ${nf.format(c.length)} mm`).join(', ')}. Sobran ${nf.format(b.leftover)} mm.`;
}

function BarsSvg({ plan, uid }: { plan: LinearPlan; uid: string }) {
  const maxLen = Math.max(...plan.bars.map((b) => b.length));
  const sc = (VW - PAD * 2) / maxLen;
  const ROW = 92;
  const H = plan.bars.length * ROW + 6;
  const metal = MATERIALS[plan.material].kind === 'metal';
  const hatch = `${uid}-hatch`;
  return (
    <div className="cp-scroll" tabIndex={0} role="group" aria-label={`Diagrama de barras de ${plan.stock} (se desplaza a los lados)`}>
      <svg viewBox={`0 0 ${VW} ${H}`} width={VW} height={H} className="cp-svg cp-bars" role="img" aria-labelledby={`${uid}-t ${uid}-d`} style={{ minWidth: 640 }}>
        <title id={`${uid}-t`}>Plan de corte de {plan.stock}</title>
        <desc id={`${uid}-d`}>{plan.bars.map(barDescription).join(' ')}</desc>
        <defs>
          <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="var(--paper-2)" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ink-3)" strokeWidth="1.4" opacity="0.55" />
          </pattern>
        </defs>
        {plan.bars.map((b, i) => {
          const y0 = i * ROW + 4;
          const by = y0 + 26;
          const bh = 46;
          let x = PAD;
          return (
            <g key={b.index}>
              <text x={PAD} y={y0 + 14} className="cp-t1">Barra {b.index}</text>
              <text x={PAD + b.length * sc} y={y0 + 14} textAnchor="end" className="cp-t2">
                {b.special ? 'largo especial · ' : ''}{mm(b.length)} · sobran {mm(b.leftover)}
              </text>
              <rect x={PAD} y={by} width={b.length * sc} height={bh} className="cp-bar-bg" />
              {b.cuts.map((c, k) => {
                const w = c.length * sc;
                const x1 = x;
                x += w + plan.kerf * sc;
                const cx = x1 + w / 2;
                return (
                  <g key={c.id}>
                    <title>{`${c.ref} · ${c.name} · ${nf.format(c.length)} mm`}</title>
                    <rect x={x1} y={by} width={w} height={bh} className={`cp-piece ${metal ? 'steel' : 'wood'}`} />
                    {w >= 22 && (
                      <>
                        <circle cx={cx} cy={by + 16} r={9.5} className="cp-ref" />
                        <text x={cx} y={by + 16} className="cp-reft">{c.ref}</text>
                      </>
                    )}
                    {w >= 44 && <text x={cx} y={by + 39} textAnchor="middle" className="cp-len">{nf.format(c.length)}</text>}
                    {k < b.cuts.length - 1 && <line x1={x1 + w + (plan.kerf * sc) / 2} x2={x1 + w + (plan.kerf * sc) / 2} y1={by - 3} y2={by + bh + 3} className="cp-kerf" />}
                  </g>
                );
              })}
              {b.leftover > 0.5 && (
                <g>
                  <rect x={x} y={by} width={Math.max(0, PAD + b.length * sc - x)} height={bh} fill={`url(#${hatch})`} className="cp-waste" />
                  {(b.length * sc + PAD - x) >= 70 && (
                    <text x={x + (PAD + b.length * sc - x) / 2} y={by + bh / 2 + 4} textAnchor="middle" className="cp-len cp-onwaste">{nf.format(b.leftover)}</text>
                  )}
                </g>
              )}
              {/* regla: marca cada 100 mm y cada 500 mm */}
              {Array.from({ length: Math.floor(b.length / 100) + 1 }, (_, t) => {
                const major = t % 5 === 0;
                const tx = PAD + t * 100 * sc;
                return sc * 100 >= 2.2 || major ? <line key={t} x1={tx} x2={tx} y1={by + bh} y2={by + bh + (major ? 8 : 4)} className="cp-tick" /> : null;
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- tableros ----------

function BoardBlock({ plan, H, uid, onSheet }: { plan: BoardPlan; H: 'h3' | 'h4'; uid: string; onSheet: (s: { length: number; width: number } | null) => void }) {
  const changed = plan.sheet.length !== plan.defaultSheet.length || plan.sheet.width !== plan.defaultSheet.width;
  const items = plan.sheets.flatMap((s) => s.placed.map((p) => ({ sheet: s.index, ...p })));
  return (
    <div className="cp-mat">
      <div className="cp-mat-head">
        <H>{plan.stock}</H>
        <span className={`chip ${MATERIALS[plan.material].kind === 'metal' || plan.kind === 'malla' ? 'steel' : 'wood'}`}>{plan.sheets.length} {plan.sheets.length === 1 ? 'tablero' : 'tableros'}</span>
      </div>
      <div className="cp-controls">
        <MmField id={`${uid}-l`} label="Largo del tablero" value={plan.sheet.length} min={200} onCommit={(v) => onSheet({ length: v, width: plan.sheet.width })} />
        <MmField id={`${uid}-w`} label="Ancho del tablero" value={plan.sheet.width} min={200} onCommit={(v) => onSheet({ length: plan.sheet.length, width: v })} />
        <p className="cp-hint">
          Medida habitual: {DEFAULT_SHEET.length} × {DEFAULT_SHEET.width} mm; cámbiala por la de tu almacén.
          {changed && (
            <button type="button" className="btn ghost small" onClick={() => onSheet(null)}>
              <RotateCcw size={14} aria-hidden /> Volver a la habitual
            </button>
          )}
        </p>
      </div>
      <p className="cp-stats">
        {plan.pieces} {plan.pieces === 1 ? 'pieza' : 'piezas'} · {new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(plan.totalArea / 1e6)} m² de piezas en{' '}
        {new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(plan.boughtArea / 1e6)} m² comprados · <strong>{pct(plan.utilisation)} aprovechado</strong>
        {plan.grain && ` · veta a lo largo${plan.canRotate ? ' (se permite girar)' : ', sin girar piezas'}`}
        {!plan.grain && plan.kind === 'tablero' && ' · se pueden girar las piezas'}
      </p>
      {plan.sheets.map((s) => (
        <SheetSvg key={s.index} plan={plan} sheet={s} uid={`${uid}-s${s.index}`} total={plan.sheets.length} />
      ))}
      {plan.oversize.length > 0 && (
        <p className="cp-oversize" role="alert">
          <TriangleAlert size={16} aria-hidden /> No caben en este tablero: {plan.oversize.map((o) => `${o.ref} (${nf.format(o.w)} × ${nf.format(o.h)} mm)`).join(', ')}.
        </p>
      )}
      <details className="cp-table">
        <summary><Ruler size={15} aria-hidden /> Ver las piezas de cada tablero en una tabla</summary>
        <div className="table-wrap">
          <table className="data">
            <caption className="sr-only">Piezas colocadas en cada tablero de {plan.stock}</caption>
            <thead>
              <tr><th scope="col">Tablero</th><th scope="col">Ref.</th><th scope="col">Pieza</th><th scope="col" className="r">Medida (mm)</th><th scope="col" className="r">Posición x, y (mm)</th><th scope="col">Veta</th></tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.sheet}</td>
                  <td><span className="ref">{p.ref}</span></td>
                  <td>{p.name}</td>
                  <td className="r dim">{nf.format(p.w)} × {nf.format(p.h)}</td>
                  <td className="r">{nf.format(p.x)}, {nf.format(p.y)}</td>
                  <td>{plan.grain ? (p.rotated ? 'Girada 90°' : 'A lo largo') : p.rotated ? 'Girada 90°' : 'Sin girar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function SheetSvg({ plan, sheet, uid, total }: { plan: BoardPlan; sheet: SheetPlan; uid: string; total: number }) {
  const ML = 44, MT = 30, MB = plan.grain ? 30 : 12, MR = 12;
  const sc = (VW - ML - MR) / sheet.length;
  const H = sheet.width * sc + MT + MB;
  const metal = MATERIALS[plan.material].kind !== 'madera';
  const hatch = `${uid}-h`;
  const grain = `${uid}-g`;
  const desc = `Tablero ${sheet.index} de ${total}, ${nf.format(sheet.length)} por ${nf.format(sheet.width)} mm, ${pct(sheet.utilisation)} aprovechado. ` +
    sheet.placed.map((p) => `${p.ref} ${nf.format(p.w)} por ${nf.format(p.h)} mm en x ${nf.format(p.x)}, y ${nf.format(p.y)}${p.rotated ? ', girada' : ''}`).join('; ') + '.';
  return (
    <figure className="cp-sheet">
      <figcaption>
        <strong>Tablero {sheet.index} de {total}</strong> · {sheet.placed.length} {sheet.placed.length === 1 ? 'pieza' : 'piezas'} · {pct(sheet.utilisation)} aprovechado
      </figcaption>
      <div className="cp-scroll" tabIndex={0} role="group" aria-label={`Diagrama del tablero ${sheet.index} (se desplaza a los lados)`}>
        <svg viewBox={`0 0 ${VW} ${H}`} width={VW} height={H} className="cp-svg cp-board" role="img" aria-labelledby={`${uid}-t ${uid}-d`} style={{ minWidth: 560 }}>
          <title id={`${uid}-t`}>Tablero {sheet.index} de {plan.stock}</title>
          <desc id={`${uid}-d`}>{desc}</desc>
          <defs>
            <pattern id={hatch} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="9" height="9" fill="var(--paper-2)" />
              <line x1="0" y1="0" x2="0" y2="9" stroke="var(--ink-3)" strokeWidth="1.2" opacity="0.5" />
            </pattern>
            <pattern id={grain} width="40" height="6" patternUnits="userSpaceOnUse">
              <line x1="0" y1="3" x2="40" y2="3" stroke="#9a6a35" strokeWidth="0.8" opacity="0.42" />
            </pattern>
          </defs>
          {/* cotas del tablero */}
          <g className="cp-dim">
            <line x1={ML} x2={ML + sheet.length * sc} y1={MT - 12} y2={MT - 12} />
            <line x1={ML} x2={ML} y1={MT - 17} y2={MT - 7} />
            <line x1={ML + sheet.length * sc} x2={ML + sheet.length * sc} y1={MT - 17} y2={MT - 7} />
            <text x={ML + (sheet.length * sc) / 2} y={MT - 17} textAnchor="middle">{nf.format(sheet.length)} mm</text>
            <line x1={ML - 12} x2={ML - 12} y1={MT} y2={MT + sheet.width * sc} />
            <line x1={ML - 17} x2={ML - 7} y1={MT} y2={MT} />
            <line x1={ML - 17} x2={ML - 7} y1={MT + sheet.width * sc} y2={MT + sheet.width * sc} />
            <text transform={`translate(${ML - 19} ${MT + (sheet.width * sc) / 2}) rotate(-90)`} textAnchor="middle">{nf.format(sheet.width)} mm</text>
          </g>
          <rect x={ML} y={MT} width={sheet.length * sc} height={sheet.width * sc} fill={`url(#${hatch})`} className="cp-sheet-bg" />
          {sheet.placed.map((p) => {
            const x = ML + p.x * sc, y = MT + p.y * sc, w = p.w * sc, h = p.h * sc;
            const cx = x + w / 2, cy = y + h / 2;
            const big = Math.min(w, h) >= 26 && w >= 52;
            const small = !big && Math.min(w, h) >= 20;
            return (
              <g key={p.id}>
                <title>{`${p.ref} · ${p.name} · ${nf.format(p.w)} × ${nf.format(p.h)} mm${p.rotated ? ' · girada' : ''}`}</title>
                <rect x={x} y={y} width={w} height={h} className={`cp-piece ${metal ? 'steel' : 'wood'}`} />
                {plan.grain && !metal && <rect x={x} y={y} width={w} height={h} fill={`url(#${grain})`} pointerEvents="none" />}
                {(big || small) && (
                  <>
                    <circle cx={cx} cy={big ? cy - 7 : cy} r={9.5} className="cp-ref" />
                    <text x={cx} y={big ? cy - 7 : cy} className="cp-reft">{p.ref}</text>
                  </>
                )}
                {big && <text x={cx} y={cy + 17} textAnchor="middle" className="cp-len">{nf.format(p.w)} × {nf.format(p.h)}</text>}
                {p.rotated && (w >= 40 && h >= 40) && <text x={x + 5} y={y + 13} className="cp-rot" aria-hidden>↻</text>}
              </g>
            );
          })}
          {plan.grain && (
            <g className="cp-dim">
              <line x1={ML + 8} x2={ML + 128} y1={H - 14} y2={H - 14} markerEnd={`url(#${uid}-arrow)`} />
              <text x={ML + 136} y={H - 10}>veta</text>
              <defs>
                <marker id={`${uid}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
            </g>
          )}
        </svg>
      </div>
    </figure>
  );
}
