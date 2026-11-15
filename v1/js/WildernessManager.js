import { GameState, createCampState } from './GameState.js';
import { config as gameConfig } from './config.js';
import { WildernessDayCycle } from './wilderness-day-cycle.js';

/**
 * WildernessManager
 * -----------------
 * Bridges WildernessDayCycle rules with live game state/UI and adds the Moses
 * leadership layer: camp needs and obedience/disobedience around the Golden
 * Calf and Bronze Serpent crises.
 */
export class WildernessManager {
  constructor(game) {
    this.game = game;
    this.cfg = gameConfig.wilderness;
    this.moses = this.cfg.moses || {};
    this.camp = GameState.wilderness.camp || createCampState();

    this.cycle = new WildernessDayCycle({
      sabbathEvery: this.cfg.sabbathDay || 7,
      onNarrativeEvent: (msg) => this._narrate(msg),
    });
  }

  _narrate(msg) {
    if (this.game.uiManager && this.game.uiManager.showNarrative) {
      this.game.uiManager.showNarrative(msg);
    } else {
      console.log('[wilderness]', msg);
    }
  }

  get isLevite() {
    return GameState.player.selectedTribe === this.cfg.leviteTribeId;
  }

  get isSabbath() {
    const n = this.cfg.sabbathDay || 7;
    return GameState.world.day % n === 0;
  }

  _campCap(n) {
    return Math.max(0, Math.min(this.camp.population, Math.round(n)));
  }

  _syncCamp() {
    const pop = this.cfg.campPopulation?.[GameState.world.difficulty] || 90;
    const defaults = createCampState(pop);
    this.camp = { ...defaults, ...(GameState.wilderness.camp || {}) };
    this.camp.population = defaults.population;
    this.camp.disobeyed = this._campCap(this.camp.disobeyed);
    this.camp.hungry = this._campCap(this.camp.hungry);
    this.camp.thirsty = this._campCap(this.camp.thirsty);
    this.camp.afflicted = this._campCap(this.camp.afflicted);
    this.camp.morale = Math.max(0, Math.min(100, Math.round(this.camp.morale ?? 70)));
    this.camp.peakDisobeyed = Math.max(this.camp.peakDisobeyed || 0, this.camp.disobeyed);
    GameState.wilderness.camp = this.camp;
  }

  _rehydrate() {
    const w = GameState.wilderness;
    const c = this.cycle;
    c.wrath = w.wrath || 0;
    c.serpentUses = w.serpentUses || 0;
    c.lastIdolUseDay = (w.lastIdolUseDay ?? -999);
    c.conditions = new Set(w.conditions || []);
    c.stats = { ...c.stats, ...(w.stats || {}) };
    c.mannaWastedToday = w.mannaWastedToday || 0;
    c.day = GameState.world.day;
    c.money = GameState.player.money;
    c.health = GameState.player.health;
    c.isLevite = this.isLevite;
    c.marketSellPrice = GameState.market.sellPrice;
    c.marketDemandModifier = 1;
    this._syncCamp();
  }

  _persist() {
    const w = GameState.wilderness;
    const c = this.cycle;
    w.wrath = c.wrath;
    w.serpentUses = c.serpentUses;
    w.lastIdolUseDay = (c.lastIdolUseDay === -Infinity ? -999 : c.lastIdolUseDay);
    w.conditions = Array.from(c.conditions);
    w.stats = { ...w.stats, ...c.stats, peakDisobeyed: this.camp.peakDisobeyed, peopleCaredFor: this.camp.caredFor };
    w.camp = this.camp;
    GameState.player.money = Math.max(0, Math.round(c.money));
    GameState.player.health = Math.max(0, Math.min(100, c.health));
  }

  // ---- camp needs -------------------------------------------------------

  updateCampNeeds({ quota = this.game.manaQuota || 0, isEnd = false } = {}) {
    this._syncCamp();
    const pop = this.camp.population;
    const food = (GameState.session.foodReserved || 0) + (isEnd ? 0 : GameState.session.dayManaCollected || 0);
    const ratio = quota > 0 ? Math.max(0, Math.min(1, food / quota)) : 1;
    this.camp.hungry = this.isSabbath ? Math.max(0, Math.round(this.camp.hungry * 0.7)) : this._campCap(pop * (1 - ratio) * 0.9);
    const hydration = GameState.player.hydration ?? 100;
    this.camp.thirsty = hydration >= 70 ? Math.max(0, Math.round(this.camp.thirsty * 0.65)) :
      hydration >= 40 ? Math.max(this.camp.thirsty, this._campCap(pop * 0.08)) :
      this._campCap(pop * (0.12 + (40 - hydration) / 100 * 0.35));
    if (isEnd) {
      this.camp.afflicted = this._campCap(this.camp.afflicted + Math.round(this.camp.hungry * 0.04) + Math.round(this.camp.thirsty * 0.04));
      if ((this.camp.hungry + this.camp.thirsty) > pop * 0.25) this.camp.morale = Math.max(0, this.camp.morale - 4);
      if (this.camp.disobeyed > pop * 0.2) this.camp.morale = Math.max(0, this.camp.morale - 3);
    }
    this._persist();
    return this.camp;
  }

