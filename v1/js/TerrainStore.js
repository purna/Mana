/**
 * TerrainStore
 * ------------
 * Persists 1 km terrain sections as JSON-serializable records. In the browser
 * this uses localForage (IndexedDB), so each section survives reloads and can
 * be loaded or unloaded independently of the rendered mesh. A small in-memory
 * fallback keeps the pipeline working in Node tests.
 */

const PREFIX = 'terrain:';

export class TerrainStore {
  constructor() {
    this.memory = new Map();
    this.db = null;
    if (typeof localforage !== 'undefined' && localforage && localforage.createInstance) {
      try {
        this.db = localforage.createInstance({
          name: 'MannaTerrain',
          storeName: 'tiles',
          description: 'Persistent 1 km terrain section records for MANNA',
        });
      } catch (err) {
        console.warn('[terrain-store] IndexedDB unavailable; using memory cache.', err);
      }
    }
  }

  key(tx, tz) {
    return `${PREFIX}${tx}:${tz}`;
  }

  async get(tx, tz) {
    const key = this.key(tx, tz);
    if (this.db) {
      try {
        const record = await this.db.getItem(key);
        if (record) return record;
      } catch (err) {
        console.warn('[terrain-store] read failed; using memory cache.', err);
      }
    }
    return this.memory.get(key) || null;
  }

  async put(record) {
    if (!record || record.tx == null || record.tz == null) return;
    const key = this.key(record.tx, record.tz);
    this.memory.set(key, record);
    if (this.db) {
      try {
        await this.db.setItem(key, record);
      } catch (err) {
        console.warn('[terrain-store] write failed; record kept in memory.', err);
      }
    }
  }

  async getAll() {
    const out = [];
    const seen = new Set();
    if (this.db) {
      try {
        await this.db.iterate((value, key) => {
          if (value && typeof value.tx === 'number') {
            out.push(value);
            seen.add(key);
          }
        });
      } catch (err) {
        console.warn('[terrain-store] enumerate failed.', err);
      }
    }
    for (const [key, value] of this.memory) {
      if (!seen.has(key)) out.push(value);
    }
    return out;
  }

  /** Export every cached section as a standalone JSON document. */
  async exportJSON() {
    const tiles = await this.getAll();
    return JSON.stringify({
      format: 'mana-terrain',
      version: 1,
      exportedAt: new Date().toISOString(),
      tileCount: tiles.length,
      tiles,
    }, null, 2);
  }

  async clear() {
    this.memory.clear();
    if (this.db) {
      try { await this.db.clear(); } catch (err) { console.warn('[terrain-store] clear failed.', err); }
    }
  }
}

export const terrainStore = new TerrainStore();
