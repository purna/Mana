/* City Gate — seeded RNG + small helpers. No dependencies. */
(function (g) {
  'use strict';
  const CG = (g.CityGate = g.CityGate || {});

  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0) || 1;
  }

  // mulberry32
  function makeRng(seed) {
    let a = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 1;
    const rng = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.shuffle = (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };
    rng.weighted = (items, weightFn) => {
      let total = 0;
      const ws = items.map((it) => { const w = Math.max(0, weightFn(it)); total += w; return w; });
      if (total <= 0) return items[Math.floor(rng() * items.length)];
      let r = rng() * total;
      for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    };
    return rng;
  }

  CG.RNG = { make: makeRng, hash: hashString };
})(typeof globalThis !== 'undefined' ? globalThis : window);