  campReportText() {
    const c = this.camp;
    return `Camp report: ${c.disobeyed} disobeyed, ${c.hungry} hungry, ${c.thirsty} thirsty, ${c.afflicted} afflicted.`;
  }

  // ---- morning ----------------------------------------------------------

  startDay() {
    if (!this.cfg.enabled) return { isSabbath: false };
    this._rehydrate();
    if (this.isSabbath) {
      this.camp.disobeyed = Math.max(0, Math.round(this.camp.disobeyed * 0.85));
      this.camp.afflicted = Math.max(0, Math.round(this.camp.afflicted * 0.8));
      this.camp.morale = Math.min(100, this.camp.morale + 6);
    } else {
      this.camp.morale = Math.min(100, this.camp.morale + 1);
    }
    this.cycle.startMorning();
    if (this.cycle.marketDemandModifier > 1) {
      GameState.wilderness.demandBonus = this.cycle.marketDemandModifier;
    }
    this.cycle.marketDemandModifier = 1;
    this.updateCampNeeds({ quota: this.game.manaQuota });
    this._narrate(this.campReportText());
    this._persist();
    return { isSabbath: this.isSabbath };
  }

  applyPendingMarketBonuses() {
    if (this.isSabbath) return;
    const w = GameState.wilderness;
    if (w.pendingSellBonus) {
      GameState.market.sellPrice = Math.min(this.cfg.calfSellPriceCap, Math.round(GameState.market.sellPrice * 1.5));
      w.pendingSellBonus = false;
      this._narrate('Trade improves, but the memory of the Calf still troubles the camp.');
    }
    if (w.demandBonus && w.demandBonus > 1) {
      GameState.market.dailyDemand = Math.round(GameState.market.dailyDemand * w.demandBonus);
      w.demandBonus = 1;
    }
  }

  recordWaste(wasted, gathered, quota) {
    const w = GameState.wilderness;
    w.mannaWastedToday = Math.max(0, Math.round(wasted));
    w.stats.mannaWasted += w.mannaWastedToday;
    if (w.mannaWastedToday === 0 && gathered >= quota && quota > 0) {
      w.stats.perfectDays += 1;
      this.camp.morale = Math.min(100, this.camp.morale + 2);
    } else if (w.mannaWastedToday > 0) {
      const add = Math.min(8, Math.ceil(w.mannaWastedToday / Math.max(1, quota) * 12));
      this.camp.disobeyed = this._campCap(this.camp.disobeyed + add);
      this.camp.morale = Math.max(0, this.camp.morale - 2);
      this._narrate(`${add} people grumble and hoard after manna is wasted.`);
    }
    this._persist();
  }

  // ---- evening ----------------------------------------------------------

  openEvening() {
    this._rehydrate();
    this.updateCampNeeds({ quota: this.game.manaQuota, isEnd: true });
    const wasted = GameState.wilderness.mannaWastedToday || 0;
    const calfRisk = Math.min(this.camp.population, 6 + this.cycle.wrath * 4 + Math.round(wasted / 2) + Math.round(this.camp.morale < 50 ? 4 : 0));
    const calfActive = !this.isSabbath && (this.cycle.wrath >= 1 || wasted > 0 || GameState.player.money >= 35 || this.camp.disobeyed > this.camp.population * 0.12);
    const serpentNeed = this.camp.afflicted > 0 || wasted > 0 || this.cycle.conditions.size > 0;
    return {
      calf: { active: calfRisk > 0, risk: calfRisk, cost: this.moses.calfConfrontCost || 8, intercedeCost: this.moses.calfIntercedeCost || 12, affordable: true },
      serpent: { ...this.cycle.offerBronzeSerpent(), relevant: serpentNeed, need: Math.max(this.camp.afflicted, wasted > 0 ? Math.ceil(this.camp.population * 0.08) : 0), careCost: this.moses.serpentCareCost || 10, careHeal: this.moses.careHeal || 10 },
      wrath: this.cycle.wrath,
      wasted,
      camp: { ...this.camp },
      calfActive,
    };
  }

