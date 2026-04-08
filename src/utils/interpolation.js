import { lerp } from "./math.js";

export function bilerp(tl, tr, bl, br, u, v) {
  const h = (a, b) => lerp(a, b, u);
  return {
    x: lerp(h(tl.x, tr.x), h(bl.x, br.x), v),
    y: lerp(h(tl.y, tr.y), h(bl.y, br.y), v),
    r: lerp(h(tl.r, tr.r), h(bl.r, br.r), v),
    g: lerp(h(tl.g, tr.g), h(bl.g, br.g), v),
    b: lerp(h(tl.b, tr.b), h(bl.b, br.b), v),
  };
}

export function colorBilerp(tl, tr, bl, br, u, v) {
  return {
    r: lerp(lerp(tl.r, tr.r, u), lerp(bl.r, br.r, u), v),
    g: lerp(lerp(tl.g, tr.g, u), lerp(bl.g, br.g, u), v),
    b: lerp(lerp(tl.b, tr.b, u), lerp(bl.b, br.b, u), v),
  };
}

export function mixPoint(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

export function inverseBilinear(target, tl, tr, bl, br) {
  const bx = tr.x - tl.x;
  const by = tr.y - tl.y;
  const cx = bl.x - tl.x;
  const cy = bl.y - tl.y;
  const dx = tl.x - tr.x - bl.x + br.x;
  const dy = tl.y - tr.y - bl.y + br.y;
  let u = 0.5;
  let v = 0.5;

  for (let i = 0; i < 10; i++) {
    const fx = tl.x + bx * u + cx * v + dx * u * v - target.x;
    const fy = tl.y + by * u + cy * v + dy * u * v - target.y;
    const j00 = bx + dx * v;
    const j01 = cx + dx * u;
    const j10 = by + dy * v;
    const j11 = cy + dy * u;
    const det = j00 * j11 - j01 * j10;
    if (Math.abs(det) < 1e-8) break;
    const du = (fx * j11 - fy * j01) / det;
    const dv = (fy * j00 - fx * j10) / det;
    u -= du;
    v -= dv;
    if (du * du + dv * dv < 1e-10) break;
  }

  const projected = bilerp(tl, tr, bl, br, u, v);
  const error = (projected.x - target.x) ** 2 + (projected.y - target.y) ** 2;
  return { u, v, error, projected };
}
