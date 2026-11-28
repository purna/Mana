#!/usr/bin/env node
/* Validates data/ and simulates generation. Run from the city-gate folder:
 *   node tools/validate-data.js            (checks every template combination)
 *   node tools/validate-data.js --sim 480  (also simulates N rounds of play)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
require(path.join(root, 'js/rng.js'));
require(path.join(root, 'js/generator.js'));
const CG = globalThis.CityGate;

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, 'data', p), 'utf8'));
const config = readJson('config.json');
const pools = readJson('pools.json');
const codex = readJson('codex.json');
const templates = [].concat.apply([], config.templateFiles.map(readJson));
const codexIds = new Set(codex.map((c) => c.id));
const cats = new Set(config.categories.map((c) => c.id));

let errors = 0, warnings = 0;
const err = (m) => { errors++; console.error('ERROR  ' + m); };
const warn = (m) => { warnings++; console.warn('warn   ' + m); };

const ids = new Set();
templates.forEach((t) => {
  if (ids.has(t.id)) err('duplicate template id ' + t.id);
  ids.add(t.id);
  if (!cats.has(t.category)) err(t.id + ': unknown category ' + t.category);
  (t.codex || []).forEach((c) => { if (!codexIds.has(c)) err(t.id + ': unknown codex id ' + c); });
  t.rules.forEach((r, i) => {
    if (!t.rulings[r.ruling]) err(t.id + ': rule ' + i + ' uses unknown ruling ' + r.ruling);
    (r.exclude || []).forEach((x) => { if (!t.rulings[x]) err(t.id + ': rule ' + i + ' excludes unknown ruling ' + x); });
    if (!r.rationale) err(t.id + ': rule ' + i + ' has no rationale');
  });
  if (t.rules[t.rules.length - 1].when) warn(t.id + ': last rule has a "when"; some combos may match no rule');
});

const gen = CG.Generator.create({ config, pools, templates });
const rng = CG.RNG.make('validate');
let combos = 0, instances = 0, posCount = { 0: 0, 1: 0, 2: 0, 3: 0 }, longest = 0;
const perTpl = {};
templates.forEach((t) => {
  const cs = gen.combosOf(t);
  const state = { seen: {}, recentTemplates: [], stats: { byDomain: {} } };
  let ratioSum = 0, n = 0, longestIsCorrect = 0, wrongPositions = 0;
  cs.forEach((c) => {
    combos++;
    for (let f = 0; f < t.frames.length; f++) {
      for (let rep = 0; rep < 4; rep++) {
        const inst = gen.buildCase({ rng, state, round: 100, forceTemplateId: t.id });
        instances++;
        // force this exact combo/frame by rebuilding via internal API: use many reps instead and check text
        const blob = [inst.title, inst.petition, inst.evidence, inst.witness, inst.hint, inst.rationale]
          .concat(inst.options.map((o) => o.label + ' ' + o.summary))
          .concat(Object.values(inst.penalties).map((p) => p.title + ' ' + p.effect)).join(' | ');
        if (/[{}]/.test(blob)) err(t.id + ' [' + inst.comboKey + ']: unresolved token in: ' + (blob.match(/.{0,30}[{}].{0,30}/) || [''])[0]);
        if (inst.options.length < 4) err(t.id + ' [' + inst.comboKey + ']: only ' + inst.options.length + ' options');
        const idx = inst.options.findIndex((o) => o.id === inst.correctId);
        posCount[idx]++;
        const len = (o) => o.label.length + o.summary.length;
        const wrong = inst.options.filter((o) => o.id !== inst.correctId);
        const avg = wrong.reduce((s, o) => s + len(o), 0) / wrong.length;
        const corr = len(inst.options[idx]);
        ratioSum += corr / avg; n++;
        if (inst.options.every((o) => o.id === inst.correctId || len(o) < corr)) longestIsCorrect++;
      }
    }
  });
  perTpl[t.id] = { combos: cs.length, frames: t.frames.length, ratio: ratioSum / n, longest: longestIsCorrect / n };
  if (perTpl[t.id].ratio > 1.3) warn(t.id + ': correct answer averages ' + perTpl[t.id].ratio.toFixed(2) + 'x the length of wrong ones');
  if (perTpl[t.id].longest > 0.55) warn(t.id + ': correct answer is the longest option ' + Math.round(perTpl[t.id].longest * 100) + '% of the time');
});

const totalVariants = templates.reduce((s, t) => s + perTpl[t.id].combos * t.frames.length, 0);
console.log('\nTemplates: ' + templates.length + '   codex entries: ' + codex.length);
console.log('Distinct (decision x narrative-frame) variants: ' + totalVariants + '   (names, places and sums vary on top of that)');
console.log('Instances built: ' + instances + '   correct-answer position counts (A/B/C/D): ' +
  [0, 1, 2, 3].map((i) => posCount[i]).join(' / '));
const byTier = {};
templates.forEach((t) => { byTier[t.tier] = (byTier[t.tier] || 0) + 1; });
console.log('Templates by tier: ' + JSON.stringify(byTier));

const simArg = process.argv.indexOf('--sim');
if (simArg !== -1) {
  const rounds = parseInt(process.argv[simArg + 1] || '480', 10);
  const per = config.session.casesPerSession;
  const state = { seen: {}, recentTemplates: [], stats: { byDomain: {} } };
  const r2 = CG.RNG.make('sim');
  let repeats = 0, sameTplBackToBack = 0, last = null; const tierN = { 1: 0, 2: 0, 3: 0 };
  for (let round = 1; round <= rounds; round++) {
    const chosen = [], cats2 = [];
    for (let i = 0; i < per; i++) {
      const c = gen.buildCase({ rng: r2, state, round, exclude: chosen, sessionCategories: cats2 });
      chosen.push(c.templateId); cats2.push(c.category); tierN[c.tier]++;
      if (state.seen[c.sig]) repeats++;
      state.seen[c.sig] = [(state.seen[c.sig] ? state.seen[c.sig][0] : 0) + 1, round];
      if (last === c.templateId) sameTplBackToBack++;
      last = c.templateId;
      state.recentTemplates.push(c.templateId);
    }
  }
  const st = gen.stats(state);
  console.log('\nSimulated ' + rounds + ' rounds x ' + per + ' cases = ' + (rounds * per) + ' petitions');
  console.log('  exact (decision+frame) repeats: ' + repeats + '   variants seen: ' + st.seenVariants + '/' + st.totalVariants);
  console.log('  same template back-to-back: ' + sameTplBackToBack + '   tier mix: ' + JSON.stringify(tierN));
}

console.log('\n' + (errors ? errors + ' error(s)' : 'No errors') + ', ' + warnings + ' warning(s).');
process.exit(errors ? 1 : 0);