  respondToCalf(action) {
    this._rehydrate();
    const info = this.openEvening();
    const risk = info.calf.risk || 0;
    this.camp.calfCrises = (this.camp.calfCrises || 0) + 1;
    if (action === 'confront') {
      this.cycle.health = Math.max(0, this.cycle.health - (this.moses.calfConfrontCost || 8));
      this.cycle.wrath = Math.max(0, this.cycle.wrath - 1);
      const reduced = Math.max(0, Math.round(risk * 0.4));
      this.camp.disobeyed = this._campCap(this.camp.disobeyed + reduced);
      this.camp.calfConfronted = (this.camp.calfConfronted || 0) + 1;
      this.camp.caredFor += Math.max(0, risk - reduced);
      this.camp.morale = Math.min(100, this.camp.morale + 2);
      this._narrate(`Moses confronts the Golden Calf. ${risk - reduced} people turn back, but ${reduced} still disobey.`);
    } else if (action === 'intercede') {
      const cost = this.moses.calfIntercedeCost || 12;
      if (this.cycle.money < cost) return { success: false, reason: 'not enough silver' };
      this.cycle.money -= cost;
      this.cycle.wrath = Math.max(0, this.cycle.wrath - 1);
      const reduced = Math.max(0, Math.round(risk * 0.55));
      this.camp.disobeyed = this._campCap(this.camp.disobeyed + reduced);
      this.camp.caredFor += Math.max(0, risk - reduced);
      this.camp.morale = Math.min(100, this.camp.morale + 4);
      this._narrate(`Moses intercedes for the people. ${risk - reduced} are spared from the Calf's influence.`);
    } else {
      this.cycle.wrath += 1;
      this.cycle.lastIdolUseDay = this.day || GameState.world.day;
      GameState.wilderness.pendingSellBonus = true;
      this.camp.disobeyed = this._campCap(this.camp.disobeyed + risk);
      this.camp.morale = Math.max(0, this.camp.morale - 8);
      this._narrate(`${risk} people bow before the Golden Calf. Trade may rise tomorrow, but the camp's faith falls.`);
      if (Math.random() < this.cycle._plagueChanceForWrath(this.cycle.wrath)) this.cycle._triggerPlague();
    }
    this.camp.peakDisobeyed = Math.max(this.camp.peakDisobeyed || 0, this.camp.disobeyed);
    this._persist();
    return { success: true, action };
  }

  // Legacy button compatibility
  activateGoldenCalf() { return this.respondToCalf('ignore'); }

  respondToSerpent(action) {
    this._rehydrate();
    const offer = this.cycle.offerBronzeSerpent();
    this.camp.serpentResponses = (this.camp.serpentResponses || 0) + 1;
    if (action === 'lift') {
      const result = this.cycle.useBronzeSerpent();
      if (!result.success) return result;
      const healed = Math.min(this.camp.afflicted || offer.need || 0, this.moses.serpentHealPerUse || 18);
      this.camp.afflicted = Math.max(0, this.camp.afflicted - healed);
      this.camp.disobeyed = Math.max(0, this.camp.disobeyed - Math.floor(healed / 4));
      this.camp.healedTotal = (this.camp.healedTotal || 0) + healed;
      this.camp.caredFor += healed;
      this.camp.morale = Math.min(100, this.camp.morale + 3);
      this._narrate(`Moses lifts the Bronze Serpent before the camp. ${healed} afflicted people recover.`);
      this._persist();
      return { ...result, success: true, healed };
    }
    if (action === 'care') {
      const cost = this.moses.serpentCareCost || 10;
      if (this.cycle.money < cost) return { success: false, reason: 'not enough silver' };
      this.cycle.money -= cost;
      const healed = Math.min(this.camp.afflicted, this.moses.careHeal || 10);
      this.camp.afflicted = Math.max(0, this.camp.afflicted - healed);
      this.camp.thirsty = Math.max(0, this.camp.thirsty - 4);
      this.camp.hungry = Math.max(0, this.camp.hungry - 4);
      this.camp.healedTotal = (this.camp.healedTotal || 0) + healed;
      this.camp.caredFor += healed + 4;
      this.camp.morale = Math.min(100, this.camp.morale + 2);
      this._narrate(`Moses organizes care for the camp. ${healed} afflicted are tended, and others receive aid.`);
      this._persist();
      return { success: true, action, healed };
    }
    this.camp.afflicted = this._campCap(this.camp.afflicted + 4);
    this.camp.morale = Math.max(0, this.camp.morale - 4);
    this._narrate('The afflicted cry out, but no help comes tonight.');
    this._persist();
    return { success: true, action, healed: 0 };
  }

  useBronzeSerpent() { return this.respondToSerpent('lift'); }

  finalizeStats() {
    this._rehydrate();
    this.updateCampNeeds({ quota: this.game.manaQuota, isEnd: true });
    const stats = this.cycle.finalizeStats();
    stats.peopleCaredFor = this.camp.caredFor || 0;
    stats.peakDisobeyed = this.camp.peakDisobeyed || 0;
    stats.calfCrisesConfronted = this.camp.calfConfronted || 0;
    stats.campHungry = this.camp.hungry || 0;
    stats.campThirsty = this.camp.thirsty || 0;
    stats.campAfflicted = this.camp.afflicted || 0;
    GameState.wilderness.stats = { ...GameState.wilderness.stats, ...stats };
    this._persist();
    return GameState.wilderness.stats;
  }

  faithfulnessLabel(rating) {
    if (rating >= 120) return 'Faithful Shepherd';
    if (rating >= 70) return 'Steadfast Leader';
    if (rating >= 35) return 'Burdened Guide';
    if (rating >= 10) return 'Struggling Shepherd';
    return 'Lost in the Wilderness';
  }
}
