import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

globalThis.window = { THREE };

const coreSource = readFileSync(new URL('../js/iso-core.js', import.meta.url), 'utf8');
const sandbox = { btoa, atob, structuredClone, Buffer, console };
vm.runInNewContext(coreSource, sandbox);
const Core = sandbox.MannaCore;

const { TerrainStreamer } = await import('../js/TerrainStreamer.js');

function makeGame() {
  return {
    scene: new THREE.Scene(),
    TILE_SIZE: 96,
    sandTexture: null,
    mobileVisible: false,
  };
}

test('terrain heights are identical across two fresh stream sessions', () => {
  const a = new TerrainStreamer(makeGame());
  const b = new TerrainStreamer(makeGame());
  a.init(); b.init();
  const samples = [];
  for (let x = -60; x <= 60; x += 17) {
    for (let z = -60; z <= 60; z += 19) samples.push([x, z]);
  }
  for (const [x, z] of samples) {
    const ha = a.getSurfaceHeight(x, z);
    const hb = b.getSurfaceHeight(x, z);
    assert.ok(Number.isFinite(ha), `height at ${x},${z}`);
    assert.equal(ha, hb, `height mismatch at ${x},${z}`);
  }
  a.dispose(); b.dispose();
});

test('a serialised journey re-loads into the same playable state', () => {
  const migrated = Core.migrateSave({
    v: 3,
    day: 97,
    hour: 13.5,
    stationIndex: 4,
    structures: [{ kind: 'tower', x: 21, y: 20 }, { kind: 'tent', x: 23, y: 24.5 }],
    blueprints: [[{ kind: 'sentry', x: 19, y: 26 }], null, null],
    raidLog: [{ day: 42, at: 1, label: 'Judah', success: true }],
    visited: ['shore', 'marah'],
    explored: ['24,24', '23,25'],
    tribeStats: { Judah: { population: 74600, livestock: 184000, unrest: 22, tribeRebellions: 1 } },
    health: 82, hunger: 66, hydration: 71, warmth: 55, stamina: 44, faith: 63,
    manna: 12, campWater: 41, silver: 24, wood: 9,
  });
  assert.ok(Core.validateSave(migrated), 'migrated journey validates');

  // Normalise to this realm so deepEqual compares values, not vm prototypes.
  const journey = JSON.parse(JSON.stringify(migrated));
  delete journey._sourceVersion; // diagnostic marker, not game state
  const roundTrip = JSON.parse(JSON.stringify(journey));
  assert.deepEqual(roundTrip, journey, 'JSON round-trip keeps every field');

  const reloaded = JSON.parse(JSON.stringify(Core.migrateSave(roundTrip)));
  assert.ok(Core.validateSave(reloaded), 'reloaded journey validates');
  delete reloaded._sourceVersion;
  assert.deepEqual(reloaded, journey, 'reload preserves every game field');
});

test('raid rolls are deterministic for the same seed stream', () => {
  const first = [];
  let seed = 1;
  for (let i = 0; i < 12; i++) {
    const roll = Core.rollRaid(seed, 0.5);
    seed = roll.seed;
    first.push(roll.success);
  }
  let seed2 = 1;
  for (let i = 0; i < 12; i++) {
    const roll = Core.rollRaid(seed2, 0.5);
    seed2 = roll.seed;
    assert.equal(roll.success, first[i], `roll ${i} replays identically`);
  }
});

test('raid rolls follow the LCG stream and respect the chance bounds', () => {
  // The first value of the classic 1664525/1013904223 stream from seed 1.
  assert.equal(Core.nextRaidSeed(1), (1 * 1664525 + 1013904223) >>> 0);
  assert.equal(Core.rollRaid(1, 1).success, true, 'chance 1 always holds');
  assert.equal(Core.rollRaid(1, 0).success, false, 'chance 0 never holds');
  assert.equal(Core.rollRaid('bad', 0.5).seed, Core.rollRaid(1, 0.5).seed, 'non-numeric seed falls back to 1');
  let wins = 0;
  let seed = 7;
  for (let i = 0; i < 4000; i++) {
    const roll = Core.rollRaid(seed, 0.7);
    seed = roll.seed;
    if (roll.success) wins++;
  }
  assert.ok(wins > 2600 && wins < 3400, `success rate near 70% (got ${(wins/4000*100).toFixed(1)}%)`);
});
