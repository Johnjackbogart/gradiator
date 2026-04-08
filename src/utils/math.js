export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

export function fract(v) {
  return v - Math.floor(v);
}

export function smoothstep01(t) {
  return t * t * (3 - 2 * t);
}

export function normalizeVector(du, dv, fallback = { du: 1, dv: 0 }) {
  const len = Math.hypot(du, dv);
  if (len < 1e-6) {
    if (!fallback) return null;
    const fallbackLen = Math.hypot(fallback.du, fallback.dv);
    if (fallbackLen < 1e-6) return null;
    return { du: fallback.du / fallbackLen, dv: fallback.dv / fallbackLen };
  }
  return { du: du / len, dv: dv / len };
}
