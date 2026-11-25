# Graphics assets

Static art for the isometric edition lives here. Nothing in this folder is
referenced by `index.html` yet; the game currently draws everything (terrain,
sprites, tribe motifs, icons) with inline SVG and canvas code, which keeps the
shell self-contained.

## Layout
- `tribes/` — one SVG per tribe motif (Reuben…Benjamin), 24×24 viewBox.
  Names must match the tribe keys used in `index.html` (`TRIBE_EMBLEMS`).
- `roles/` — role icons for the daily muster (manna, water, wood, camp, watch).
- `ui/` — top-bar and HUD icons (pause, map, speaker, gear).

## Rules
- SVG only (no emoji, no raster placeholders) per `AGENTS.md` "Art & content rules".
- Keep files small (<4 KB) and self-contained (no external refs).
- When a file is actually wired into the game, add its folder to the copy list
  in `vite.config.js` so it ships to `dist/`.
