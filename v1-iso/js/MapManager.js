import { GameState, createMapState } from './GameState.js';
import { config as gameConfig } from './config.js';

const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));

/**
 * MapManager
 * ----------
 * Records the 1 km terrain sections the player has actually entered and draws
 * them as a slowly-revealed wilderness map. Records are small JSON summaries
 * (not raw meshes), so they persist cheaply in the save file.
 */
export class MapManager {
  constructor(game) {
    this.game = game;
    this.baseTiles = new Map();
    this._redrawQueued = false;
    this.view = 13;
    this.centerTx = 0;
    this.centerTz = 0;
    this._cell = 0;
    this._left = 0;
    this._top = 0;
    if (!GameState.map) GameState.map = createMapState();
  }

  reset() {
    GameState.map = createMapState();
  }

  openAtPlayer() {
    const U = this.game.terrainStreamer?.tileUnits || 96;
    const p = this.game.player?.position || { x: 0, z: 0 };
    this.centerTx = Math.floor((p.x + U / 2) / U);
    this.centerTz = Math.floor((p.z + U / 2) / U);
    this.view = 13;
  }

  recenterPlayer() {
    const view = this.view;
    this.openAtPlayer();
    this.view = view;
  }

  zoomBy(delta) {
    let next = this.view + delta * 2;
    next = Math.max(5, Math.min(31, next));
    if (next % 2 === 0) next += 1;
    this.view = Math.min(31, next);
  }

  panPixels(dx, dy) {
    if (!this._cell) return;
    this.centerTx -= dx / this._cell;
    this.centerTz -= dy / this._cell;
  }

  hydrate() {
    if (!GameState.map) GameState.map = createMapState();
    if (!GameState.map.tiles || typeof GameState.map.tiles !== 'object') GameState.map.tiles = {};
    GameState.map.exploredCount = Object.keys(GameState.map.tiles).length;
    return GameState.map;
  }

