import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { config } from '../js/config.js';
import { GameState } from '../js/GameState.js';
import { weatherExposure, weatherForDay } from '../js/WeatherManager.js';
import { SceneManager } from '../js/SceneManager.js';
import { PlayerManager } from '../js/PlayerManager.js';
const elements = new Map();
const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); } };
const source = readFileSync(new URL('../js/Game.js', import.meta.url), 'utf8').replace(/import [^;]+;\s*/g, '').replace('export class Game', 'class Game');
const Game = vm.runInNewContext(source + '\nGame;', { THREE, GameState, gameConfig: config, weatherExposure, weatherForDay, document, clearInterval, setInterval });
const base = () => Object.assign(Object.create(Game.prototype), {
 manaQuota: 10, input: {}, clickTarget: null, uiManager: { updateHUD() {}, showMarket() {}, setDayNightIcon() {}, showEvening() {} },
 audioManager: { play() {} }, wildernessManager: { isSabbath: false, recordWaste() {} },
 player: { position: new THREE.Vector3() }
});
test('household food is reserved before surplus enters the market', () => {
 const game = base(); GameState.world.gameState = 'playing'; GameState.session.dayManaCollected = 14;
 game.endDay(); assert.equal(GameState.session.foodReserved, 10); assert.equal(GameState.session.dayManaCollected, 4); assert.equal(GameState.world.gameState, 'market');
 game.endDay(); assert.equal(GameState.session.dayManaCollected, 4, 'market entry must not reserve twice');
});
test('bought food fills a shortage before remaining surplus spoils', () => {
 const game = base(); GameState.session.foodReserved = 6; GameState.session.dayManaCollected = 7;
 game.enterEvening(); assert.equal(GameState.session.foodReserved, 10); assert.equal(GameState.session.dayManaCollected, 3);
});
test('heat drains water faster; oasis refills it', () => {
 const game = base(); GameState.world.timeLeft = 30; GameState.player.hydration = 50; game.updateSurvival(1); const hot = GameState.player.hydration;
 GameState.world.timeLeft = 60; GameState.player.hydration = 50; game.updateSurvival(1); assert.ok(GameState.player.hydration > hot);
 game.player.position.set(-25, 0, -15); GameState.player.hydration = 50; game.updateSurvival(1); assert.equal(GameState.player.hydration, 62);
});
test('collision center overlap is resolved without NaN and respects scale', () => {
 const game = base(); const collider = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 5)); collider.scale.set(2, 1, 2); collider.updateMatrixWorld();
 game.obstacleColliders = [collider]; const player = new PlayerManager(game); player.player = new THREE.Object3D(); player.checkCollisions();
 assert.ok(Number.isFinite(player.player.position.x)); assert.ok(player.player.position.x >= 6.45);
});
test('movement covers the same distance at 30 and 60 frames per second', () => {
 function walk(frames) {
  const game = base(); game.frameScale = 60 / frames; game.input = { up: true }; game.cameraHeading = new THREE.Vector3(0, 0, -1);
  game.getDifficultySettings = () => ({ moveSpeed: .16 }); game.drainHealthFromMovement = () => {};
  const manager = new PlayerManager(game); manager.player = new THREE.Object3D(); for (let i = 0; i < frames; i++) manager.handleMovement(); return manager.player.position.z;
 }
 assert.ok(Math.abs(walk(30) - walk(60)) < 0.00001);
});
test('surface height matches both mesh triangles', () => {
 const game = base(); game.TILE_SIZE = 10; game.tileHeightGrids = { '0,0': { grid:[0,0,0,10], gridSize:2, segmentSize:10, size:10, centerX:0, centerZ:0 } };
 assert.equal(game.getSurfaceHeight(-2.5,-2.5), 0); assert.equal(game.getSurfaceHeight(2.5,2.5), 5);
});
test('world rebuild clears effects and disposes nested shared scenery once', () => {
 const game = base(); game.scene = new THREE.Scene();
 const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
 let geometryDisposals = 0, materialDisposals = 0, cleared = 0;
 geometry.addEventListener('dispose', () => geometryDisposals++); material.addEventListener('dispose', () => materialDisposals++);
 const root = new THREE.Group(); root.add(new THREE.Mesh(geometry,material)); root.add(new THREE.Mesh(geometry,material)); game.scene.add(root);
 game.scenery = [root]; game.locationSprites = []; game.obstacleColliders = [];
 game.particleManager = { clear() { cleared++; } }; game.playerManager = { dustEmitter: {} };
 game.rebuildTerrain = () => {}; game.sceneManager = { createLandscape() {} };
 game.rebuildWorld(); assert.equal(cleared,1); assert.equal(geometryDisposals,1); assert.equal(materialDisposals,1);
 assert.equal(root.parent,null); assert.equal(game.playerManager.dustEmitter,null);
});

test('cached grounding matches raycasts against rendered terrain across slopes and tile edges', () => {
 const game = base(); game.scene = new THREE.Scene(); game.TILE_SIZE = 96;
 game.tileHeightGrids = {}; game.tiles = {}; game.sandTexture = null;
 game.getTerrainHeight = (x,z) => Math.sin(x*.17) * 2 + Math.cos(z*.13) * 1.8 + z*.02;
 const sceneManager = new SceneManager(game);
 for (const [x,z] of [[0,0],[96,0],[0,96],[-96,-96]]) sceneManager.createTile(x,z);
 game.scene.updateMatrixWorld(true);
 const ray = new THREE.Raycaster();
 for (const [cx,cz] of [[0,0],[96,0],[0,96],[-96,-96]]) {
  for (const dx of [-47.99,-30.21,-12.73,0,19.41,35.37,47.99]) {
   for (const dz of [-47.99,-25.62,-9.27,0,13.52,39.83,47.99]) {
    const x=cx+dx, z=cz+dz;
    ray.set(new THREE.Vector3(x,100,z), new THREE.Vector3(0,-1,0));
    const hits = ray.intersectObjects(Object.values(game.tiles));
    assert.ok(hits.length, `No ground at ${x},${z}`);
    assert.ok(Math.abs(game.getSurfaceHeight(x,z) - hits[0].point.y) < 0.00001, `Ground mismatch at ${x},${z}`);
   }
  }
 }
});
