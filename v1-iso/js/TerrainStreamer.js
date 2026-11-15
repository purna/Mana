import * as THREE from 'three';
import { config as gameConfig } from './config.js';
import { terrainStore } from './TerrainStore.js';

const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* Deterministic value noise so terrain is identical across reloads/tiles. */
function hash2(x, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
function valueNoise(x, z, seed = 0) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
function fbm(x, z, seed = 0, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}
function mulberry32(a) {
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Wadi Rum–style terrain used when external DEM tiles are not
 * reachable. Height is in real metres and made of sand plains, sandstone
 * massifs, carved wadis, dunes and an oasis.
 */
class ProceduralWadiRum {
  constructor(cfg, world) {
    this.cfg = cfg;
    this.world = world;
    this.seed = cfg.seed ?? 1337;
    this.oasis = { x: 620, z: -410 }; // metres from region origin
    this.massifs = [
      { x: -2350, z: -1450, rx: 920, rz: 700, h: 265 },
      { x: 2680, z: -1920, rx: 1080, rz: 820, h: 315 },
      { x: -1980, z: 2340, rx: 820, rz: 1120, h: 225 },
      { x: 2140, z: 2480, rx: 980, rz: 720, h: 280 },
      { x: 320, z: -3120, rx: 720, rz: 920, h: 205 },
      { x: -520, z: 3380, rx: 1240, rz: 730, h: 250 },
      { x: 640, z: 760, rx: 165, rz: 105, h: 46 },
      { x: -980, z: 430, rx: 128, rz: 92, h: 38 },
      { x: 1350, z: -560, rx: 180, rz: 140, h: 54 },
    ];
  }

  /** 0..1 closeness to a wadi channel, in world metres. */
  wadiMaskMeters(x, z) {
    const curves = [
      { width: 70, kind: 'z', f: (v) => 0.35 * v + 240 * Math.sin(v * 0.0011) + 90 * Math.sin(v * 0.0027 + 1.1) },
      { width: 48, kind: 'x', f: (v) => -0.25 * v + 200 * Math.sin(v * 0.0014 + 0.6) },
      { width: 58, kind: 'z', f: (v) => -0.55 * v + 320 * Math.sin(v * 0.00085 + 2.0) },
      { width: 36, kind: 'z', f: (v) => 0.12 * v + 120 * Math.sin(v * 0.0031 + 4.2) - 700 },
    ];
    let mask = 0;
    for (const curve of curves) {
      if (curve.kind === 'z') {
        const base = curve.f(x);
        const eps = 20;
        const slope = (curve.f(x + eps) - base) / eps;
        const d = Math.abs(z - base) / Math.sqrt(1 + slope * slope);
        mask = Math.max(mask, Math.exp(-Math.pow(d / curve.width, 2)));
      } else {
        const base = curve.f(z);
        const eps = 20;
        const slope = (curve.f(z + eps) - base) / eps;
        const d = Math.abs(x - base) / Math.sqrt(1 + slope * slope);
        mask = Math.max(mask, Math.exp(-Math.pow(d / curve.width, 2)));
      }
    }
    return mask;
  }

  heightMetersAtWorld(xUnits, zUnits) {
    const x = xUnits * this.world.metersPerUnit;
    const z = zUnits * this.world.metersPerUnit;

    // Sand plain and dunes (metres).
    let h = 11 * fbm(x * 0.0011, z * 0.0011, this.seed, 5)
      + 4.5 * fbm(x * 0.0055, z * 0.0055, this.seed + 21, 3)
      + 5 * Math.sin(x * 0.0036 + z * 0.0021)
      + 2.5 * Math.sin(x * 0.0102 - z * 0.0077);

    // Sandstone massifs and smaller outcrops. Terraces suggest bedding planes.
    for (const m of this.massifs) {
      const d = Math.hypot((x - m.x) / m.rx, (z - m.z) / m.rz);
      const plateau = 1 - smoothstep(0.76, 1.04, d);
      if (plateau <= 0) continue;
      const terraces = 1 + 0.10 * Math.sin(h * 0.22 + d * 5.2) + 0.05 * Math.sin(d * 23);
      h += plateau * m.h * terraces;
    }

    // Carve wadis.
    const wadi = this.wadiMaskMeters(x, z);
    h -= wadi * 21;

    // Oasis basin.
    const od = Math.hypot(x - this.oasis.x, z - this.oasis.z);
    const oasis = 1 - smoothstep(35, 95, od);
    h -= oasis * 11;

    return h;
  }

  wadiMaskAtWorld(xUnits, zUnits) {
    return this.wadiMaskMeters(xUnits * this.world.metersPerUnit, zUnits * this.world.metersPerUnit);
  }

  oasisMaskAtWorld(xUnits, zUnits) {
    const x = xUnits * this.world.metersPerUnit;
    const z = zUnits * this.world.metersPerUnit;
    const d = Math.hypot(x - this.oasis.x, z - this.oasis.z);
    return 1 - smoothstep(35, 110, d);
  }
}

/**
 * Fetches Mapzen Terrarium height tiles (SRTM/NED) from AWS Open Data.
 * Terrarium: height = (R * 256 + G + B / 256) - 32768 metres.
 */
class TerrariumProvider {
  constructor(cfg, world) {
    this.cfg = cfg;
    this.world = world;
    this.zoom = cfg.terrarium?.zoom ?? 15;
    this.urlTemplate = cfg.terrarium?.urlTemplate;
    this.cache = new Map();
    this.failed = false;
    this.warned = false;
  }

  tileUrl(x, y) {
    return this.urlTemplate.replace('{z}', this.zoom).replace('{x}', x).replace('{y}', y);
  }

  loadImage(x, y) {
    const key = `${this.zoom}/${x}/${y}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const promise = new Promise((resolve, reject) => {
      if (typeof Image === 'undefined' || typeof document === 'undefined') {
        reject(new Error('no image environment'));
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('terrarium tile failed'));
      img.src = this.tileUrl(x, y);
    });
    this.cache.set(key, promise);
    return promise;
  }

  async getHeightMeters(tx, tz) {
    if (this.failed || !this.urlTemplate) throw new Error('terrarium unavailable');
    const world = this.world;
    const cfg = this.cfg;
    const U = world.tileUnits;
    const seg = world.segments;
    const gs = seg + 1;
    const z = this.zoom;
    const scale = 256 * Math.pow(2, z);

    const toPixel = (x, zz) => {
      const ll = world.worldToLonLat(x, zz);
      const sin = Math.sin((ll.lat * Math.PI) / 180);
      return {
        x: ((ll.lon + 180) / 360) * scale,
        y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
      };
    };

    const x0 = tx * U - U / 2;
    const x1 = tx * U + U / 2;
    const z0 = tz * U - U / 2;
    const z1 = tz * U + U / 2;
    const corners = [toPixel(x0, z0), toPixel(x1, z0), toPixel(x0, z1), toPixel(x1, z1)];
    const minPX = Math.min(...corners.map((p) => p.x));
    const maxPX = Math.max(...corners.map((p) => p.x));
    const minPY = Math.min(...corners.map((p) => p.y));
    const maxPY = Math.max(...corners.map((p) => p.y));
    const minTX = Math.floor(minPX / 256);
    const maxTX = Math.floor(maxPX / 256);
    const minTY = Math.floor(minPY / 256);
    const maxTY = Math.floor(maxPY / 256);

    const images = [];
    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let txx = minTX; txx <= maxTX; txx++) {
        images.push({ x: txx, y: ty, img: await this.loadImage(txx, ty) });
      }
    }

    const width = (maxTX - minTX + 1) * 256;
    const height = (maxTY - minTY + 1) * 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    for (const item of images) {
      ctx.drawImage(item.img, (item.x - minTX) * 256, (item.y - minTY) * 256);
    }
    const data = ctx.getImageData(0, 0, width, height).data;

    const grain = (px, py) => {
      const xx = clamp(px, 0, width - 1.001);
      const yy = clamp(py, 0, height - 1.001);
      const ix = Math.floor(xx);
      const iy = Math.floor(yy);
      const fx = xx - ix;
      const fy = yy - iy;
      const at = (i, j) => {
        const k = (j * width + i) * 4;
        return (data[k] * 256 + data[k + 1] + data[k + 2] / 256) - 32768;
      };
      const a = at(ix, iy);
      const b = at(Math.min(ix + 1, width - 1), iy);
      const c = at(ix, Math.min(iy + 1, height - 1));
      const d = at(Math.min(ix + 1, width - 1), Math.min(iy + 1, height - 1));
      return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    };

    const out = new Float32Array(gs * gs);
    for (let iz = 0; iz < gs; iz++) {
      for (let ix = 0; ix < gs; ix++) {
        const x = tx * U + (ix / seg - 0.5) * U;
        const zz = tz * U + (iz / seg - 0.5) * U;
        const p = toPixel(x, zz);
        out[iz * gs + ix] = grain(p.x - minTX * 256, p.y - minTY * 256) - (this.cfg.baseElevation ?? 0);
      }
    }
    return out;
  }
}

export class TerrainStreamer {
  constructor(game) {
    this.game = game;
    this.cfg = gameConfig.terrain?.real || {};
    this.active = !!this.cfg.enabled;
    this.segments = this.cfg.segments ?? 96;
    this.tileUnits = this.cfg.tileUnits ?? this.game.TILE_SIZE ?? 96;
    this.tileMeters = this.cfg.tileMeters ?? 1000;
    this.metersPerUnit = this.tileMeters / this.tileUnits;
    this.unitsPerMeter = this.tileUnits / this.tileMeters;
    this.viewRadius = this.cfg.viewRadius ?? 1;
    this.tiles = new Map();
    this.meshes = [];
    // The opening 3x3 ring contains the camp, all eight stations and their
    // scenery. Keeping it pinned means landmarks never float when their
    // terrain tile would otherwise be unloaded far from the player.
    this.pinnedTiles = new Set();
    for (let pz = -1; pz <= 1; pz++) {
      for (let px = -1; px <= 1; px++) this.pinnedTiles.add(`${px},${pz}`);
    }
    this.procedural = new ProceduralWadiRum(this.cfg, this);
    // Station seas/springs, in world units, so scatter never enters them.
    this.stationWaterZones = (gameConfig.journey.stations || [])
      .filter((station) => station.water)
      .map((station) => ({
        x: station.pos[0] + station.water.x,
        z: station.pos[1] + station.water.z,
        r: station.water.r,
      }));
    this.oasisWaterZone = {
      x: this.procedural.oasis.x * this.unitsPerMeter,
      z: this.procedural.oasis.z * this.unitsPerMeter,
      r: 9,
    };
    this.store = terrainStore;
    this.realProvider = null;
    this.loadCount = 0;
    this.disposed = false;
    this._frame = 0;
    this.initShared();
  }

  initShared() {
    const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
      color, roughness: 0.9, metalness: 0, ...opts,
    });
    this.materials = {
      trunk: mat(0x5a3f25),
      palm: mat(0x3f6b32, { side: THREE.DoubleSide }),
      acacia: mat(0x4d5f2c),
      tamarisk: mat(0x6a7d45),
      shrub: mat(0x7d7a45),
      dryShrub: mat(0x8a7440),
      sandstone: mat(0x9a5a3f),
      sandstoneDark: mat(0x6e3f2d),
      boulder: mat(0x7f6a52),
      water: new THREE.MeshStandardMaterial({
        color: 0x2f7f9a, roughness: 0.18, metalness: 0.05,
        transparent: true, opacity: 0.82,
      }),
    };
    this.geometries = {
      trunk: new THREE.CylinderGeometry(0.055, 0.09, 1.5, 5),
      palmFrond: new THREE.ConeGeometry(0.24, 1.7, 4, 1, true),
      canopy: new THREE.SphereGeometry(1, 7, 5),
      shrub: new THREE.DodecahedronGeometry(0.34, 0),
      boulder: new THREE.IcosahedronGeometry(0.7, 0),
      outcrop: new THREE.BoxGeometry(1, 1, 1),
      oasisWater: new THREE.CircleGeometry(8.5, 24),
    };
  }

  init() {
    if (!this.active) return;
    this.updateTiles(0, 0, true);
    const provider = this.cfg.provider ?? 'auto';
    if (provider === 'terrarium' || provider === 'auto') {
      this.realProvider = new TerrariumProvider(this.cfg, this);
    }
    // Cached JSON sections load instantly; otherwise fetch real DEM; otherwise
    // keep the deterministic Wadi Rum fallback and cache that.
    this._initialData = [...this.tiles.values()].map((tile) => this.loadTileData(tile));
  }

  /**
   * Await the first ring of terrain before landmarks/player are created, so
   * camps, stations and the player are grounded on the real DEM rather than
   * the procedural fallback. Caps the wait so a blocked network never hangs.
   */
  async initAsync() {
    this.init();
    if (!this._initialData || !this._initialData.length) return;
    const timeout = new Promise((resolve) => setTimeout(resolve, 6000));
    await Promise.race([Promise.allSettled(this._initialData), timeout]);
  }

  tileCoord(value) {
    return Math.floor((value + this.tileUnits / 2) / this.tileUnits);
  }

  tileKey(tx, tz) {
    return `${tx},${tz}`;
  }

  worldToLonLat(x, z) {
    const lat = this.cfg.region.lat - (z * this.metersPerUnit) / 110540;
    const lon = this.cfg.region.lon + (x * this.metersPerUnit) / (111320 * Math.cos((this.cfg.region.lat * Math.PI) / 180));
    return { lat, lon };
  }

  heightMetersAtWorld(x, z) {
    return this.procedural.heightMetersAtWorld(x, z);
  }

  /** Fallback height even before a tile has streamed in. */
  fallbackHeightUnits(x, z) {
    return this.procedural.heightMetersAtWorld(x, z) * this.unitsPerMeter;
  }

  isWaterAt(x, z) {
    for (const zone of this.stationWaterZones) {
      if (Math.hypot(x - zone.x, z - zone.z) < zone.r + 1) return true;
    }
    const o = this.oasisWaterZone;
    return !!o && Math.hypot(x - o.x, z - o.z) < o.r + 1;
  }

  getSurfaceHeight(x, z) {
    const tx = this.tileCoord(x);
    const tz = this.tileCoord(z);
    const tile = this.tiles.get(this.tileKey(tx, tz));
    if (!tile || !tile.grid) return this.fallbackHeightUnits(x, z);
    const U = this.tileUnits;
    const seg = this.segments;
    const gs = seg + 1;
    const lx = x - tx * U;
    const lz = z - tz * U;
    const fx = clamp(((lx + U / 2) / U) * seg, 0, seg - 0.0001);
    const fz = clamp(((lz + U / 2) / U) * seg, 0, seg - 0.0001);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const txF = fx - ix;
    const tzF = fz - iz;
    const at = (i, j) => tile.grid[Math.min(j, seg) * gs + Math.min(i, seg)];
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    return lerp(lerp(a, b, txF), lerp(c, d, txF), tzF);
  }

  getMeshes() {
    return [...this.tiles.values()].map((tile) => tile.mesh).filter((mesh) => mesh?.parent?.parent);
  }

  makeRecord(tile, source, meters) {
    return {
      format: 'mana-terrain',
      version: 1,
      tx: tile.tx,
      tz: tile.tz,
      segments: this.segments,
      tileMeters: this.tileMeters,
      tileUnits: this.tileUnits,
      baseElevation: this.cfg.baseElevation ?? 0,
      region: this.cfg.region?.name || '',
      source,
      heights: Array.from(meters, (v) => Math.round(v * 10) / 10),
      savedAt: new Date().toISOString(),
    };
  }

  /** Load a tile's JSON record, else real DEM, else persist the fallback. */
  async loadTileData(tile) {
    if (!tile || tile.dataRequested) return;
    tile.dataRequested = true;
    const gs = tile.gs || this.segments + 1;

    try {
      const cached = await this.store.get(tile.tx, tile.tz);
      if (cached && cached.version === 1 && cached.segments === this.segments
        && Array.isArray(cached.heights) && cached.heights.length === gs * gs) {
        const current = this.tiles.get(tile.key);
        if (current !== tile || this.disposed) return;
        this.applyHeights(tile, cached.heights, cached.source === 'terrarium');
        return;
      }
    } catch (err) {
      // A corrupt cache record must never block the stream.
      console.warn('[terrain] cached section unreadable; regenerating.', err);
    }

    if (this.realProvider) {
      try {
        const meters = await this.realProvider.getHeightMeters(tile.tx, tile.tz);
        const current = this.tiles.get(tile.key);
        if (!current || current !== tile || this.disposed) return;
        this.applyHeights(tile, meters, true);
        await this.store.put(this.makeRecord(tile, 'terrarium', meters));
        return;
      } catch (err) {
        // Keep the generated Wadi Rum terrain and stop hammering the network.
        this.realProvider = null;
        if (!this._warned) {
          this._warned = true;
          console.warn('[terrain] External DEM unavailable; using generated Wadi Rum terrain.', err?.message || err);
        }
      }
    }

    // Persist the deterministic fallback as JSON so reloads are instant.
    try {
      await this.store.put(this.makeRecord(tile, 'procedural', tile.heights));
    } catch (err) {
      console.warn('[terrain] could not persist section JSON.', err);
    }
  }

  ensureTile(tx, tz, immediate = false) {
    const key = this.tileKey(tx, tz);
    if (this.tiles.has(key)) return;
    const tile = this.createTile(tx, tz);
    this.tiles.set(key, tile);
    this.meshes.push(tile.mesh);
    this.loadTileData(tile);
  }

  updateTiles(px, pz, immediate = false) {
    if (!this.active) return;
    const tx = this.tileCoord(px);
    const tz = this.tileCoord(pz);
    const radius = this.viewRadius;
    let created = 0;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const key = this.tileKey(tx + dx, tz + dz);
        if (!this.tiles.has(key)) {
          if (!immediate && created >= 2) continue;
          this.ensureTile(tx + dx, tz + dz, immediate);
          created++;
        }
      }
    }
    const keep = radius + 1;
    for (const [key, tile] of this.tiles) {
      if (this.pinnedTiles.has(key)) continue;
      if (Math.abs(tile.tx - tx) > keep || Math.abs(tile.tz - tz) > keep) {
        this.removeTile(key, tile);
      }
    }
  }

  update(playerPos) {
    if (!this.active || !playerPos) return;
    this._frame++;
    // Check every few frames; movement is slow relative to tile size.
    if (this._frame % 3 === 0) this.updateTiles(playerPos.x, playerPos.z);
  }

  createTile(tx, tz) {
    const U = this.tileUnits;
    const seg = this.segments;
    const gs = seg + 1;
    const heights = new Float32Array(gs * gs);
    for (let iz = 0; iz < gs; iz++) {
      for (let ix = 0; ix < gs; ix++) {
        const x = tx * U + (ix / seg - 0.5) * U;
        const z = tz * U + (iz / seg - 0.5) * U;
        heights[iz * gs + ix] = this.procedural.heightMetersAtWorld(x, z);
      }
    }

    const group = new THREE.Group();
    group.position.set(tx * U, 0, tz * U);
    group.userData.isTerrainTile = true;
    const geometry = this.buildGeometry(heights, tx, tz);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      map: this.game.sandTexture || null,
    });
    material.map = null; // vertex colours are enough; avoids stretched UVs
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.isTerrain = true;
    group.add(mesh);
    this.game.scene.add(group);

    const tile = {
      tx, tz, key: this.tileKey(tx, tz), group, mesh, geometry, material,
      heights, grid: this.metersToUnits(heights), seg, gs, vegetation: null,
      ready: true, realRequested: false, isReal: false,
    };
    this.addVegetation(tile);
    if (this.game.mapManager?.discover?.(tile)) this.game.scheduleAutosave?.();
    return tile;
  }

  metersToUnits(meters) {
    const out = new Float32Array(meters.length);
    for (let i = 0; i < meters.length; i++) out[i] = meters[i] * this.unitsPerMeter;
    return out;
  }

  slopeGrid(heights, gs, seg) {
    const slope = new Float32Array(heights.length);
    const cell = this.tileMeters / seg;
    for (let iz = 0; iz < gs; iz++) {
      for (let ix = 0; ix < gs; ix++) {
        const i = iz * gs + ix;
        const left = heights[iz * gs + Math.max(0, ix - 1)];
        const right = heights[iz * gs + Math.min(seg, ix + 1)];
        const up = heights[Math.max(0, iz - 1) * gs + ix];
        const down = heights[Math.min(seg, iz + 1) * gs + ix];
        const dx = (right - left) / (2 * cell);
        const dz = (down - up) / (2 * cell);
        slope[i] = Math.hypot(dx, dz);
      }
    }
    return slope;
  }

  reliefWadi(heights, gs, seg) {
    const mask = new Float32Array(heights.length);
    for (let iz = 0; iz < gs; iz++) {
      for (let ix = 0; ix < gs; ix++) {
        const i = iz * gs + ix;
        const left = heights[iz * gs + Math.max(0, ix - 1)];
        const right = heights[iz * gs + Math.min(seg, ix + 1)];
        const up = heights[Math.max(0, iz - 1) * gs + ix];
        const down = heights[Math.min(seg, iz + 1) * gs + ix];
        const avg = (left + right + up + down) / 4;
        const below = clamp((avg - heights[i]) / 13);
        mask[i] = below;
      }
    }
    return mask;
  }

  buildGeometry(heights, tx, tz) {
    const U = this.tileUnits;
    const seg = this.segments;
    const gs = seg + 1;
    const positions = new Float32Array(gs * gs * 3);
    const colors = new Float32Array(gs * gs * 3);
    const indices = [];
    const slope = this.slopeGrid(heights, gs, seg);
    const relief = this.reliefWadi(heights, gs, seg);

    const sandLow = new THREE.Color(0xc4a66b);
    const sandHigh = new THREE.Color(0xa9834d);
    const rock = new THREE.Color(0x8f4f35);
    const rockDark = new THREE.Color(0x623628);
    const wadiColor = new THREE.Color(0x94744d);
    const oasisColor = new THREE.Color(0x5a7d3a);
    const c = new THREE.Color();

    for (let iz = 0; iz < gs; iz++) {
      for (let ix = 0; ix < gs; ix++) {
        const i = iz * gs + ix;
        const x = (ix / seg - 0.5) * U;
        const z = (iz / seg - 0.5) * U;
        const h = heights[i] * this.unitsPerMeter;
        const wx = tx * U + (ix / seg - 0.5) * U;
        const wz = tz * U + (iz / seg - 0.5) * U;
        const procWadi = this.procedural.wadiMaskAtWorld(wx, wz);
        const oasis = this.procedural.oasisMaskAtWorld(wx, wz);
        const wadi = clamp(Math.max(procWadi * 0.9, relief[i] * 1.4));
        const rocky = clamp(slope[i] * 1.4 + (h > 16 ? 0.15 : 0));
        c.copy(sandLow).lerp(sandHigh, clamp(h / 22));
        c.lerp(wadiColor, wadi * 0.7);
        c.lerp(rock, rocky * 0.85);
        c.lerp(rockDark, clamp((slope[i] - 0.8) * 0.7) * 0.6);
        c.lerp(oasisColor, oasis * 0.85);
        const tint = 0.92 + hash2(tx * gs + ix, tz * gs + iz, 7) * 0.16;
        positions[i * 3] = x;
        positions[i * 3 + 1] = h;
        positions[i * 3 + 2] = z;
        colors[i * 3] = c.r * tint;
        colors[i * 3 + 1] = c.g * tint;
        colors[i * 3 + 2] = c.b * tint;
      }
    }
    for (let iz = 0; iz < seg; iz++) {
      for (let ix = 0; ix < seg; ix++) {
        const a = iz * gs + ix;
        const b = a + 1;
        const c2 = a + gs;
        const d = c2 + 1;
        indices.push(a, c2, b, b, c2, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  applyHeights(tile, meters, isReal) {
    tile.heights = meters;
    tile.grid = this.metersToUnits(meters);
    tile.isReal = !!isReal;
    const pos = tile.geometry.attributes.position;
    const col = tile.geometry.attributes.color;
    const slope = this.slopeGrid(meters, tile.gs, tile.seg);
    const relief = this.reliefWadi(meters, tile.gs, tile.seg);
    const sandLow = new THREE.Color(0xc4a66b);
    const sandHigh = new THREE.Color(0xa9834d);
    const rock = new THREE.Color(0x8f4f35);
    const rockDark = new THREE.Color(0x623628);
    const wadiColor = new THREE.Color(0x94744d);
    const oasisColor = new THREE.Color(0x5a7d3a);
    const c = new THREE.Color();
    const U = this.tileUnits;
    for (let iz = 0; iz < tile.gs; iz++) {
      for (let ix = 0; ix < tile.gs; ix++) {
        const i = iz * tile.gs + ix;
        const h = meters[i] * this.unitsPerMeter;
        const wx = tile.tx * U + (ix / tile.seg - 0.5) * U;
        const wz = tile.tz * U + (iz / tile.seg - 0.5) * U;
        const wadi = clamp(Math.max(relief[i] * 1.5, 0));
        const oasis = isReal ? 0 : this.procedural.oasisMaskAtWorld(wx, wz);
        const rocky = clamp(slope[i] * 1.5 + (h > 16 ? 0.12 : 0));
        c.copy(sandLow).lerp(sandHigh, clamp(h / 22));
        c.lerp(wadiColor, wadi * 0.7);
        c.lerp(rock, rocky * 0.85);
        c.lerp(rockDark, clamp((slope[i] - 0.9) * 0.7) * 0.6);
        c.lerp(oasisColor, oasis * 0.8);
        const tint = 0.92 + hash2(tile.tx * tile.gs + ix, tile.tz * tile.gs + iz, 7) * 0.16;
        pos.setY(i, h);
        col.setXYZ(i, c.r * tint, c.g * tint, c.b * tint);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    tile.geometry.computeVertexNormals();
    tile.geometry.computeBoundingSphere();
    // Rebuild vegetation with the new heights/masks.
    this.removeVegetation(tile);
    this.addVegetation(tile);
    if (this.game.mapManager?.discover?.(tile)) this.game.scheduleAutosave?.();
    this.game.regroundScenery?.();
  }

  addVegetation(tile) {
    const cfg = this.cfg.vegetation || {};
    const U = this.tileUnits;
    const group = new THREE.Group();
    const rng = mulberry32((tile.tx * 73856093) ^ (tile.tz * 19349663) ^ (this.cfg.seed || 1));
    const counts = { palm: 0, acacia: 0, tamarisk: 0, shrub: 0, boulder: 0, outcrop: 0 };
    const limits = {
      palm: cfg.palms ?? 7, acacia: cfg.acacias ?? 9, tamarisk: cfg.tamarisks ?? 7,
      shrub: cfg.shrubs ?? 24, boulder: cfg.boulders ?? 16, outcrop: cfg.outcrops ?? 4,
    };
    const slopeGrid = this.slopeGrid(tile.heights, tile.gs, tile.seg);
    const reliefGrid = this.reliefWadi(tile.heights, tile.gs, tile.seg);
    const sample = (lx, lz) => {
      const gx = clamp(((lx + U / 2) / U) * tile.seg, 0, tile.seg);
      const gz = clamp(((lz + U / 2) / U) * tile.seg, 0, tile.seg);
      const ix = Math.round(gx);
      const iz = Math.round(gz);
      const idx = Math.min(tile.seg, iz) * tile.gs + Math.min(tile.seg, ix);
      const h = tile.grid[idx];
      const slope = slopeGrid[idx];
      const relief = reliefGrid[idx];
      const wx = tile.tx * U + lx;
      const wz = tile.tz * U + lz;
      const procWadi = tile.isReal ? 0 : this.procedural.wadiMaskAtWorld(wx, wz) * 0.9;
      const wadi = clamp(Math.max(relief * 1.5, procWadi));
      const oasis = tile.isReal ? 0 : this.procedural.oasisMaskAtWorld(wx, wz);
      return { h, slope, wadi, oasis, moisture: clamp(wadi * 0.9 + oasis * 1.1), rock: clamp(slope * 1.5) };
    };

    // Water at the oasis, if this tile contains it.
    const oasisX = this.procedural.oasis.x * this.unitsPerMeter;
    const oasisZ = this.procedural.oasis.z * this.unitsPerMeter;
    const lox = oasisX - tile.tx * U;
    const loz = oasisZ - tile.tz * U;
    if (!tile.isReal && Math.abs(lox) < U / 2 + 20 && Math.abs(loz) < U / 2 + 20) {
      const water = new THREE.Mesh(this.geometries.oasisWater, this.materials.water);
      water.rotation.x = -Math.PI / 2;
      water.position.set(lox, this.getLocalHeight(tile, lox, loz) + 0.12, loz);
      group.add(water);
    }

    const tries = 30 * 30;
    for (let i = 0; i < tries; i++) {
      const lx = (rng() - 0.5) * U * 0.94;
      const lz = (rng() - 0.5) * U * 0.94;
      if (this.isWaterAt(tile.tx * U + lx, tile.tz * U + lz)) continue;
      const info = sample(lx, lz);
      const roll = rng();
      let type = null;
      if (info.slope > 1.7 && roll < 0.7) type = 'outcrop';
      else if (info.rock > 0.75 && roll < 0.6) type = 'boulder';
      else if (info.oasis > 0.25 && roll < 0.55) type = 'palm';
      else if (info.moisture > 0.55 && roll < 0.45) type = 'tamarisk';
      else if (info.moisture > 0.28 && roll < 0.42) type = 'acacia';
      else if (roll < 0.42) type = 'shrub';
      else if (roll < 0.55) type = 'boulder';
      if (!type || counts[type] >= limits[type]) continue;
      if (type === 'palm' && info.oasis < 0.12 && info.wadi < 0.5) continue;
      counts[type]++;
      const obj = this.makeVegetation(type, rng, info);
      if (!obj) continue;
      obj.position.set(lx, info.h, lz);
      obj.rotation.y = rng() * Math.PI * 2;
      group.add(obj);
    }

    tile.vegetation = group;
    tile.group.add(group);
  }

  getLocalHeight(tile, lx, lz) {
    const U = this.tileUnits;
    const gx = clamp(((lx + U / 2) / U) * tile.seg, 0, tile.seg);
    const gz = clamp(((lz + U / 2) / U) * tile.seg, 0, tile.seg);
    const ix = Math.round(gx);
    const iz = Math.round(gz);
    const idx = Math.min(tile.seg, iz) * tile.gs + Math.min(tile.seg, ix);
    return tile.grid[idx];
  }

  makeVegetation(type, rng, info) {
    const g = new THREE.Group();
    if (type === 'palm') {
      const trunk = new THREE.Mesh(this.geometries.trunk, this.materials.trunk);
      trunk.scale.set(0.8, 1.8 + rng() * 0.9, 0.8);
      trunk.position.y = 1.4;
      trunk.castShadow = true;
      g.add(trunk);
      const fronds = 6 + Math.floor(rng() * 3);
      for (let i = 0; i < fronds; i++) {
        const frond = new THREE.Mesh(this.geometries.palmFrond, this.materials.palm);
        const a = (i / fronds) * Math.PI * 2 + rng() * 0.3;
        frond.position.set(Math.cos(a) * 0.35, 2.6 + rng() * 0.25, Math.sin(a) * 0.35);
        frond.rotation.set(Math.PI / 2 + 0.35, a, rng() * 0.4 - 0.2);
        frond.castShadow = true;
        g.add(frond);
      }
      return g;
    }
    if (type === 'acacia') {
      const trunk = new THREE.Mesh(this.geometries.trunk, this.materials.trunk);
      trunk.scale.set(0.8, 1.5, 0.8);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      g.add(trunk);
      const canopy = new THREE.Mesh(this.geometries.canopy, this.materials.acacia);
      canopy.scale.set(1.5 + rng() * 0.8, 0.38, 1.5 + rng() * 0.8);
      canopy.position.y = 2.15;
      canopy.castShadow = true;
      g.add(canopy);
      return g;
    }
    if (type === 'tamarisk') {
      const trunk = new THREE.Mesh(this.geometries.trunk, this.materials.trunk);
      trunk.scale.set(0.55, 1.2, 0.55);
      trunk.position.y = 0.9;
      g.add(trunk);
      for (let i = 0; i < 3; i++) {
        const bush = new THREE.Mesh(this.geometries.canopy, this.materials.tamarisk);
        bush.scale.set(0.7 + rng() * 0.5, 0.65 + rng() * 0.4, 0.7 + rng() * 0.5);
        bush.position.set((rng() - 0.5) * 0.7, 1.4 + i * 0.35, (rng() - 0.5) * 0.7);
        bush.castShadow = true;
        g.add(bush);
      }
      return g;
    }
    if (type === 'shrub') {
      for (let i = 0; i < 2; i++) {
        const bush = new THREE.Mesh(this.geometries.shrub, rng() < 0.3 ? this.materials.dryShrub : this.materials.shrub);
        bush.scale.setScalar(0.7 + rng() * 0.9);
        bush.position.set((rng() - 0.5) * 0.5, 0.18 + i * 0.12, (rng() - 0.5) * 0.5);
        bush.castShadow = true;
        g.add(bush);
      }
      return g;
    }
    if (type === 'boulder') {
      const rock = new THREE.Mesh(this.geometries.boulder, this.materials.boulder);
      rock.scale.set(0.5 + rng() * 1.1, 0.4 + rng() * 0.9, 0.5 + rng() * 1.1);
      rock.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      rock.position.y = 0.25;
      rock.castShadow = true;
      g.add(rock);
      return g;
    }
    if (type === 'outcrop') {
      const levels = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < levels; i++) {
        const layer = new THREE.Mesh(this.geometries.outcrop, i % 2 ? this.materials.sandstoneDark : this.materials.sandstone);
        const w = 1.2 + rng() * 2.4 - i * 0.18;
        layer.scale.set(w, 0.55 + rng() * 0.45, w * (0.7 + rng() * 0.5));
        layer.position.y = 0.3 + i * 0.55;
        layer.rotation.y = rng() * 0.5;
        layer.castShadow = true;
        g.add(layer);
      }
      return g;
    }
    return null;
  }

  removeVegetation(tile) {
    if (!tile.vegetation) return;
    tile.group.remove(tile.vegetation);
    tile.vegetation = null;
  }

  removeTile(key, tile) {
    if (!tile) return;
    this.tiles.delete(key);
    if (tile.group?.parent) this.game.scene.remove(tile.group);
    const index = this.meshes.indexOf(tile.mesh);
    if (index >= 0) this.meshes.splice(index, 1);
    tile.geometry?.dispose();
    tile.material?.dispose();
    // Vegetation uses shared materials/geometries, so only the group is removed.
  }

  dispose() {
    this.disposed = true;
    for (const [key, tile] of this.tiles) this.removeTile(key, tile);
    this.tiles.clear();
    this.meshes = [];
  }
}
