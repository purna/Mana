import * as THREE from 'three';
import Stats from '../plugins/stats.module.js';
import { GUI } from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/dist/lil-gui.esm.js';
import FastNoiseLite from '../plugins/FastNoiseLite.js'; // Your FastNoiseLite import is correct
import { config as gameConfig } from './config.js'; // This was correct, but I'm confirming it's here.
import { GameState, GameSummary, createWildernessState, createMapState } from './GameState.js';import { AudioManager } from './AudioManager.js';
import { WeatherManager, weatherForDay, weatherExposure } from './WeatherManager.js';
import { PlayerManager } from './PlayerManager.js';
import { SceneManager } from './SceneManager.js';
import { UIManager } from './UIManager.js';
import { ParticleManager } from './ParticleManager.js';
import { SaveManager } from './SaveManager.js';
import { MarketSimulation } from './MarketSimulation.js';
import { DayNightManager } from './DayNightManager.js';
import { WildernessManager } from './WildernessManager.js';
import { JourneyManager } from './JourneyManager.js';
import { PillarManager } from './PillarManager.js';
import { TerrainStreamer } from './TerrainStreamer.js';
import { MapManager } from './MapManager.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

export class Game {
  constructor(loadingScreen) {
    this.loadingScreen = loadingScreen;

    // Internal state
    this.manaQuota = 0;
    this.marketSimulation = new MarketSimulation();
    this.input = { up: false, down: false, left: false, right: false };
    this.clickTarget = null;
    this.mobileVisible = matchMedia('(pointer: coarse), (max-width: 650px), (max-height: 500px) and (max-width: 900px)').matches;
    this.frameScale = 1;
    this.animationTime = 0;

    this.tileUpdateTimer = 0;
    this.tileUpdateInterval = 0.5; // seconds
    this.colors = gameConfig.scene.colors;

    // Terrain generation
    this.terrain = {
      noise: null,
      scale: gameConfig.terrain.scale,
      height: gameConfig.terrain.height,
      octaves: gameConfig.terrain.octaves,
      persistence: gameConfig.terrain.persistence,
      lacunarity: gameConfig.terrain.lacunarity,
      noiseEnabled: gameConfig.terrain.noiseEnabled,
    };
    // Managers
    this.ripples = {
      enabled: this.terrain.noiseEnabled,
      amplitude: 0.2,
    };
    this.scenery = [];
    this.tileHeightGrids = {};
    this.TILE_SIZE = gameConfig.scene.tileSize;
    this.GRID_RADIUS = gameConfig.scene.gridRadius;
    this.audioManager = null;
    this.playerManager = null;
    this.sceneManager = null;
    this.uiManager = null;
    this.particleManager = null;
    this.saveManager = null;
    this.dayNightManager = null;
    this.wildernessManager = null;
    this.journeyManager = null;
    this.pillarManager = null;
    this.terrainStreamer = null;
    this.mapManager = null;
    this.mapOpen = false;
    this.useRealTerrain = !!gameConfig.terrain.real?.enabled;
    this.sprint = false;
    this.stats = null;
    this.gui = null;

    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = null;
    this.composer = null;
    this.sunLight = null;
    this.vignettePass = null;
    this.torchLight = null;
    this.sandTexture = null;
    this.clock = new THREE.Clock();

    // Scene objects
    this.manaPickups = [];
    this.waterPickups = [];
    this.restPickups = [];
    this.locationSprites = [];
    this.obstacleColliders = [];
    this.birds = [];
    this.tiles = {};
    this.TILE_SIZE = gameConfig.scene.tileSize;
    this.GRID_RADIUS = gameConfig.scene.gridRadius;
  }

  async init() {
    this.loadingScreen.setProgress(10);
    this.audioManager = new AudioManager();
    this.playerManager = new PlayerManager(this);
    this.uiManager = new UIManager(this);
    this.sceneManager = new SceneManager(this);
    this.saveManager = new SaveManager(this);
    this.mapManager = new MapManager(this);
    this.dayNightManager = new DayNightManager(this);
    this.wildernessManager = new WildernessManager(this);
    this.journeyManager = new JourneyManager(this);
    this.loadingScreen.setProgress(25);

    if (this.terrain.noiseEnabled) {
      this.terrain.noise = new FastNoiseLite();
      this.terrain.noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
      // Neutralize FastNoiseLite's built-in frequency/fractal handling —
      // getTerrainHeight() already does its own scale/octave/persistence/lacunarity loop,
      // so we want GetNoise() to behave like a raw single-octave sampler (same as
      // simplex-noise's createNoise2D() did) rather than double-applying frequency.
      this.terrain.noise.SetFrequency(1);
      this.terrain.noise.SetFractalType(FastNoiseLite.FractalType.None);
      // Optional: randomize the seed each load, since simplex-noise did this by default.
      // Leave it out if you want the same terrain every time you refresh.
      // this.terrain.noise.SetSeed(Math.floor(Math.random() * 65536));
    } else {
      console.warn('FastNoiseLite failed to load; terrain will be flat.');
    }

    this.sandTexture = this.generateSandTexture();
    await this.loadTribes();
    this.setupEventListeners();
    this.loadingScreen.setProgress(40);

    await this.createThreeJsScene();
    this.weatherManager = new WeatherManager(this);
    this.loadingScreen.setProgress(85);
    if (this.dayNightManager) this.dayNightManager.init();
    this.setupPostProcessing();
    this.loadingScreen.setProgress(97);
    this.animate();

    if (gameConfig.debug && gameConfig.debug.stats) {
      this.stats = new Stats();
      this.stats.showPanel(0); // 0: fps, 1: ms, 2: mem
      document.body.appendChild(this.stats.dom);
      this.stats.dom.style.position = 'fixed';
      this.stats.dom.style.zIndex = '9999';
      this.stats.dom.style.top = '0px';
      this.stats.dom.style.transformOrigin = 'top left';
      this.stats.dom.style.transform = 'scale(2)'; // You can change 2 to 1.5, 3, etc. to make it bigger or smaller

    }

    if (gameConfig.debug.gui) {
      this.gui = new GUI();
      this.setupGUI();
    }

    // Load any previous save summary so the menu can offer "Continue Journey".
    await this.saveManager.loadSummary();

    // If there's no active game state from a load, go to menu
    if (GameState.world.gameState === 'menu') this.showMenu();

    this.setupUIEventListeners(); // Set up UI listeners after potential state load

    this.loadingScreen.hide();
  }

  setupGUI() {
    if (!this.gui) return;
    const gameplay = this.gui.addFolder("Gameplay");
    gameplay.add(GameState.world, "timeLeft", 10, 120, 1).name("Day Length (s)");
    gameplay.add(GameState.world, "day", 1, 100, 1).name("Current Day");

    const player = this.gui.addFolder("Player").onFinishChange(() => {
      this.playerManager.updatePlayerAppearance();
    });
    player.addColor(GameState.player, "headColor").name("Head Color");
    player.addColor(GameState.player, "bodyColor").name("Body Color");
    player.addColor(GameState.player, "dressColor").name("Dress Color");
    player.add(GameState.player, "money", 0, 1000);

    const market = this.gui.addFolder("Market");
    market.add(GameState.market, "sellPrice", 1, 10, 1).name("Sell Price");
    market.add(GameState.market, "dailyDemand", 10, 100, 1).name("Daily Demand");

    const lighting = this.gui.addFolder("Lighting");
    lighting.add(this.sunLight, "intensity", 0, 3).name("Sun Intensity");
    lighting.addColor(gameConfig.scene.colors, 'fogColor').name('Fog Color').onChange((value) => {
      this.scene.fog.color.set(value);
    });
    lighting.add(this.scene.fog, "near", 5, 100).name("Fog Near");
    lighting.add(this.scene.fog, "far", 20, 300).name("Fog Far");

    const sceneColors = this.gui.addFolder("Scene Colors");
    sceneColors.addColor(this.colors, 'skyColor1').name('Sky Top').onChange(() => this.updateSky());
    sceneColors.addColor(this.colors, 'skyColor2').name('Sky Middle').onChange(() => this.updateSky());
    sceneColors.addColor(this.colors, 'skyColor3').name('Sky Low').onChange(() => this.updateSky());
    sceneColors.addColor(this.colors, 'skyColor4').name('Sky Bottom').onChange(() => this.updateSky());
    sceneColors.addColor(this.colors, 'terrainColor1').name('Terrain Low').onFinishChange(() => this.rebuildWorld());
    sceneColors.addColor(this.colors, 'terrainColor2').name('Terrain Mid-Low').onFinishChange(() => this.rebuildWorld());
    sceneColors.addColor(this.colors, 'terrainColor3').name('Terrain Mid-High').onFinishChange(() => this.rebuildWorld());
    sceneColors.addColor(this.colors, 'terrainColor4').name('Terrain High').onFinishChange(() => this.rebuildWorld());


    const postProcessing = this.gui.addFolder("Post-processing");
    postProcessing.add(this.bloomPass, "strength", 0, 2, 0.05).name("Bloom Strength");
    postProcessing.add(this.bloomPass, "radius", 0, 1, 0.01).name("Bloom Radius");
    postProcessing.add(this.bloomPass, "threshold", 0, 1, 0.01).name("Bloom Threshold");
    postProcessing.add(this.vignettePass.uniforms.offset, 'value', 0, 2, 0.05).name('Vignette Offset');
    postProcessing.add(this.vignettePass.uniforms.darkness, 'value', 0, 2, 0.05).name('Vignette Darkness');

    const terrainGUI = this.gui.addFolder("Terrain");
    terrainGUI.add(this.terrain, 'noiseEnabled').name('Enable Noise').onFinishChange(() => this.rebuildWorld());
    terrainGUI.add(this.ripples, 'enabled').name('Enable Ripples').onFinishChange(() => this.rebuildWorld());
    terrainGUI.add(this.ripples, 'amplitude', 0, 1, 0.05).name('Ripple Amplitude').onFinishChange(() => this.rebuildWorld());
    terrainGUI.add(this.terrain, 'scale', 0.001, 0.1, 0.001).name('Noise Scale').onFinishChange(() => this.rebuildWorld());
    terrainGUI.add(this.terrain, 'height', 0, 20, 0.5).name('Noise Height').onFinishChange(() => this.rebuildWorld());
    terrainGUI.add(this.terrain, 'octaves', 1, 8, 1).name('Noise Octaves').onFinishChange(() => this.rebuildWorld());


    const camera = this.gui.addFolder("Camera");
    camera.add(this.camera, "fov", 40, 90).onChange(() => {
      this.camera.updateProjectionMatrix();
    });

    const debug = this.gui.addFolder("Debug");
    debug.add(this, 'endDay').name('End Day');
    debug.add(this, 'gameOver').name('Game Over');
    debug.add(this.saveManager, 'saveGame').name('Save Game');
    debug.add(this.saveManager, 'loadGame').name('Load Game & Reload');
    debug.add(this.saveManager, 'newGame').name('New Game (Deletes Save)');
  }

