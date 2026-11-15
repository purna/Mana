import { GameState, createJourneyState } from './GameState.js';
import { config as gameConfig } from './config.js';

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * JourneyManager
 * --------------
 * The 40-year Exodus campaign. Each in-game day is a year of wandering. The
 * Pillar of Cloud & Fire stands at the next station of the journey; reaching
 * it reveals the story and blessing of that place, and the pillar moves on.
 */
export class JourneyManager {
  constructor(game) {
    this.game = game;
    this.cfg = gameConfig.journey;
    this.stations = this.cfg.stations || [];
    this.state = GameState.journey || (GameState.journey = createJourneyState());
    this._nagTimer = 0;
  }

  get totalYears() {
    return this.cfg.totalYears ?? gameConfig.game.totalYears ?? 40;
  }

  get station() {
    return this.stations[Math.min(this.state.stationIndex, this.stations.length - 1)] || null;
  }

  get isFinalStation() {
    return this.state.stationIndex >= this.stations.length - 1;
  }

  get isComplete() {
    return this.state.stationIndex >= this.stations.length;
  }

  reset() {
    GameState.journey = createJourneyState();
    this.state = GameState.journey;
    this.state.startedAt = Date.now();
    this._nagTimer = 0;
    return this.state;
  }

  /** Restore defaults for older saves that predate the journey fields. */
  hydrate() {
    this.state = GameState.journey || createJourneyState();
    GameState.journey = this.state;
    this.state.stationIndex = Math.max(0, Math.min(this.stations.length, this.state.stationIndex ?? 0));
    this.state.completed = Array.isArray(this.state.completed) ? this.state.completed : [];
    this.state.awaitingAdvance = false;
    this.state.year = Math.min(this.totalYears, GameState.world.day || 1);
    return this.state;
  }

  /** World-space position of the pillar / current destination. */
  getTarget() {
    const s = this.station;
    if (!s) return { x: 0, z: 0, y: 0, station: null };
    const y = this.game.getSurfaceHeight ? this.game.getSurfaceHeight(s.pos[0], s.pos[1]) : 0;
    return { x: s.pos[0], z: s.pos[1], y, station: s };
  }

  distanceToTarget() {
    const t = this.getTarget();
    const p = this.game.player?.position || { x: 0, z: 0 };
    return Math.hypot(p.x - t.x, p.z - t.z);
  }

