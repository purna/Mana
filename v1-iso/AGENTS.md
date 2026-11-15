# Mana — AI instructions

## Scope
`games/mana/` is a static browser game (Three.js) published as built assets. Treat this folder as game-specific; do not apply unrelated repository/course-material rules.

## Context loading
Read this file first. Open `ARCHITECTURE.md` for runtime/asset structure, `FEATURES.md` for current feature status, `TESTING.md` for verification, and `IMPROVEMENTS.md` for backlog items. Avoid loading the large minified bundle except when searching for a specific symbol.

## Implement
- Preserve published paths and runtime behavior: `index.html`, `assets/index-*.js`, `assets/index-*.css`, `js/tribes.json`, `plugins/*`, `assets/audio/*`, and fonts.
- The game has a local Vite + Three.js source under `js/` and `styles/`. Edit the source and rebuild (`npm run build`); do not hand-patch generated bundles in `dist/` or stale `assets/index-*.js` files.
- 3D model assets live in `models/blender/` (`.blend`) and `models/glb/` (`.glb`). Keep names stable, origins grounded, scale consistent, and export GLBs with transforms applied.
- Gameplay/state changes must preserve save/load compatibility where practical (`localforage` save data), accessibility controls, audio behavior, and tribe/household tuning data in `js/tribes.json`.

## Verify and report
- Run only supported checks: `npm run build` and `npm test` (Node test suite). For static changes, verify file references and JSON validity; do not claim unrun browser checks passed.
- For model changes, record Blender export/validation steps and note that runtime GLB loading may require source/build integration.
- Update `FEATURES.md`/`IMPROVEMENTS.md` for status changes, `ARCHITECTURE.md` for structure/interface changes, and `CHANGELOG.md` for meaningful shipped changes.
- Report changed files, checks/results, affected paths, and remaining risks.
