import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/iso-core.js', import.meta.url), 'utf8');
const sandbox = { btoa, atob, structuredClone, Buffer, console };
vm.runInNewContext(source, sandbox);
const Core = sandbox.MannaCore;

test('share codes round-trip seed, day, station and camp layout', () => {
  const code = Core.encodeShare({
    seed: 20261115,
    day: 42,
    station: 3,
    layout: [
      { kind: 'tent', x: 23, y: 24 },
      { kind: 'tower', x: 26, y: 22 },
      { kind: 'wall', x: 1, y: 1 },
    ],
    blueprints: [null, [{ kind: 'sentry', x: 20, y: 20 }], null],
  });
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const decoded = Core.decodeShare(code);
  assert.equal(decoded.seed, 20261115);
  assert.equal(decoded.day, 42);
  assert.equal(decoded.station, 3);
  assert.equal(JSON.stringify(decoded.layout), JSON.stringify([
    { kind: 'tent', x: 23, y: 24 },
    { kind: 'tower', x: 26, y: 22 },
  ]));
  assert.equal(JSON.stringify(decoded.blueprints[1]), JSON.stringify([{ kind: 'sentry', x: 20, y: 20 }]));
});

test('damaged or unsupported share codes are rejected', () => {
  assert.equal(Core.decodeShare(''), null);
  assert.equal(Core.decodeShare('not-a-code'), null);
  assert.equal(Core.decodeShare(Core.encodeShare({ seed: 1, day: 99999, station: 0 })), null);
  assert.equal(Core.decodeShare(Core.encodeShare({ seed: 1, day: 1, station: 99 })), null);
});

test('save migration adds v4 fields and keeps old wall saves playable', () => {
  const migrated = Core.migrateSave({
    v: 3,
    day: 8,
    hour: 6,
    stationIndex: 2,
    structures: [{ kind: 'wall', x: 22, y: 22 }],
    tribeStats: { Judah: { population: 74600, livestock: 30 } },
    visited: ['shore'],
    explored: ['24,24'],
    health: 90,
    hunger: 80,
    hydration: 70,
    warmth: 60,
    stamina: 50,
    faith: 55,
    manna: 4,
    campWater: 22,
    silver: 10,
    wood: 6,
  });
  assert.equal(migrated.v, 4);
  assert.equal(migrated.structures[0].kind, 'sentry');
  assert.equal(migrated.worldSeed, 20261115);
  assert.equal(migrated.blueprints.length, 3);
  assert.equal(Core.validateSave(migrated), true);
});

test('save validation rejects malformed structures and impossible counters', () => {
  const base = {
    v: 4,
    day: 1,
    hour: 6,
    stationIndex: 0,
    structures: [],
    blueprints: [null, null, null],
    raidLog: [],
    visited: [],
    explored: [],
    tribeStats: {},
    health: 100,
    hunger: 100,
    hydration: 100,
    warmth: 100,
    stamina: 100,
    faith: 60,
    manna: 0,
    campWater: 20,
    silver: 10,
    wood: 0,
    stone: 0,
  };
  assert.equal(Core.validateSave(base), true);
  assert.equal(Core.validateSave({ ...base, structures: [{ kind: 'tent', x: -1, y: 2 }] }), false);
  assert.equal(Core.validateSave({ ...base, structures: [{ kind: 'wall', x: 2, y: 2 }] }), false);
  assert.equal(Core.validateSave({ ...base, day: 0 }), false);
  assert.equal(Core.validateSave({ ...base, health: 'lots' }), false);
});
