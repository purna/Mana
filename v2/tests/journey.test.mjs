import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.window = { THREE, innerWidth: 1200, innerHeight: 800 };

const { JourneyManager } = await import('../js/JourneyManager.js');
const { PillarManager } = await import('../js/PillarManager.js');
const { GameState } = await import('../js/GameState.js');
const { config } = await import('../js/config.js');

function makeGame() {
  GameState.world.gameState = 'playing';
  GameState.world.paused = false;
  const calls = { victory: 0, stations: [], targets: [] };
  const game = {
    player: new THREE.Object3D(),
    cameraHeading: new THREE.Vector3(0, 0, -1),
    getSurfaceHeight: () => 0,
    manaQuota: 10,
    wildernessManager: { isSabbath: false },
    audioManager: { play() {} },
    saveManager: { saveGame() {} },
    uiManager: {
      updateHUD() {},
      showStation(j, station) { calls.stations.push(station.id); },
      hideStation() {},
      showNarrative() {},
      showDayMessage() {},
      showGameUI() {},
    },
    pillarManager: { setTarget(target) { calls.targets.push(target); } },
    victory() { calls.victory++; },
  };
  return { game, calls };
}

test('journey starts at the Red Sea Shore and guides the player', () => {
  const { game } = makeGame();
  GameState.world.day = 1;
  const j = new JourneyManager(game);
  j.reset();
  assert.equal(j.station.id, 'shore');
  assert.equal(j.totalYears, 40);
  const g = j.getGuidance();
  assert.ok(Number.isFinite(g.distance));
  assert.ok(Number.isFinite(g.relative));
  assert.match(j.objectiveText(), /Red Sea Shore/);
});

test('reaching a station grants its blessing, pauses the day, and moves the pillar on', () => {
  const { game, calls } = makeGame();
  GameState.world.day = 3;
  GameState.world.paused = false;
  GameState.player.health = 50;
  GameState.player.faith = 40;
  const j = new JourneyManager(game);
  j.reset();
  const first = j.station;
  game.player.position.set(first.pos[0], 0, first.pos[1]);
  j.update(0.016);
  assert.equal(j.state.awaitingAdvance, true);
  assert.equal(GameState.world.paused, true);
  assert.equal(calls.stations[0], first.id);
  assert.ok(GameState.player.health > 50);
  assert.ok(GameState.player.faith > 40);

  j.advance();
  assert.equal(j.state.awaitingAdvance, false);
  assert.equal(GameState.world.paused, false);
  assert.ok(j.state.completed.includes(first.id));
  assert.equal(j.state.stationIndex, 1);
  assert.equal(calls.targets.length, 1);
});

test('completing every station wins the journey', () => {
  const { game, calls } = makeGame();
  GameState.world.day = 20;
  const j = new JourneyManager(game);
  j.reset();
  for (let i = 0; i < j.stations.length; i++) {
    const station = j.station;
    game.player.position.set(station.pos[0], 0, station.pos[1]);
    j.update(0.016);
    j.advance();
  }
  assert.equal(calls.victory, 1);
  assert.equal(j.state.completed.length, j.stations.length);
  assert.equal(j.isComplete, true);
});

test('the Pillar of Cloud becomes fire at night and crosses to a new target', () => {
  const scene = new THREE.Scene();
  const game = { scene, player: new THREE.Object3D() };
  const pillar = new PillarManager(game);
  pillar.setTarget({ x: 20, y: 0, z: -10 }, true);
  assert.equal(pillar.group.visible, true);
  assert.ok(Math.abs(pillar.group.position.x - 20) < 0.01);
  pillar.update(0.016, 1);
  assert.equal(pillar.cloud.visible, true);
  assert.equal(pillar.fire.visible, false);
  pillar.update(0.016, 0);
  assert.equal(pillar.fire.visible, true);
  pillar.setTarget({ x: -40, y: 0, z: 30 });
  for (let i = 0; i < 200; i++) pillar.update(0.05, 0.2);
  assert.ok(pillar.group.position.x < 0, 'pillar glides toward the new target');
});

test('survival tuning keeps one day survivable with food and water', () => {
  const { hungerDrain, hungerMoveDrain, eatHunger, hungerPerDay } = {
    hungerDrain: config.survival.hungerDrain,
    hungerMoveDrain: config.survival.hungerMoveDrain,
    eatHunger: config.survival.eatHunger,
    hungerPerDay: (config.survival.hungerDrain + config.survival.hungerMoveDrain) * config.game.dayLength,
  };
  assert.ok(hungerPerDay > 0 && hungerPerDay < 60, `daily hunger drain ${hungerPerDay}`);
  assert.ok(eatHunger > 10, 'a meal meaningfully restores hunger');
  assert.ok(hungerPerDay / eatHunger < 4, 'a few meals cover the day');
  assert.ok(hungerDrain + hungerMoveDrain > hungerDrain, 'walking burns more than resting');
});
