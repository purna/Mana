# MANNA — Improvements

## Completed in the Exodus overhaul
- [x] **40-year campaign loop**: eight stations, year tracking, Pillar guidance, blessings, victory and a fortieth-year ending.
- [x] **Pillar of Cloud & Fire**: day/night visual, fog-ignoring shaft, point light, halo, smooth movement between stations.
- [x] **Survival layer**: wellbeing, fed, water, warmth, stamina and faith, with starvation/dehydration/cold damage and rest recovery.
- [x] **Actions**: eat manna (`F`), drink (`R`), draw water/warm at fire (`E`), sprint (`Shift`), plus mobile buttons.
- [x] **Journey HUD**: year, next station, distance, cardinal direction and rotating pillar compass.
- [x] **Story presentation**: prologue, scripture/station modals, victory/ending summaries, themed menu.
- [x] **Living camp**: crowd of Israelites, tents, fire and market stalls.
- [x] **Night sky and atmosphere**: stars, stronger firelight, camp crowd idle motion.
- [x] **Save v2**: new fields persist and older saves merge forward.
- [x] **Automated checks**: journey/pillar tests plus the existing terrain/weather/survival suite (26 tests).
- [x] **1 km terrain streaming**: Wadi Rum pilot with real Terrarium/SRTM adapter and deterministic fallback.
- [x] **Biome scatter**: palms, acacias, tamarisk, shrubs, boulders, layered outcrops, dry wadis.
- [x] **Real terrain grounding**: initial 3×3 ring awaited before landmarks/player creation.

## Next (terrain)
- [ ] **More pilot regions**: AlUla/Hegra, Sinai, Petra/Dana, Yemen highlands; region-specific procedural fallbacks.
- [ ] **Higher-resolution regional DEM**: replace 30 m Terrarium where national lidar is available.
- [ ] **Wadi hydrology**: flow-accumulation bake and occasional pools.
- [ ] **Satellite-derived ground colour** and rock/stratigraphy textures.
- [ ] **Smooth real-DEM updates** for sections loaded after the player arrives.

## Next (gameplay)
- [ ] **Station trials**: require a concrete task at each station (fill waterskin, gather quota, choose faith/doubt) before the pillar moves.
- [ ] **Quail and manna events**: occasional quail flocks, double-manna day before Sabbath, spoilage warnings.
- [ ] **Faith consequences**: low faith affects camp morale, murmuring events, and divine aid; high faith unlocks dawn blessings.
- [ ] **Camp followers on the move**: a small procession follows the pillar between stations.
- [ ] **Balance pass**: playtest hunger/thirst/warmth over 10+ years; tune day length, sprint, and station spacing.

## Next (UX / accessibility)
- [ ] **Onboarding checklist** for the first station with contextual tips.
- [ ] **Minimap / route line** in addition to the compass.
- [ ] **Reduced-motion option** for the pillar, stars and camp bob.
- [ ] **Screen-reader labels** for the vitals and compass; colour-independent status text.
- [ ] **Separate music/SFX sliders** with persistence.

## Next (visuals / technical)
- [ ] **Runtime GLB integration** for the character, tents, trees and landmarks; keep procedural fallbacks.
- [ ] **Walk animation polish**: staff planting, robe sway, dust timing.
- [ ] **Instancing/LOD** for station stones, palms and rocks on mobile.
- [ ] **Automated browser smoke test** once preview automation is reliable.
- [ ] **Performance budget**: measure station/camp crowd cost on low-end devices.
