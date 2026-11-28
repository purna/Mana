/* City Gate — case generator.
 * Turns data/templates/*.json into concrete cases, tracks what has been seen
 * (so a 480-round game doesn't repeat itself) and balances option order/length.
 * Pure logic: no DOM, no storage. */
(function (g) {
  'use strict';
  const CG = (g.CityGate = g.CityGate || {});

  const PRONOUNS = {
    m: { he: 'he', His: 'His', his: 'his', him: 'him', himself: 'himself' },
    f: { he: 'she', His: 'Her', his: 'her', him: 'her', himself: 'herself' }
  };
  const SMALL = new Set(['of', 'the', 'a', 'an', 'at', 'in', 'on', 'to', 'and', 'for', 's']);

  function titleCase(s) {
    return String(s).split(' ').map((w, i) => (i > 0 && SMALL.has(w.toLowerCase())) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  function capFirst(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }

  function create(data) {
    const cfg = data.config;
    const pools = data.pools;
    const templates = data.templates;
    const byId = {};
    templates.forEach((t) => { byId[t.id] = t; });
    const comboCache = {};

    /* ---------- combos ---------- */
    function matches(req, picks) {
      if (!req) return true;
      return Object.keys(req).every((ax) => {
        const want = req[ax];
        return Array.isArray(want) ? want.indexOf(picks[ax]) !== -1 : picks[ax] === want;
      });
    }
    function combosOf(tpl) {
      if (comboCache[tpl.id]) return comboCache[tpl.id];
      let acc = [{ picks: {}, weight: 1, key: [] }];
      tpl.axes.forEach((ax) => {
        const next = [];
        acc.forEach((c) => {
          ax.options.forEach((o) => {
            if (!matches(o.requires, c.picks)) return;
            const picks = Object.assign({}, c.picks); picks[ax.id] = o.id;
            next.push({ picks: picks, weight: c.weight * (o.weight || 1), key: c.key.concat(o.id) });
          });
        });
        acc = next;
      });
      const out = acc.map((c) => ({ picks: c.picks, weight: c.weight, key: c.key.join('+') }));
      comboCache[tpl.id] = out;
      return out;
    }
    function sigOf(tid, comboKey, frame) { return tid + '|' + comboKey + '|' + frame; }

    /* ---------- rendering ---------- */
    function applyMod(val, mod, slotVal) {
      if (!mod) return val;
      if (mod === 'l') return String(val).toLowerCase();
      if (mod === 't') return titleCase(val);
      if (mod === 'c') return capFirst(val);
      if (mod === 'u') return String(val).toUpperCase();
      return val;
    }
    function renderOnce(str, ctx) {
      return String(str).replace(/\{(@?)([A-Za-z0-9_]+)(?:\.([a-z]+))?(?::([A-Za-z]+))?\}/g, function (m, at, name, prop, mod) {
        if (at) {
          const opt = ctx.axes[name];
          if (!opt) return m;
          const v = opt[prop || 'text'];
          return applyMod(v == null ? '' : v, mod);
        }
        const sv = ctx.slots[name];
        if (sv === undefined) return m;
        if (sv && typeof sv === 'object' && sv.n) {
          if (mod && PRONOUNS[sv.g] && PRONOUNS[sv.g][mod]) return PRONOUNS[sv.g][mod];
          if (mod && mod.toLowerCase() === 'he' && mod === 'He') return capFirst(PRONOUNS[sv.g].he);
          return applyMod(sv.n, mod);
        }
        return applyMod(sv, mod);
      });
    }
    function render(str, ctx) {
      let s = String(str == null ? '' : str);
      for (let i = 0; i < 4 && s.indexOf('{') !== -1; i++) s = renderOnce(s, ctx);
      return s;
    }

    /* ---------- slots ---------- */
    function drawSlots(tpl, rng) {
      const slots = {};
      const used = {};
      Object.keys(tpl.slots || {}).forEach((name) => {
        let spec = tpl.slots[name];
        if (typeof spec === 'string') {
          if (pools.people[spec]) {
            const pool = pools.people[spec];
            let n, tries = 0;
            do { n = rng.pick(pool.items); tries++; } while (used[n] && tries < 20);
            used[n] = true; slots[name] = { n: n, g: pool.g };
          } else if (pools.lists[spec]) {
            slots[name] = rng.pick(pools.lists[spec]);
          } else { slots[name] = spec; }
        } else if (spec.num) {
          const lo = spec.num[0], hi = spec.num[1], step = spec.num[2] || 1;
          slots[name] = lo + step * rng.int(0, Math.floor((hi - lo) / step));
        } else if (spec.anyOf) {
          const pool = pools.people[rng.pick(spec.anyOf)];
          let n, tries = 0;
          do { n = rng.pick(pool.items); tries++; } while (used[n] && tries < 20);
          used[n] = true; slots[name] = { n: n, g: pool.g };
        } else if (spec.pick) {
          slots[name] = rng.pick(spec.pick);
        }
      });
      return slots;
    }

    /* ---------- selection ---------- */
    function tierWeightsFor(round) {
      let w = cfg.tierWeights[0].weights;
      cfg.tierWeights.forEach((e) => { if (round >= e.fromRound) w = e.weights; });
      return w;
    }
    function seenCount(state, sig) { const e = state.seen[sig]; return e ? e[0] : 0; }
    function unseenFraction(tpl, state) {
      const combos = combosOf(tpl); const frames = tpl.frames.length;
      let total = 0, unseen = 0;
      combos.forEach((c) => { for (let f = 0; f < frames; f++) { total++; if (!seenCount(state, sigOf(tpl.id, c.key, f))) unseen++; } });
      return total ? unseen / total : 0;
    }

    function pickTemplate(opts) {
      const rng = opts.rng, state = opts.state, round = opts.round;
      const exclude = opts.exclude || [];
      const tw = tierWeightsFor(round);
      const sel = cfg.selection;
      const recent = (state.recentTemplates || []).slice(-sel.recentTemplateMemory);
      const sessionCats = opts.sessionCategories || [];
      const pool = templates.filter((t) => exclude.indexOf(t.id) === -1);
      return rng.weighted(pool, (t) => {
        let w = (tw[String(t.tier)] || 0) * (t.weight || 1);
        w *= 0.3 + 0.7 * unseenFraction(t, state);
        if (recent.indexOf(t.id) !== -1) w *= sel.recentTemplatePenalty;
        if (sessionCats.indexOf(t.category) !== -1) w *= 0.4;
        const d = state.stats && state.stats.byDomain && state.stats.byDomain[t.category];
        if (d && d.j >= 5 && d.c / d.j < sel.weakDomainAccuracy) w *= sel.weakDomainBoost;
        return w;
      });
    }

    function pickVariant(tpl, state, rng, avoidKey) {
      const combos = combosOf(tpl);
      const cands = [];
      combos.forEach((c) => {
        if (avoidKey && c.key === avoidKey && combos.length > 1) return;
        for (let f = 0; f < tpl.frames.length; f++) {
          cands.push({ combo: c, frame: f, count: seenCount(state, sigOf(tpl.id, c.key, f)) });
        }
      });
      const min = cands.reduce((m, c) => Math.min(m, c.count), Infinity);
      const fresh = cands.filter((c) => c.count === min);
      return rng.weighted(fresh, (c) => c.combo.weight);
    }

    /* ---------- building ---------- */
    /* Choose up to 3 wrong rulings: always include one "trap" if the template has any,
       and prefer wrong options whose text length is close to the correct one so that
       the right answer cannot be spotted by how long it is. */
    function pickDistractors(tpl, rule, correctId, rng, ctx) {
      const len = (id) => render(tpl.rulings[id].label, ctx).length + render(tpl.rulings[id].summary, ctx).length;
      const target = len(correctId);
      const pool = Object.keys(tpl.rulings).filter((id) => id !== correctId && (rule.exclude || []).indexOf(id) === -1);
      const scored = pool.map((id) => ({ id: id, trap: !!tpl.rulings[id].trap, score: Math.abs(len(id) - target) + rng() * 14 }));
      scored.sort((a, b) => a.score - b.score);
      const chosen = [];
      const firstTrap = scored.filter((x) => x.trap)[0];
      if (firstTrap) chosen.push(firstTrap.id);
      scored.forEach((x) => { if (chosen.length < 3 && chosen.indexOf(x.id) === -1) chosen.push(x.id); });
      return chosen;
    }

    function build(tpl, variant, rng) {
      const combo = variant.combo;
      const slots = drawSlots(tpl, rng);
      const axes = {};
      tpl.axes.forEach((ax) => {
        axes[ax.id] = ax.options.filter((o) => o.id === combo.picks[ax.id])[0];
      });
      slots.ot = slots.town || rng.pick(pools.lists.town);
      slots.tribe = rng.pick(pools.lists.tribe);
      const ctx = { slots: slots, axes: axes };
      const rule = tpl.rules.filter((r) => matches(r.when, combo.picks))[0];
      const correctId = rule.ruling;
      const ids = [correctId].concat(pickDistractors(tpl, rule, correctId, rng, ctx));
      const options = rng.shuffle(ids).map((id) => {
        const r = tpl.rulings[id];
        return { id: id, label: render(r.label, ctx), summary: render(r.summary, ctx), trap: r.trap || null };
      });
      const penalties = {};
      ids.forEach((id) => {
        const r = tpl.rulings[id];
        const def = cfg.defaults.penaltyByHarm[String(r.harm == null ? 2 : r.harm)];
        const p = r.penalty || def;
        penalties[id] = { title: render(p.title, ctx), effect: render(p.effect, ctx), harm: r.harm == null ? 2 : r.harm, trap: r.trap || null };
      });
      const blessing = rule.blessing || cfg.defaults.blessing;
      const witness = tpl.witness ? render(tpl.witness, ctx) : 'Court Record';
      return {
        sig: sigOf(tpl.id, combo.key, variant.frame),
        templateId: tpl.id,
        comboKey: combo.key,
        category: tpl.category,
        tier: tpl.tier,
        title: render(rng.pick(tpl.titles), ctx),
        petition: [rng.pick(pools.openers || ['']), render(tpl.frames[variant.frame], ctx), rng.pick(pools.closers || [''])]
          .map((x, i) => (i === 1 ? x : render(x, ctx))).filter(Boolean).join(' '),
        evidence: render(tpl.evidence || '', ctx).replace(/;\s*;/g, ';').replace(/^[;\s]+/, ''),
        witness: witness,
        hint: render(tpl.hint, ctx),
        options: options,
        correctId: correctId,
        rationale: render(rule.rationale, ctx),
        citations: (rule.citations || []).slice(),
        blessing: { title: render(blessing.title, ctx), effect: render(blessing.effect, ctx) },
        penalties: penalties,
        codex: (tpl.codex || []).slice()
      };
    }

    /* opts: { rng, state, round, exclude[], sessionCategories[], forceTemplateId, avoidComboKey } */
    function buildCase(opts) {
      let tpl = opts.forceTemplateId && byId[opts.forceTemplateId];
      if (!tpl) tpl = pickTemplate(opts);
      const variant = pickVariant(tpl, opts.state, opts.rng, opts.avoidComboKey);
      return build(tpl, variant, opts.rng);
    }

    function stats(state) {
      let total = 0, seen = 0;
      templates.forEach((t) => {
        combosOf(t).forEach((c) => { for (let f = 0; f < t.frames.length; f++) { total++; if (seenCount(state, sigOf(t.id, c.key, f))) seen++; } });
      });
      return { totalVariants: total, seenVariants: seen, templates: templates.length };
    }

    return { buildCase, stats, combosOf, render, byId, templates, sigOf, tierWeightsFor };
  }

  CG.Generator = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : window);
