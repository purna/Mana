import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.window = { THREE };
const { TerrainStreamer } = await import('../js/TerrainStreamer.js');
const { config } = await import('../js/config.js');

function makeGame() {
  return {
    scene: new THREE.Scene(),
    TILE_SIZE: 96,
    sandTexture: null,
    mobileVisible: false,
  };
}

test('streams a 3x3 grid of 1 km terrain sections', () => {
  const game = makeGame();
  const terrain = new TerrainStreamer(game);
  terrain.init();
  assert.equal(terrain.active, true);
  assert.equal(terrain.tileUnits, 96);
  assert.equal(terrain.tileMeters, 1000);
  assert.equal(terrain.tiles.size, 9);
  assert.equal(terrain.getMeshes().length, 9);
  assert.equal(game.scene.children.length, 9);
  terrain.dispose();
  assert.equal(terrain.tiles.size, 0);
  assert.equal(game.scene.children.length, 0);
});

test('terrain height is finite, deterministic and varied', () => {
  const game = makeGame();
  const terrain = new TerrainStreamer(game);
  terrain.init();
  const a = terrain.getSurfaceHeight(0, 0);
  const b = terrain.getSurfaceHeight(0, 0);
  assert.ok(Number.isFinite(a));
  assert.equal(a, b);

  let min = Infinity;
  let max = -Infinity;
  for (let x = -40; x <= 40; x += 5) {
    for (let z = -40; z <= 40; z += 5) {
      const y = terrain.getSurfaceHeight(x, z);
      assert.ok(Number.isFinite(y), `height at ${x},${z}`);
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  }
  assert.ok(max - min > 1, 'terrain has relief');
  assert.ok(max < 80, 'terrain stays within a sane game-unit range');
  terrain.dispose();
});

test('the Wadi Rum source has wadis, massifs and vegetation', () => {
  const game = makeGame();
  const terrain = new TerrainStreamer(game);
  terrain.init();
  const proc = terrain.procedural;

  // A point on the main wadi should be a strong channel.
  const channel = proc.wadiMaskMeters(0, 240 * Math.sin(0) + 90 * Math.sin(1.1));
  assert.ok(channel > 0.8, `channel mask ${channel}`);

  // A massif should be higher than the nearby plain.
  const massif = proc.heightMetersAtWorld(-2350 / terrain.metersPerUnit, -1450 / terrain.metersPerUnit);
  const plain = proc.heightMetersAtWorld(100, 100);
  assert.ok(massif > plain + 80, `massif ${massif} vs plain ${plain}`);

  const tile = terrain.tiles.get('0,0');
  assert.ok(tile.vegetation);
  assert.ok(tile.vegetation.children.length > 0, 'tile has plants/rocks');

  // Check every height is finite.
  for (const v of tile.grid) assert.ok(Number.isFinite(v));
  terrain.dispose();
});

test('the pilot region maps to the Wadi Rum area', () => {
  const game = makeGame();
  const terrain = new TerrainStreamer(game);
  const ll = terrain.worldToLonLat(0, 0);
  assert.ok(Math.abs(ll.lat - config.terrain.real.region.lat) < 1e-9);
  assert.ok(Math.abs(ll.lon - config.terrain.real.region.lon) < 1e-9);
  // 10 units ≈ 104 m east/south.
  const east = terrain.worldToLonLat(10, 0);
  assert.ok(east.lon > ll.lon);
  const south = terrain.worldToLonLat(0, 10);
  assert.ok(south.lat < ll.lat);
});

test('streaming loads new sections as the player walks', () => {
  const game = makeGame();
  const terrain = new TerrainStreamer(game);
  terrain.init();
  const before = terrain.tiles.size;
  for (let i = 0; i < 12; i++) terrain.update({ x: 300, z: 300 });
  // The streamer follows the player's new tile and keeps the view filled.
  assert.ok(terrain.tiles.has('3,3'));
  assert.ok(terrain.tiles.size >= before);
  assert.ok(Number.isFinite(terrain.getSurfaceHeight(300, 300)));
  terrain.dispose();
});


test('sampled streamed heights match the rendered terrain mesh', () => {
  const game = makeGame();
  const terrain = new TerrainStreamer(game);
  terrain.init();
  const tile = terrain.tiles.get('0,0');
  assert.ok(tile);
  game.scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const [x, z] of [[0, 0], [12, -18], [-25, 30], [40, 40]]) {
    ray.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObject(tile.mesh, false);
    assert.ok(hits.length, `mesh hit at ${x},${z}`);
    const sampled = terrain.getSurfaceHeight(x, z);
    // Bilinear sampling should match the rendered triangles within a small
    // interpolation tolerance.
    assert.ok(Math.abs(sampled - hits[0].point.y) < 0.6,
      `height mismatch at ${x},${z}: sampled ${sampled}, mesh ${hits[0].point.y}`);
  }
  terrain.dispose();
});


test('the camp and station terrain ring stays pinned when the player travels far', () => {
  const game = makeGame();
  const terrain = new TerrainStreamer(game);
  terrain.init();
  assert.ok(terrain.tiles.has('0,0'));
  assert.ok(terrain.tiles.has('-1,1'));
  for (let i = 0; i < 20; i++) terrain.update({ x: 1200, z: 900 });
  // Landmark-bearing sections remain loaded even though the player is far away.
  assert.ok(terrain.tiles.has('0,0'));
  assert.ok(terrain.tiles.has('-1,1'));
  assert.ok(terrain.tiles.has('1,1'));
  terrain.dispose();
});
