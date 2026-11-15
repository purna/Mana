import { GameState, GameSummary } from './GameState.js';
import { config as gameConfig } from './config.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.initDOMElements();
    this.bindMapControls();
  }

  initDOMElements() {
    this.dom = {
      score: document.getElementById('score'),
      day: document.getElementById('day'),
      time: document.getElementById('time'),
      mana: document.getElementById('mana'),
      manaQuota: document.getElementById('mana-quota'),
      gold: document.getElementById('gold'),
      healthValue: document.getElementById('healthValue'),
      healthBarFill: document.getElementById('healthBarFill'),
      healthStatus: document.getElementById('healthStatus'),
      wealthValue: document.getElementById('wealthValue'),
      wealthBarFill: document.getElementById('wealthBarFill'),
      locationPopup: document.getElementById('locationPopup'),
      locationPopupContent: document.getElementById('locationPopupContent'),
      locationDisplay: document.getElementById('location-display'),
      // Journey HUD
      journeyHud: document.getElementById('journeyHud'),
      yearLabel: document.getElementById('yearLabel'),
      stationName: document.getElementById('stationName'),
      stationDistance: document.getElementById('stationDistance'),
      terrainSource: document.getElementById('terrainSource'),
      compassArrow: document.getElementById('compassArrow'),
      compassCardinal: document.getElementById('compassCardinal'),
      vitals: document.getElementById('vitals'),
      vitalHealth: document.getElementById('vitalHealth'),
      vitalHunger: document.getElementById('vitalHunger'),
      vitalThirst: document.getElementById('vitalThirst'),
      vitalWarmth: document.getElementById('vitalWarmth'),
      vitalFaith: document.getElementById('vitalFaith'),
      vitalStamina: document.getElementById('vitalStamina'),
      vitalHealthVal: document.getElementById('vitalHealthVal'),
      vitalHungerVal: document.getElementById('vitalHungerVal'),
      vitalThirstVal: document.getElementById('vitalThirstVal'),
      vitalWarmthVal: document.getElementById('vitalWarmthVal'),
      vitalFaithVal: document.getElementById('vitalFaithVal'),
      vitalStaminaVal: document.getElementById('vitalStaminaVal'),
      waterskinHud: document.getElementById('waterskinHud'),
      // Story modals
      prologueModal: document.getElementById('prologueModal'),
      stationModal: document.getElementById('stationModal'),
      victoryModal: document.getElementById('victoryModal'),
      endingModal: document.getElementById('endingModal'),
      stationKicker: document.getElementById('stationKicker'),
      stationTitle: document.getElementById('stationTitle'),
      stationScripture: document.getElementById('stationScripture'),
      stationNarrative: document.getElementById('stationNarrative'),
      stationTrial: document.getElementById('stationTrial'),
      stationBlessing: document.getElementById('stationBlessing'),
      victoryStats: document.getElementById('victoryStats'),
      mapModal: document.getElementById('mapModal'),
      mapCanvas: document.getElementById('mapCanvas'),
      mapSubtitle: document.getElementById('mapSubtitle'),
      mapZoomLevel: document.getElementById('mapZoomLevel'),
      mapZoomIn: document.getElementById('mapZoomIn'),
      mapZoomOut: document.getElementById('mapZoomOut'),
      mapRecenter: document.getElementById('mapRecenter'),
      endingStats: document.getElementById('endingStats'),
      endingText: document.getElementById('endingText'),
      // Modals
      menuModal: document.getElementById('menuModal'),
      difficultyModal: document.getElementById('difficultyModal'),
      characterStep: document.getElementById('characterStep'),
      tribeButtons: document.getElementById('tribeButtons'),
      householdStep: document.getElementById('householdStep'),
      dayEndModal: document.getElementById('dayEndModal'),
      gameOverModal: document.getElementById('gameOverModal'),
      marketModal: document.getElementById('marketModal'),
      pauseModal: document.getElementById('pauseModal'),
      eveningModal: document.getElementById('eveningModal'),
      faithPanel: document.getElementById('faithPanel'),
      // Day End Modal fields
      dayEndTitle: document.getElementById('dayEndTitle'),
      dayManaCount: document.getElementById('dayManaCount'),
      daySold: document.getElementById('daySold'),
      dayWasted: document.getElementById('dayWasted'),
      dayRevenue: document.getElementById('dayRevenue'),
      dayScore: document.getElementById('dayScore'),
      dayHealth: document.getElementById('dayHealth'),
      dayHealthStatus: document.getElementById('dayHealthStatus'),
      dayWealth: document.getElementById('dayWealth'),
      dayHealthBar: document.getElementById('dayHealthBar'),
      dayWealthBar: document.getElementById('dayWealthBar'),
      dayEndBtn: document.getElementById('dayEndBtn'),
      // Game Over Modal fields
      finalScore: document.getElementById('finalScore'),
      survivedDays: document.getElementById('survivedDays'),
      // Market Modal fields
      dailyDemand: document.getElementById('dailyDemand'),
      sellPrice: document.getElementById('sellPrice'),
      buyPrice: document.getElementById('buyPrice'),
      playerMoney: document.getElementById('playerMoney'),
      playerMana: document.getElementById('playerMana'),
      manaForSale: document.getElementById('manaForSale'),
      marketMood: document.getElementById('marketMood'),
      marketStatus: document.getElementById('marketStatus'),
      marketWasteWarning: document.getElementById('marketWasteWarning'),
      // HUD & Controls
      hud: document.getElementById('hud'),
      healthBarContainer: document.getElementById('healthBarContainer'),
      wealthBarContainer: document.getElementById('wealthBarContainer'),
      mobileControls: document.getElementById('mobileControls'),
      mobileToggleBtn: document.getElementById('mobileToggleBtn'),
      // Top right controls
      pauseIcon: document.getElementById('pauseIcon'),
      audioIcon: document.getElementById('audioIcon'),
      aboutPanel: document.getElementById('aboutPanel'),
    };
  }

  updateHUD() {
    const oldScore = parseInt(this.dom.score.textContent) || 0;
    const oldMana = parseInt(this.dom.mana.textContent) || 0;
    const oldHealth = parseInt(this.dom.healthValue.textContent) || 100;
    const oldWealth = parseInt(this.dom.wealthValue.textContent) || 0;

    this.dom.score.textContent = GameState.player.score;
    this.dom.day.textContent = GameState.world.day;
    this.dom.time.textContent = Math.max(0, GameState.world.timeLeft);
    this.dom.healthValue.textContent = Math.round(GameState.player.health);
    this.dom.healthBarFill.style.width = Math.max(0, GameState.player.health) + '%';
    this.dom.wealthValue.textContent = GameState.player.money;
    this.dom.wealthBarFill.style.width = Math.min(100, (GameState.player.money / 500) * 100) + '%';
    this.dom.mana.textContent = GameState.session.dayManaCollected;
    this.dom.manaQuota.textContent = this.game.manaQuota;
    this.dom.gold.textContent = GameState.player.money;
    this.dom.healthStatus.textContent = this.game.getHealthStatus();

    const camp = GameState.wilderness?.camp;
    if (camp) {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('campDisobeyedHud', camp.disobeyed);
      set('campHungryHud', camp.hungry);
      set('campThirstyHud', camp.thirsty);
      set('campAfflictedHud', camp.afflicted);
    }
    document.getElementById('survivalHud').hidden = GameState.world.gameState !== 'playing';
    const campHud = document.getElementById('campStatusHud'); if (campHud) campHud.hidden = GameState.world.gameState !== 'playing';
    if (GameState.player.score > oldScore) {
      const scoreDiff = GameState.player.score - oldScore;
      if (!isNaN(scoreDiff) && scoreDiff > 0) {
        this.animateValue(this.dom.score, 'updated', 600);
        const screenX = window.innerWidth * 0.15;
        const screenY = window.innerHeight * 0.2;
        this.createFloatingText('+' + scoreDiff, screenX, screenY, '#b8862f');
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            this.createStarBurst(screenX + (Math.random() - 0.5) * 100, screenY + (Math.random() - 0.5) * 40);
          }, i * 100);
        }
      }
    }

    if (GameState.session.dayManaCollected > oldMana) {
      this.animateValue(this.dom.mana, 'updated', 500);
    }

    if (Math.round(GameState.player.health) !== oldHealth) {
      this.dom.healthBarFill.classList.add('pulse');
      setTimeout(() => this.dom.healthBarFill.classList.remove('pulse'), 400);

      const healthScreenX = window.innerWidth * 0.5;
      const healthScreenY = window.innerHeight * 0.85;
      if (GameState.player.health < oldHealth) {
        this.createFloatingText('-' + Math.round(oldHealth - GameState.player.health), healthScreenX, healthScreenY, '#7a2118');
      } else if (GameState.player.health > oldHealth) {
        this.createFloatingText('+' + Math.round(GameState.player.health - oldHealth), healthScreenX, healthScreenY, '#5c6b3e');
      }
    }

    if (GameState.player.money !== oldWealth) {
      this.dom.wealthBarFill.classList.add('pulse');
      setTimeout(() => this.dom.wealthBarFill.classList.remove('pulse'), 400);
    }

    if (GameState.player.health <= 30) {
      this.dom.healthBarFill.style.background = 'linear-gradient(90deg, #a8392c, #7a2118)';
    } else if (GameState.player.health <= 60) {
      this.dom.healthBarFill.style.background = 'linear-gradient(90deg, #e0ad4f, #b8862f)';
    } else {
      this.dom.healthBarFill.style.background = 'linear-gradient(90deg, #6f8a3f, #91ab53)';
    }

    this.updateVitals();
    this.updateJourneyHUD();
  }

  /** Update the survival meters (health/hunger/thirst/warmth/faith/stamina). */
  updateVitals() {
    if (!this.dom.vitals) return;
    const p = GameState.player;
    const clamp = (n) => Math.max(0, Math.min(100, Math.round(n ?? 0)));
    const setBar = (el, value) => { if (el) el.style.width = clamp(value) + '%'; };
    const setText = (el, value) => { if (el) el.textContent = clamp(value); };
    const health = clamp(p.health);
    const hunger = clamp(p.hunger);
    const thirst = clamp(p.hydration);
    const warmth = clamp(p.warmth);
    const faith = clamp(p.faith);
    const stamina = clamp(p.stamina);
    setBar(this.dom.vitalHealth, health);
    setBar(this.dom.vitalHunger, hunger);
    setBar(this.dom.vitalThirst, thirst);
    setBar(this.dom.vitalWarmth, warmth);
    setBar(this.dom.vitalFaith, faith);
    setBar(this.dom.vitalStamina, stamina);
    setText(this.dom.vitalHealthVal, health);
    setText(this.dom.vitalHungerVal, hunger);
    setText(this.dom.vitalThirstVal, thirst);
    setText(this.dom.vitalWarmthVal, warmth);
    setText(this.dom.vitalFaithVal, faith);
    setText(this.dom.vitalStaminaVal, stamina);
    const critical = (value) => value <= 25;
    const mark = (name, value) => {
      const row = this.dom.vitals.querySelector(`[data-vital="${name}"]`);
      if (row) row.classList.toggle('low', critical(value));
    };
    mark('health', health);
    mark('hunger', hunger);
    mark('thirst', thirst);
    mark('warmth', warmth);
    mark('faith', faith);
    mark('stamina', stamina);
    this.dom.vitals.classList.toggle('is-critical', critical(health) || critical(hunger) || critical(thirst) || critical(warmth));

    if (this.dom.waterskinHud) {
      const cap = gameConfig.survival?.waterskinCapacity ?? 3;
      const have = Math.max(0, Math.min(cap, Math.round(p.waterskin ?? 0)));
      const skinText = 'Waterskin ' + '◉'.repeat(have) + '○'.repeat(cap - have);
      if (this._skinText !== skinText) {
        this.dom.waterskinHud.textContent = skinText;
        this._skinText = skinText;
      }
    }
  }

  /** Update the year, station and pillar compass. */
  updateJourneyHUD() {
    const j = this.game.journeyManager;
    if (!j || !this.dom.journeyHud) return;
    const total = j.totalYears;
    const year = Math.min(total, GameState.world.day || 1);
    const yearHTML = `Year <b>${year}</b><span>of ${total}</span>`;
    if (this.dom.yearLabel && this._yearHTML !== yearHTML) {
      this.dom.yearLabel.innerHTML = yearHTML;
      this._yearHTML = yearHTML;
    }
    const station = j.station;
    if (station && this.dom.stationName && this._stationName !== station.name) {
      this.dom.stationName.textContent = station.name;
      this._stationName = station.name;
    }
    const g = j.getGuidance();
    const distanceText = `${Math.round(g.distance)}m ${g.cardinal}`;
    if (this.dom.stationDistance && this._distanceText !== distanceText) {
      this.dom.stationDistance.textContent = distanceText;
      this._distanceText = distanceText;
    }
    if (this.dom.compassArrow) {
      this.dom.compassArrow.style.transform = `rotate(${g.relative * 180 / Math.PI}deg)`;
    }
    if (this.dom.compassCardinal && this._compassCardinal !== g.cardinal) {
      this.dom.compassCardinal.textContent = g.cardinal;
      this._compassCardinal = g.cardinal;
    }
    if (this.dom.terrainSource) {
      const terrain = this.game.terrainStreamer;
      const source = terrain?.tiles && [...terrain.tiles.values()].some((t) => t.isReal)
        ? 'Wadi Rum · SRTM DEM'
        : 'Wadi Rum · generated';
      if (this._terrainSource !== source) {
        this.dom.terrainSource.textContent = source;
        this._terrainSource = source;
      }
    }
  }

  createFloatingText(text, x, y, color = '#ffd93d') {
    const el = document.createElement('div');
    el.className = 'score-pop';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color;
    document.getElementById('gameContainer').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  createStarBurst(x, y) {
    const el = document.createElement('div');
    el.className = 'star-burst';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.getElementById('gameContainer').appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  animateValue(element, animationClass, duration = 600) {
    element.classList.remove(animationClass);
    void element.offsetWidth;
    element.classList.add(animationClass);
    setTimeout(() => element.classList.remove(animationClass), duration);
  }

  hideAllModals() {
    document.querySelectorAll('.modal').forEach((m) => m.classList.remove('active'));
  }

  showMenu() {
    this.hideAllModals();
    this.dom.menuModal.classList.add('active');
    document.getElementById('survivalHud').hidden = true;
    this.dom.hud.style.display = 'none';
    this.dom.mobileControls.style.display = 'none';
    if (this.dom.journeyHud) this.dom.journeyHud.hidden = true;
    if (this.dom.vitals) this.dom.vitals.hidden = true;

    // New logic to show/hide save game container
    const saveContainer = document.getElementById('saveGameContainer');
    const beginBtn = document.getElementById('beginJourneyBtn');
    const quickBtn = document.getElementById('quickStartBtn');
    if (quickBtn) quickBtn.style.display = GameSummary.hasSave ? 'none' : 'block';
    const setSave = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    if (GameSummary.hasSave) {
      setSave('saveYear', `Year ${GameSummary.year ?? GameSummary.day}`);
      setSave('saveStation', GameSummary.station || 'The Red Sea Shore');
      setSave('saveScore', GameSummary.score ?? 0);
      setSave('saveTribe', (GameSummary.tribe || 'judah').charAt(0).toUpperCase() + (GameSummary.tribe || 'judah').slice(1));
      setSave('saveDifficulty', (GameSummary.difficulty || 'couple').charAt(0).toUpperCase() + (GameSummary.difficulty || 'couple').slice(1));
      setSave('saveHealth', Math.round(GameSummary.health));
      setSave('saveMoney', GameSummary.money);
      saveContainer.style.display = 'block';
      beginBtn.style.display = 'none';
    } else {
      saveContainer.style.display = 'none';
      beginBtn.style.display = 'block';
    }

    this.dom.healthBarContainer.style.display = 'none';
    this.dom.wealthBarContainer.style.display = 'none';
  }

  showDifficultyScreen() {
    this.hideAllModals();
    // Tribes are campaign statistics, not a player choice. Go straight to household size.
    this.showHouseholdStep();
    this.dom.difficultyModal.classList.add('active');
  }

  showTribeStep() {
    if (this.dom.characterStep) this.dom.characterStep.style.display = 'block';
    if (this.dom.householdStep) this.dom.householdStep.style.display = 'none';
  }

  showHouseholdStep() {
    if (this.dom.characterStep) this.dom.characterStep.style.display = 'none';
    if (this.dom.householdStep) this.dom.householdStep.style.display = 'block';
  }

  showGameUI() {
    this.hideAllModals();
    document.getElementById('survivalHud').hidden = false;
    this.dom.hud.style.display = 'block';
    this.dom.healthBarContainer.style.display = 'block';
    this.dom.wealthBarContainer.style.display = 'block';
    if (this.dom.journeyHud) this.dom.journeyHud.hidden = false;
    if (this.dom.vitals) this.dom.vitals.hidden = false;
    const campHud = document.getElementById('campStatusHud'); if (campHud) campHud.hidden = GameState.world.gameState !== 'playing';
    this.toggleMobileControls(this.game.mobileVisible);
  }

  // ===================================================================
  // EXPLORED MAP
  // ===================================================================

  /** Bind drag-pan, wheel/pinch zoom and map controls once. */
  bindMapControls() {
    if (this._mapBound) return;
    const canvas = this.dom.mapCanvas;
    if (!canvas) return;
    this._mapBound = true;
    const manager = () => this.game.mapManager;
    const redraw = () => this.updateMap(this.game);
    const pointers = new Map();
    let drag = null;
    let pinchDistance = 0;

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        drag = { x: e.clientX, y: e.clientY };
        canvas.classList.add('dragging');
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
        drag = null;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const next = Math.hypot(a.x - b.x, a.y - b.y);
        if (Math.abs(next - pinchDistance) > 12) {
          manager()?.zoomBy(next > pinchDistance ? -1 : 1);
          pinchDistance = next;
          redraw();
        }
        return;
      }
      if (drag) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag = { x: e.clientX, y: e.clientY };
        manager()?.panPixels(dx, dy);
        redraw();
      }
    });
    const endPointer = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDistance = 0;
      if (pointers.size === 0) {
        drag = null;
        canvas.classList.remove('dragging');
      }
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', endPointer);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      manager()?.zoomBy(e.deltaY > 0 ? 1 : -1);
      redraw();
    }, { passive: false });

    this.dom.mapZoomIn?.addEventListener('click', () => { manager()?.zoomBy(-1); redraw(); });
    this.dom.mapZoomOut?.addEventListener('click', () => { manager()?.zoomBy(1); redraw(); });
    this.dom.mapRecenter?.addEventListener('click', () => { manager()?.recenterPlayer(); redraw(); });
  }

  showMap(game) {
    if (!this.dom.mapModal) return false;
    this.hideAllModals();
    this.dom.mapModal.classList.add('active');
    game.mapManager?.openAtPlayer?.();
    this.updateMap(game);
    return true;
  }

  hideMap() {
    if (this.dom.mapModal) this.dom.mapModal.classList.remove('active');
  }

  updateMap(game) {
    const manager = game.mapManager;
    if (!manager) return;
    manager.draw(this.dom.mapCanvas);
    const count = manager.getExploredCount();
    const source = (game.terrainStreamer?.tiles && [...game.terrainStreamer.tiles.values()].some((t) => t.isReal))
      ? 'SRTM DEM' : 'generated terrain';
    if (this.dom.mapSubtitle) {
      this.dom.mapSubtitle.textContent = `${gameConfig.terrain.real.region.name} · ${count} section${count === 1 ? '' : 's'} explored · ${source}`;
    }
    if (this.dom.mapZoomLevel) {
      const view = game.mapManager?.view || 13;
      this.dom.mapZoomLevel.textContent = `${view} × ${view} km`;
    }
  }

  // ===================================================================
  // 40-YEAR JOURNEY STORY UI
  // ===================================================================

  showPrologue() {
    if (!this.dom.prologueModal) return false;
    this.hideAllModals();
    const campHud0 = document.getElementById('campStatusHud'); if (campHud0) campHud0.hidden = true;
    this.dom.prologueModal.classList.add('active');
    document.getElementById('survivalHud').hidden = true;
    this.dom.hud.style.display = 'none';
    if (this.dom.journeyHud) this.dom.journeyHud.hidden = true;
    if (this.dom.vitals) this.dom.vitals.hidden = true;
    return true;
  }

  hidePrologue() {
    if (this.dom.prologueModal) this.dom.prologueModal.classList.remove('active');
    this.showGameUI();
  }

  showStation(journey, station, blessing) {
    if (!this.dom.stationModal) return false;
    this.hideAllModals();
    document.getElementById('survivalHud').hidden = true;
    this.dom.hud.style.display = 'none';
    const campHud1 = document.getElementById('campStatusHud'); if (campHud1) campHud1.hidden = true;
    if (this.dom.journeyHud) this.dom.journeyHud.hidden = true;
    if (this.dom.vitals) this.dom.vitals.hidden = true;
    if (this.dom.stationKicker) {
      this.dom.stationKicker.textContent = `Year ${GameState.world.day} · Station ${journey.state.stationIndex + 1} of ${journey.stations.length}`;
    }
    if (this.dom.stationTitle) this.dom.stationTitle.textContent = station.name;
    if (this.dom.stationScripture) this.dom.stationScripture.textContent = station.scripture || '';
    if (this.dom.stationNarrative) this.dom.stationNarrative.textContent = station.text || '';
    if (this.dom.stationTrial) this.dom.stationTrial.textContent = station.trial || '';
    if (this.dom.stationBlessing) {
      const labels = {
        health: '+ wellbeing', faith: '+ faith', hydration: 'waterskin filled',
        warmth: '+ warmth', manna: '+ manna', money: '+ silver', score: '+ renown',
      };
      const parts = Object.entries(blessing || {})
        .map(([key, value]) => `<span>${value > 1 ? value + ' ' : ''}${labels[key] || key}</span>`)
        .join('');
      this.dom.stationBlessing.innerHTML = parts ? `<strong>A blessing at ${station.name}</strong><div>${parts}</div>` : '';
    }
    this.dom.stationModal.classList.add('active');
    this.game.audioManager?.play?.('dayEnd');
    return true;
  }

  hideStation() {
    if (this.dom.stationModal) this.dom.stationModal.classList.remove('active');
  }

  showVictory(game) {
    this.hideAllModals();
    const campHud = document.getElementById('campStatusHud'); if (campHud) campHud.hidden = true;
    if (this.dom.journeyHud) this.dom.journeyHud.hidden = true;
    if (this.dom.vitals) this.dom.vitals.hidden = true;
    document.getElementById('survivalHud').hidden = true;
    this.dom.hud.style.display = 'none';
    const w = GameState.wilderness || {};
    const stats = [
      ['Years wandered', game.journeyManager?.totalYears || 40],
      ['Stations reached', game.journeyManager?.state.completed.length || 0],
      ['Wellbeing', Math.round(GameState.player.health)],
      ['Faith', Math.round(GameState.player.faith || 0)],
      ['Renown', GameState.player.score],
      ['Silver', GameState.player.money],
      ['People cared for', w.camp?.caredFor || 0],
      ['Manna wasted', w.stats?.mannaWasted || 0],
    ];
    if (this.dom.victoryStats) {
      this.dom.victoryStats.innerHTML = stats.map(([label, value]) => `<span>${label}<b>${value}</b></span>`).join('');
    }
    if (this.dom.victoryModal) this.dom.victoryModal.classList.add('active');
  }

  showEnding(game) {
    this.hideAllModals();
    const campHud = document.getElementById('campStatusHud'); if (campHud) campHud.hidden = true;
    if (this.dom.journeyHud) this.dom.journeyHud.hidden = true;
    if (this.dom.vitals) this.dom.vitals.hidden = true;
    document.getElementById('survivalHud').hidden = true;
    this.dom.hud.style.display = 'none';
    const reached = game.journeyManager?.state.completed.length || 0;
    if (this.dom.endingText) {
      this.dom.endingText.textContent = `Forty years have passed. You reached ${reached} of ${game.journeyManager?.stations.length || 8} stations, but the people are not yet home. The pillar still burns at the edge of the camp.`;
    }
    if (this.dom.endingStats) {
      const rows = [
        ['Years', 40], ['Stations', `${reached}/${game.journeyManager?.stations.length || 8}`],
        ['Wellbeing', Math.round(GameState.player.health)], ['Faith', Math.round(GameState.player.faith || 0)],
        ['Renown', GameState.player.score],
      ];
      this.dom.endingStats.innerHTML = rows.map(([label, value]) => `<span>${label}<b>${value}</b></span>`).join('');
    }
    if (this.dom.endingModal) this.dom.endingModal.classList.add('active');
  }

  toggleAbout() {
    this.dom.aboutPanel.classList.toggle('open');
  }

  togglePause(paused) {
    if (paused) {
      this.dom.pauseIcon.className = 'fas fa-play';
      this.dom.pauseModal.classList.add('active');
    } else {
      this.dom.pauseIcon.className = 'fas fa-pause';
      this.dom.pauseModal.classList.remove('active');
    }
  }

  toggleAudioIcon(muted) {
    this.dom.audioIcon.className = muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
  }

  toggleMobileControls(visible) {
    if (visible) {
      this.dom.mobileControls.style.display = 'grid';
      this.dom.mobileToggleBtn.style.opacity = '1';
    } else {
      this.dom.mobileControls.style.display = 'none';
      this.dom.mobileToggleBtn.style.opacity = '0.5';
    }
  }

  buildTribeButtons(tribes) {
    const container = this.dom.tribeButtons;
    if (!container) return;
    container.innerHTML = '';
    const total = tribes.reduce((sum, tribe) => sum + (Number(tribe.population) || 0), 0);
    tribes.forEach((tribe) => {
      const card = document.createElement('div');
      card.className = 'tribe-btn tribe-stat';
      card.style.setProperty('--tribe-color', tribe.color);
      card.innerHTML = `
        <span class="tribe-swatch" style="background:${tribe.color}"></span>
        <span class="tribe-name">${tribe.name}</span>
        <span class="tribe-epithet">${tribe.epithet}</span>
        <span class="tribe-population">${Number(tribe.population || 0).toLocaleString()} souls</span>
      `;
      container.appendChild(card);
    });
    const totalEl = document.createElement('div');
    totalEl.className = 'tribe-total';
    totalEl.innerHTML = `Souls of Israel: <b>${total.toLocaleString()}</b>`;
    container.appendChild(totalEl);
  }

  selectTribe(tribeId) {
    document.querySelectorAll('.tribe-btn').forEach((btn) => {
      btn.classList.remove('selected');
      if (btn.dataset.tribe === tribeId) btn.classList.add('selected');
    });
  }

  updateLocationDisplay(flagUserData) {
    const locName =
      flagUserData.targetX === 20
        ? 'Camp'
        : flagUserData.targetX === -25
          ? 'Oasis'
          : flagUserData.targetZ === 25
            ? 'Split Rock'
            : flagUserData.targetX === -20
              ? 'Temple'
              : 'Wilderness';
    const currentLoc = this.dom.locationDisplay.textContent;
    if (currentLoc !== 'Location: ' + locName) {
      this.dom.locationDisplay.textContent = 'Location: ' + locName;
      this.animateValue(this.dom.locationDisplay, 'updated', 500);
      this.dom.locationDisplay.classList.add('location-flash');
      setTimeout(() => this.dom.locationDisplay.classList.remove('location-flash'), 1000);
    }
  }

  showMarket(game) {
    this.updateMarket(game);
    this.dom.marketModal.classList.add('active');
  }

  hideMarket() {
    this.dom.marketModal.classList.remove('active');
  }

  updateMarket(game) {
    document.getElementById('foodReserved').textContent = `Household fed: ${GameState.session.foodReserved || 0}/${game.manaQuota}. Only surplus is traded. Buy manna to cover any shortage.`;
    this.dom.dailyDemand.textContent = GameState.market.dailyDemand;
    this.dom.sellPrice.textContent = GameState.market.sellPrice;
    this.dom.playerMoney.textContent = GameState.player.money;
    this.dom.playerMana.textContent = GameState.session.dayManaCollected;
    this.dom.marketMood.textContent = GameState.market.mood || 'The traders seem fair today.';
    // Optional market fields — not present in every HTML layout, so guard against null.
    if (this.dom.buyPrice) this.dom.buyPrice.textContent = GameState.market.buyPrice;
    if (this.dom.manaForSale) this.dom.manaForSale.textContent = GameState.market.manaForSale;

    if (this.dom.marketStatus) {
      this.dom.marketStatus.className = 'market-status market-status-' + (GameState.market.status || 'balanced');
    }

    const remainingDemand = Math.max(0, GameState.market.dailyDemand - GameState.market.manaSoldToday);
    const hasExcess = GameState.session.dayManaCollected > remainingDemand;
    this.dom.marketWasteWarning.style.display = hasExcess ? 'inline' : 'none';
    this.dom.marketWasteWarning.textContent = hasExcess ? 'Warning: Excess manna may spoil if unsold!' : '';
  }

  showDayMessage(message) {
    const old = document.querySelector('.day-announcement');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'day-announcement';
    el.textContent = message;
    document.body.appendChild(el);
    document.body.classList.add('day-banner-active');
    setTimeout(() => el.classList.add('fade'), 3600);
    setTimeout(() => {
      el.remove();
      document.body.classList.remove('day-banner-active');
    }, 4300);
  }

  showDayEnd(game, manaBonus) {
    this.hideAllModals();
    document.getElementById('survivalHud').hidden = true;
    this.dom.hud.style.display = 'none';
    if (this.dom.journeyHud) this.dom.journeyHud.hidden = true;
    if (this.dom.vitals) this.dom.vitals.hidden = true;
    this.dom.dayEndModal.classList.add('active');

    this.dom.dayEndTitle.textContent = `Year ${GameState.world.day} Complete`;
    this.dom.dayManaCount.textContent = GameState.session.dayManaGathered;
    this.dom.daySold.textContent = GameState.market.manaSoldToday;
    this.dom.dayWasted.textContent = GameState.session.dayManaCollected;
    this.dom.dayRevenue.textContent = GameState.market.manaSoldToday * GameState.market.sellPrice;
    this.dom.dayScore.textContent = GameState.player.score;
    this.dom.dayHealth.textContent = Math.round(GameState.player.health);
    this.dom.dayHealthStatus.textContent = game.getHealthStatus();
    this.dom.dayWealth.textContent = GameState.player.money;

    this.dom.dayHealthBar.style.width = Math.max(0, GameState.player.health) + '%';
    this.dom.dayWealthBar.style.width = Math.min(100, (GameState.player.money / 500) * 100) + '%';

    if (GameState.player.health <= 30) {
      this.dom.dayHealthBar.style.background = 'linear-gradient(90deg, #a8392c, #7a2118)';
    } else if (GameState.player.health <= 60) {
      this.dom.dayHealthBar.style.background = 'linear-gradient(90deg, #e0ad4f, #b8862f)';
    } else {
      this.dom.dayHealthBar.style.background = 'linear-gradient(90deg, #6f8a3f, #91ab53)';
    }

    this.dom.dayEndBtn.textContent = GameState.player.health <= 0 ? 'Game Over' : `Continue to Year ${GameState.world.day + 1}`;
  }

  showGameOver(game, faith = null) {
    this.hideAllModals();
    document.getElementById('survivalHud').hidden = true;
    const campHud = document.getElementById('campStatusHud'); if (campHud) campHud.hidden = true;
    this.dom.hud.style.display = 'none';
    if (this.dom.journeyHud) this.dom.journeyHud.hidden = true;
    if (this.dom.vitals) this.dom.vitals.hidden = true;
    this.dom.gameOverModal.classList.add('active');
    this.dom.finalScore.textContent = GameState.player.score;
    this.dom.survivedDays.textContent = GameState.world.day;

    const faithBox = document.getElementById('gameOverFaith');
    if (faithBox && faith) {
      const label = game.wildernessManager
        ? game.wildernessManager.faithfulnessLabel(faith.faithfulnessRating)
        : '';
      faithBox.innerHTML =
        `<div class="gameover-faith-rating">Leadership: <span>${faith.faithfulnessRating}</span> — ${label}</div>` +
        `<div class="gameover-faith-grid">` +
        `<span>Disobeyed (peak): ${faith.peakDisobeyed || 0}</span>` +
        `<span>Hungry now: ${faith.campHungry || 0}</span>` +
        `<span>Thirsty now: ${faith.campThirsty || 0}</span>` +
        `<span>Afflicted now: ${faith.campAfflicted || 0}</span>` +
        `<span>People cared for: ${faith.peopleCaredFor || 0}</span>` +
        `<span>Calf crises confronted: ${faith.calfCrisesConfronted || 0}</span>` +
        `<span>Silver tithed: ${faith.silverTithed || 0}</span>` +
        `<span>Manna wasted: ${faith.mannaWasted || 0}</span>` +
        `</div>`;
      faithBox.style.display = 'block';
    } else if (faithBox) {
      faithBox.style.display = 'none';
    }
  }

  showLocationPopup(name) {
    // This popup is disabled for now as it duplicates the in-world text.
    // The in-world text is now the primary location indicator.
    return;
  }

  // ===================================================================
  // WILDERNESS ECONOMY UI (tithe narrative, evening temptations, faith)
  // ===================================================================

  /** A stacking parchment toast for narrative events ("The Levites collect..."). */
  showNarrative(msg) {
    let container = document.getElementById('narrativeToasts');
    if (!container) {
      container = document.createElement('div');
      container.id = 'narrativeToasts';
      container.className = 'narrative-toasts';
      document.getElementById('gameContainer').appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'narrative-toast';
    el.textContent = msg;
    container.appendChild(el);
    // Fade in, hold, then remove.
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => el.classList.remove('show'), 4200);
    setTimeout(() => el.remove(), 4800);
  }

  showEvening(game) {
    this.hideAllModals();
    document.getElementById('survivalHud').hidden = true;
    const campHud = document.getElementById('campStatusHud'); if (campHud) campHud.hidden = true;
    this.dom.hud.style.display = 'none';
    if (this.dom.journeyHud) this.dom.journeyHud.hidden = true;
    if (this.dom.vitals) this.dom.vitals.hidden = true;
    if (this.dom.eveningModal) this.dom.eveningModal.classList.add('active');
    this.refreshEvening(game, {});
  }

  hideEvening() {
    if (this.dom.eveningModal) this.dom.eveningModal.classList.remove('active');
  }

  refreshEvening(game, outcome = {}) {
    if (!game.wildernessManager) return;
    const info = game.wildernessManager.openEvening();
    const camp = info.camp || GameState.wilderness.camp || {};

    const narrativeEl = document.getElementById('eveningNarrative');
    if (narrativeEl) {
      if (outcome.calfAction === 'confront') narrativeEl.textContent = 'Moses confronts the Golden Calf and calls the people back.';
      else if (outcome.calfAction === 'intercede') narrativeEl.textContent = 'Moses intercedes for the people and pleads for mercy.';
      else if (outcome.calfAction === 'ignore') narrativeEl.textContent = outcome.calfResult?.plague ? 'The Calf is tolerated, and a plague strikes the camp.' : 'The Calf draws people away, and disobedience spreads.';
      else if (outcome.serpentAction === 'lift') narrativeEl.textContent = `Moses lifts the Bronze Serpent. ${outcome.serpentResult?.healed || 0} afflicted are healed.`;
      else if (outcome.serpentAction === 'care') narrativeEl.textContent = `Moses organizes care for the camp. ${outcome.serpentResult?.healed || 0} afflicted are tended.`;
      else if (outcome.serpentAction === 'ignore') narrativeEl.textContent = 'The afflicted are left waiting through the night.';
      else narrativeEl.textContent = 'Moses, your people need your judgment before dawn.';
    }
    const report = document.getElementById('eveningCampReport');
    if (report) report.innerHTML = `<strong>Camp status</strong><div class="camp-report-grid"><span>Population ${camp.population || 0}</span><span>Disobeyed ${camp.disobeyed || 0}</span><span>Hungry ${camp.hungry || 0}</span><span>Thirsty ${camp.thirsty || 0}</span><span>Afflicted ${camp.afflicted || 0}</span></div>`;

    const calfDesc = document.getElementById('calfDesc');
    if (calfDesc) calfDesc.innerHTML = `People are tempted by the Golden Calf. <strong>${info.calf?.risk || 0}</strong> may disobey tonight.` +
      `<br><span class="evening-cost">Confront: -${info.calf?.cost || 8} wellbeing</span> · <span class="evening-cost">Intercede: -${info.calf?.intercedeCost || 12} silver</span> · <span class="evening-risk">Allow: disobedience rises</span>`;
    const chosenCalf = outcome.calfAction || GameState.session.eveningChoices?.calf;
    const disableCalf = !!chosenCalf;
    ['calfConfrontBtn','calfIntercedeBtn','calfIgnoreBtn'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = disableCalf || (id==='calfIntercedeBtn' && GameState.player.money < (info.calf?.intercedeCost || 12)); });

    const serpent = info.serpent || {};
    const serpentDesc = document.getElementById('serpentDesc');
    const serpentOption = document.getElementById('serpentOption');
    if (serpentDesc) serpentDesc.innerHTML = serpent.relevant
      ? `Affliction troubles the camp. <strong>${serpent.need || camp.afflicted || 0}</strong> need help.` +
        `<br><span class="evening-cost">Lift Serpent: -${serpent.cost || 15} silver</span> · <span class="evening-cost">Care: -${serpent.careCost || 10} silver</span> · <span class="evening-risk">Do nothing: suffering grows</span>`
      : 'The camp is calm tonight. Keep watch over the people.';
    const chosenSerpent = outcome.serpentAction || GameState.session.eveningChoices?.serpent;
    const disableSerpent = !!chosenSerpent || !serpent.relevant;
    ['serpentLiftBtn','serpentCareBtn','serpentIgnoreBtn'].forEach(id => { const el = document.getElementById(id); if (!el) return; el.disabled = disableSerpent || (id==='serpentLiftBtn' && !serpent.affordable) || (id==='serpentCareBtn' && GameState.player.money < (serpent.careCost || 10)); });
    if (serpentOption) serpentOption.classList.toggle('evening-option-muted', !serpent.relevant);

    // Resting is always available. An unresolved crisis carries its own cost,
    // but it must never leave the player trapped on this screen.
    const restBtn = document.getElementById('eveningRestBtn');
    if (restBtn) {
      restBtn.disabled = false;
      restBtn.setAttribute('aria-label', 'Rest until dawn and continue');
    }
    const hint = document.querySelector('#eveningModal .evening-hint');
    if (hint) hint.textContent = 'Choose a response where you can, then rest until dawn. Resting is always available.';
  }

  setDayNightIcon(mode) {
    const btn = document.getElementById('dayNightBtn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (icon) icon.className = mode === 'night' ? 'fas fa-moon' : 'fas fa-sun';
  }

  toggleFaithPanel(game) {
    if (!this.dom.faithPanel) return;
    const opening = !this.dom.faithPanel.classList.contains('open');
    if (opening) this.updateFaithPanel(game);
    this.dom.faithPanel.classList.toggle('open');
  }

  updateFaithPanel(game) {
    const w = GameState.wilderness || {};
    const stats = w.stats || {};
    const camp = w.camp || {};
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setText('faithPopulation', camp.population || 0);
    setText('faithDisobeyed', camp.disobeyed || 0);
    setText('faithHungry', camp.hungry || 0);
    setText('faithThirsty', camp.thirsty || 0);
    setText('faithAfflicted', camp.afflicted || 0);
    setText('faithCared', camp.caredFor || 0);
    setText('faithTithed', stats.silverTithed || 0);
    setText('faithWrath', w.wrath || 0);
    const cond = (w.conditions && w.conditions.length) ? w.conditions.join(', ') : 'None';
    setText('faithConditions', cond);

    // The twelve tribes are not a choice: their populations are campaign stats.
    const tribeList = document.getElementById('faithTribes');
    if (tribeList) {
      const tribes = Array.isArray(game?.tribes) ? game.tribes : [];
      if (!tribes.length) {
        tribeList.innerHTML = '';
      } else {
        const total = tribes.reduce((sum, tribe) => sum + (Number(tribe.population) || 0), 0);
        tribeList.innerHTML = `<h3 class="faith-tribes-title">The Twelve Tribes</h3>` +
          `<div class="faith-tribe-grid">` +
          tribes.map((tribe) => `<div class="faith-tribe"><i class="faith-tribe-dot" style="background:${tribe.color}"></i><span class="faith-tribe-name">${tribe.name}</span><b>${Number(tribe.population || 0).toLocaleString()}</b></div>`).join('') +
          `</div><div class="faith-tribes-total">Souls of Israel <b>${total.toLocaleString()}</b></div>`;
      }
    }
  }
}