  updateSky() {
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 256;
    skyCanvas.height = 256;
    const ctx = skyCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, gameConfig.scene.colors.skyColor1);
    gradient.addColorStop(0.3, gameConfig.scene.colors.skyColor2);
    gradient.addColorStop(0.7, gameConfig.scene.colors.skyColor3);
    gradient.addColorStop(1, gameConfig.scene.colors.skyColor4);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    if (this.scene.background && this.scene.background.dispose) {
      this.scene.background.dispose();
    }

    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    this.scene.background = skyTexture;
  }

  generateSandTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Create a fine grainy pattern
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const ripple = Math.sin(2 * Math.PI * (y / size * 12 + 0.3 * Math.sin(x / size * Math.PI * 2)));
        const noise = Math.random() * 12 + ripple * 9;
        ctx.fillStyle = `rgb(${220 + noise}, ${190 + noise}, ${150 + noise})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.anisotropy = 4; // Tile the texture for finer grain
    return texture;
  }

  getTerrainHeight(x, z) {
    if (!this.terrain.noiseEnabled || !this.terrain.noise) return 0;

    let height = 0;
    let frequency = this.terrain.scale;
    let amplitude = this.terrain.height;

    for (let i = 0; i < this.terrain.octaves; i++) {
      height += this.terrain.noise.GetNoise(x * frequency, z * frequency) * amplitude;
      amplitude *= this.terrain.persistence;
      frequency *= this.terrain.lacunarity;
    }

    if (this.ripples.enabled) {
      const ripple1 = Math.sin(x * 0.15 + z * 0.05) * this.ripples.amplitude;
      const ripple2 = Math.sin(x * 0.04 - z * 0.08) * (this.ripples.amplitude * 0.7);
      const microGrain = Math.sin(x * 1.2) * Math.cos(z * 1.2) * (this.ripples.amplitude * 0.1);
      height += ripple1 + ripple2 + microGrain;
    }

    return height;
  }

  /** True when a world position is inside a station spring, sea or oasis. */
  isWaterAt(x, z) {
    return !!this.terrainStreamer?.isWaterAt?.(x, z);
  }

  /** Re-ground static scenery after a terrain section receives new heights. */
  regroundScenery() {
    if (!this.terrainStreamer?.active) return;
    const reground = (obj) => {
      if (!obj?.userData?.groundAnchored) return;
      const offset = obj.userData.groundOffset || 0;
      obj.position.y = this.getSurfaceHeight(obj.position.x, obj.position.z) + offset;
      if (obj.userData.localAnchors) {
        for (const anchor of obj.userData.localAnchors) {
          const wx = obj.position.x + anchor.lx;
          const wz = obj.position.z + anchor.lz;
          anchor.object.position.y = this.getSurfaceHeight(wx, wz) - obj.position.y + anchor.yOffset;
        }
      }
    };
    for (const obj of this.scenery) reground(obj);
    for (const obj of this.locationSprites) reground(obj);
    for (const obj of this.obstacleColliders) reground(obj);
    const target = this.journeyManager?.getTarget?.();
    if (target && this.pillarManager) this.pillarManager.target = target;
  }

  getSurfaceHeight(x, z) {
    if (this.terrainStreamer?.active) return this.terrainStreamer.getSurfaceHeight(x, z);
    const gx = Math.round(x / this.TILE_SIZE);
    const gz = Math.round(z / this.TILE_SIZE);
    const tileGrid = this.tileHeightGrids[`${gx},${gz}`];
    if (!tileGrid) return this.getTerrainHeight(x, z);

    const { grid, gridSize, segmentSize, size, centerX, centerZ } = tileGrid;
    const localX = x - centerX;
    const localY = centerZ - z; // inverse of worldZ = -localY + centerZ, used in createTile

    // Fractional grid-space coordinates, clamped to the tile's valid range
    let fx = (localX + size / 2) / segmentSize;
    // PlaneGeometry stores rows from +localY to -localY; world Z increases with the row.
    let fy = (size / 2 - localY) / segmentSize;
    const maxIdx = gridSize - 1;
    fx = Math.min(Math.max(fx, 0), maxIdx);
    fy = Math.min(Math.max(fy, 0), maxIdx);

    const ix0 = Math.floor(fx);
    const iy0 = Math.floor(fy);
    const ix1 = Math.min(ix0 + 1, maxIdx);
    const iy1 = Math.min(iy0 + 1, maxIdx);
    const tx = fx - ix0;
    const ty = fy - iy0;

    const h00 = grid[iy0 * gridSize + ix0];
    const h10 = grid[iy0 * gridSize + ix1];
    const h01 = grid[iy1 * gridSize + ix0];
    const h11 = grid[iy1 * gridSize + ix1];

    return tx + ty <= 1
      ? h00 + (h10 - h00) * tx + (h01 - h00) * ty
      : h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - ty);
  }

  rebuildTerrain() {
    if (this.useRealTerrain) return;
    // Clear existing tiles
    for (const key in this.tiles) {
      const mesh = this.tiles[key];
      this.scene.remove(mesh);

      mesh.geometry.dispose();
      mesh.material.dispose();
      delete this.tiles[key];
      delete this.tileHeightGrids[key];
    }

    // Re-create tiles around the player
    this.updateTileGrid();
  }

  rebuildWorld() {
    this.particleManager?.clear();
    if (this.playerManager) this.playerManager.dustEmitter = null;
    // Shared mesh resources are disposed once, including children of scenery groups.
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    const objects = new Set([...this.scenery, ...this.obstacleColliders, ...this.locationSprites]);
    for (const object of objects) {
      this.scene.remove(object);
      object.traverse(child => {
        if (child.geometry) geometries.add(child.geometry);
        for (const material of [].concat(child.material || [])) {
          materials.add(material);
          if (material.map && material.map !== this.sandTexture) textures.add(material.map);
        }
      });
    }
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    this.scenery = [];
    this.obstacleColliders = [];
    this.locationSprites = [];

    this.rebuildTerrain();
    this.sceneManager.createLandscape();
    if (this.sceneManager.createStations) this.sceneManager.createStations(this.journeyManager?.stations || []);
  }

  updateTileGrid() {
    if (this.useRealTerrain) return;
    const TILE = this.TILE_SIZE;
    const px = this.player?.position.x || 0;
    const pz = this.player?.position.z || 0;
    const playerGX = Math.floor((px + TILE / 2) / TILE);
    const playerGZ = Math.floor((pz + TILE / 2) / TILE);

    const keys = Object.keys(this.tiles);
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k];
      const [gx, gz] = key.split(',').map(Number);
      if (Math.abs(gx - playerGX) > this.GRID_RADIUS || Math.abs(gz - playerGZ) > this.GRID_RADIUS) {
        const mesh = this.tiles[key];
        this.scene.remove(mesh);
        delete this.tileHeightGrids[key];
        mesh.geometry.dispose();
        mesh.material.dispose();
        delete this.tiles[key];
      }
    }

    for (let dx = -this.GRID_RADIUS; dx <= this.GRID_RADIUS; dx++) {
      for (let dz = -this.GRID_RADIUS; dz <= this.GRID_RADIUS; dz++) {
        const gx = playerGX + dx;
        const gz = playerGZ + dz;
        const key = `${gx},${gz}`;
        if (!this.tiles[key]) {
          this.sceneManager.createTile(gx * TILE, gz * TILE);
        }
      }
    }
  }

  toggleAudio() {
    GameState.settings.muted = !GameState.settings.muted;
    if (GameState.world.gameState !== 'menu') this.saveManager.saveGame();
    Howler.mute(GameState.settings.muted);
    this.uiManager.toggleAudioIcon(GameState.settings.muted);
  }

  toggleAbout() {
    this.uiManager.toggleAbout();
    this.audioManager.play('click');
  }

  togglePause() {
    if (GameState.world.gameState !== 'playing') return;
    if (this.mapOpen) { this.closeMap(); return; }
    if (this.journeyManager?.state?.awaitingAdvance) return;
    if (document.querySelector('#prologueModal.active, #stationModal.active, #victoryModal.active, #endingModal.active')) return;
    GameState.world.paused = !GameState.world.paused;
    this.audioManager.play('pause');
    this.uiManager.togglePause(GameState.world.paused);
  }

  manualSave() {
    this.saveManager.saveGame();
    this.uiManager.createFloatingText('Game Saved!', window.innerWidth / 2, window.innerHeight / 2, '#5c6b3e');
    this.audioManager.play('sell'); // Re-using a pleasant sound for confirmation
  }

  toggleMobileControls() {
    this.mobileVisible = !this.mobileVisible;
    this.uiManager.toggleMobileControls(this.mobileVisible);
    this.audioManager.play('click');
  }

  toggleDayNight() {
    if (!this.dayNightManager || !this.dayNightManager.enabled) return;
    const mode = this.dayNightManager.toggle();
    this.uiManager.setDayNightIcon(mode);
    this.audioManager.play('click');
  }

  toggleFaithPanel(e) {
    // Stop the click from bubbling to the canvas/game world (defensive — the
    // faith panel overlays part of the play area).
    if (e && e.stopPropagation) e.stopPropagation();
    this.uiManager.toggleFaithPanel(this);
    this.audioManager.play('click');
  }

  /** True when the player stands at a place where water can be drawn. */
  isNearWater() {
    if (!this.player) return false;
    const p = this.player.position;
    const distances = [
      Math.hypot(p.x + 25, p.z + 15), // Oasis
      Math.hypot(p.x - 0, p.z - 25),  // Split Rock
    ];
    if (distances.some((d) => d < 13)) return true;
    const stations = this.journeyManager?.stations || [];
    return stations.some((station) =>
      ['waters', 'palms', 'shore', 'rock'].includes(station.kind) &&
      Math.hypot(p.x - station.pos[0], p.z - station.pos[1]) < 18
    );
  }

  /** Eat manna from the basket. This trades household food for strength. */
  eatManna() {
    if (GameState.world.gameState !== 'playing' || GameState.world.paused) return;
    const cfg = gameConfig.survival || {};
    const amount = cfg.eatManna ?? 2;
    if ((GameState.session.dayManaCollected || 0) < amount) {
      this.uiManager.createFloatingText('No manna in your basket', window.innerWidth / 2, window.innerHeight * 0.55, '#7a2118');
      this.uiManager.showNarrative?.('There is no manna in the basket. Gather from the white flakes on the sand.');
      return;
    }
    const p = GameState.player;
    if ((p.hunger ?? 100) >= 98) {
      this.uiManager.createFloatingText('You are not hungry', window.innerWidth / 2, window.innerHeight * 0.55, '#5c6b3e');
      return;
    }
    GameState.session.dayManaCollected -= amount;
    p.hunger = Math.min(100, (p.hunger ?? 0) + (cfg.eatHunger ?? 38));
    p.health = Math.min(100, p.health + (cfg.eatHealth ?? 6));
    p.faith = Math.min(100, (p.faith ?? 0) + (cfg.eatFaith ?? 1));
    this.audioManager.play('pickup');
    this.uiManager.createFloatingText(`+${cfg.eatHunger ?? 38} fed`, window.innerWidth / 2, window.innerHeight * 0.55, '#8be36b');
    this.uiManager.createStarBurst(window.innerWidth / 2, window.innerHeight * 0.55);
    this.uiManager.updateHUD();
  }

  /** Drink from the waterskin, or fill it if standing by water. */
  drinkWater() {
    if (GameState.world.gameState !== 'playing' || GameState.world.paused) return;
    const cfg = gameConfig.survival || {};
    const p = GameState.player;
    if ((p.waterskin ?? 0) <= 0) {
      if (this.isNearWater()) { this.fillWaterskin(); return; }
      this.uiManager.createFloatingText('Waterskin empty', window.innerWidth / 2, window.innerHeight * 0.55, '#7a2118');
      this.uiManager.showNarrative?.('Your waterskin is empty. Fill it at the Oasis, Split Rock, Marah or Elim.');
      return;
    }
    p.waterskin -= 1;
    p.hydration = Math.min(100, (p.hydration ?? 0) + (cfg.drinkHydration ?? 40));
    p.health = Math.min(100, p.health + (cfg.drinkHealth ?? 2));
    this.audioManager.play('water');
    this.uiManager.createFloatingText('+water', window.innerWidth / 2, window.innerHeight * 0.55, '#3fb6ff');
    this.uiManager.createStarBurst(window.innerWidth / 2, window.innerHeight * 0.55);
    this.uiManager.updateHUD();
  }

  fillWaterskin() {
    if (!this.isNearWater()) {
      this.uiManager.createFloatingText('No water here', window.innerWidth / 2, window.innerHeight * 0.55, '#7a2118');
      return;
    }
    const cfg = gameConfig.survival || {};
    const p = GameState.player;
    p.waterskin = cfg.waterskinCapacity ?? 3;
    p.hydration = Math.min(100, (p.hydration ?? 0) + (cfg.fillHydration ?? 26));
    this.audioManager.play('water');
    this.uiManager.createFloatingText('Waterskin filled', window.innerWidth / 2, window.innerHeight * 0.55, '#3fb6ff');
    this.uiManager.updateHUD();
  }

  /** Interact with the world: drink at water or warm at a fire. */
  interact() {
    if (GameState.world.gameState !== 'playing' || GameState.world.paused) return;
    if (this.isNearWater()) { this.fillWaterskin(); return; }
    if (!this.player) return;
    const p = this.player.position;
    const nearFire = Math.hypot(p.x - 20, p.z + 20) < 12 || Math.hypot(p.x + 20, p.z - 20) < 13;
    if (nearFire) {
      GameState.player.warmth = 100;
      GameState.player.faith = Math.min(100, (GameState.player.faith ?? 0) + 2);
      GameState.player.health = Math.min(100, GameState.player.health + 3);
      this.audioManager.play('click');
      this.uiManager.createFloatingText('Warmth restored', window.innerWidth / 2, window.innerHeight * 0.55, '#ffb257');
      this.uiManager.updateHUD();
      return;
    }
    this.uiManager.createFloatingText('Nothing to interact with here', window.innerWidth / 2, window.innerHeight * 0.55, '#5c6b3e');
  }

  advanceStation() {
    this.journeyManager?.advance();
    this.uiManager.updateHUD();
  }

  scheduleAutosave() {
    if (this._autosaveTimer) return;
    this._autosaveTimer = setTimeout(() => {
      this._autosaveTimer = null;
      if (GameState.world.gameState !== 'menu') this.saveManager?.saveGame?.();
    }, 1500);
  }

  toggleMap() {
    if (GameState.world.gameState !== 'playing') return;
    if (this.mapOpen) { this.closeMap(); return; }
    if (GameState.world.paused) return;
    this.mapOpen = true;
    GameState.world.paused = true;
    this.uiManager.showMap?.(this);
    this.audioManager.play('click');
  }

  closeMap() {
    if (!this.mapOpen) {
      this.uiManager.hideMap?.();
      return;
    }
    this.mapOpen = false;
    this.uiManager.hideMap?.();
    if (GameState.world.gameState === 'playing' && !document.querySelector('.modal.active:not(#mapModal)')) {
      GameState.world.paused = false;
    }
    this.saveManager?.saveGame?.();
    this.audioManager.play('click');
  }

  setupUIEventListeners() {
    // This function can be called multiple times, so we use a helper
    // to avoid adding duplicate listeners.
    const addClickListener = (id, handler) => {
      const element = document.getElementById(id);
      if (element) {
        // Remove old listener before adding new one
        if (element.handler) {
          element.removeEventListener('click', element.handler);
        }
        element.handler = handler.bind(this);
        element.addEventListener('click', element.handler);
      }
    };

    addClickListener('beginJourneyBtn', this.showDifficultyScreen);
    addClickListener('continueJourneyBtn', this.continueJourney.bind(this));
    addClickListener('newGameBtn', this.startNewGameWarning.bind(this));
    addClickListener('toHouseholdBtn', this.showHouseholdStep);
    addClickListener('backToTribeBtn', this.showMenu);
    addClickListener('backToMenuBtn', this.showMenu);
    addClickListener('dayEndBtn', this.continueToNextDay);
    addClickListener('tryAgainBtn', this.showDifficultyScreen);
    addClickListener('gameOverMenuBtn', this.showMenu);
    addClickListener('sellManaBtn', this.sellMana.bind(this));
    addClickListener('sellAllManaBtn', this.sellAllMana.bind(this));
    addClickListener('buyManaBtn', this.buyMana.bind(this));
    addClickListener('leaveMarketBtn', this.hideMarket.bind(this));
    addClickListener('calfConfrontBtn', () => this.respondToCalf('confront'));
    addClickListener('calfIntercedeBtn', () => this.respondToCalf('intercede'));
    addClickListener('calfIgnoreBtn', () => this.respondToCalf('ignore'));
    addClickListener('serpentLiftBtn', () => this.respondToSerpent('lift'));
    addClickListener('serpentCareBtn', () => this.respondToSerpent('care'));
    addClickListener('serpentIgnoreBtn', () => this.respondToSerpent('ignore'));
    addClickListener('goldenCalfBtn', this.activateGoldenCalf.bind(this));
    addClickListener('bronzeSerpentBtn', this.useBronzeSerpent.bind(this));
    addClickListener('eveningRestBtn', this.finishEvening.bind(this));
    addClickListener('eatBtn', this.eatManna.bind(this));
    addClickListener('drinkBtn', this.drinkWater.bind(this));
    addClickListener('interactBtn', this.interact.bind(this));
    addClickListener('stationContinueBtn', this.advanceStation.bind(this));
    addClickListener('prologueStartBtn', this.beginJourneyFromPrologue.bind(this));
    addClickListener('victoryBtn', this.restartJourney.bind(this));
    addClickListener('victoryMenuBtn', this.showMenu.bind(this));
    addClickListener('endingMenuBtn', this.showMenu.bind(this));
    addClickListener('resumeBtn', this.togglePause);
    addClickListener('manualSaveBtn', this.manualSave);
    addClickListener('pauseMenuBtn', this.showMenu);
    addClickListener('dayNightBtn', this.toggleDayNight);
    addClickListener('faithBtn', this.toggleFaithPanel);
    addClickListener('closeFaith', this.toggleFaithPanel);
    addClickListener('mapBtn', this.toggleMap.bind(this));
    addClickListener('closeMap', this.closeMap.bind(this));
    addClickListener('closeMapBtn', this.closeMap.bind(this));
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    document.getElementById('canvas').addEventListener('click', (e) => this.handleClick(e));

    ['Up', 'Down', 'Left', 'Right'].forEach(direction => {
      const button = document.getElementById('btn' + direction);
      const key = direction.toLowerCase();
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (GameState.world.gameState !== 'playing' || GameState.world.paused) return;
        button.setPointerCapture(event.pointerId);
        this.input[key] = true;
        this.clickTarget = null;
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
        button.addEventListener(type, () => { this.input[key] = false; });
      });
    });
    const release = () => {
      Object.keys(this.input).forEach(key => { this.input[key] = false; });
      this.sprint = false;
      this.clickTarget = null;
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        release();
        if (GameState.world.gameState === 'playing' && !GameState.world.paused) this.togglePause();
      }
    });
    window.addEventListener('resize', () => this.onWindowResize());
    document.getElementById('btnJump').addEventListener('pointerdown', event => {
      event.preventDefault(); this.jump();
    });
    document.getElementById('quickStartBtn').addEventListener('click', () => {
      this.selectTribe('judah'); this.startGame('single');
    });
    document.getElementById('makeCampBtn').addEventListener('click', () => {
      if (GameState.world.gameState !== 'playing' || GameState.world.paused) return;
      const target = this.journeyManager?.getTarget();
      const atOriginCamp = Math.hypot(this.player.position.x - 20, this.player.position.z + 20) <= 12;
      const atPillarCamp = !!target && Math.hypot(this.player.position.x - target.x, this.player.position.z - target.z) <= 14;
      if (!atOriginCamp && !atPillarCamp) return;
      this.endDay();
    });
    const credits = document.getElementById('creditsModal');
    document.getElementById('creditsBtn').addEventListener('click', () => {
      if (GameState.world.gameState === 'playing' && !GameState.world.paused) this.togglePause();
      credits.classList.add('active');
    });
    document.getElementById('closeCredits').addEventListener('click', () => credits.classList.remove('active'));

    document.getElementById('audioBtn').addEventListener('click', () => this.toggleAudio());
    document.getElementById('aboutBtn').addEventListener('click', () => this.toggleAbout());
    document.getElementById('closeAbout').addEventListener('click', () => this.toggleAbout());
    document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
    document.getElementById('mobileToggleBtn').addEventListener('click', () => this.toggleMobileControls());

    // Setup for buttons that trigger game state changes
    document.querySelectorAll('.btn-difficulty').forEach(btn => {
      btn.addEventListener('click', () => {
        this.startGame(btn.dataset.difficulty);
        this.audioManager.play('click');
      });
    });
  }

  handleKeyDown(e) {
    const key = (e.key || '').toLowerCase();
    if (e.key === 'Escape') {
      this.togglePause();
      return;
    }
    // If the player starts moving while the prologue is still open, begin the
    // journey instead of leaving them stuck behind the intro.
    if (GameState.world.gameState === 'playing' && GameState.world.paused
      && ['arrowup', 'w', 'arrowdown', 's', 'arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
      const prologue = document.getElementById('prologueModal');
      if (prologue?.classList.contains('active')) this.beginJourneyFromPrologue();
    }
    if (key === 'arrowup' || key === 'w') this.input.up = true;
    if (key === 'arrowdown' || key === 's') this.input.down = true;
    if (key === 'arrowleft' || key === 'a') this.input.left = true;
    if (key === 'arrowright' || key === 'd') this.input.right = true;
    if (key === ' ' || e.code === 'Space' || key === 'enter') {
      const station = document.getElementById('stationModal');
      if (station?.classList.contains('active')) {
        e.preventDefault();
        this.advanceStation();
        return;
      }
      if (key === ' ' || e.code === 'Space') {
        e.preventDefault(); // stop the page from scrolling
        this.jump();
      }
    }
    if (key === 'enter') {
      const evening = document.getElementById('eveningModal');
      if (evening?.classList.contains('active')) {
        e.preventDefault();
        this.finishEvening();
        return;
      }
    }
    if (key === 'm') { this.toggleMap(); return; }
    if (key === 'shift') this.sprint = true;
    if (key === 'e') this.interact();
    if (key === 'f') this.eatManna();
    if (key === 'r') this.drinkWater();
  }

  jump() {
    if (GameState.world.gameState !== 'playing' || GameState.world.paused) return;
    this.playerManager.jump();
  }

  handleKeyUp(e) {
    const key = (e.key || '').toLowerCase();
    if (key === 'arrowup' || key === 'w') this.input.up = false;
    if (key === 'arrowdown' || key === 's') this.input.down = false;
    if (key === 'arrowleft' || key === 'a') this.input.left = false;
    if (key === 'arrowright' || key === 'd') this.input.right = false;
    if (key === 'shift') this.sprint = false;
  }

  handleClick(e) {
    if (GameState.world.gameState !== 'playing') return;
    if (e.target.id !== 'canvas' || GameState.world.paused) return;

    const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);

    if (!this.camera) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const grounds = this.terrainStreamer?.active ? this.terrainStreamer.getMeshes() : Object.values(this.tiles);
    if (grounds.length === 0) return;

    const intersection = raycaster.intersectObjects(grounds);
    if (intersection.length > 0) {
      const point = intersection[0].point;
      this.clickTarget = new THREE.Vector3(point.x, point.y, point.z);
    }
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.composer) {
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  async createThreeJsScene() {
    this.scene = new THREE.Scene();
    this.uiScene = new THREE.Scene();
    this.cameraHeading = new THREE.Vector3(0, 0, -1);
    // Create the particle manager before building the landscape, so scenery
    // emitters (campfire, temple sparkles, market confetti) actually spawn.
    this.particleManager = new ParticleManager(this.scene);
    this.updateSky();

    const ambientLight = new THREE.AmbientLight(0xffffff, gameConfig.scene.ambientLight.intensity);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(gameConfig.scene.hemiLight.skyColor, gameConfig.scene.hemiLight.groundColor, gameConfig.scene.hemiLight.intensity);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffe5b4, gameConfig.scene.sunLight.intensity);
    sunLight.position.set(gameConfig.scene.sunLight.pos.x, gameConfig.scene.sunLight.pos.y, gameConfig.scene.sunLight.pos.z);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = gameConfig.scene.sunLight.shadow.mapSize;
    sunLight.shadow.mapSize.height = gameConfig.scene.sunLight.shadow.mapSize;
    sunLight.shadow.camera.near = gameConfig.scene.sunLight.shadow.camera.near;
    sunLight.shadow.camera.far = gameConfig.scene.sunLight.shadow.camera.far;
    sunLight.shadow.camera.left = gameConfig.scene.sunLight.shadow.camera.left;
    sunLight.shadow.camera.right = gameConfig.scene.sunLight.shadow.camera.right;
    sunLight.shadow.camera.top = gameConfig.scene.sunLight.shadow.camera.top;
    sunLight.shadow.camera.bottom = gameConfig.scene.sunLight.shadow.camera.bottom;
    sunLight.shadow.bias = gameConfig.scene.sunLight.shadow.bias;
    sunLight.shadow.normalBias = gameConfig.scene.sunLight.shadow.normalBias;
    sunLight.shadow.radius = gameConfig.scene.sunLight.shadow.radius;
    const sunTarget = new THREE.Object3D();
    this.scene.add(sunTarget);
    sunLight.target = sunTarget;
    this.scene.add(sunLight);
    this.sunLight = sunLight;

    this.scene.fog = new THREE.Fog(gameConfig.scene.colors.fogColor, gameConfig.scene.fog.near, gameConfig.scene.fog.far);

    if (this.useRealTerrain) {
      try {
        this.terrainStreamer = new TerrainStreamer(this);
        await this.terrainStreamer.initAsync();
      } catch (err) {
        console.warn('[terrain] Streaming terrain failed; using procedural terrain.', err);
        this.terrainStreamer?.dispose?.();
        this.terrainStreamer = null;
        this.useRealTerrain = false;
        this.updateTileGrid();
      }
    } else {
      this.updateTileGrid(); // Create initial tiles before placing objects on them
    }
    this.sceneManager.createLandscape();
    this.sceneManager.createStations(this.journeyManager?.stations || []);
    this.pillarManager = new PillarManager(this);
    this.sceneManager.createBirds();
    this.player = this.playerManager.createPlayer();
    this.player.position.set(0, this.getSurfaceHeight(0, 0), 0);
    this.scene.add(this.player);

    this.camera = new THREE.PerspectiveCamera(gameConfig.camera.initialFov, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(this.player.position.x + 25, this.player.position.y + 30, this.player.position.z + 25);
    this.camera.lookAt(this.player.position.x, this.player.position.y + 0.9, this.player.position.z);

    const canvas = document.getElementById('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = gameConfig.postprocessing.toneMappingExposure;
    this.renderer.vertexColors = true;
  }

  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      gameConfig.postprocessing.bloom.strength,
      gameConfig.postprocessing.bloom.radius,
      gameConfig.postprocessing.bloom.threshold
    );
    this.composer.addPass(this.bloomPass);

    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms['offset'].value = gameConfig.postprocessing.vignette.offset;
    this.vignettePass.uniforms['darkness'].value = gameConfig.postprocessing.vignette.darkness;
    this.composer.addPass(this.vignettePass);
  }

  async loadTribes() {
    try {
      const data = await fetch('./js/tribes.json');
      const json = await data.json();
      this.tribes = json.tribes || [];
      this.tribeMap = Object.fromEntries(this.tribes.map((t) => [t.id, t]));
    } catch (err) {
      console.error('Failed to load tribes.json:', err);
      this.tribes = [];
      this.tribeMap = {};
    }
    // Build the tribe selection buttons once the data is available.
    if (this.uiManager && this.tribes.length) {
      this.uiManager.buildTribeButtons(this.tribes);
    }
  }

  getTribe() {
    return this.tribeMap[GameState.player.selectedTribe] || this.tribes[0] || null;
  }

  getDifficultySettings() {
    // Combined profile: Tribe base settings modified by the chosen Household size.
    const tribe = this.getTribe();
    const mod = gameConfig.household[GameState.world.difficulty] || gameConfig.household.couple;
    const spawnMult = gameConfig.manna.spawnMultiplier ?? 1;
    if (!tribe) {
      // Fallback if tribes failed to load.
      return { moveSpeed: 0.12 * mod.moveSpeed, manaCount: Math.round(100 * mod.manaCount),
        moveDrain: 0.02 * mod.moveDrain, quota: Math.round(35 * mod.quota), startHealth: 100, startMoney: 0 };
    }
    const s = tribe.settings;
    return {
      moveSpeed: s.moveSpeed * mod.moveSpeed,
      manaCount: Math.max(1, Math.round(s.manaCount * mod.manaCount * spawnMult)),
      moveDrain: s.moveDrain * mod.moveDrain,
      quota: Math.max(1, Math.round(s.quota * mod.quota)),
      startMoney: s.startMoney,
      startHealth: s.startHealth,
    };
  }

  selectTribe(tribeId) {
    GameState.player.selectedTribe = tribeId;
    const tribe = this.getTribe();
    if (tribe && tribe.color) {
      GameState.player.dressColor = parseInt(tribe.color.replace('#', '0x'));
    }
    this.playerManager.updatePlayerAppearance();
    this.uiManager.selectTribe(tribeId);
  }

  showMenu() {
    if (this.dayTimerInterval) clearInterval(this.dayTimerInterval);
    GameState.world.paused = false;
    GameState.world.gameState = 'menu';
    this.mapOpen = false;
    this.clickTarget = null;
    this.sprint = false;
    this.pillarManager?.setVisible(false);
    if (this.dayNightManager) this.dayNightManager.disable();
    this.uiManager.showMenu();
    this.audioManager.playMenuMusic();
    this.setupUIEventListeners();
  }

  showDifficultyScreen() {
    GameState.world.gameState = 'difficulty';
    this.uiManager.showDifficultyScreen();
  }

  showHouseholdStep() {
    this.uiManager.showHouseholdStep();
    this.audioManager.play('click');
  }

  showTribeStep() {
    this.uiManager.showTribeStep();
    this.audioManager.play('click');
  }

  async continueJourney() {
    await this.saveManager.loadGame();
  }

  startNewGameWarning() {
    if (window.confirm('This will delete your previous journey. Are you sure you want to start anew?')) {
      this.saveManager.newGame(); // This will reload the page
    }
  }

  hideMarket() {
    this.uiManager.hideMarket();
    if (GameState.world.gameState !== 'market') return;
    // After the day's market, night falls and the evening temptations appear.
    if (this.wildernessManager && gameConfig.wilderness.enabled) {
      this.enterEvening();
    } else {
      GameState.world.gameState = 'dayend';
      this.processDayEndStats();
    }
  }

  sellMana(sellAmount = 5) {
    // Selling is only allowed at the end-of-day market.
    if (GameState.world.gameState !== 'market') return;
    // The Sell 5 button passes a click event; coerce anything non-numeric back to the default.
    if (typeof sellAmount !== 'number' || !Number.isFinite(sellAmount)) sellAmount = 5;
    const remainingDemand = Math.max(0, GameState.market.dailyDemand - GameState.market.manaSoldToday);
    const availableToSell = Math.min(sellAmount, GameState.session.dayManaCollected, remainingDemand);

    if (availableToSell <= 0) {
      const msg = GameState.session.dayManaCollected <= 0 ? 'No manna to sell!' : 'No one is buying any more today!';
      this.uiManager.createFloatingText(msg, window.innerWidth / 2, window.innerHeight / 2, '#7a2118');
      return;
    }
    GameState.session.dayManaCollected -= availableToSell;
    GameState.market.manaSoldToday += availableToSell;
    const revenue = availableToSell * GameState.market.sellPrice;
    GameState.player.money += revenue;
    this.uiManager.updateHUD();
    this.uiManager.updateMarket(this);
    this.uiManager.createFloatingText(`+${revenue} silver`, window.innerWidth / 2, window.innerHeight / 2, '#b8862f');
    this.audioManager.play('sell');
  }

  sellAllMana() {
    if (GameState.world.gameState !== 'market') return;
    const remainingDemand = Math.max(0, GameState.market.dailyDemand - GameState.market.manaSoldToday);
    const availableToSell = Math.min(GameState.session.dayManaCollected, remainingDemand);
    if (availableToSell <= 0) {
      const msg = GameState.session.dayManaCollected <= 0 ? 'No manna to sell!' : 'No one is buying any more today!';
      this.uiManager.createFloatingText(msg, window.innerWidth / 2, window.innerHeight / 2, '#7a2118');
      return;
    }
    this.sellMana(availableToSell);
  }

  buyMana(buyAmount = 5) {
    if (GameState.world.gameState !== 'market') return;
    if (typeof buyAmount !== 'number' || !Number.isFinite(buyAmount)) buyAmount = 5;
    const cost = buyAmount * GameState.market.buyPrice;
    if (GameState.player.money < cost) {
      this.uiManager.createFloatingText('Not enough silver!', window.innerWidth / 2, window.innerHeight / 2, '#7a2118');
      return;
    }
    if (GameState.market.manaForSale <= 0) {
      this.uiManager.createFloatingText('No manna for sale!', window.innerWidth / 2, window.innerHeight / 2, '#7a2118');
      return;
    }
    const amount = Math.min(buyAmount, GameState.market.manaForSale);
    GameState.player.money -= amount * GameState.market.buyPrice;
    GameState.market.manaForSale -= amount;
    GameState.session.dayManaCollected += amount;
    this.uiManager.updateHUD();
    this.uiManager.updateMarket(this);
    this.uiManager.createFloatingText(`+${amount} manna`, window.innerWidth / 2, window.innerHeight / 2, '#5c6b3e');
    this.audioManager.play('buy');
  }

  simulateMarket() {
    const result = this.marketSimulation.simulate(
      this.manaQuota,
      GameState.session.dayManaCollected,
      GameState.world.difficulty
    );

    GameState.market.status = result.marketStatus;
    GameState.market.sellPrice = Math.max(1, Math.round(gameConfig.market.baseSellPrice * result.priceModifier));
    GameState.market.dailyDemand = Math.max(gameConfig.market.minDemand, Math.round(result.totalSold / gameConfig.market.demandFactor));
    GameState.market.manaForSale = Math.max(0, Math.round(result.totalWasted));
    GameState.market.mood = this.marketSimulation.getMarketMood(result.marketStatus);
    GameState.session.playerWaste = result.playerWaste;
    GameState.session.playerWasteValue = result.playerWasteValue;

    // On most days, the market is quiet as everyone has enough.
    const isMarketClosed = Math.random() < gameConfig.market.closedChance && GameState.world.day > 1;
    if (isMarketClosed) {
      GameState.market.dailyDemand = 0;
      GameState.market.manaForSale = 0;
      GameState.market.mood = "The market is quiet. It seems everyone has enough manna for today.";
    }
  }

  updateManaQuota() {
    const settings = this.getDifficultySettings();
    let baseQuota = settings.quota;

    // On day 6 or 7, the quota is doubled.
    if (GameState.world.day % 7 === 6) {
      baseQuota *= gameConfig.gameplay.quotaDoubleDay6;
    }
    this.manaQuota = baseQuota;
  }

  showNewDayMessage() {
    const totalYears = this.journeyManager?.totalYears ?? 40;
    const year = Math.min(totalYears, GameState.world.day);
    const station = this.journeyManager?.station;
    let message;
    if (this.wildernessManager && this.wildernessManager.isSabbath) {
      message = `Year ${year} of ${totalYears} · The Sabbath. Rest — no manna is gathered, yet the tithe is given.`;
    } else if (GameState.world.day % 7 === 6) {
      message = `Year ${year} of ${totalYears} · Day 6: the quota is doubled to ${this.manaQuota}.`;
    } else {
      message = `Year ${year} of ${totalYears} · Gather ${this.manaQuota} manna for the camp.`;
    }
    if (station) message += ` The Pillar leads to ${station.name} (${Math.round(this.journeyManager.distanceToTarget())}m ${this.journeyManager.getGuidance().cardinal}).`;
    this.uiManager.showDayMessage(message);
  }

  startGame(household) {
    GameState.world.difficulty = household;
    const profile = this.getDifficultySettings();
    GameState.world.gameState = 'playing';
    GameState.world.paused = false;
    this.sprint = false;
    GameState.player.hydration = 100;
    this.player.position.set(0, this.getSurfaceHeight(0, 0), 0);
    this.cameraHeading.set(0, 0, -1);
    this.clearPickups();
    GameState.player.score = 0;
    GameState.world.timeLeft = gameConfig.game.dayLength;
    GameState.world.day = 1;
    GameState.player.health = profile.startHealth;
    GameState.session.dayManaCollected = 0;
    GameState.session.dayManaGathered = 0;
    GameState.session.foodReserved = 0;
    GameState.session.dayWaterHealed = 0;
    GameState.session.dayRestHealed = 0;
    GameState.player.money = gameConfig.player.initialMoney + (profile.startMoney || 0);
    GameState.market.manaSoldToday = 0;
    this.animationTime = 0;
    this.clickTarget = null;

    this.updateManaQuota();
    this.simulateMarket();

    // Reset the wilderness economy and the 40-year journey for a fresh start.
    this.resetWilderness();
    this.journeyManager?.reset();
    GameState.map = createMapState();
    this.mapManager?.hydrate();
    for (const tile of this.terrainStreamer?.tiles.values() || []) this.mapManager?.discover(tile);
    const survival = gameConfig.survival || {};
    GameState.player.hunger = 88;
    GameState.player.warmth = 100;
    GameState.player.stamina = 100;
    GameState.player.faith = survival.faithStart ?? 68;
    GameState.player.waterskin = 1;

    if (this.dayNightManager) this.dayNightManager.enable();
    this.uiManager.setDayNightIcon('day');
    this.runDawn();
    this.uiManager.showGameUI();
    this.uiManager.updateHUD();
    if (!this.wildernessManager?.isSabbath) {
      this.sceneManager.spawnPickups();
    }
    this.setupUIEventListeners();
    this.audioManager.playGameMusic();
    this.startDayTimer();

    // The pillar rises over the first station and the journey begins.
    const target = this.journeyManager?.getTarget();
    if (target && this.pillarManager) this.pillarManager.setTarget(target, true);

    // Open the prologue; the day timer waits while the player reads. If the
    // prologue cannot be shown (stale/cached HTML), never leave the game stuck.
    GameState.world.paused = true;
    const prologueShown = this.uiManager.showPrologue?.(this);
    if (prologueShown === false) {
      GameState.world.paused = false;
      this.uiManager.showGameUI?.();
      this.showNewDayMessage();
    }
  }

  beginJourneyFromPrologue() {
    this.uiManager.hidePrologue?.();
    if (GameState.world.gameState !== 'playing') return;
    GameState.world.paused = false;
    this.showNewDayMessage();
    this.audioManager.play('click');
    this.saveManager?.saveGame?.();
  }

  /** Reset all wilderness-economy state for a brand new journey. */
  resetWilderness() {
    GameState.wilderness = createWildernessState();
  }

  /**
   * Run the dawn events for the current day (the tithe, or the Sabbath rest),
   * then fold any pending market bonuses into today's prices.
   * @returns {boolean} whether today is a Sabbath.
   */
  runDawn() {
    if (!this.wildernessManager) return false;
    const { isSabbath } = this.wildernessManager.startDay();
    this.wildernessManager.applyPendingMarketBonuses();
    this.uiManager.updateHUD();
    return isSabbath;
  }

  resumeFromLoad() {
    // Called by SaveManager after loading a game state
    if (['playing', 'dayend', 'market', 'evening'].includes(GameState.world.gameState)) {
      this.updateManaQuota();
      GameState.player.hydration ??= 100;
      GameState.player.hunger ??= 80;
      GameState.player.warmth ??= 100;
      GameState.player.stamina ??= 100;
      GameState.player.faith ??= gameConfig.survival?.faithStart ?? 68;
      GameState.player.waterskin ??= 1;
      this.journeyManager?.hydrate();
      const target = this.journeyManager?.getTarget();
      if (target && this.pillarManager && GameState.world.gameState === 'playing') this.pillarManager.setTarget(target, true);
      this.uiManager.showGameUI();
      this.uiManager.updateHUD();
      this.player.position.set(GameState.player.position.x, GameState.player.position.y, GameState.player.position.z);
      this.terrainStreamer?.update(this.player.position);
      this.playerManager.updatePlayerAppearance();
      Howler.mute(GameState.settings.muted);
      this.uiManager.toggleAudioIcon(GameState.settings.muted);
      this.setupUIEventListeners();
      this.uiManager.togglePause(GameState.world.paused);
      if (GameState.world.gameState === 'playing') {
        this.sceneManager.spawnPickups();
        this.audioManager.playGameMusic();
        if (this.dayNightManager) this.dayNightManager.enable();
      }
      if (GameState.world.gameState === 'dayend') this.uiManager.showDayEnd(this, 0);
      if (GameState.world.gameState === 'market') this.uiManager.showMarket(this);
      if (GameState.world.gameState === 'evening') this.uiManager.showEvening(this);
      if (GameState.world.timeLeft > 0 && GameState.world.gameState === 'playing') this.startDayTimer();
    } else if (GameState.world.gameState === 'victory') {
      this.uiManager.showVictory(this);
    } else if (GameState.world.gameState === 'ending') {
      this.uiManager.showEnding(this);
    }
  }

  startDayTimer() {
    if (this.dayTimerInterval) clearInterval(this.dayTimerInterval);
    this.dayTimerInterval = setInterval(() => {
      if (GameState.world.paused || GameState.world.gameState !== 'playing') return;
      GameState.world.timeLeft--;
      this.uiManager.updateHUD();
      if (GameState.world.timeLeft <= 0) {
        clearInterval(this.dayTimerInterval);
        this.endDay();
      }
    }, 1000);
  }

  endDay() {
    if (this.dayTimerInterval) clearInterval(this.dayTimerInterval);
    if (GameState.world.gameState !== 'playing') return;

    // Sabbath: no market and no evening trade — the dawn already collected the
    // tithe and granted rest. Go straight to the day's reckoning.
    if (this.wildernessManager && this.wildernessManager.isSabbath) {
      if (this.dayNightManager) this.dayNightManager.setNight();
      this.uiManager.setDayNightIcon('night');
      this.wildernessManager.recordWaste(0, GameState.session.dayManaGathered, this.manaQuota);
      GameState.world.gameState = 'dayend';
      this.processDayEndStats();
      return;
    }

    const food = Math.min(this.manaQuota, GameState.session.dayManaCollected);
    GameState.session.foodReserved = food;
    GameState.session.dayManaCollected -= food;
    this.clickTarget = null;
    Object.keys(this.input).forEach(key => { this.input[key] = false; });
    GameState.world.gameState = 'market';
    this.uiManager.updateHUD();
    this.uiManager.showMarket(this);
  }

  /**
   * Nightfall. Whatever manna is still in the basket spoils, torches are lit,
   * and the player is tempted by the Golden Calf / offered the Bronze Serpent.
   */
  enterEvening() {
    // Bought manna first fills any missing household food.
    const needed = Math.max(0, this.manaQuota - (GameState.session.foodReserved || 0));
    const used = Math.min(needed, GameState.session.dayManaCollected);
    GameState.session.foodReserved = (GameState.session.foodReserved || 0) + used;
    GameState.session.dayManaCollected -= used;
    const wasted = GameState.session.dayManaCollected;
    if (this.wildernessManager) {
      this.wildernessManager.recordWaste(wasted, GameState.session.dayManaGathered, this.manaQuota);
    }
    GameState.session.eveningChoices = { calf: null, serpent: null };
    GameState.world.gameState = 'evening';
    if (this.dayNightManager) this.dayNightManager.setNight();
    this.uiManager.setDayNightIcon('night');
    this.audioManager.play('click');
    this.uiManager.showEvening(this);
  }

  respondToCalf(action) {
    if (GameState.world.gameState !== 'evening' || !this.wildernessManager) return;
    if (GameState.session.eveningChoices?.calf) return;
    const result = this.wildernessManager.respondToCalf(action);
    if (!result.success) {
      this.uiManager.createFloatingText(result.reason === 'not enough silver' ? 'Not enough silver!' : 'Unable to act.', window.innerWidth / 2, window.innerHeight / 2, '#7a2118');
      return;
    }
    GameState.session.eveningChoices = { ...(GameState.session.eveningChoices || {}), calf: action };
    this.audioManager.play(action === 'ignore' ? 'buy' : 'click');
    this.uiManager.updateHUD();
    this.uiManager.refreshEvening(this, { calfAction: action, calfResult: result });
  }

  activateGoldenCalf() { this.respondToCalf('ignore'); }

  respondToSerpent(action) {
    if (GameState.world.gameState !== 'evening' || !this.wildernessManager) return;
    if (GameState.session.eveningChoices?.serpent) return;
    const result = this.wildernessManager.respondToSerpent(action);
    if (!result.success) {
      this.uiManager.createFloatingText(result.reason === 'not enough silver' ? 'Not enough silver!' : 'Unable to act.', window.innerWidth / 2, window.innerHeight / 2, '#7a2118');
      return;
    }
    GameState.session.eveningChoices = { ...(GameState.session.eveningChoices || {}), serpent: action };
    this.audioManager.play(action === 'care' ? 'buy' : 'sell');
    this.uiManager.updateHUD();
    this.uiManager.refreshEvening(this, { serpentAction: action, serpentResult: result });
  }

  useBronzeSerpent() { this.respondToSerpent('lift'); }

  finishEvening() {
    if (GameState.world.gameState !== 'evening') return;
    this.uiManager.hideEvening();
    GameState.world.gameState = 'dayend';
    this.clickTarget = null;
    this.processDayEndStats();
  }

  processDayEndStats() {
    const isSabbath = this.wildernessManager && this.wildernessManager.isSabbath;
    const wasted = GameState.session.dayManaCollected;
    let healthDelta = 0;
    if (!isSabbath) {
      if ((GameState.session.foodReserved ?? 0) < this.manaQuota) {
        healthDelta = ((GameState.session.foodReserved ?? 0) - this.manaQuota) * gameConfig.gameplay.healthPenaltyMultiplier;
      } else if (GameState.session.dayManaGathered >= this.manaQuota && wasted === 0) {
        healthDelta += gameConfig.gameplay.healthBonusNoWaste;
      } else if (wasted > 0) {
        healthDelta -= wasted * gameConfig.gameplay.healthPenaltyWasteMultiplier;
      }
    }

    if (this.wildernessManager) {
      const camp = this.wildernessManager.updateCampNeeds({ quota: this.manaQuota, isEnd: true });
      healthDelta -= Math.min(8, Math.round((camp.hungry + camp.thirsty + camp.afflicted) / Math.max(1, camp.population) * 18));
    }

    GameState.player.health = Math.max(0, Math.min(100, GameState.player.health + healthDelta));

    const manaBonus = Math.max(0, GameState.session.dayManaGathered - this.manaQuota - wasted);
    GameState.player.score += manaBonus;
    this.journeyManager?.onDayEnd();

    this.clickTarget = null;
    this.uiManager.showDayEnd(this, manaBonus);
    this.audioManager.play('dayEnd');
    this.saveManager.saveGame();
  }

  continueToNextDay() {
    if (GameState.player.health <= 0) {
      this.gameOver();
      return;
    }
    const totalYears = this.journeyManager?.totalYears ?? gameConfig.game.totalYears ?? 40;
    if (GameState.world.day >= totalYears) {
      this.journeyEnding();
      return;
    }
    GameState.world.day++;
    GameState.player.hydration = Math.min(100, (GameState.player.hydration ?? 100) + 45);
    GameState.player.hunger = Math.min(100, (GameState.player.hunger ?? 80) + 18);
    GameState.world.timeLeft = gameConfig.game.dayLength;
    GameState.session.dayManaCollected = 0;
    GameState.session.dayManaGathered = 0;
    GameState.session.foodReserved = 0;
    GameState.session.dayWaterHealed = 0;
    GameState.session.dayRestHealed = 0;
    GameState.market.manaSoldToday = 0;
    this.clickTarget = null;
    this.updateManaQuota();
    this.simulateMarket();

    this.manaPickups.forEach((p) => this.scene.remove(p));
    this.manaPickups = [];
    this.waterPickups.forEach((p) => this.scene.remove(p));
    this.waterPickups = [];
    this.restPickups.forEach((p) => this.scene.remove(p));
    this.restPickups = [];

    this.uiManager.hideAllModals();
    this.uiManager.showGameUI();
    GameState.world.gameState = 'playing';
    // A new dawn breaks — restore daylight and run the morning tithe / Sabbath.
    if (this.dayNightManager) this.dayNightManager.setDay();
    this.uiManager.setDayNightIcon('day');
    this.runDawn();
    this.journeyManager?.onDayStart();
    const nextTarget = this.journeyManager?.getTarget();
    if (nextTarget && this.pillarManager) this.pillarManager.setTarget(nextTarget, true);
    this.uiManager.updateHUD();
    this.setupUIEventListeners();
    this.audioManager.playGameMusic();
    if (!this.wildernessManager?.isSabbath) {
      this.sceneManager.spawnPickups();
    }
    this.startDayTimer();
    this.showNewDayMessage();
    this.saveManager.saveGame();
  }

  /** The player reached the final station: the Promised Land. */
  victory() {
    if (GameState.world.gameState === 'victory') return;
    GameState.world.gameState = 'victory';
    if (this.dayTimerInterval) clearInterval(this.dayTimerInterval);
    this.pillarManager?.setVisible(false);
    this.clickTarget = null;
    Object.keys(this.input).forEach(key => { this.input[key] = false; });
    this.audioManager.stopAllMusic();
    this.audioManager.play('dayEnd');
    this.saveManager.saveGame();
    this.uiManager.showVictory(this);
  }

  /** Forty years have passed before the journey was finished. */
  journeyEnding() {
    GameState.world.gameState = 'ending';
    if (this.dayTimerInterval) clearInterval(this.dayTimerInterval);
    this.pillarManager?.setVisible(false);
    this.clickTarget = null;
    this.audioManager.stopAllMusic();
    this.audioManager.play('gameOver');
    this.uiManager.showEnding(this);
  }

  restartJourney() {
    this.saveManager.newGame();
  }

  gameOver() {
    if (GameState.world.gameState === 'gameover') return;
    GameState.world.gameState = 'gameover';
    this.clickTarget = null;
    this.pillarManager?.setVisible(false);
    if (this.dayNightManager) this.dayNightManager.disable();
    let faith = null;
    if (this.wildernessManager) faith = this.wildernessManager.finalizeStats();
    this.audioManager.play('gameOver');
    this.audioManager.stopAllMusic();
    this.setupUIEventListeners();
    this.uiManager.showGameOver(this, faith);
  }

  getHealthStatus() {
    if (GameState.player.health > 75) return 'Abundant';
    if (GameState.player.health > 50) return 'Content';
    if (GameState.player.health > 25) return 'Weary';
    return 'Perishing';
  }

  drainHealthFromMovement(settings) {
    if (GameState.player.health <= 0) return;
    // On the Sabbath the journey wearies no one — no movement drain.
    if (this.wildernessManager && this.wildernessManager.isSabbath) return;
    const exposure = this.getWeatherExposure();
    const drain = settings.moveDrain * (gameConfig.gameplay.moveDrainScale ?? 1) * this.frameScale * exposure.effort;
    GameState.player.health = Math.max(0, GameState.player.health - drain);
    this.uiManager.updateHUD();
    if (GameState.player.health <= 0) {
      this.audioManager.play('hurt');
      this.gameOver();
    }
  }

  /**
   * Restore health from a water/rest collectible, respecting a per-day cap so a
   * single sacred place can't fully refill the bar. Returns the health actually
   * gained (which may be 0 once the daily cap for that type is reached).
   * @param {'water'|'rest'} type
   */
  applyHealthPickup(type) {
    if (GameState.player.health <= 0) return 0;
    const cfg = gameConfig.gameplay.healthCollectibles[type];
    if (!cfg) return 0;
    if (type === 'water') GameState.player.hydration = Math.min(100, (GameState.player.hydration ?? 100) + 24);
    const maxHealth = gameConfig.player.initialHealth;
    const cap = maxHealth * cfg.dailyCapPct;
    const trackerKey = type === 'water' ? 'dayWaterHealed' : 'dayRestHealed';
    const alreadyHealed = GameState.session[trackerKey];
    const remaining = Math.max(0, cap - alreadyHealed);
    if (remaining <= 0) return 0;
    const gained = Math.min(cfg.healthPer, remaining, maxHealth - GameState.player.health);
    GameState.player.health = Math.min(maxHealth, GameState.player.health + gained);
    GameState.session[trackerKey] = alreadyHealed + gained;
    this.uiManager.updateHUD();
    return gained;
  }

  /** Bob/rotate and collect any water/rest pickups near the player. */
  collectHealthPickups(pickups) {
    return pickups.filter((p) => {
      const pickupFloor = this.getSurfaceHeight(p.position.x, p.position.z) + gameConfig.scene.manaPickup.bobOffset;
      p.position.y = pickupFloor + Math.sin(this.animationTime * gameConfig.scene.manaPickup.bobSpeed) * gameConfig.scene.manaPickup.bobAmount;
      p.rotation.y += gameConfig.scene.manaPickup.rotationSpeed;

      if (this.playerManager.player.position.distanceTo(p.position) < gameConfig.scene.manaPickup.pickupDistance) {
        const type = p.userData.type;
        const gained = this.applyHealthPickup(type);
        const screenPos = p.position.clone().project(this.camera);
        const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

        if (!isNaN(screenX) && !isNaN(screenY)) {
          const label = gained > 0 ? '+' + gained : 'Full';
          const color = type === 'water' ? '#3fb6ff' : '#8be36b';
          this.uiManager.createFloatingText(label, screenX, screenY, color);
          this.uiManager.createStarBurst(screenX, screenY);
        }

        this.scene.remove(p);
        this.audioManager.play(type === 'water' ? 'water' : 'pickup');
        this.particleManager.createEmitter('manaPickup', p.position.clone());
        return false;
      }
      return true;
    });
  }

  dayForWeather() { return GameState.world.day; }

  getWeatherExposure() {
    const x = this.player.position.x, z = this.player.position.z;
    const sheltered = Math.hypot(x + 25, z + 15) < 8 || Math.hypot(x, z - 25) < 11 || Math.hypot(x + 20, z - 20) < 13 || Math.hypot(x - 20, z + 20) < 10;
    return weatherExposure(GameState.world.day, (gameConfig.game.dayLength - GameState.world.timeLeft) / gameConfig.game.dayLength, sheltered, this.wildernessManager?.isSabbath);
  }

  clearPickups() {
    ['manaPickups', 'waterPickups', 'restPickups'].forEach(key => {
      this[key].forEach(pickup => { this.scene.remove(pickup); pickup.geometry.dispose(); pickup.material.dispose(); });
      this[key] = [];
    });
  }

  updateSurvival(dt) {
    const sabbath = this.wildernessManager?.isSabbath;
    const elapsed = gameConfig.game.dayLength - GameState.world.timeLeft;

    const cfg = gameConfig.survival || {};
    const near = (x, z, radius = 10) => Math.hypot(this.player.position.x - x, this.player.position.z - z) < radius;
    const stationWater = (this.journeyManager?.stations || []).some((station) =>
      ['waters', 'palms', 'shore', 'rock'].includes(station.kind) && near(station.pos[0], station.pos[1], 18)
    );
    const water = near(-25, -15, 8) || near(0, 25, 11) || stationWater;
    const shade = water || near(-20, 20, 13) || near(20, -20);
    const pillarPos = this.pillarManager?.group?.position;
    const pillarFire = !!(pillarPos && this.pillarManager.group.visible && near(pillarPos.x, pillarPos.z, 13));
    const fire = near(20, -20, 12) || near(-20, 20, 13) || pillarFire;
    const { weather, heat, thirst } = weatherExposure(GameState.world.day, elapsed / gameConfig.game.dayLength, shade, sabbath);

    // Thirst / hydration (water sources restore it).
    let hydration = GameState.player.hydration ?? 100;
    hydration = Math.max(0, Math.min(100, hydration + (water ? 12 : -thirst) * dt));
    GameState.player.hydration = hydration;

    // Hunger: steady drain, faster while walking. Manna is the only plentiful food.
    const moving = !!this.playerManager?.isMoving;
    let hunger = GameState.player.hunger ?? 88;
    hunger = Math.max(0, Math.min(100, hunger - ((cfg.hungerDrain ?? 0.34) + (moving ? (cfg.hungerMoveDrain ?? 0.22) : 0)) * dt));
    GameState.player.hunger = hunger;

    // Warmth: the desert is cold after dark. Fire and shelter keep it at bay.
    let warmth = GameState.player.warmth ?? 100;
    const daylight = this.dayNightManager?.factor ?? 1;
    const isNight = daylight < 0.55;
    if (fire) {
      warmth += (cfg.fireWarmthGain ?? 9) * dt;
    } else if (isNight) {
      warmth -= (shade ? (cfg.shelteredWarmthDrain ?? 0.7) : (cfg.nightWarmthDrain ?? 2.6)) * dt;
    } else {
      warmth += 2.5 * dt;
    }
    GameState.player.warmth = Math.max(0, Math.min(100, warmth));

    // Faith rises at the pillar and on the Sabbath; murmuring erodes it.
    let faith = GameState.player.faith ?? cfg.faithStart ?? 68;
    if (sabbath) faith += 0.8 * dt;
    if (hunger <= 0 || hydration <= 0 || GameState.player.warmth <= 0) faith -= (cfg.faithNeedLoss ?? 1.6) * dt;
    GameState.player.faith = Math.max(0, Math.min(100, faith));

    // Rest and good provisions restore a little wellbeing.
    if (!isNight && !moving && hunger > 60 && hydration > 60 && GameState.player.warmth > 60) {
      GameState.player.health = Math.min(100, GameState.player.health + 0.45 * dt);
    }
    if (sabbath) GameState.player.health = Math.min(100, GameState.player.health + 0.8 * dt);

    // Needs at zero cost health.
    if (hydration <= 0) GameState.player.health -= (cfg.dehydrationHealthDrain ?? 3.8) * dt;
    if (hunger <= 0) GameState.player.health -= (cfg.starvationHealthDrain ?? 3.2) * dt;
    if (GameState.player.warmth <= 0) GameState.player.health -= (cfg.coldHealthDrain ?? 2.8) * dt;
    GameState.player.health = Math.max(0, GameState.player.health);
    if (GameState.player.health <= 0) {
      this.gameOver();
      return;
    }
    const remaining = Math.max(0, this.manaQuota - GameState.session.dayManaGathered);
    const target = this.journeyManager?.getTarget();
    const camp = near(20, -20, 12) || !!(target && near(target.x, target.z, 14));
    const button = document.getElementById('makeCampBtn');
    if (button) {
      const campX = target?.x ?? 20;
      const campZ = target?.z ?? -20;
      button.disabled = !camp;
      button.textContent = camp ? 'Make camp · finish day' : 'Camp ↗ · ' + Math.round(Math.hypot(this.player.position.x - campX, this.player.position.z - campZ)) + 'm';
    }
    const objectiveEl = document.getElementById('survivalObjective');
    if (objectiveEl) {
      let objective;
      if (hydration < 25) objective = 'Find water — the Pillar leads to your next station';
      else if (hunger < 18) objective = 'Eat manna — press F';
      else if (GameState.player.warmth < 20 && isNight) objective = 'Cold night — find fire at Camp or the Temple';
      else if (this.journeyManager) objective = this.journeyManager.objectiveText();
      else objective = remaining ? `Gather ${remaining} more manna for your household` : 'Food secured · return to Camp or gather surplus';
      objectiveEl.textContent = sabbath ? 'Sabbath · rest and follow the pillar' : objective;
    }
    const weatherEl = document.getElementById('survivalWeather');
    if (weatherEl) {
      weatherEl.textContent = `${weather.name}${heat ? shade ? ' · sheltered' : ' · seek shade' : ''} · Fed ${Math.round(hunger)}% · Warmth ${Math.round(GameState.player.warmth)}%`;
    }
    const guideEl = document.getElementById('survivalGuide');
    if (guideEl && this.journeyManager) {
      const g = this.journeyManager.getGuidance();
      guideEl.textContent = `Pillar ${g.cardinal} · ${Math.round(g.distance)}m · Camp NE · Oasis NW · Temple SW`;
    }
    this.uiManager?.updateVitals?.();
    this.uiManager?.updateJourneyHUD?.();
  }

  /**
   * Defensive recovery: if the game says it is paused but no modal is actually
   * blocking the screen, resume. This prevents a missing/hidden modal from
   * making the character appear frozen.
   */
  ensurePlayable() {
    if (GameState.world.gameState !== 'playing' || !GameState.world.paused) return;
    const blocking = ['pauseModal', 'prologueModal', 'stationModal', 'marketModal',
      'eveningModal', 'dayEndModal', 'creditsModal', 'mapModal'].some((id) => {
      const el = document.getElementById(id);
      return !!(el && el.classList && el.classList.contains('active'));
    });
    if (!blocking) {
      GameState.world.paused = false;
      this.uiManager?.togglePause?.(false);
    }
  }

  animate() {
    if (this.stats) this.stats.begin();

    requestAnimationFrame(() => this.animate());

    const deltaTime = Math.min(this.clock.getDelta(), 0.05);
    this.frameScale = deltaTime * 60;
    this.animationTime++;
    this.ensurePlayable();

    if (this.terrainStreamer?.active) {
      this.terrainStreamer.update(this.player?.position || { x: 0, z: 0 });
    }

    if (this.particleManager) {
      this.particleManager.update(deltaTime);
    }

    if (this.sceneManager && this.birds.length) {
      this.sceneManager.updateBirds(deltaTime);
    }

    if (GameState.world.gameState === 'playing' && this.player && !GameState.world.paused) {
      this.playerManager.update();
      this.updateSurvival(deltaTime);
      this.journeyManager?.update(deltaTime);
      this.weatherManager?.update(deltaTime);
      this.sceneManager.animateStations?.(this.animationTime, this.player.position);

      this.tileUpdateTimer += deltaTime;
      if (this.tileUpdateTimer > this.tileUpdateInterval) {
        this.updateTileGrid();
        this.tileUpdateTimer = 0;
      }

      this.locationSprites.forEach((flagGroup) => {
        const distToZone = this.player.position.distanceTo(new THREE.Vector3(flagGroup.userData.targetX, this.player.position.y, flagGroup.userData.targetZ));
        flagGroup.visible = distToZone <= flagGroup.userData.radius;

        if (flagGroup.visible) {
          // Ripple the cloth banner and update the location readout.
          this.sceneManager.animateFlagWave(flagGroup.userData.flagMesh, this.animationTime);
          this.uiManager.updateLocationDisplay(flagGroup.userData);
        }
      });

      this.manaPickups = this.manaPickups.filter((mana) => {
        const pickupFloor = this.getSurfaceHeight(mana.position.x, mana.position.z) + gameConfig.scene.manaPickup.bobOffset;
        const targetY = pickupFloor + Math.sin(this.animationTime * gameConfig.scene.manaPickup.bobSpeed) * gameConfig.scene.manaPickup.bobAmount;
        if (mana.userData.drop) {
          mana.position.y += (targetY - mana.position.y) * 0.08;
          if (Math.abs(mana.position.y - targetY) < 0.12) { mana.position.y = targetY; mana.userData.drop = false; }
        } else {
          mana.position.y = targetY;
        }
        mana.rotation.y += gameConfig.scene.manaPickup.rotationSpeed;

        if (this.playerManager.player.position.distanceTo(mana.position) < gameConfig.scene.manaPickup.pickupDistance) {
          const screenPos = mana.position.clone().project(this.camera);
          const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
          const screenY = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

          if (!isNaN(screenX) && !isNaN(screenY)) {
            this.uiManager.createFloatingText('+' + mana.userData.points, screenX, screenY, '#48dbfb');
            this.uiManager.createStarBurst(screenX, screenY);
          }

          this.particleManager.createEmitter('manaPickup', mana.position.clone());
          this.scene.remove(mana);
          GameState.player.score += mana.userData.points;
          GameState.session.dayManaCollected++;
          GameState.session.dayManaGathered++;
          this.audioManager.play('pickup');
          this.uiManager.updateHUD();
          return false;
        }
        return true;
      });

      // Water (Split Rock) and rest (Temple) collectibles restore health,
      // each capped per day via applyHealthPickup().
      this.waterPickups = this.collectHealthPickups(this.waterPickups);
      this.restPickups = this.collectHealthPickups(this.restPickups);
    }

    if (GameState.world.gameState !== 'playing' || GameState.world.paused) this.weatherManager?.hide();

    if (this.player && this.camera) {
      const playerPos = this.player.position;

      // Check if player position is valid before using it to prevent camera errors
      if (playerPos && !isNaN(playerPos.x)) {
        const heading = this.cameraHeading.clone().normalize();
        const targetCamPos = playerPos
          .clone()
          .add(heading.multiplyScalar(-gameConfig.camera.followDistance))
          .add(new THREE.Vector3(0, gameConfig.camera.followHeight, 0));
        this.camera.position.lerp(targetCamPos, gameConfig.camera.lerpFactor);
        this.camera.lookAt(playerPos.x, playerPos.y + 0.9, playerPos.z);
      }
    }

    if (this.sunLight && this.player) {
      this.sunLight.position.set(this.player.position.x + 40, this.player.position.y + 35, this.player.position.z + 25);
      this.sunLight.target.position.copy(this.player.position);
      this.sunLight.target.updateMatrixWorld();
    }

    if (this.dayNightManager) {
      this.dayNightManager.update(deltaTime);
    }
    if (this.pillarManager) {
      this.pillarManager.update(deltaTime, this.dayNightManager?.factor ?? 1);
    }

    if (this.renderer && this.scene && this.camera) {
      this.composer.render();
    }

    if (this.stats) this.stats.end();
  }
}