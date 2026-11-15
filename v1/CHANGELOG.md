# MANNA — Changelog

## Unreleased — tribes are population stats, not a choice

- Removed tribe selection from the start flow; `Begin`/`Choose household size` goes straight to household size, using the existing default tribe profile.
- Added canonical population figures to `js/tribes.json` and a read-only Twelve Tribes stats list in the camp/faith panel, including the total souls of Israel.
- The tribe cards now show populations instead of manna quotas and are no longer clickable.

## Unreleased — evening crisis screen unblocked

- The evening `Rest until Dawn` action is now always enabled and visually prominent (gold parchment button with dark text), instead of blending into the light panel.
- `refreshEvening` explicitly re-enables the rest button after every crisis response, so a disabled or unaffordable crisis option can never trap the player.
- `finishEvening` now refuses duplicate/submit when the game is not in the evening state, and Enter rests when the evening modal is open.
- The evening hint now tells the player that resting is always available.


## Unreleased — explored map, real basemap & JSON cache

- Added a slowly-revealed wilderness map (`M` / map button) with fog-of-war, player heading, pillar target and camp marker.
- Explored sections now display real **Esri World Imagery** satellite tiles, with the abstract relief map as a fallback.
- Added `js/MapManager.js` and `GameState.map`; explored sections persist in save v3.
- Added `js/TerrainStore.js`: each 1 km section is cached as a JSON-serializable record in IndexedDB via localForage, loaded on demand automatically.
- Terrain streamer checks JSON cache → real DEM → procedural fallback, and writes each result back.
- Re-grounded static scenery when terrain heights update, fixing floating rocks, people and landmarks.
- Moved the Red Sea Shore water behind the monument, anchored station stones/water to local terrain, and excluded vegetation, rocks and pickups from all station springs and the oasis.
- Grounded tents, market stalls, campfire and station props at their own terrain heights and added contact shadows.
- Station stones, altar, ring, sea and shoreline now store local anchors and recompute them whenever the station is re-grounded.
- Pinned the opening 3×3 terrain ring so the camp and all eight station landmarks keep their ground when the player travels far away.
- Rebuilt Moses with a layered robe, mantle, sash, headwrap, beard, sandals, articulated arms and a detailed staff; feet now sit on the surface.
- Added `tests/map.test.mjs`; suite now 32 tests.
- Evening choices are now one-per-crisis per night, with a sticky “Rest until Dawn” action and a clear hint, fixing the loop where the night screen kept reappearing after a response.
- The map X is now in the top-right, the JSON export button was removed, and exploration auto-saves in the browser.
- Added map panning (drag), zooming (wheel/pinch), zoom controls and recenter; the map view now follows the panned location instead of always the player.

## Unreleased — terrain streaming pilot

- Added `js/TerrainStreamer.js`: streams 1 km Wadi Rum sections around the player, grounds terrain, cameras, stations and pickups.
- Added real elevation adapter for Mapzen Terrarium/SRTM tiles (AWS Open Data) with `auto` fallback to a deterministic Wadi Rum model.
- Added carved dry wadis, sandstone massifs, dunes, an oasis, date palms, acacias, tamarisk, desert shrubs, boulders and layered rock outcrops.
- Terrain is normalised around `baseElevation` and compressed into the existing 96-unit tile scale.
- Initial 3×3 terrain ring is awaited before landmarks/player creation to avoid floating scenery.
- Added `tests/terrain.test.mjs`; suite now 26 tests.

## Unreleased — “Forty Years” overhaul

### Campaign
- Reworked the game around a 40-year Exodus journey. Each day is a year; the HUD tracks Year 1–40.
- Added eight story stations (Red Sea Shore, Marah, Elim, Wilderness of Sin, Rephidim, Mount Sinai, Kadesh-Barnea, Plains of Moab) with scripture, narrative, trial and blessing.
- Added victory at the final station and a fortieth-year ending if the journey is unfinished.
- Added `JourneyManager` and `PillarManager`; the pillar glides between stations and drives a compass HUD.

### Survival
- Added fed, warmth, stamina and faith alongside wellbeing and water.
- Added starvation, dehydration and cold damage; rest and good provisions recover wellbeing.
- Added eat manna (`F`), drink (`R`), draw water/warm (`E`) and sprint (`Shift`), with mobile buttons.
- Added a three-charge waterskin; springs and the rock at Rephidim refill it.
- Reduced movement health drain and added passive recovery while safe and rested.

### Presentation
- New “MANNA — Forty Years in the Wilderness” menu, prologue, station, victory and ending modals.
- New journey HUD, rotating pillar compass, survival vitals panel and responsive mobile layout (`styles/journey.css`).
- Pillar of Cloud by day and Fire by night, with a fog-ignoring light shaft, halo and point light.
- Added a living camp crowd of Israelites, night stars, improved player model (robe, headwrap, beard, staff) and walk animation.
- Year terminology across HUD, day-end and messages; station/camp reports remain.

### Technical
- `GameState` v2 adds journey/vitals/waterskin fields; `SaveManager` merges older saves forward.
- Manna now spawns around the camp’s current position and relocates when the camp moves on.
- Added `tests/journey.test.mjs` (journey, pillar, survival tuning) and an `npm test` script.
- Updated docs and build; all 21 Node tests pass and `npm run build` succeeds.

## Earlier
- Added wilderness economy (tithe, Sabbath, Golden Calf, Bronze Serpent), camp needs and evening choices.
- Added save/load, audio, credits, tribes/households, weather, day/night, post-processing.
- Created Blender model sources and GLB exports (not yet runtime-loaded).
