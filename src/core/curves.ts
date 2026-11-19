/** Curvas planas compartidas por el visor 3D, las plantillas 1:1 y los generadores de forja. */
export type Pt = [number, number];

/** Curva (u, v) de una voluta dentro de su caja w × h hecha con barra de grueso `bar`. */
export function volutaPoints(w: number, h: number, curve: 'C' | 'S' | 'espiral', bar: number): Pt[] {
  const spiral = (cx: number, cy: number, R: number, turns: number): Pt[] => {
    const tmax = turns * Math.PI * 2;
    const pts: Pt[] = [];
    const n = Math.round(turns * 28);
    for (let i = 0; i <= n; i++) {
      const t = tmax * (0.12 + 0.88 * (i / n));
      const r = R * (t / tmax);
      const phi = tmax - t; // termina en phi = 0 (punto más a la derecha), bajando
      pts.push([cx + r * Math.cos(phi), cy + r * Math.sin(phi)]);
    }
    return pts;
  };
  const m = bar / 2;
  const W = w - bar, H = h - bar;
  if (curve === 'espiral') return spiral(m + W / 2, m + H / 2, Math.min(W, H) / 2, 2.25);
  const R = Math.min(W / 2, H / 4);
  const top = spiral(m + W - R, m + H - R, R, 1.35); // acaba en (m + W, m + H - R)
  const bottom: Pt[] = curve === 'C'
    ? top.map(([x, y]): Pt => [x, 2 * m + H - y]).reverse()
    : top.map(([x, y]): Pt => [2 * m + W - x, 2 * m + H - y]).reverse();
  return [...top, ...bottom];
}

/** Corazón de forja: dos volutas enfrentadas que se unen abajo en punta. Curva cerrada por abajo. */
export function corazonPoints(w: number, h: number, bar: number): Pt[] {
  const m = bar / 2;
  const W = w - bar, H = h - bar;
  const R = W / 4; // radio de cada lóbulo
  const half: Pt[] = [];
  // lóbulo derecho: espiral que nace dentro y sale por el exterior derecho
  const cx = m + W / 2 + R, cy = m + H - R;
  const turns = 1.1, tmax = turns * Math.PI * 2;
  for (let i = 0; i <= 30; i++) {
    const t = tmax * (0.2 + 0.8 * (i / 30));
    const r = R * (t / tmax);
    const phi = Math.PI + (tmax - t) * -1 + tmax; // gira en sentido horario y termina en el exterior derecho
    half.push([cx + r * Math.cos(phi - tmax + Math.PI * 0), cy + r * Math.sin(phi - tmax + Math.PI * 0)]);
  }
  // normaliza: asegura que el último punto es el extremo derecho del lóbulo
  const last: Pt = [m + W, cy];
  half.push(last);
  // baja en curva suave hasta la punta inferior central
  for (let i = 1; i <= 14; i++) {
    const k = i / 14;
    const x = m + W - (W / 2) * (1 - Math.cos((k * Math.PI) / 2));
    const y = cy - (cy - m) * Math.sin((k * Math.PI) / 2);
    half.push([x, y]);
  }
  const left = half.map(([x, y]): Pt => [2 * m + W - x, y]).reverse();
  return [...half, ...left.slice(1)];
}

/** Rombo: contorno cerrado de cuatro vértices. */
export function romboPoints(w: number, h: number, bar: number): Pt[] {
  const m = bar / 2;
  return [[w / 2, h - m], [w - m, h / 2], [w / 2, m], [m, h / 2], [w / 2, h - m]];
}

/** Hoja de forja: contorno apuntado (para un prisma plano). */
export function hojaPolygon(w: number, h: number): Pt[] {
  const pts: Pt[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([w / 2 + (w / 2) * Math.sin(Math.PI * t) * (1 - 0.25 * t), h * t]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const t = i / n;
    pts.push([w / 2 - (w / 2) * Math.sin(Math.PI * t) * (1 - 0.25 * t), h * t]);
  }
  return pts;
}

/** Longitud de una polilínea. */
export function polyLength(pts: Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
