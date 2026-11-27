import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export default defineConfig({
  base: './',
  cacheDir: '.vite-cache',
  resolve: { alias: { 'three/examples/jsm/shaders/VignetteShader.js': fileURLToPath(new URL('./js/libs/shaders/VignetteShader.js', import.meta.url)) } },
  plugins: [{ name: 'copy-game-assets', closeBundle() {
    for (const path of ['assets/audio', 'assets/graphics', 'fonts', 'js/tribes.json', 'js/iso-core.js', 'js/electricBorder.js', 'plugins/howler.min.js', 'plugins/stats.module.js', 'plugins/three.min.js', 'plugins/localforage.min.js', 'plugins/gsap.min.js', 'favicon.ico', 'manifest.webmanifest', 'sw.js']) {
      mkdirSync('dist/' + path.substring(0, path.lastIndexOf('/') + 1), { recursive: true });
      cpSync(path, 'dist/' + path, { recursive: true });
    }
    // Stamp the service worker's cache name with a hash of this build, so every
    // release manages its own cache and activation prunes the previous one.
    // A source sw.js keeps the plain name, which still works unbuilt.
    const swPath = 'dist/sw.js';
    const hash = createHash('sha256').update(readFileSync('dist/index.html')).digest('hex').slice(0, 8);
    writeFileSync(swPath, readFileSync(swPath, 'utf8').replace(
      "const CACHE = 'manna-iso-v2';",
      `const CACHE = 'manna-iso-v2-${hash}';`,
    ));
  } }],
  build: { rollupOptions: { external: id => id.startsWith('https://') } }
});
