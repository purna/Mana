# MANNA — Feature tracker

Statuses: Planned, In progress, Implemented (unverified), Verified, Blocked. “Verified” means an automated test or a recorded manual check proves it.

| Feature / area | Status | Acceptance criteria | Evidence / checks | Next action |
|---|---|---|---|---|
| 40-year Exodus campaign | Implemented (unverified) | Eight stations in order; reaching the pillar completes a station; final station wins; year 40 before completion ends the run. | `tests/journey.test.mjs` covers arrival, blessing, advance and victory; `npm run build` passes. | Manual browser run through station 1 and day-end. |
| Pillar of Cloud & Fire | Implemented (unverified) | Pillar stands at the next station, glides onward, becomes fire at night, remains visible through fog, and drives the compass. | Pillar test verifies target movement and cloud/fire switch; build passes. | Visual check for scale/colour in the running scene. |
| Survival vitals | Implemented (unverified) | Wellbeing, fed, water, warmth, stamina and faith update; starvation/dehydration/cold damage wellbeing; rest/food restore. | Survival tuning test; existing hydration/weather tests pass. | Browser check of HUD updates and death at zero. |
| Survival actions | Implemented (unverified) | Eat manna (F), drink (R), draw water/warm at fire (E), sprint (Shift), with mobile buttons. | Static reference check; action methods implemented. | Manual check of each action and mobile buttons. |
| Living camp | Implemented (unverified) | Camp has tents, fire, market stalls and a crowd of Israelites; camp needs persist. | Scene creation path in `SceneManager.createCampPeople`. | Visual/performance check. |
| Journey HUD & compass | Implemented (unverified) | Year, station, distance, cardinal direction and rotating pillar arrow update in motion. | Guidance math covered by journey tests; DOM references validated. | Browser check at several headings. |
| Story / station UI | Implemented (unverified) | Prologue, station scripture/narrative/blessing modal, victory and ending modals. | HTML references exist; UI methods implemented. | Manual check of each modal. |
| Save/load v2 | Implemented (unverified) | New vitals/journey fields save and load; v1 saves merge forward. | Existing save migration and reference tests pass. | Save in play, reload, continue. |
| Audio & credits | Implemented (unverified) | Music/SFX toggle works; credits accessible. | Existing audio/credits path retained. | Manual mute/volume check. |
| Core economy loop | Implemented (unverified) | Reserve food, sell/buy surplus, evening temptations, Sabbath. | Existing survival tests pass. | Manual playtest. |
| Tribes & households | Implemented (unverified) | Tribe/household tuning affects speed, quota, spawn count, starting resources. | `js/tribes.json` valid; existing tests. | Balance pass after play. |
| Weather | Verified | Four-day forecast cycle, heat/wind/rain effects, shelter, Sabbath rest. | `tests/migration.test.mjs` weather tests pass. | — |
| Terrain/collision grounding | Verified | Cached surface height matches rendered tiles; collisions resolve without NaN. | Existing terrain/collision tests pass. | — |
| 1 km terrain streaming | Implemented (unverified) | 3×3 sections stream around the player; heights ground the player, stations and pickups; real DEM fallback. | `tests/terrain.test.mjs`; build passes. | Browser check with real tiles/CORS. |
| Wadi Rum biome scatter | Implemented (unverified) | Palms, acacias, tamarisk, shrubs, boulders, outcrops, wadis and massifs populate sections. | Terrain tests verify vegetation and wadi/massif generation. | Visual/performance check. |
| Explored map & JSON tiles | Implemented (unverified) | Visited 1 km sections are recorded, drawn with fog-of-war and real satellite imagery, saved, and cached as JSON records. | `tests/map.test.mjs`; build passes. | Browser map/save check. |
| Runtime GLB integration | Planned | Load GLBs with procedural fallback/colliders. | Procedural geometry still used. | Integrate GLTFLoader and validate scale/origin. |
