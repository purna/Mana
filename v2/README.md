# MANNA — Forty Years in the Wilderness (Isometric Edition)

An isometric survival game inspired by the Exodus, built in `index.html` as a self-contained 2D canvas adaptation of the v1 Three.js game. You play **Moses**, leading the Israelites through the wilderness. A **Pillar of Cloud** goes before the people by day; by night it becomes a **Pillar of Fire**. Follow it from station to station, gather manna, find water, keep the camp alive, and guard the faith of Israel through forty years of wandering.

### Colony-sim slice

- 28 visible citizen agents with traits (greedy, lazy, murmurer, devout, ordinary) gather manna and acacia wood, deposit stores, hoard, murmur, fall sick and can be counselled.
- Faith drives an obedience ladder: Optimal Order → Growing Unrest → Secret Idolatry → Open Rebellion.
- Hoarded manna rots at midnight, breeding disease and feeding Golden Calf progress.
- Build tents, wall panels and watchtowers from acacia wood; defend the camp from night raids with towers and palisades.
- Open the **Camp** panel with `C` for population, traits, stores, construction and defense.
- Terrain uses textured tiles plus a dual-grid pass for blended water/rock/trail edges and sloped height transitions.
- Every tribe has a per-tribe stat block: canonical population, represented agents, sickness, hoarding and trait counts.

The isometric entry points are:

- `index.html` — the playable 2D isometric edition (parchment HUD, compass, map, market, station stories, About and Credits menus).
- `example.html` — an earlier standalone canvas isometric prototype kept for reference.
- `js/` — the inherited v1 Three.js source, kept as the gameplay/content reference for the adaptation.

## Play

```bash
npm install
npm run dev       # http://localhost:5173
# or
npm run build     # static build in dist/
npm run preview   # serve the built game
```

## Time and pressure

Each round is a **month**; twelve months make a year. Camp water, manna and faith gate station travel, and neglected tribes lose people and flocks. Personal vitals are shown only when low or critical.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrow keys | Walk screen-relative (W up-screen, A left, etc.) |
| `Shift` | Run (drains stamina) |
| `F` | Eat manna from the basket |
| `R` | Drink from the waterskin |
| `E` | Draw water, warm at the fire, gather acacia wood, counsel a citizen, or trade |
| `C` | Open the Camp panel (population, traits, stores, build, defense) |
| `M` | Open the explored wilderness map |
| `Esc` | Pause |
| Mouse / touch | Click/tap to walk |
| `i` / ♫ | About / Credits and music toggle (HUD buttons) |

## Terrain pilot: Wadi Rum, Jordan

The game now streams **1 km terrain sections** around Moses. Each section is one game tile and is populated with sandstone massifs, carved dry wadis, date palms, acacias, tamarisk, desert shrubs, boulders and layered rock outcrops.

- Default region: Wadi Rum, Jordan (`29.5765 N, 35.4207 E`), set in `js/config.js` → `terrain.real.region`.
- `terrain.real.provider: 'auto'` tries public **Mapzen Terrarium / SRTM** elevation tiles from AWS Open Data. If the network/CORS blocks them, it falls back to a deterministic Wadi Rum terrain model.
- The first 3×3 section ring is loaded before the camp, stations and player are placed, so landmarks are grounded correctly.
- Change `provider` to `'procedural'` to force the offline model, or to `'terrarium'` to require real elevation.

### Explored map, real basemap and JSON sections

- Every 1 km section is stored as a JSON-serializable record in IndexedDB via localForage (`MannaTerrain/tiles`).
- Sections load from that cache instantly; if absent, the game tries real DEM, then saves the generated Wadi Rum fallback.
- The map panel (`M`) slowly reveals only explored sections. Explored sections use real **Esri World Imagery** satellite tiles; unknown sections stay under fog of war. Drag to pan, scroll/pinch to zoom, or use the zoom/recenter controls.
- Progress, explored sections and terrain records are saved automatically in the browser (IndexedDB via localForage); manual save remains available from the pause menu.

## Play

```bash
npm install
npm run dev       # http://localhost:5173
# or
npm run build     # static build in dist/
npm run preview   # serve the built game
```

## Controls

| Input | Action |
|---|---|
| `WASD` / arrow keys | Walk and steer |
| `Shift` | Run (drains stamina) |
| `F` | Eat manna from the basket |
| `R` | Drink from the waterskin |
| `E` | Draw water at a spring, or warm at a fire |
| `Space` | Jump |
| `M` | Open the explored wilderness map |
| `Esc` | Pause |
| Mouse / touch | Click to walk, on-screen arrows on mobile |

## The journey

- **Each day is a year** of the forty-year wandering. The HUD shows the current year, the next station, and a compass pointing at the pillar.
- **Eight stations** carry the story: the Red Sea Shore, Marah, Elim, the Wilderness of Sin, Rephidim, Mount Sinai, Kadesh-Barnea and the Plains of Moab. Reaching the pillar at a station reveals its scripture, story, trial and blessing; then the pillar moves on.
- **Survive**: manage wellbeing, food, water, warmth, stamina and faith. Water is drawn into a three-charge waterskin; manna feeds you and the camp; fire restores warmth; the Sabbath restores faith.
- **The camp**: the people need food, water and leadership. At dusk, household manna is reserved first; surplus can be traded. Nightfall brings the Golden Calf and Bronze Serpent choices, and the Sabbath comes every seventh year.
- **Win** by reaching all eight stations before the fortieth year ends. If wellbeing reaches zero, the journey ends.

## Key files

| Path | Purpose |
|---|---|
| `index.html` | Self-contained isometric game: HUD, compass, map, market, story and menu overlays |
| `js/` | Inherited v1 Three.js source used as the gameplay/content reference |
| `js/Game.js` | Main loop, survival, day/year flow, actions, win/loss |
| `js/JourneyManager.js` | 40-year campaign, stations, pillar target, compass |
| `js/PillarManager.js` | Pillar of Cloud & Fire visuals, light, distant shaft |
| `js/TerrainStreamer.js` | 1 km terrain streaming, Wadi Rum terrain model, real DEM adapter, biome vegetation, wadis, rock formations |
| `js/TerrainStore.js` | JSON-serializable terrain section cache (IndexedDB via localForage) |
| `js/MapManager.js` | Explored-section records, real satellite basemap and fog-of-war map rendering |
| `js/SceneManager.js` | Landmarks, stations, camp, pickups, legacy procedural tiles |
| `js/PlayerManager.js` | Moses model, movement, sprint/stamina, collisions |
| `js/GameState.js` | Persisted state, journey/wilderness defaults |
| `js/config.js` | Survival tuning and all station data |
| `js/UIManager.js` | HUD, vitals, compass, story/market/evening modals |
| `styles/journey.css` | Journey HUD, vitals, story modal and menu theme |
| `js/tribes.json` | Tribe/household tuning |
| `assets/audio/` | Music, SFX and credits |
| `models/` | Blender sources and GLB exports (not yet runtime-loaded) |

## Verification

```bash
npm run build
npm test
```

`npm test` runs 32 Node tests covering streamed terrain, weather, survival math, collisions, save migration and the journey/pillar systems. Manual browser smoke tests are listed in `TESTING.md`.