  /** Returns { distance, bearing, relative, cardinal } for the compass UI. */
  getGuidance() {
    const t = this.getTarget();
    const p = this.game.player?.position || { x: 0, z: 0 };
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const distance = Math.hypot(dx, dz);
    // Bearing measured from north (-z), clockwise toward east (+x).
    const bearing = Math.atan2(dx, -dz);
    const h = this.game.cameraHeading || { x: 0, z: -1 };
    const heading = Math.atan2(h.x, -h.z);
    let relative = bearing - heading;
    while (relative > Math.PI) relative -= Math.PI * 2;
    while (relative < -Math.PI) relative += Math.PI * 2;
    const cardinal = CARDINALS[Math.round(((bearing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4)) % 8];
    return { distance, bearing, relative, cardinal, target: t };
  }

  /** Called every frame while the player travels. */
  update(dt) {
    if (GameState.world.gameState !== 'playing') return;
    const day = GameState.world.day || 1;
    this.state.year = Math.min(this.totalYears, day);

    // Periodic murmur of the people when needs are ignored.
    this._nagTimer -= dt;
    if (this._nagTimer <= 0) {
      this._nagTimer = 18;
      const p = GameState.player;
      if ((p.hunger ?? 100) < 18) {
        this.game.uiManager?.showNarrative?.('The people murmur: “We remember the fish we ate in Egypt. Now we hunger.”');
        p.faith = Math.max(0, (p.faith ?? 0) - 2);
      } else if ((p.hydration ?? 100) < 16) {
        this.game.uiManager?.showNarrative?.('The people cry out for water. “Is the Lord among us or not?”');
        p.faith = Math.max(0, (p.faith ?? 0) - 2);
      }
    }

    if (!this.state.awaitingAdvance && this.distanceToTarget() <= this.cfg.arriveRadius) {
      this.arrive();
    }
  }

  /** The player has reached the pillar and the station's story begins. */
  arrive() {
    const station = this.station;
    if (!station || this.state.awaitingAdvance) return;
    this.state.awaitingAdvance = true;
    this.state.lastStation = station.id;
    GameState.world.paused = true;
    const blessing = this.applyBlessing(station);
    this.game.uiManager?.showStation?.(this, station, blessing);
  }

  applyBlessing(station) {
    const p = GameState.player;
    const b = station.blessing || {};
    const applied = {};
    if (b.health) { p.health = Math.min(100, p.health + b.health); applied.health = b.health; }
    if (b.faith) { p.faith = Math.min(100, (p.faith ?? 0) + b.faith); applied.faith = b.faith; }
    if (b.hydration) {
      p.hydration = Math.min(100, (p.hydration ?? 0) + b.hydration);
      p.waterskin = gameConfig.survival?.waterskinCapacity ?? 3;
      applied.hydration = b.hydration;
    }
    if (b.warmth) { p.warmth = Math.min(100, (p.warmth ?? 0) + b.warmth); applied.warmth = b.warmth; }
    if (b.manna) {
      GameState.session.dayManaCollected = (GameState.session.dayManaCollected || 0) + b.manna;
      GameState.session.dayManaGathered = (GameState.session.dayManaGathered || 0) + b.manna;
      applied.manna = b.manna;
    }
    if (b.money) { p.money += b.money; applied.money = b.money; }
    if (b.score) { p.score += b.score; applied.score = b.score; }
    p.score += 25;
    applied.score = (applied.score || 0) + 25;
    this.game.uiManager?.updateHUD?.();
    return applied;
  }

  /** Leave the station and let the pillar lead onward. */
  advance() {
    if (!this.state.awaitingAdvance) return;
    const station = this.station;
    if (station && !this.state.completed.includes(station.id)) {
      this.state.completed.push(station.id);
    }
    this.state.awaitingAdvance = false;
    this.state.stationIndex += 1;
    GameState.world.paused = false;

    if (this.isComplete) {
      this.game.uiManager?.hideStation?.();
      this.game.victory();
      return;
    }

    const next = this.station;
    this.game.pillarManager?.setTarget(this.getTarget());
    // The manna the camp gathered travels with the camp to its new station.
    this.game.sceneManager?.relocateManna?.(this.game.player?.position);
    this.game.uiManager?.hideStation?.();
    this.game.uiManager?.showGameUI?.();
    this.game.uiManager?.updateHUD?.();
    this.game.saveManager?.saveGame?.();
    if (next) {
      this.game.uiManager?.showNarrative?.(`The pillar rises and goes before you, toward ${next.name}.`);
      this.game.uiManager?.showDayMessage?.(`The Pillar leads to ${next.name} — ${Math.round(this.distanceToTarget())}m ${this.getGuidance().cardinal}`);
    }
  }

  /** Dawn bookkeeping. Returns true when the 40 years are spent. */
  onDayStart() {
    this.state.year = Math.min(this.totalYears, GameState.world.day || 1);
    const p = GameState.player;
    p.warmth = 100;
    p.stamina = Math.min(100, (p.stamina ?? 100) + 35);
    const strongFaith = (p.faith ?? 0) >= 65;
    if (strongFaith) {
      p.health = Math.min(100, p.health + (gameConfig.survival?.faithDawnHealth ?? 4));
    }
    if (this.game.wildernessManager?.isSabbath) {
      p.faith = Math.min(100, (p.faith ?? 0) + (gameConfig.survival?.faithSabbath ?? 5));
    }
    return (GameState.world.day || 1) > this.totalYears;
  }

  /** End-of-day faith drift based on how well the camp was kept. */
  onDayEnd() {
    const p = GameState.player;
    const camp = GameState.wilderness?.camp || {};
    if ((p.hunger ?? 100) <= 0 || (p.hydration ?? 100) <= 0) {
      p.faith = Math.max(0, (p.faith ?? 0) - 4);
    }
    if ((camp.hungry || 0) > (camp.population || 0) * 0.25) {
      p.faith = Math.max(0, (p.faith ?? 0) - 2);
    }
    if ((GameState.session.foodReserved || 0) >= (this.game.manaQuota || 0) && (GameState.session.dayManaCollected || 0) === 0) {
      p.faith = Math.min(100, (p.faith ?? 0) + 1);
    }
  }

  progressPercent() {
    return Math.round(clamp01(this.state.stationIndex / Math.max(1, this.stations.length)) * 100);
  }

  yearLabel() {
    const y = Math.min(this.totalYears, GameState.world.day || 1);
    return `Year ${y} of ${this.totalYears}`;
  }

  objectiveText() {
    const s = this.station;
    if (!s) return 'The journey is complete.';
    const g = this.getGuidance();
    return `Follow the Pillar to ${s.name} — ${Math.round(g.distance)}m ${g.cardinal}`;
  }
}