  /** Record a streamed section. Real DEM arrivals update the existing record. */
  discover(tile) {
    if (!tile) return false;
    this.hydrate();
    const key = `${tile.tx},${tile.tz}`;
    const existing = GameState.map.tiles[key];
    const heights = tile.heights;
    if (!heights || !heights.length) return false;

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    const gs = tile.gs || this.game.terrainStreamer?.segments + 1 || 97;
    for (let i = 0; i < heights.length; i++) {
      const h = heights[i];
      min = Math.min(min, h);
      max = Math.max(max, h);
      sum += h;
    }
    // 4x4 relief thumbnail for the map.
    const thumb = [];
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const ix = Math.min(gs - 1, Math.round(((tx + 0.5) / 4) * (gs - 1)));
        const iz = Math.min(gs - 1, Math.round(((ty + 0.5) / 4) * (gs - 1)));
        thumb.push(Math.round(heights[iz * gs + ix] * 10) / 10);
      }
    }
    const record = {
      tx: tile.tx,
      tz: tile.tz,
      source: tile.isReal ? 'terrarium' : 'procedural',
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round((sum / heights.length) * 10) / 10,
      thumb,
      at: Date.now(),
    };
    if (existing) {
      Object.assign(existing, record, { visits: (existing.visits || 1) + 1 });
    } else {
      GameState.map.tiles[key] = { ...record, visits: 1 };
    }
    GameState.map.exploredCount = Object.keys(GameState.map.tiles).length;
    GameState.map.lastTile = key;
    return !existing;
  }

  getExploredCount() {
    return Object.keys(GameState.map?.tiles || {}).length;
  }

  /** Draw the fog-of-war map onto a canvas. */
  draw(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.hydrate();

    const W = canvas.width;
    const H = canvas.height;
    const player = this.game.player?.position || { x: 0, z: 0 };
    const U = this.game.terrainStreamer?.tileUnits || 96;
    const centerTx = Math.round(this.centerTx);
    const centerTz = Math.round(this.centerTz);
    const view = this.view;
    const cell = Math.floor(Math.min(W / view, (H - 34) / view));
    const gridW = cell * view;
    const gridH = cell * view;
    const left = Math.floor((W - gridW) / 2);
    const top = 26;
    this._cell = cell;
    this._left = left;
    this._top = top;
    this._startTx = centerTx - Math.floor(view / 2);
    this._startTz = centerTz - Math.floor(view / 2);

    // Parchment-dark map ground.
    const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, '#2b2114');
    bg.addColorStop(1, '#120d07');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const startTx = this._startTx;
    const startTz = this._startTz;

    // Fallback relief colours, visible until real map tiles load (or forever
    // if the map API is unavailable).
    for (let iz = 0; iz < view; iz++) {
      for (let ix = 0; ix < view; ix++) {
        const tx = startTx + ix;
        const tz = startTz + iz;
        const record = GameState.map.tiles[`${tx},${tz}`];
        if (!record) continue;
        const x = left + ix * cell;
        const y = top + iz * cell;
        ctx.fillStyle = this.terrainColor(record);
        ctx.fillRect(x, y, cell, cell);
        if (record.thumb && record.thumb.length === 16) {
          const sub = cell / 4;
          for (let sy = 0; sy < 4; sy++) {
            for (let sx = 0; sx < 4; sx++) {
              const v = record.thumb[sy * 4 + sx];
              const shade = clamp((v - record.min) / Math.max(1, record.max - record.min));
              ctx.fillStyle = `rgba(255, 236, 190, ${0.04 + shade * 0.12})`;
              ctx.fillRect(x + sx * sub, y + sy * sub, sub + 0.4, sub + 0.4);
            }
          }
        }
      }
    }

    // Real satellite basemap (Esri World Imagery) under the fog.
    this.drawBaseMap(ctx, left, top, gridW, gridH, centerTx, centerTz, U, cell);

    // Fog of war: unknown sections stay dark; explored sections get a subtle
    // gold edge so the real imagery reads clearly.
    for (let iz = 0; iz < view; iz++) {
      for (let ix = 0; ix < view; ix++) {
        const tx = startTx + ix;
        const tz = startTz + iz;
        const x = left + ix * cell;
        const y = top + iz * cell;
        const record = GameState.map.tiles[`${tx},${tz}`];
        if (!record) {
          ctx.fillStyle = 'rgba(9, 7, 4, 0.90)';
          ctx.fillRect(x, y, cell, cell);
          ctx.fillStyle = 'rgba(224, 173, 79, 0.08)';
          ctx.fillRect(x + cell / 2 - 1, y + cell / 2 - 1, 2, 2);
          ctx.strokeStyle = 'rgba(224, 173, 79, 0.08)';
        } else {
          ctx.fillStyle = 'rgba(242, 204, 107, 0.035)';
          ctx.fillRect(x, y, cell, cell);
          ctx.strokeStyle = 'rgba(224, 173, 79, 0.28)';
        }
        ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      }
    }

    // Pillar / next station marker.
    const target = this.game.journeyManager?.getTarget?.();
    if (target) {
      const ttx = Math.floor((target.x + U / 2) / U);
      const ttz = Math.floor((target.z + U / 2) / U);
      const gx = left + (ttx - startTx + 0.5) * cell;
      const gy = top + (ttz - startTz + 0.5) * cell;
      if (gx > left && gx < left + gridW && gy > top && gy < top + gridH) {
        ctx.beginPath();
        ctx.arc(gx, gy, Math.max(4, cell * 0.16), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(242, 204, 107, 0.95)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gx, gy, Math.max(7, cell * 0.27), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(242, 204, 107, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Camp marker (the original camp at world 20,-20).
    const campTx = Math.floor((20 + U / 2) / U);
    const campTz = Math.floor((-20 + U / 2) / U);
    const cx = left + (campTx - startTx + 0.5) * cell;
    const cy = top + (campTz - startTz + 0.5) * cell;
    if (cx > left && cx < left + gridW && cy > top && cy < top + gridH) {
      ctx.fillStyle = 'rgba(143, 191, 95, 0.95)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - cell * 0.20);
      ctx.lineTo(cx + cell * 0.18, cy + cell * 0.15);
      ctx.lineTo(cx - cell * 0.18, cy + cell * 0.15);
      ctx.closePath();
      ctx.fill();
    }

    // Player arrow at the player's section, which may be off-centre after panning.
    const playerTx = Math.floor((player.x + U / 2) / U);
    const playerTz = Math.floor((player.z + U / 2) / U);
    const px = left + (playerTx - startTx + 0.5) * cell;
    const py = top + (playerTz - startTz + 0.5) * cell;
    const playerVisible = px > left && px < left + gridW && py > top && py < top + gridH;
    const heading = this.game.cameraHeading || { x: 0, z: -1 };
    // In the isometric edition the camera heading is fixed; the arrow should show
    // which way Moses is actually facing, so prefer the player model's rotation.
    const rotY = this.game.player?.rotation?.y;
    const hx = Number.isFinite(rotY) ? Math.sin(rotY) : heading.x;
    const hz = Number.isFinite(rotY) ? Math.cos(rotY) : -heading.z;
    const angle = Math.atan2(hx, hz);
    if (playerVisible) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -cell * 0.32);
    ctx.lineTo(cell * 0.22, cell * 0.22);
    ctx.lineTo(0, cell * 0.10);
    ctx.lineTo(-cell * 0.22, cell * 0.22);
    ctx.closePath();
    ctx.fillStyle = '#fff2cb';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    }

    // North marker and scale.
    ctx.fillStyle = 'rgba(255, 242, 203, 0.9)';
    ctx.font = '600 13px Cinzel, serif';
    ctx.textAlign = 'right';
    ctx.fillText('N', W - 18, 22);
    ctx.strokeStyle = 'rgba(255, 242, 203, 0.6)';
    ctx.beginPath();
    ctx.moveTo(W - 24, 26);
    ctx.lineTo(W - 24, 44);
    ctx.lineTo(W - 28, 38);
    ctx.moveTo(W - 24, 44);
    ctx.lineTo(W - 20, 38);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '12px Cinzel, serif';
    ctx.fillStyle = 'rgba(255, 242, 203, 0.7)';
    ctx.fillText('1 square = 1 km', 14, H - 12);
    ctx.textAlign = 'right';
    ctx.fillText(`Explored ${this.getExploredCount()} sections`, W - 14, H - 12);
  }

  /** Load one raster basemap tile; failed tiles simply leave the fallback map. */
  getBaseTile(z, tx, ty) {
    const key = `${z}/${tx}/${ty}`;
    if (this.baseTiles.has(key)) return this.baseTiles.get(key);
    const cfg = gameConfig.map;
    const rec = { ready: false, failed: false, img: null };
    if (!cfg?.enabled || !cfg.urlTemplate || typeof Image === 'undefined') {
      rec.failed = true;
      this.baseTiles.set(key, rec);
      return rec;
    }
    const img = new Image();
    rec.img = img;
    img.onload = () => {
      rec.ready = true;
      this.redrawIfOpen();
    };
    img.onerror = () => {
      rec.failed = true;
      this.redrawIfOpen();
    };
    img.src = cfg.urlTemplate
      .replace('{z}', z)
      .replace('{x}', tx)
      .replace('{y}', ty)
      .replace('{s}', 'a');
    this.baseTiles.set(key, rec);
    return rec;
  }

  redrawIfOpen() {
    if (this._redrawQueued) return;
    this._redrawQueued = true;
    requestAnimationFrame(() => {
      this._redrawQueued = false;
      const modal = document.getElementById('mapModal');
      if (modal?.classList.contains('active')) this.game.uiManager?.updateMap?.(this.game);
    });
  }

  /** Draw real satellite tiles clipped to the explored map window. */
  drawBaseMap(ctx, left, top, gridW, gridH, centerTx, centerTz, U, cell) {
    const cfg = gameConfig.map;
    const terrain = this.game.terrainStreamer;
    if (!cfg?.enabled || !terrain?.worldToLonLat) return;
    const z = cfg.zoom ?? 13;
    const worldSize = 256 * Math.pow(2, z);
    // Centre the imagery on the centre of the current 1 km section.
    const ll = terrain.worldToLonLat(centerTx * U, centerTz * U);
    const sin = Math.sin((ll.lat * Math.PI) / 180);
    const centerPX = ((ll.lon + 180) / 360) * worldSize;
    const centerPY = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize;
    // Mercator metres per pixel at this latitude/zoom.
    const mpp = (156543.03392 * Math.cos((ll.lat * Math.PI) / 180)) / Math.pow(2, z);
    // One explored cell represents 1 km.
    const scale = (cell / 1000) * mpp;
    const centerScreenX = left + gridW / 2;
    const centerScreenY = top + gridH / 2;

    const minPX = centerPX + (left - centerScreenX) / scale;
    const maxPX = centerPX + (left + gridW - centerScreenX) / scale;
    const minPY = centerPY + (top - centerScreenY) / scale;
    const maxPY = centerPY + (top + gridH - centerScreenY) / scale;
    const minTX = Math.floor(minPX / 256) - 1;
    const maxTX = Math.floor(maxPX / 256) + 1;
    const minTY = Math.floor(minPY / 256) - 1;
    const maxTY = Math.floor(maxPY / 256) + 1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, gridW, gridH);
    ctx.clip();
    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        const rec = this.getBaseTile(z, tx, ty);
        if (!rec.ready || !rec.img) continue;
        const sx = centerScreenX + (tx * 256 - centerPX) * scale;
        const sy = centerScreenY + (ty * 256 - centerPY) * scale;
        const size = 256 * scale + 0.7;
        try {
          ctx.drawImage(rec.img, sx, sy, size, size);
        } catch (err) {
          rec.failed = true;
        }
      }
    }
    // Warm the imagery slightly so it belongs to the parchment UI.
    ctx.fillStyle = 'rgba(48, 30, 12, 0.10)';
    ctx.fillRect(left, top, gridW, gridH);
    ctx.restore();
  }

  terrainColor(record) {
    // t = 0 low sand, 0.55 high sand, 1 sandstone massif.
    const t = clamp((record.avg + 40) / 160);
    const low = [150, 120, 78];
    const mid = [196, 166, 107];
    const high = [143, 79, 53];
    let c;
    if (t < 0.55) {
      c = low.map((v, i) => v + (mid[i] - v) * (t / 0.55));
    } else {
      c = mid.map((v, i) => v + (high[i] - v) * ((t - 0.55) / 0.45));
    }
    return `rgb(${c.map((v) => Math.round(v)).join(',')})`;
  }
}
