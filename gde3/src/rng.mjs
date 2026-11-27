// Seeded random numbers and smooth value noise (same seed = same output).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth 2D noise in [-1, 1] with wavelength wl; a pure function of (x, y, seed)
export function valueNoise(seed, wl) {
  const h = (i, j) => {
    let a = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0;
    a = Math.imul(a ^ (a >>> 13), 1274126177) >>> 0;
    return ((a ^ (a >>> 16)) >>> 0) / 2147483648 - 1;
  };
  const f = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const u = x / wl, v = y / wl, i = Math.floor(u), j = Math.floor(v), fu = f(u - i), fv = f(v - j);
    const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
  };
}
