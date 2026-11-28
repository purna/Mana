/* City Gate — game engine.
 * Owns all state and rules (scoring, wagers, hints, power-ups, appeals, timers,
 * badges, ranks, epilogues, persistence). No DOM access, so it can be driven by
 * the bundled UI or by your own game. */
(function (g) {
  'use strict';
  const CG = (g.CityGate = g.CityGate || {});

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function freshState(cfg, keep) {
    const s = {
      v: 1,
      round: 0,
      standing: cfg.scoring.standingStart,
      renown: 0,
      streak: 0,
      bestStreak: 0,
      difficulty: 'scholar',
      inventory: { scroll: 0, witness: 0, appeal: 0 },
      stats: { judged: 0, correct: 0, hinted: 0, sessions: 0, perfectSessions: 0, byDomain: {}, byTemplate: {} },
      recent: [],
      seen: {},
      recentTemplates: [],
      reviewQueue: [],
      badges: {},
      records: { bestStreak: 0, bestSessionRenown: 0, perfectSessions: 0, bestTermRenown: 0, bestTermAccuracy: 0 },
      highlights: { best: [], worst: [] },
      log: [],
      pastTerms: [],
      lastSession: null,
      session: null
    };
    if (keep) { s.records = keep.records; s.pastTerms = keep.pastTerms; s.difficulty = keep.difficulty; }
    return s;
  }

  /* ---------- storage adapters ---------- */
  function makeStorage(opts, key) {
    if (opts && opts.storage) return opts.storage;
    const api = g.notebookAppApi;
    if (api && typeof api.getAppState === 'function' && typeof api.setAppState === 'function') {
      return { get: () => Promise.resolve(api.getAppState()), set: (k, v) => Promise.resolve(api.setAppState(v)) };
    }
    try {
      if (g.localStorage) {
        g.localStorage.setItem('__cg_test', '1'); g.localStorage.removeItem('__cg_test');
        return {
          get: (k) => Promise.resolve(JSON.parse(g.localStorage.getItem(k) || 'null')),
          set: (k, v) => { g.localStorage.setItem(k, JSON.stringify(v)); return Promise.resolve(); }
        };
      }
    } catch (e) { /* fall through */ }
    const mem = {};
    return { get: (k) => Promise.resolve(mem[k] ? JSON.parse(mem[k]) : null), set: (k, v) => { mem[k] = JSON.stringify(v); return Promise.resolve(); } };
  }

  function create(data, opts) {
    opts = opts || {};
    const cfg = data.config;
    const gen = CG.Generator.create(data);
    const storage = makeStorage(opts, cfg.storageKey);
    const listeners = {};
    let state = freshState(cfg);

    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return function () { listeners[evt] = listeners[evt].filter((f) => f !== fn); }; }
    function emit(evt, payload) { (listeners[evt] || []).forEach((fn) => { try { fn(payload); } catch (e) { if (g.console) console.error(e); } }); }

    /* ---------- persistence ---------- */
    async function load() {
      try {
        const saved = await storage.get(cfg.storageKey);
        if (saved && saved.v === 1) {
          state = Object.assign(freshState(cfg), saved);
          state.inventory = Object.assign({ scroll: 0, witness: 0, appeal: 0 }, saved.inventory);
        }
      } catch (e) { /* start fresh */ }
      if (opts.difficulty && cfg.difficulties[opts.difficulty]) state.difficulty = opts.difficulty;
      return state;
    }
    async function save() { try { await storage.set(cfg.storageKey, state); } catch (e) { /* best effort */ } emit('change', state); }

    /* ---------- derived values ---------- */
    function difficulty() { return cfg.difficulties[state.difficulty] || cfg.difficulties.scholar; }
    function getBand() {
      const bands = cfg.bands.slice().sort((a, b) => b.min - a.min);
      return bands.filter((b) => state.standing >= b.min)[0] || bands[bands.length - 1];
    }
    function rollingAccuracy() {
      const w = state.recent.slice(-cfg.rolling.window);
      return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
    }
    function lifetimeAccuracy() { return state.stats.judged ? state.stats.correct / state.stats.judged : null; }
    function getRank() {
      const acc = rollingAccuracy();
      if (state.recent.length >= cfg.rolling.minForDemotion && acc !== null && acc < cfg.rolling.compromisedBelow) return cfg.compromisedRank;
      let rank = cfg.ranks[0];
      cfg.ranks.forEach((r) => {
        if (state.renown >= r.minRenown && (r.minAccuracy == null || (acc !== null && acc >= r.minAccuracy)) && (r.minStanding == null || state.standing >= r.minStanding)) rank = r;
      });
      return rank;
    }
    function nextRank() {
      const cur = getRank(); const idx = cfg.ranks.findIndex((r) => r.id === cur.id);
      return idx >= 0 && idx < cfg.ranks.length - 1 ? cfg.ranks[idx + 1] : null;
    }
    function streakBonus(n) {
      let b = 0; cfg.scoring.streakBonus.forEach((s) => { if (n >= s.at) b = s.bonus; }); return b;
    }
    function calendar(round) {
      const per = cfg.calendar.roundsPerYear;
      return { round: round, year: Math.floor((round - 1) / per) + 1, month: ((round - 1) % per) + 1 };
    }

    /* ---------- sessions ---------- */
    function startSession(o) {
      o = o || {};
      if (state.session && !o.force) return state.session;       // resume
      const round = o.round != null ? o.round : state.round + 1;
      const n = clamp(o.cases || cfg.session.casesPerSession, 1, cfg.session.maxCasesPerSession);
      if (o.difficulty && cfg.difficulties[o.difficulty]) state.difficulty = o.difficulty;
      const rng = CG.RNG.make((o.seed != null ? String(o.seed) : String(Math.random())) + ':' + round);
      const band = getBand();
      const chosen = [], cats = [], cases = [];
      for (let i = 0; i < n; i++) {
        let force = null, avoid = null;
        const due = state.reviewQueue.filter((r) => r.due <= round && chosen.indexOf(r.tid) === -1);
        if (due.length && rng() < cfg.selection.reviewChance) {
          const r = due[0]; force = r.tid; avoid = r.comboKey;
          state.reviewQueue = state.reviewQueue.filter((x) => x !== r);
        }
        const c = gen.buildCase({ rng: rng, state: state, round: round, exclude: chosen, sessionCategories: cats, forceTemplateId: force, avoidComboKey: avoid });
        c.review = !!force;
        // remember what has been shown so it is not repeated
        const e = state.seen[c.sig] || [0, 0]; state.seen[c.sig] = [e[0] + 1, round];
        state.recentTemplates.push(c.templateId);
        if (state.recentTemplates.length > 40) state.recentTemplates.shift();
        chosen.push(c.templateId); cats.push(c.category);
        // temptation when the nation's standing is low
        if (rng() < band.pressureChance) {
          const wrong = c.options.filter((op) => op.id !== c.correctId);
          const target = rng.pick(wrong); const amt = rng.pick(cfg.scoring.pressure.amounts);
          c.pressure = {
            optionId: target.id, amt: amt,
            text: rng.pick(data.pools.pressures.bench).replace('{amt}', amt),
            tag: data.pools.pressures.optionTag.replace('{amt}', amt)
          };
        } else { c.pressure = null; }
        cases.push(c);
      }
      state.session = { round: round, calendar: calendar(round), index: 0, cases: cases, results: [], standingStart: state.standing, renownStart: state.renown, cur: null };
      startCase();
      save();
      emit('sessionStart', state.session);
      return state.session;
    }

    function startCase() {
      const s = state.session; const c = s.cases[s.index];
      const secs = difficulty().timer[String(c.tier)];
      s.cur = { hintStage: 0, freeHint: false, removed: [], pendingWrong: null, appealed: false, wasWrongBeforeAppeal: null,
                deadline: secs ? Date.now() + secs * 1000 : null, seconds: secs || null, done: false, verdict: null };
    }

    function currentCase() { const s = state.session; return s ? s.cases[s.index] : null; }
    function cur() { return state.session ? state.session.cur : null; }

    /* ---------- player actions ---------- */
    function canUseHint() {
      const u = cur(); if (!u || u.done || u.pendingWrong) return null;
      const max = difficulty().maxHintStage;
      if (u.freeHint || u.hintStage >= max) return null;
      const next = u.hintStage + 1;
      const h = next === 1 ? cfg.scoring.hints.principle : cfg.scoring.hints.elders;
      return { stage: next, label: h.label, cost: h.cost * difficulty().hintCostMult, winMult: h.winMult };
    }
    function useHint() {
      const info = canUseHint(); if (!info) return null;
      cur().hintStage = info.stage; save(); return info;
    }
    function useScroll() {
      const u = cur(); if (!u || u.done || u.pendingWrong || u.freeHint || state.inventory.scroll < 1) return false;
      state.inventory.scroll--; u.freeHint = true; u.hintStage = 2; save(); return true;
    }
    function useWitness() {
      const u = cur(), c = currentCase();
      if (!u || u.done || u.pendingWrong || state.inventory.witness < 1 || u.removed.length > (u.appealed ? 1 : 0)) return null;
      const wrong = c.options.filter((o) => o.id !== c.correctId && u.removed.indexOf(o.id) === -1);
      if (wrong.length < 2) return null;
      const pick = wrong[Math.floor(Math.random() * wrong.length)];
      state.inventory.witness--; u.removed.push(pick.id); save(); return pick.id;
    }

    function submit(choiceId, wagerId) {
      const u = cur(), c = currentCase();
      if (!u || u.done || u.pendingWrong) return null;
      if (u.removed.indexOf(choiceId) !== -1 || !c.options.some((o) => o.id === choiceId)) return null;
      if (u.deadline && Date.now() > u.deadline + 1500) return timeout();
      const correct = choiceId === c.correctId;
      if (!correct && !u.appealed && state.inventory.appeal > 0) {
        u.pendingWrong = { choiceId: choiceId, wager: wagerId || 'cautious' };
        save();
        return { status: 'appealOffer', chosenId: choiceId };
      }
      return { status: 'final', verdict: finalize(choiceId, u.appealed ? 'cautious' : wagerId, {}) };
    }
    function useAppeal() {
      const u = cur(); if (!u || !u.pendingWrong || state.inventory.appeal < 1) return false;
      state.inventory.appeal--; u.appealed = true; u.removed.push(u.pendingWrong.choiceId);
      u.wasWrongBeforeAppeal = u.pendingWrong.choiceId; u.pendingWrong = null; save(); return true;
    }
    function declineAppeal() {
      const u = cur(); if (!u || !u.pendingWrong) return null;
      const pw = u.pendingWrong; u.pendingWrong = null; u.appealed = false;
      return finalize(pw.choiceId, pw.wager, {});
    }
    function timeout() {
      const u = cur(); if (!u || u.done) return null;
      u.pendingWrong = null;
      return { status: 'final', verdict: finalize(null, 'cautious', { timedOut: true }) };
    }

    /* ---------- scoring ---------- */
    function finalize(choiceId, wagerId, flags) {
      const s = state.session, c = currentCase(), u = s.cur, diff = difficulty(), sc = cfg.scoring;
      const timedOut = !!flags.timedOut;
      const correct = choiceId !== null && choiceId === c.correctId;
      const appealed = u.appealed;
      const wager = sc.wagers[wagerId] || sc.wagers.cautious;
      const tier = sc.tiers[String(c.tier)];
      const lines = [];
      const stage = u.freeHint ? 0 : u.hintStage;
      const hintCfg = stage === 2 ? sc.hints.elders : stage === 1 ? sc.hints.principle : null;
      const hintMult = hintCfg ? hintCfg.winMult : 1;
      const hintCost = hintCfg ? hintCfg.cost * diff.hintCostMult : 0;
      let standingDelta = 0, renown = 0, newStreak = state.streak;
      let accurate = false, bribed = false, resisted = false;

      if (correct && !appealed) {
        accurate = true;
        newStreak = state.streak + 1;
        const bonus = streakBonus(newStreak);
        let gain = tier.blessing * wager.win * (1 + bonus) * hintMult;
        const d = sc.damping;
        if (state.standing > d.from) gain *= 1 - ((state.standing - d.from) / (100 - d.from)) * d.max;
        gain = Math.max(1, Math.round(gain));
        lines.push('Base blessing (tier ' + c.tier + '): +' + tier.blessing);
        if (bonus) lines.push('Righteous run (' + newStreak + ' in a row): +' + Math.round(bonus * 100) + '%');
        if (wager.win !== 1) lines.push(wager.label + ' wager: x' + wager.win);
        if (hintCfg) lines.push('Counsel taken: x' + hintMult);
        if (state.standing > d.from) lines.push('Standing near its peak: gains are damped');
        if (c.pressure) { gain += sc.pressure.resistBonus; resisted = true; lines.push('Incorruptible: refused a bribe of ' + c.pressure.amt + ' shekels: +' + sc.pressure.resistBonus); }
        standingDelta = gain;
        renown = Math.round(tier.renown * wager.win * (1 + bonus) * hintMult * diff.renownMult);
      } else if (correct && appealed) {
        const gain = Math.max(1, Math.round(tier.blessing * sc.appealWinMult));
        standingDelta = gain; renown = Math.round(tier.renown * sc.appealWinMult);
        lines.push('Appeal granted: right on the second ruling, half credit; your streak is kept');
      } else {
        const pen = c.penalties[choiceId];
        const base = timedOut ? sc.timeoutPenalty : sc.penaltyByHarm[String(pen.harm)];
        let loss = Math.round(base * (timedOut ? 1 : wager.lose));
        lines.push(timedOut ? 'No ruling before the clock ran out: -' + base : 'Penalty for a harm-' + pen.harm + ' ruling: -' + base);
        if (!timedOut && wager.lose !== 1) lines.push(wager.label + ' wager: x' + wager.lose);
        if (c.pressure && choiceId === c.pressure.optionId) { loss += sc.pressure.extraLoss; bribed = true; lines.push('Bribe accepted: -' + sc.pressure.extraLoss + ' more'); }
        standingDelta = -loss;
        newStreak = 0;
      }
      if (hintCost) { standingDelta -= hintCost; lines.push('Counsel cost: -' + hintCost); }
      if (u.freeHint) lines.push('Scroll of the Elders used: no cost');

      state.standing = clamp(state.standing + standingDelta, 0, 100);
      state.renown += renown;
      state.streak = (correct && appealed) ? state.streak : newStreak;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;

      // stats
      const st = state.stats;
      st.judged++; if (accurate) st.correct++; if (stage > 0 || u.freeHint) st.hinted++;
      const dom = st.byDomain[c.category] = st.byDomain[c.category] || { j: 0, c: 0 }; dom.j++; if (accurate) dom.c++;
      const tp = st.byTemplate[c.templateId] = st.byTemplate[c.templateId] || { j: 0, c: 0 }; tp.j++; if (accurate) tp.c++;
      state.recent.push(accurate ? 1 : 0); if (state.recent.length > 60) state.recent.shift();

      // spaced repetition: re-teach what was missed, with a different variant
      if (!accurate && !state.reviewQueue.some((r) => r.tid === c.templateId)) {
        const d = cfg.selection.reviewDelayRounds;
        state.reviewQueue.push({ tid: c.templateId, comboKey: c.comboKey, due: s.round + d[0] + Math.floor(Math.random() * (d[1] - d[0] + 1)) });
      }

      // power-ups earned
      const earned = [];
      if (accurate) {
        Object.keys(cfg.powerups).forEach((k) => {
          const p = cfg.powerups[k];
          if (p.everyStreak && newStreak % p.everyStreak === 0 && state.inventory[k] < p.max) { state.inventory[k]++; earned.push(k); }
        });
      }
      // domain badges
      const newBadges = [];
      const tiers = cfg.domainBadges;
      let reached = null;
      tiers.forEach((b) => { if (dom.j >= b.minJudged && dom.c / dom.j >= b.minAccuracy) reached = b; });
      const had = state.badges[c.category]; const hadIdx = had ? tiers.findIndex((b) => b.id === had) : -1;
      const reachedIdx = reached ? tiers.findIndex((b) => b.id === reached.id) : -1;
      if (reachedIdx > hadIdx) {
        state.badges[c.category] = reached.id; newBadges.push({ category: c.category, badge: reached.id, label: reached.label });
        Object.keys(cfg.powerups).forEach((k) => { const p = cfg.powerups[k]; if (p.onBadge === reached.id && state.inventory[k] < p.max) { state.inventory[k]++; earned.push(k); } });
      }

      const chosenOpt = c.options.filter((o) => o.id === choiceId)[0];
      const correctOpt = c.options.filter((o) => o.id === c.correctId)[0];
      const verdict = {
        caseIndex: s.index, templateId: c.templateId, title: c.title, category: c.category, tier: c.tier,
        chosenId: choiceId, chosenLabel: chosenOpt ? chosenOpt.label : null, correctId: c.correctId, correctLabel: correctOpt.label,
        accurate: accurate, rawCorrect: correct, appealed: appealed, timedOut: timedOut, wager: wagerId || 'cautious',
        hintStage: u.freeHint ? 'scroll' : stage, standingDelta: standingDelta, renown: renown, streak: state.streak, standing: state.standing,
        breakdown: lines, earned: earned, newBadges: newBadges, bribed: bribed, resisted: resisted,
        trap: (!correct && choiceId && c.penalties[choiceId].trap) || null,
        harm: choiceId ? c.penalties[choiceId].harm : null
      };
      s.results.push(verdict); u.done = true; u.verdict = verdict;

      state.log.push({ round: s.round, title: c.title, category: c.category, tier: c.tier, accurate: accurate, delta: standingDelta, renown: renown,
                       chosen: verdict.chosenLabel || 'No ruling (time ran out)', correct: correctOpt.label, wager: verdict.wager, hint: verdict.hintStage,
                       appealed: appealed, bribed: bribed, harm: verdict.harm });
      if (state.log.length > 120) state.log.shift();
      const hl = state.highlights;
      if (accurate && c.tier === 3) { hl.best.push({ round: s.round, title: c.title }); if (hl.best.length > 5) hl.best.shift(); }
      if (!accurate && verdict.harm === 3) { hl.worst.push({ round: s.round, title: c.title, chosen: verdict.chosenLabel }); if (hl.worst.length > 5) hl.worst.shift(); }

      save();
      emit('verdict', verdict);
      if (opts.onVerdict) opts.onVerdict(verdict);
      return verdict;
    }

    /* ---------- flow ---------- */
    function next() {
      const s = state.session; if (!s || !s.cur.done) return null;
      if (s.index < s.cases.length - 1) { s.index++; startCase(); save(); return { status: 'case' }; }
      return { status: 'complete', result: completeSession() };
    }

    function completeSession() {
      const s = state.session; const t = cfg.scoring.drift;
      const standingBefore = s.standingStart;
      const afterCases = state.standing;
      const drift = Math.trunc((t.target - state.standing) * t.rate);
      state.standing = clamp(state.standing + drift, 0, 100);
      const flawless = s.results.every((r) => r.accurate && !r.hintStage && !r.appealed);
      const earned = [];
      if (flawless) {
        state.stats.perfectSessions++; state.records.perfectSessions = state.stats.perfectSessions;
        if (cfg.flawlessSessionScrollBonus && state.inventory.scroll < cfg.powerups.scroll.max) { state.inventory.scroll++; earned.push('scroll'); }
      }
      const band = getBand();
      if (band.scrollChance && Math.random() < band.scrollChance && state.inventory.scroll < cfg.powerups.scroll.max) { state.inventory.scroll++; earned.push('scroll'); }
      state.round = Math.max(state.round, s.round);
      state.stats.sessions++;
      const renownGained = state.renown - s.renownStart;
      if (renownGained > state.records.bestSessionRenown) state.records.bestSessionRenown = renownGained;
      if (state.bestStreak > state.records.bestStreak) state.records.bestStreak = state.bestStreak;
      const rank = getRank();
      const result = {
        round: s.round, calendar: s.calendar, total: s.results.length,
        correctCount: s.results.filter((r) => r.accurate).length,
        cases: s.results.map((r) => ({ title: r.title, category: r.category, tier: r.tier, correct: r.accurate, standingDelta: r.standingDelta, renown: r.renown,
                                      wager: r.wager, hintStage: r.hintStage, appealed: r.appealed, timedOut: r.timedOut, trap: r.trap })),
        flawless: flawless, standingBefore: standingBefore, standingAfterCases: afterCases, drift: drift, standingAfter: state.standing,
        standingDelta: state.standing - standingBefore, renownGained: renownGained, streak: state.streak, rank: rank,
        band: { id: band.id, label: band.label, modifiers: band.modifiers }, newBadges: [].concat.apply([], s.results.map((r) => r.newBadges)),
        powerupsEarned: earned.concat.apply(earned, s.results.map((r) => r.earned)), inventory: clone(state.inventory)
      };
      state.lastSession = result; state.session = null;
      save();
      emit('sessionComplete', result);
      if (opts.onSessionComplete) opts.onSessionComplete(result);
      return result;
    }

    /* ---------- legacy ---------- */
    function getEpilogue() {
      const acc = lifetimeAccuracy(); const accPct = acc === null ? 0 : Math.round(acc * 100);
      const rounds = state.round; const years = Math.max(1, Math.round(rounds / cfg.calendar.roundsPerYear));
      const match = cfg.epilogues.filter((e) =>
        (e.maxRounds == null || rounds <= e.maxRounds) && (e.minRounds == null || rounds >= e.minRounds) &&
        (e.minStanding == null || state.standing >= e.minStanding) && (e.minAccuracy == null || (acc !== null && acc >= e.minAccuracy)))[0] || cfg.epilogues[cfg.epilogues.length - 1];
      const fill = (t) => t.replace(/\{(\w+)\}/g, (m, k) => ({ rounds: rounds, years: years, accuracy: accPct, judged: state.stats.judged, standing: state.standing, renown: state.renown, rank: getRank().title, bestStreak: state.bestStreak })[k]);
      return { id: match.id, title: match.title, text: fill(match.text), best: state.highlights.best.slice(), worst: state.highlights.worst.slice() };
    }

    function reset() {
      const acc = lifetimeAccuracy();
      if (state.stats.judged > 0) {
        state.pastTerms.push({ rounds: state.round, judged: state.stats.judged, accuracy: Math.round((acc || 0) * 100), renown: state.renown, standing: state.standing, rank: getRank().title });
        if (state.renown > state.records.bestTermRenown) state.records.bestTermRenown = state.renown;
        if ((acc || 0) * 100 > state.records.bestTermAccuracy) state.records.bestTermAccuracy = Math.round((acc || 0) * 100);
        if (state.pastTerms.length > 20) state.pastTerms.shift();
      }
      state = freshState(cfg, state);
      save();
      emit('reset', state);
    }

    function setDifficulty(id) { if (cfg.difficulties[id]) { state.difficulty = id; save(); } }

    return {
      cfg: cfg, data: data, generator: gen, on: on, load: load, save: save,
      get state() { return state; },
      startSession, currentCase, cur, next, submit, useHint, useScroll, useWitness, useAppeal, declineAppeal, timeout, canUseHint,
      getBand, getRank, nextRank, rollingAccuracy, lifetimeAccuracy, getEpilogue, reset, setDifficulty, difficulty, calendar,
      variantStats: () => gen.stats(state)
    };
  }

  CG.Engine = { create: create, freshState: freshState };
})(typeof globalThis !== 'undefined' ? globalThis : window);
