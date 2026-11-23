/*
 * MANNA isometric core helpers.
 *
 * Kept dependency-free so the same validation and share-code rules can run in
 * the browser and in Node tests. The game exposes this as window.MannaCore.
 */
(function (root) {
  'use strict';

  const SAVE_VERSION = 4;
  const SHARE_VERSION = 1;
  const TOTAL_DAYS = 40 * 12 * 7;
  const MAP_SIZE = 48;
  const STRUCTURE_KINDS = new Set(['tent', 'sentry', 'tower']);

  const toBase64 = (text) =>
    typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(text)))
      : Buffer.from(text, 'utf8').toString('base64');
  const fromBase64 = (text) =>
    typeof atob === 'function'
      ? decodeURIComponent(escape(atob(text)))
      : Buffer.from(text, 'base64').toString('utf8');

  /** URL-safe base64 without padding. */
  function encodeText(text) {
    return toBase64(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeText(text) {
    const padded = String(text).replace(/-/g, '+').replace(/_/g, '/');
    return fromBase64(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  }

  function encodeShare(payload) {
    const clean = {
      v: SHARE_VERSION,
      s: Math.max(0, Math.floor(Number(payload.seed) || 0)),
      d: Math.max(1, Math.floor(Number(payload.day) || 1)),
      st: Math.max(0, Math.floor(Number(payload.station) || 0)),
      l: Array.isArray(payload.layout)
        ? payload.layout
            .filter((s) => s && STRUCTURE_KINDS.has(s.kind))
            .slice(0, 200)
            .map((s) => [s.kind, Math.max(0, Math.floor(s.x || 0)), Math.max(0, Math.floor(s.y || 0))])
        : [],
      b: Array.isArray(payload.blueprints)
        ? payload.blueprints.slice(0, 3).map((slot) =>
            Array.isArray(slot)
              ? slot
                  .filter((s) => s && STRUCTURE_KINDS.has(s.kind))
                  .slice(0, 200)
                  .map((s) => [s.kind, Math.max(0, Math.floor(s.x || 0)), Math.max(0, Math.floor(s.y || 0))])
              : null,
          )
        : [null, null, null],
    };
    return encodeText(JSON.stringify(clean));
  }

  function decodeShare(code) {
    try {
      const raw = JSON.parse(decodeText(String(code || '').trim()));
      if (!raw || raw.v !== SHARE_VERSION) return null;
      const seed = Number(raw.s);
      const day = Number(raw.d);
      const station = Number(raw.st);
      if (!Number.isFinite(seed) || !Number.isFinite(day) || !Number.isFinite(station)) return null;
      if (day < 1 || day > TOTAL_DAYS || station < 0 || station > 8) return null;
      const layout = (Array.isArray(raw.l) ? raw.l : [])
        .filter((row) => Array.isArray(row) && STRUCTURE_KINDS.has(row[0]))
        .map((row) => ({ kind: row[0], x: clampInt(row[1], 1, MAP_SIZE - 2), y: clampInt(row[2], 1, MAP_SIZE - 2) }));
      if (layout.length > 200) return null;
      const blueprints = [0, 1, 2].map((i) => {
        const slot = Array.isArray(raw.b) ? raw.b[i] : null;
        if (!Array.isArray(slot)) return null;
        return slot
          .filter((row) => Array.isArray(row) && STRUCTURE_KINDS.has(row[0]))
          .map((row) => ({ kind: row[0], x: clampInt(row[1], 1, MAP_SIZE - 2), y: clampInt(row[2], 1, MAP_SIZE - 2) }))
          .slice(0, 200);
      });
      return { seed, day, station, layout, blueprints };
    } catch (_) {
      return null;
    }
  }

  function clampInt(value, min, max) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * Migrate old isometric saves to the current shape. Unknown/hostile values are
   * left alone so validateSave can reject them rather than silently inventing a
   * playable journey.
   */
  function migrateSave(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const data = clone(input);
    const oldVersion = Number(data.v || data.version || 1);
    // The old v1/v2 calendars used a different unit; the game's own loader
    // already understands those units, so migration only adds new fields.
    data._sourceVersion = oldVersion;
    data.v = SAVE_VERSION;
    data.worldSeed = Number.isFinite(Number(data.worldSeed)) ? Math.floor(Number(data.worldSeed)) : 20261115;
    data.raidSeed = Number.isFinite(Number(data.raidSeed)) ? Math.floor(Number(data.raidSeed)) : 1;
    data.raidLog = Array.isArray(data.raidLog) ? data.raidLog.slice(0, 20) : [];
    data.blueprints = Array.isArray(data.blueprints) ? data.blueprints.slice(0, 3) : [null, null, null];
    while (data.blueprints.length < 3) data.blueprints.push(null);
    data.structures = Array.isArray(data.structures) ? data.structures : [];
    data.visited = Array.isArray(data.visited) ? data.visited : [];
    data.explored = Array.isArray(data.explored) ? data.explored : [];
    data.events = data.events && typeof data.events === 'object' ? data.events : {};
    data.tribeStats = data.tribeStats && typeof data.tribeStats === 'object' ? data.tribeStats : {};
    // v1/v2 had walls; the isometric edition treats them as sentry posts.
    data.structures = data.structures.map((s) =>
      s && s.kind === 'wall' ? { ...s, kind: 'sentry' } : s,
    );
    const defaults = {
      hour: 6, stationIndex: 0, health: 100, hunger: 100, hydration: 100,
      warmth: 100, stamina: 100, faith: 68, manna: 0, waterskin: 0,
      campWater: 34, silver: 18, sick: 0, rot: 0, calf: 0, wood: 0,
      score: 0, speed: 1,
    };
    for (const [key, value] of Object.entries(defaults)) {
      if (!Number.isFinite(Number(data[key]))) data[key] = value;
    }
    return data;
  }

  function validStructure(s) {
    if (!s || !STRUCTURE_KINDS.has(s.kind)) return false;
    const x = Number(s.x);
    const y = Number(s.y);
    return Number.isFinite(x) && Number.isFinite(y) && x >= 1 && x <= MAP_SIZE - 2 && y >= 1 && y <= MAP_SIZE - 2;
  }

  function validateSave(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    if (input.v !== SAVE_VERSION) return false;
    const day = Number(input.day);
    if (!Number.isFinite(day) || day < 1 || day > TOTAL_DAYS) return false;
    if (!Number.isFinite(Number(input.hour)) || Number(input.hour) < 0 || Number(input.hour) >= 24) return false;
    if (!Number.isFinite(Number(input.stationIndex))) return false;
    if (!Array.isArray(input.structures) || input.structures.length > 400 || !input.structures.every(validStructure)) return false;
    if (!Array.isArray(input.blueprints) || input.blueprints.length > 3) return false;
    for (const slot of input.blueprints) {
      if (slot !== null && (!Array.isArray(slot) || slot.length > 400 || !slot.every(validStructure))) return false;
    }
    if (!Array.isArray(input.raidLog) || input.raidLog.length > 20) return false;
    if (!Array.isArray(input.visited) || !Array.isArray(input.explored)) return false;
    if (!input.tribeStats || typeof input.tribeStats !== 'object' || Array.isArray(input.tribeStats)) return false;
    for (const key of ['health', 'hunger', 'hydration', 'warmth', 'stamina', 'faith', 'manna', 'campWater', 'silver', 'wood']) {
      if (!Number.isFinite(Number(input[key]))) return false;
    }
    return true;
  }

  root.MannaCore = {
    SAVE_VERSION,
    SHARE_VERSION,
    TOTAL_DAYS,
    MAP_SIZE,
    STRUCTURE_KINDS,
    encodeText,
    decodeText,
    encodeShare,
    decodeShare,
    migrateSave,
    validateSave,
  };
})(typeof window !== 'undefined' ? window : globalThis);
