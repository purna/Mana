import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const v2 = path.join(root, 'v3');
const vite = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');

// Build the current isometric game into v3/dist, then publish that output as
// the repository-level dist/ that GitHub Pages uses as the site root.
execFileSync(vite, ['build'], { cwd: v2, stdio: 'inherit' });

const source = path.join(v2, 'dist');
const target = path.join(root, 'dist');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
writeFileSync(path.join(target, '.nojekyll'), '');
console.log('GitHub Pages site ready in dist/');
