import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.window = { THREE };
const { MapManager } = await import('../js/MapManager.js');
const { GameState, createMapState } = await import('../js/GameState.js');
const { TerrainStore } = await import('../js/TerrainStore.js');

function fakeGame() {
  return {
    player: new THREE.Object3D(),
    cameraHeading: new THREE.Vector3(0, 0, -1),
    terrainStreamer: { segments: 96, tileUnits: 96 },
    journeyManager: { getTarget: () => ({ x: 96, z: -96 }) },
  };
}

function fakeTile(tx, tz, isReal = false) {
  const gs = 97;
  const heights = new Float32Array(gs * gs);
  for (let i = 0; i < heights.length; i++) heights[i] = (i % 40) + tx * 2 + tz;
  return { tx, tz, gs, heights, isReal };
}

test('explored sections accumulate into a saved map', () => {
  GameState.map = createMapState();
  const map = new MapManager(fakeGame());
  assert.equal(map.getExploredCount(), 0);
  assert.equal(map.discover(fakeTile(0, 0)), true);
  assert.equal(map.discover(fakeTile(1, 0)), true);
  assert.equal(map.getExploredCount(), 2);
  const record = GameState.map.tiles['0,0'];
  assert.ok(record);
  assert.equal(record.thumb.length, 16);
  assert.ok(record.max > record.min);
  assert.equal(record.source, 'procedural');
  assert.equal(GameState.map.lastTile, '1,0');
});

test('real DEM updates an explored section without adding a new tile', () => {
  GameState.map = createMapState();
  const map = new MapManager(fakeGame());
  const tile = fakeTile(2, 3);
  map.discover(tile);
  tile.isReal = true;
  map.discover(tile);
  assert.equal(map.getExploredCount(), 1);
  assert.equal(GameState.map.tiles['2,3'].source, 'terrarium');
  assert.equal(GameState.map.tiles['2,3'].visits, 2);
});

test('map state resets for a new journey', () => {
  GameState.map = createMapState();
  const map = new MapManager(fakeGame());
  map.discover(fakeTile(0, 0));
  map.reset();
  assert.equal(map.getExploredCount(), 0);
  assert.equal(GameState.map.exploredCount, 0);
});

test('terrain sections serialize to JSON and load back', async () => {
  const store = new TerrainStore();
  await store.clear();
  const record = {
    format: 'mana-terrain', version: 1, tx: 4, tz: -2,
    segments: 96, tileMeters: 1000, tileUnits: 96,
    source: 'procedural', heights: [1, 2, 3], savedAt: new Date().toISOString(),
  };
  await store.put(record);
  const loaded = await store.get(4, -2);
  assert.equal(loaded.heights.length, 3);
  assert.equal(loaded.tx, 4);
  const json = await store.exportJSON();
  const parsed = JSON.parse(json);
  assert.equal(parsed.format, 'mana-terrain');
  assert.ok(parsed.tileCount >= 1);
  await store.clear();
  assert.equal(await store.get(4, -2), null);
});
