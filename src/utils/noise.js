import { fract, lerp, smoothstep01 } from "./math.js";

function hash2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

function valueNoise2D(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep01(x - ix);
  const fy = smoothstep01(y - iy);
  const v00 = hash2(ix, iy);
  const v10 = hash2(ix + 1, iy);
  const v01 = hash2(ix, iy + 1);
  const v11 = hash2(ix + 1, iy + 1);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

export function fractalNoise2D(x, y, octaves = 2) {
  let total = 0;
  let amplitude = 0.6;
  let frequency = 1;
  let weight = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * frequency, y * frequency) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return weight > 0 ? total / weight : 0;
}
