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

/** Corazón de forja: dos volutas en J que nacen en la punta, abrazan cada lóbulo y se enrollan hacia dentro. */
export function corazonPoints(w: number, h: number, bar: number): Pt[] {
  const m = bar / 2, W = w - bar, H = h - bar;
  const R = W / 4; // radio de cada lóbulo
  const cx = m + W / 2 + R, cy = m + H - R; // centro del lóbulo derecho
  const half: Pt[] = [];
  // tramo bajo: de la punta (centro abajo) al lado derecho del lóbulo, con tangente vertical al llegar
  const P0: Pt = [m + W / 2, m], P1: Pt = [m + W / 2 + W * 0.16, m + (cy - m) * 0.28], P2: Pt = [m + W, cy - (cy - m) * 0.55], P3: Pt = [m + W, cy];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
    half.push([a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1]]);
  }
  // lóbulo: media vuelta por arriba hasta el centro y después espiral hacia dentro (el ojo)
  const n = 40, giro = Math.PI + (Math.PI * 5) / 3;
  for (let i = 1; i <= n; i++) {
    const th = (giro * i) / n;
    const r = th <= Math.PI ? R : R * (1 - 0.62 * ((th - Math.PI) / (giro - Math.PI)));
    half.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  const left = half.map(([x, y]): Pt => [2 * m + W - x, y]);
  return [...left.reverse(), ...half.slice(1)];
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
