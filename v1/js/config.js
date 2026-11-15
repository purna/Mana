export const config = {
  // Game state
  game: {
    initialState: 'menu',
    dayLength: 75, // seconds — one day of the journey
    totalYears: 40, // each day advances one year toward the Promised Land
  },

  // Survival needs. These sit on top of the existing wellbeing/wealth loop:
  // hunger, thirst, warmth and faith must be tended while you follow the pillar.
  survival: {
    hungerDrain: 0.34,            // per second at rest
    hungerMoveDrain: 0.22,        // extra per second while walking
    starvationHealthDrain: 3.2,   // health/sec when hunger hits zero
    dehydrationHealthDrain: 3.8,  // health/sec when hydration hits zero
    coldHealthDrain: 2.8,         // health/sec when warmth hits zero
    nightWarmthDrain: 2.6,        // warmth/sec after dark, exposed
    shelteredWarmthDrain: 0.7,    // warmth/sec in shelter after dark
    fireWarmthGain: 9,            // warmth/sec beside a fire
    faithStart: 68,
    faithSabbath: 5,
    faithStation: 6,
    faithEat: 1,
    faithNeedLoss: 1.6,           // faith/sec while starving or parched
    faithDawnHealth: 4,           // dawn health when faith is strong
    // Food and water actions
    eatManna: 2,                  // basket manna consumed per meal
    eatHunger: 38,
    eatHealth: 6,
    eatFaith: 1,
    waterskinCapacity: 3,
    drinkHydration: 40,
    drinkHealth: 2,
    fillHydration: 26,
    // Sprinting
    staminaDrain: 26,
    staminaRegen: 15,
    sprintMultiplier: 1.6,
    sprintMin: 8,
  },

  // The journey through the wilderness. Reaching the pillar at each station
  // reveals its story and blessing, then the pillar moves on.
  journey: {
    arriveRadius: 9,
    interactRadius: 12,
    stations: [
      {
        id: 'shore', name: 'The Red Sea Shore', year: 1, kind: 'shore',
        pos: [-85, 65], color: '#2f6f8f',
        water: { x: 0, z: 32, r: 18 },
        scripture: 'Exodus 14:31',
        title: 'The sea is behind you',
        text: 'The waters closed over the chariots of Egypt. The people lift their eyes to the pillar of cloud, and for the first time they believe.',
        trial: 'Follow the pillar into the wilderness. Gather manna, find water, and keep the camp alive.',
        blessing: { faith: 8, health: 8 },
      },
      {
        id: 'marah', name: 'Waters of Marah', year: 6, kind: 'waters',
        pos: [-92, -42], color: '#3f7f6a',
        water: { x: 17, z: 0, r: 6.5 },
        scripture: 'Exodus 15:23-25',
        title: 'The bitter water is made sweet',
        text: 'Three days without water. At Marah the spring is bitter, and the people murmur. Moses cries to the Lord, and a tree is shown him; he casts it into the waters, and they become sweet.',
        trial: 'Fill your waterskin at the spring and carry water to the thirsty.',
        blessing: { hydration: 100, faith: 6, health: 10 },
      },
      {
        id: 'elim', name: 'Elim', year: 8, kind: 'palms',
        pos: [78, -86], color: '#4f8a3a',
        water: { x: 17, z: 0, r: 7 },
        scripture: 'Exodus 15:27',
        title: 'Twelve springs and seventy palms',
        text: 'They came to Elim, where there were twelve springs of water and seventy palm trees, and they encamped there beside the waters.',
        trial: 'Rest in the shade. Let the camp recover its strength.',
        blessing: { health: 22, faith: 5, warmth: 30, manna: 6 },
      },
      {
        id: 'sin', name: 'Wilderness of Sin', year: 12, kind: 'manna',
        pos: [106, 14], color: '#b8a25e',
        scripture: 'Exodus 16:4-15',
        title: 'Bread from heaven',
        text: 'In the morning a fine, flake-like thing lay on the face of the wilderness. “It is the bread the Lord has given you to eat.” Gather only what you need; let nothing remain until morning.',
        trial: 'Gather manna for the household. Do not hoard what will spoil.',
        blessing: { manna: 12, faith: 6, health: 8 },
      },
      {
        id: 'rephidim', name: 'Rephidim', year: 17, kind: 'rock',
        pos: [28, 108], color: '#7a6b58',
        scripture: 'Exodus 17:1-7',
        title: 'Water from the rock',
        text: 'The people thirsted and tested the Lord. “Behold, I will stand before you there on the rock at Horeb; strike the rock, and water shall come out of it.”',
        trial: 'Strike the rock. Bring water to a dry and grumbling camp.',
        blessing: { hydration: 100, faith: 7, health: 12 },
      },
      {
        id: 'sinai', name: 'Mount Sinai', year: 24, kind: 'mountain',
        pos: [-108, 16], color: '#6a5a8a',
        scripture: 'Exodus 19:16-20',
        title: 'The mountain trembles',
        text: 'Thunder and lightning, a thick cloud upon the mountain, and the sound of a trumpet growing louder. Moses goes up, and the Lord descends in fire.',
        trial: 'Choose faithfulness. The covenant shapes the people you lead.',
        blessing: { faith: 14, health: 10, manna: 8 },
      },
      {
        id: 'kadesh', name: 'Kadesh-Barnea', year: 32, kind: 'spy',
        pos: [12, -112], color: '#9a6a3a',
        scripture: 'Numbers 13-14',
        title: 'The report of the spies',
        text: 'The land is good, but the people are afraid. Ten spies bring back fear; two bring back faith. The camp stands at the edge of promise, and doubt spreads like a plague.',
        trial: 'Hold the camp together. Faith is harder than fear.',
        blessing: { faith: 10, health: 8, manna: 6 },
      },
      {
        id: 'moab', name: 'Plains of Moab', year: 40, kind: 'moab',
        pos: [96, 96], color: '#c99a3a',
        scripture: 'Deuteronomy 34:1-4',
        title: 'The Promised Land in sight',
        text: 'Moses climbs the mountain and looks across the land. Forty years of wandering are ended. The pillar stands still, and the people lift their eyes to the horizon.',
        trial: 'Lead the people home.',
        blessing: { faith: 20, health: 20 },
      },
    ],
  },

  audio: {
    musicVolume: 0.05,
    sfxVolume: 0.8,
  },

  gameplay: {
    // Movement wears the player down, but hunger/thirst are the real threats.
    // 1 = the original (very punishing) rate; keep this low so exploration is fun.
    moveDrainScale: 0.08,
    healthPenaltyMultiplier: 1.2,
    healthBonusNoWaste: 8,
    healthPenaltyWasteMultiplier: 1.5,
    quotaDoubleDay6: 2,
    quotaDoubleDay7: 2,
    // Health-recovery collectibles found at sacred places. Each type is capped
    // per day so you can replenish at most ~10% of max health from water and
    // ~10% from rest (≈20% combined). healthPer is per collectible.
    healthCollectibles: {
      water: {
        location: 'Split Rock',
        count: 6,
        healthPer: 4,
        dailyCapPct: 0.10,
        spawnRadius: 9,
      },
      rest: {
        location: 'Temple',
        count: 6,
        healthPer: 4,
        dailyCapPct: 0.10,
        spawnRadius: 9,
      },
    },
  },

  // Wilderness Economy (see docs/Wilderness_Economy_Systems_Revised.md).
  // These layer tithe / Golden Calf / Bronze Serpent / Sabbath narrative
  // systems on top of the core gather-and-sell loop.
  wilderness: {
    enabled: true,
    sabbathDay: 7,            // every Nth day is a Sabbath (rest, tithe, heal, no gather)
    sabbathHeal: 10,          // health restored on the Sabbath
    goldenCalfCost: 30,       // silver to bow before the Golden Calf
    plagueHealthLoss: 25,     // health lost when a plague strikes
    // Tribe id that RECEIVES the tithe instead of paying it (the priestly tribe).
    leviteTribeId: 'levi',
    // A calf-boosted sell price is capped here (matches the design doc).
    calfSellPriceCap: 12,
    campPopulation: { single: 60, couple: 90, family: 120 },
    moses: {
      calfConfrontCost: 8,      // wellbeing cost to confront the calf
      calfIntercedeCost: 12,    // silver cost to intercede
      serpentCareCost: 10,      // silver cost for organized care
      serpentHealPerUse: 18,    // afflicted helped by lifting the serpent
      careHeal: 10,             // afflicted helped by organized care
      maxDisobeyedGain: 24,
    },
  },

  // Day / Night cycle visuals.
  dayNight: {
    enabled: true,
    // How quickly lighting eases toward its target each second (0-1 per frame-ish).
    transitionSpeed: 1.8,
    // Lowest daylight factor reached at dusk while still "day" (1 = noon, 0 = night).
    duskFloor: 0.42,
    day: {
      skyColor: '#bcd8f2',
      fogColor: '#b3d9ff',
      sunIntensity: 1.6,
      moonIntensity: 0.0,
      ambient: 0.6,
      hemi: 0.5,
      torch: 0.0,
      exposure: 1.55,
    },
    night: {
      skyColor: '#0a1330',
      fogColor: '#0c1a3c',
      sunIntensity: 0.08,
      moonIntensity: 0.9,
      ambient: 0.22,
      hemi: 0.14,
      torch: 4.0,
      exposure: 1.15,
    },
    moonColor: '#7f9dff',
    torchColor: '#ffb257',
    torchDistance: 22,
  },

  // Player settings
  player: {
    initialHealth: 100,
    initialMoney: 50,
    rotateSpeed: 0.05,
    turnSpeed: 0.035, // radians/frame for left/right steering (yaw)
    jumpVelocity: 0.14, // initial upward velocity when jumping
    gravity: 0.012,     // downward acceleration applied per frame while airborne
    bob: {
      speed: 0.2,
      amount: 0.05,
    },
    idle: {
      speed: 0.05,
      amount: 0.02,
    },
  },

  // Manna settings (defaults; real per-day counts/quotas come from the Tribe base profile * household modifier)
  manna: {
    // Multiplier on how many manna pickups actually spawn each day, so there is
    // plenty to find without changing the amount you need (quota).
    spawnMultiplier: 2,
    count: {
      single: 35,
      couple: 50,
      family: 70,
    },
    quota: {
      single: 40,
      couple: 60,
      family: 80,
    },
  },

  // Household size is a modifier applied on top of the chosen Tribe's base profile.
  // single = swift but fragile (less to gather, faster); family = many mouths (more to gather, slower).
  household: {
    single: { moveSpeed: 1.15, manaCount: 0.85, quota: 0.8, moveDrain: 0.85, label: 'Single' },
    couple: { moveSpeed: 1.0, manaCount: 1.0, quota: 1.0, moveDrain: 1.0, label: 'Couple' },
    family: { moveSpeed: 0.85, manaCount: 1.15, quota: 1.25, moveDrain: 1.15, label: 'Family' },
  },

  market: {
    baseSellPrice: 4,
    minDemand: 5,
    demandFactor: 1000,
    closedChance: 0.6,
    priceModifier: {
      shortage: { min: 1.4, range: 0.6 },
      glut: { min: 0.3, range: 0.4 },
      surplus: { min: 0.6, range: 0.3 },
      balanced: { min: 0.9, range: 0.2 },
    },
  },

  // Real map basemap (keyless raster tiles). The explored fog-of-war sits on
  // top, so only sections the player has visited become visible.
  map: {
    enabled: true,
    provider: 'esri-world-imagery',
    zoom: 13,
    // Esri World Imagery: no API key, real satellite imagery of Wadi Rum.
    urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  },

  // UI & Display
  display: {
    minLoadingTime: 1600,
  },

  // Terrain settings
  terrain: {
    noiseEnabled: true,
    scale: 0.02,
    height: 1,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,

    // Real-world streaming terrain. A 1 km topographic section is compressed
    // to one 96-unit game tile (the existing world scale) so the journey stays
    // playable while the geography, wadis and massifs come from real terrain.
    real: {
      enabled: true,
      // 'auto' tries real public DEM tiles and silently falls back to the
      // deterministic Wadi Rum terrain model if CORS/network is unavailable.
      provider: 'auto', // 'auto' | 'procedural' | 'terrarium'
      region: {
        name: 'Wadi Rum, Jordan',
        lat: 29.5765,
        lon: 35.4207,
      },
      tileMeters: 1000,
      tileUnits: 96,
      // Normalise absolute DEM elevation to a local baseline so the player's
      // spawn, camp and stations stay near the existing world origin.
      baseElevation: 1000,
      segments: 96,
      viewRadius: 1,
      seed: 1337,
      // Mapzen Terrarium height tiles (SRTM/NED), hosted on AWS Open Data.
      // height = (R * 256 + G + B / 256) - 32768 metres.
      terrarium: {
        zoom: 15,
        urlTemplate: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      },
      vegetation: {
        palms: 7,
        acacias: 9,
        tamarisks: 7,
        shrubs: 24,
        boulders: 16,
        outcrops: 4,
      },
    },
  },

  scene: {
    colors: {
      skyColor1: '#ffecd6',
      skyColor2: '#ffd1a4',
      skyColor3: '#c4b0ff',
      skyColor4: '#8a70ff',
      fogColor: '#b3d9ff',
      terrainColor1: '#d1c082', // low, yellower sand
      terrainColor2: '#c3b079', // mid-low
      terrainColor3: '#b5a171', // mid-high
      terrainColor4: '#a79168', // high
    },
    fog: {
      near: 40,
      far: 70,
    },
    ambientLight: {
      intensity: 0.6,
    },
    hemiLight: {
      skyColor: '#b3d9ff',
      groundColor: '#c1a584',
      intensity: 0.5,
    },
    sunLight: {
      intensity: 1.6,
      pos: { x: 40, y: 30, z: 40 },
      shadow: {
        mapSize: 2048,
        camera: { near: 0.5, far: 120, left: -50, right: 50, top: 50, bottom: -50 },
        bias: -0.0015,
        normalBias: 0.02,
        radius: 2,
      },
    },
    tileSize: 96,
    gridRadius: 1,
    manaPickup: {
      bobOffset: 0.5,
      bobSpeed: 0.05,
      bobAmount: 0.1,
      rotationSpeed: 0.02,
      pickupDistance: 1.5,
    },
    birds: {
      count: {
        min: 5,
        max: 8,
      },
      flightHeight: {
        min: 30,
        max: 50,
      },
      speed: {
        min: 0.15,
        max: 0.35,
      },
      turn: {
        speed: 0.003,
        amount: 0.02,
      },
      bounds: 90,
      flapAmount: 0.6,
      bobAmount: 1.5,
    },
  },

  camera: {
    initialFov: 65,
    lerpFactor: 0.09,       // higher = snappier, tighter follow
    followDistance: 13,     // how far behind the player the camera sits
    followHeight: 11,       // how high above the player the camera sits
  },

  // Debug settings
  debug: {
    stats: false, // Set to true to show the panel, false to hide it
    gui: false,
  },

  // Post-processing settings
  postprocessing: {
    bloom: {
      strength: 0.18,
      radius: 0.25,
      threshold: 0.94,
    },
    toneMappingExposure: 1.55,
    vignette: {
      offset: 1.0, // Note: this was already in config
      darkness: 0.9,
    },
  }
};
