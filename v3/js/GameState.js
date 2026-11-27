import { config } from './config.js';

export function createCampState(population = 90) {
  const p = Math.max(20, Math.round(population));
  return {
    population: p,
    disobeyed: 0,
    hungry: 0,
    thirsty: 0,
    afflicted: 0,
    morale: 70,
    caredFor: 0,
    fedTotal: 0,
    wateredTotal: 0,
    healedTotal: 0,
    calfCrises: 0,
    calfConfronted: 0,
    serpentResponses: 0,
    peakDisobeyed: 0,
  };
}

/** Factory for a fresh Wilderness Economy state (single source of truth). */
export function createWildernessState() {
  return {
    wrath: 0,                 // rises with every Golden Calf use, drives plague odds
    serpentUses: 0,           // Bronze Serpent uses (drives escalating cost)
    lastIdolUseDay: -999,     // last day the Golden Calf was used
    conditions: [],           // active negative conditions e.g. 'fatigue'
    mannaWastedToday: 0,      // manna that spoiled today (Bronze Serpent trigger)
    pendingSellBonus: false,  // a Golden Calf boost waiting to apply next market
    demandBonus: 1,           // a blessing's market-demand boost for the next market
    camp: createCampState(config.wilderness?.campPopulation?.couple ?? 90),
    stats: {
      silverTithed: 0,
      goldenCalfUses: 0,
      plaguesEndured: 0,
      bronzeSerpentUses: 0,
      perfectDays: 0,
      mannaWasted: 0,
      faithfulnessRating: 0,
      peopleCaredFor: 0,
      peakDisobeyed: 0,
      calfCrisesConfronted: 0,
    },
  };
}

/** Factory for a fresh explored-map state. */
export function createMapState() {
  return {
    version: 1,
    tiles: {},
    exploredCount: 0,
    lastTile: null,
  };
}

/** Factory for a fresh 40-year journey state. */
export function createJourneyState() {
  return {
    stationIndex: 0,
    completed: [],          // station ids already reached
    awaitingAdvance: false, // station modal is open
    year: 1,
    totalYears: config.game.totalYears ?? 40,
    startedAt: null,
    lastStation: null,
    decision: null,         // e.g. 'faith' | 'doubt' at Sinai / Kadesh
  };
}

export const GameState = {
  version: 3,

  player: {
    health: config.player.initialHealth,
    hydration: 100,
    hunger: 88,
    warmth: 100,
    stamina: 100,
    faith: config.survival?.faithStart ?? 68,
    waterskin: 1,
    money: config.player.initialMoney,
    mana: 0,
    score: 0,
    position: { x: 0, y: 0, z: 0 },
    selectedTribe: 'judah',
    dressColor: 0xc49030,
    headColor: 0x332211, // Skin color
    bodyColor: 0x332211, // Skin color
  },

  world: {
    day: 1,
    timeLeft: config.game.dayLength,
    difficulty: 'normal',
    paused: false,
    gameState: config.game.initialState,
  },

  market: {
    sellPrice: 4,
    buyPrice: 6,
    dailyDemand: 0,
    manaSoldToday: 0,
    manaForSale: 0,
    status: 'balanced',
    mood: 'The traders seem fair today.',
  },

  session: {
    dayManaGathered: 0, // Total gathered this day for health calculation
    dayManaCollected: 0, // Current basket for selling
    playerWaste: 0,
    playerWasteValue: 0,
    dayWaterHealed: 0,  // health restored from water collectibles today (capped)
    dayRestHealed: 0,   // health restored from rest collectibles today (capped)
    eveningChoices: { calf: null, serpent: null },
  },

  // The 40-year Exodus journey: station progress, year and story decisions.
  journey: createJourneyState(),

  // Explored 1 km terrain sections, rendered as a player-built map.
  map: createMapState(),

  // Wilderness Economy systems (tithe / Golden Calf / Bronze Serpent / Sabbath).
  // Persisted so a saved journey keeps its wrath, debts and faith stats.
  wilderness: createWildernessState(),

  settings: {
    muted: false,
  }
};

export const GameSummary = {
  hasSave: false,
  score: 0,
  day: 1,
  year: 1,
  station: 'The Red Sea Shore',
  tribe: 'judah',
  difficulty: 'couple',
  health: 100,
  money: 50,
};
