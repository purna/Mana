# MANNA — Testing guide

## Automated checks

```bash
npm run build
npm test
```

`npm test` runs `node --test tests/*.test.mjs`:

- `tests/survival.test.mjs` — food reservation, market, hydration/weather, collisions, 30/60 fps movement, tile grounding.
- `tests/migration.test.mjs` — particle lifecycle, scenery/collider creation, local references, forecast cycle, weather particles, Stats import.
- `tests/journey.test.mjs` — journey start/guidance, station blessing/advance, eight-station victory, pillar cloud/fire and movement, survival tuning.
- `tests/terrain.test.mjs` — 1 km section streaming, deterministic heights, wadis/massifs, vegetation, Wadi Rum projection and player-driven tile loading.
- `tests/map.test.mjs` — explored-section records, real-DEM updates, map reset and JSON section round-trip.
- `tests/v2-core.test.mjs` — share-code encode/decode, save migration and validation rules.
- `tests/determinism.test.mjs` — identical terrain heights across fresh sessions, save/load JSON round-trip plus migration idempotence, and raid-roll determinism through `MannaCore.rollRaid`.

Expected result: 40 passing tests. The Vite build should complete with no errors (the existing chunk-size warning is expected).

## Static checks

```bash
python3 -m json.tool js/tribes.json >/dev/null
python3 - <<'PY'
import re, pathlib
html = pathlib.Path('index.html').read_text()
ids = set(re.findall(r'id="([^"]+)"', html))
for f in pathlib.Path('js').glob('*.js'):
    for ref in re.findall(r"getElementById\('([^']+)'\)", f.read_text()):
        if ref not in ids and ref != 'narrativeToasts':
            print('missing', f.name, ref)
PY
```

`narrativeToasts` is created dynamically and is expected to be absent from the HTML.

## Manual browser smoke test

1. `npm run dev`, open `http://localhost:5173/`.
2. Confirm the MANNA menu, then **Begin the Exodus**; close the prologue with **Take up the staff**.
3. Confirm the journey HUD shows Year 1, **The Red Sea Shore**, distance/cardinal and a rotating compass arrow.
4. Walk/steer (`WASD`/arrows), sprint (`Shift`), collect manna, eat (`F`), drink (`R`), fill the waterskin at the Oasis/Split Rock (`E`). Check the journey HUD terrain badge: `Wadi Rum · SRTM DEM` or `Wadi Rum · generated`.
5. Walk toward a new 1 km section and confirm terrain/plants keep streaming in.
6. Follow the pillar; verify the cloud glows by day and becomes fire at night, and that reaching the station opens the story/blessing modal.
7. Press **Continue the journey**; confirm the pillar moves on and the HUD updates.
8. Let the day timer end; verify food reservation, market, evening choices and the next year.
9. Pause/save, reload, continue; verify vitals and journey position restore.
10. Open the map (`M`); confirm explored sections show the real Esri satellite basemap, unknown sections stay dark, and drag/wheel/pinch pan and zoom work. Closing the map persists exploration automatically.
11. Check the About panel, credits, audio toggle and the faith/camp panel. In the HUD resources row confirm the always-visible **Cover** chip updates as you build watchtowers/sentry posts in Camp.
12. Gather manna or wood and watch the resource flight arc to the camp stores; in Camp → Move structures, confirm moves snap to the half-tile grid, the dashed footprint shows blocking reasons, and Undo/Redo replay moves.
13. After publishing an updated build, reload the site once: the update banner should appear while the new worker waits, and clicking **Reload** swaps to the new shell.
14. On a phone (or DevTools device mode), export the journey from Pause → export: the share sheet should offer the save file where Web Share is available.
15. Narrow the viewport to phone width; verify vitals, compass, survival buttons and on-screen arrows remain reachable.

## Known limitations

- External DEM requests are blocked in this environment; the game is verified with the deterministic Wadi Rum provider. The Terrarium/SRTM adapter is built but needs a browser/CORS check.
- Browser preview automation in this environment timed out; the overhaul is verified by build + 26 Node tests and static reference checks, not a recorded browser session.
- Runtime GLB loading is still not wired; all world visuals are procedural.
- Balance has not been playtested across a full 40-year run.
