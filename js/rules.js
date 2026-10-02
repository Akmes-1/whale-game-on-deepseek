/*
 * Whale Spa — pure game rules. No DOM, no canvas: safe to unit-test in Node.
 * Coordinates are in MARK space (the whale SVG viewBox, 764x584 at origin 0,0).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WhaleRules = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---- deterministic RNG (mulberry32) so rounds are reproducible from a seed ----
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- 武器表 ----
  // kind: 'throw' = 旋转飞刀；'thrust' = 直刺（不旋转，命中后贯穿一条线，带发射特效）
  // 剑更贵，但直刺范围长、能一次贯穿多个藤壶。
  const KNIVES = [
    { id: 'rusty', kind: 'throw', name: '生锈小刀', en: 'Rusty Knife', cost: 0, damage: 1, cooldown: 0.32, radius: 13, blade: 26, dps: 3.1, desc: '开局就有的小刀，能切，但慢。' },
    { id: 'sharp', kind: 'throw', name: '锋利厨刀', en: 'Sharp Knife', cost: 26, damage: 2, cooldown: 0.26, radius: 16, blade: 34, dps: 7.7, desc: '刀身更长，切开藤壶更省力。' },
    { id: 'big', kind: 'throw', name: '大砍刀', en: 'Big Knife', cost: 78, damage: 3, cooldown: 0.19, radius: 20, blade: 44, dps: 15.8, desc: '又大又快，一刀顶三刀。' },
    { id: 'cleaver', kind: 'throw', name: '巨刃剁刀', en: 'Great Cleaver', cost: 185, damage: 5, cooldown: 0.13, radius: 25, blade: 56, dps: 38.5, desc: '鲸鱼搓澡神器，藤壶成片掉。' },
    {
      id: 'rapier', kind: 'thrust', name: '直刺细剑', en: 'Thrusting Rapier', cost: 300,
      damage: 6, cooldown: 0.16, radius: 22, blade: 74, dps: 37.5,
      pierce: 5, pierceFalloff: 0.72,          // 最多贯穿 5 个，之后每个伤害递减
      fx: 'thrust',                            // 发射特效
      desc: '一刺到底：不旋转，直线贯穿一排藤壶，出手带剑光。',
    },
    {
      id: 'greatsword', kind: 'thrust', name: '深海巨剑', en: 'Abyss Greatsword', cost: 720,
      damage: 11, cooldown: 0.13, radius: 30, blade: 96, dps: 84.6,
      pierce: 8, pierceFalloff: 0.82,
      fx: 'greatthrust',
      desc: '又长又粗的直刺巨剑，一次能串起一整排藤壶。',
    },
    {
      id: 'excalibur', kind: 'thrust', name: '鲸落圣剑', en: 'Whalefall Blade', cost: 1500,
      damage: 18, cooldown: 0.10, radius: 38, blade: 120, dps: 180,
      pierce: 99, pierceFalloff: 1,            // 无衰减，无限贯穿
      fx: 'holy',
      desc: '传说之剑：贯穿整条鲸鱼，剑光扫过之处藤壶尽落。',
    },
  ];

  // ---- upgrades that are not knives ----
  const UPGRADES = [
    { id: 'wide', name: '加宽刀锋', en: 'Wide Edge', cost: 24, max: 3, desc: '命中范围更宽，更容易蹭到旁边的藤壶。' },
    { id: 'crit', name: '精准磨刀', en: 'Hone', cost: 30, max: 3, desc: '每次命中都有机会打出双倍伤害。' },
    { id: 'magnet', name: '贝壳磁铁', en: 'Shell Magnet', cost: 20, max: 2, desc: '金币自动飞向你，捡钱不用手。' },
    { id: 'gloves', name: '防滑手套', en: 'Grip Gloves', cost: 28, max: 3, desc: '投刀冷却更短。' },
    { id: 'tank', name: '加长气管', en: 'Long Hose', cost: 34, max: 3, desc: '每次下潜的氧气更多。' },
  ];

  // ---- 直刺武器：命中后沿刀身方向贯穿一条线上的多个藤壶 ----
  // origin 是命中点（MARK 空间），dir 是刺击方向（单位向量，MARK 空间）。
  // 返回按距离排序的命中列表，供游戏逐个结算伤害。
  function pierceTargets(barnacles, origin, dir, length, width) {
    const hits = [];
    for (const b of barnacles) {
      if (b.dead) continue;
      const rx = b.x - origin.x, ry = b.y - origin.y;
      const along = rx * dir.x + ry * dir.y;                  // 沿刀身的投影
      if (along < -b.size * 0.6 || along > length) continue;
      const perp = Math.abs(rx * -dir.y + ry * dir.x);         // 垂直距离
      if (perp > width + b.size * 0.85) continue;
      hits.push({ b, along, perp });
    }
    hits.sort((a, b) => a.along - b.along);
    return hits.map(h => h.b);
  }

  // 贯穿伤害：第 i 个目标 × falloff^i（falloff=1 表示不衰减）
  function pierceDamage(base, index, falloff) {
    const f = falloff === undefined ? 1 : falloff;
    return Math.max(1, Math.round(base * Math.pow(f, index)));
  }

  const BARNACLE_KINDS = [
    { id: 'small', size: 11, hp: 2, coins: 1, weight: 4 },
    { id: 'medium', size: 17, hp: 3, coins: 2, weight: 3 },
    { id: 'large', size: 24, hp: 5, coins: 4, weight: 2 },
    { id: 'cluster', size: 30, hp: 8, coins: 7, weight: 1 },
  ];

  // ---- 特质：一次性购买的强力加成，会改变手感（买了就一直在）----
  const PERKS = [
    {
      id: 'frost', name: '霜刃', en: 'Frost Edge', cost: 220,
      desc: '命中时冻住周围藤壶（溅射伤害 + 冰蓝特效）。',
      sweep: 0.45,        // 溅射伤害 = 主伤害 × 该系数（作用在命中点周围 70px）
      sweepRadius: 70,
      fx: 'frost',
    },
    {
      id: 'flame', name: '炎刃', en: 'Flame Edge', cost: 340,
      desc: '命中后烧起来，3 秒内持续掉血（橙色火花特效）。',
      burn: { dps: 2.5, duration: 3 },          // 每秒伤害（会随关卡加成）
      fx: 'flame',
    },
    {
      id: 'shock', name: '雷刃', en: 'Thunder Edge', cost: 480,
      desc: '命中时电弧跳到最近的另一个藤壶（闪电特效）。',
      chain: { targets: 1, ratio: 0.6 },        // 跳到 1 个额外目标，伤害 60%
      fx: 'shock',
    },
    {
      id: 'gold', name: '黄金刀鞘', en: 'Golden Sheath', cost: 260,
      desc: '每个藤壶多掉 1 枚金币。',
      coinBonus: 1,
    },
  ];

  function perkById(id) { return PERKS.find(p => p.id === id) || null; }
  // 按购买顺序返回已拥有的特质（后买的覆盖先买的特效）
  function equippedPerks(state) {
    const owned = (state && state.perks) || [];
    return owned.map(perkById).filter(Boolean);
  }
  function activePerk(state) {
    const list = equippedPerks(state);
    return list.length ? list[list.length - 1] : null;
  }

  // 统一购买入口：刀 / 道具 / 特质都走这里，方便存档记录
  function purchase(state, kind, id) {
    if (kind === 'knife') return buyKnife(state, id);
    if (kind === 'upgrade') return buyUpgrade(state, id);
    if (kind === 'perk') {
      const p = perkById(id);
      if (!p) return { ok: false, reason: 'unknown' };
      if ((state.perks || []).includes(id)) return { ok: false, reason: 'owned' };
      if (!canAfford(state, p.cost)) return { ok: false, reason: 'poor' };
      state.coins -= p.cost;
      state.perks = (state.perks || []).concat([id]);
      return { ok: true, perk: p };
    }
    return { ok: false, reason: 'unknown-kind' };
  }

  const SAVE_VERSION = 3;

  // 鲸鱼配色：都保持图一的那个蓝，只是深浅不同，避免下一关的鲸鱼看起来"不是同一只"
  const WHALE_TINTS = [
    { body: '#4D6BFE', fin: '#3F5BEA', name: '深海蓝' },
    { body: '#4A63E8', fin: '#3B52D6', name: '深一点的蓝' },
    { body: '#5578FF', fin: '#4568F0', name: '亮一点的蓝' },
    { body: '#4257C9', fin: '#3546AE', name: '更深的蓝' },
    { body: '#5E86FF', fin: '#4B74F2', name: '浅一点的蓝' },
  ];

  // 每关藤壶数量：第一关就多一点（用户要求「藤壶可以多一点」），之后继续加
  function barnacleCountForRound(round) {
    return Math.min(52, 12 + (round - 1) * 5);
  }

  // Barnacles get tougher as the whale gets deeper, so upgrades stay meaningful.
  function hpScaleForRound(round) {
    return 1 + Math.max(0, round - 1) * 0.10;
  }

  // Air budget per dive: tightens slowly each round, eased by the Long Hose upgrade.
  // 数值经过模拟校准：让「三刀中两刀」的玩家在第 1~2 关用开局小刀也能过，
  // 之后必须换刀才轻松（换刀后立刻变宽裕）。
  function airForRound(round, upgrades) {
    const tank = (upgrades && upgrades.tank) || 0;
    return Math.max(16, 32 - round * 0.5 + tank * 6);
  }

  function roundConfig(round, seed) {
    const rng = makeRng((seed || 1) * 7919 + round * 104729);
    return {
      round,
      barnacleCount: barnacleCountForRound(round),
      hpScale: hpScaleForRound(round),
      tint: WHALE_TINTS[(round - 1) % WHALE_TINTS.length],
      seed: Math.floor(rng() * 1e9),
    };
  }

  // ---- Poisson-ish scatter over the pre-validated anchor sets ----
  // Each set is guaranteed to hold a barnacle of that size fully inside the whale silhouette.
  function scatterBarnacles(anchorSets, count, seed, jitter) {
    const rng = makeRng(seed >>> 0);
    const all = anchorSets.all;
    const large = anchorSets.large && anchorSets.large.length ? anchorSets.large : all;
    const medium = anchorSets.medium && anchorSets.medium.length ? anchorSets.medium : all;
    const small = anchorSets.small && anchorSets.small.length ? anchorSets.small : all;
    const J = jitter == null ? 6 : jitter;
    const placed = [];
    const kinds = [];
    for (const k of BARNACLE_KINDS) for (let i = 0; i < k.weight; i++) kinds.push(k);

    let guard = 0;
    while (placed.length < count && guard++ < count * 80) {
      const kind = kinds[Math.floor(rng() * kinds.length)];
      // pick an anchor set that can actually hold this kind
      let pool, radii;
      if (kind.id === 'cluster') { pool = large; radii = 44; }
      else if (kind.id === 'large') { pool = medium; radii = 32; }
      else if (kind.id === 'medium') { pool = small; radii = 24; }
      else { pool = small; radii = 18; }
      const size = kind.size * (0.85 + rng() * 0.28);
      if (size + J > radii) continue;              // never exceed the validated clearance
      const a = pool[Math.floor(rng() * pool.length)];
      const x = a[0] + (rng() - 0.5) * J * 2;
      const y = a[1] + (rng() - 0.5) * J * 2;
      let ok = true;
      for (const p of placed) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < (p.size + size) * 0.74) { ok = false; break; }
      }
      if (!ok) continue;
      const hp = Math.max(1, Math.round(kind.hp));
      placed.push({
        id: placed.length,
        x, y, size, kind: kind.id,
        hp, maxHp: hp, coins: kind.coins,
        seed: Math.floor(rng() * 1e9),
        hit: 0, dead: false,
      });
    }
    return placed;
  }

  // ---- shop helpers ----
  function knifeById(id) { return KNIVES.find(k => k.id === id) || KNIVES[0]; }
  function upgradeById(id) { return UPGRADES.find(u => u.id === id) || null; }

  function effectiveStats(state) {
    const knife = knifeById(state.knifeId);
    const wide = state.upgrades.wide || 0;
    const crit = state.upgrades.crit || 0;
    const magnet = state.upgrades.magnet || 0;
    const gloves = state.upgrades.gloves || 0;
    return {
      damage: knife.damage,
      cooldown: knife.cooldown * Math.pow(0.85, gloves),
      radius: knife.radius * (1 + 0.18 * wide),
      blade: knife.blade * (1 + 0.10 * wide),
      critChance: crit * 0.15,
      critMult: 2,
      magnetRadius: 90 + magnet * 130,
      kind: knife.kind || 'throw',
      pierce: knife.pierce || 0,
      pierceFalloff: knife.pierceFalloff === undefined ? 1 : knife.pierceFalloff,
      fx: knife.fx || null,
      knife,
    };
  }

  function applyDamage(barnacle, amount) {
    if (barnacle.dead) return { killed: false, damage: 0 };
    barnacle.hp -= amount;
    barnacle.hit = 1;
    if (barnacle.hp <= 0) {
      barnacle.hp = 0;
      barnacle.dead = true;
      return { killed: true, damage: amount, coins: barnacle.coins };
    }
    return { killed: false, damage: amount };
  }

  function canAfford(state, cost) { return state.coins >= cost; }

  // 当前拥有的最高档武器下标（老存档没有 maxKnifeId 就退回 knifeId）
  function ownedKnifeIndex(state) {
    const top = state.maxKnifeId || state.knifeId || 'rusty';
    const i = KNIVES.findIndex(k => k.id === top);
    return i < 0 ? 0 : i;
  }
  // 某把武器是否已拥有
  function ownsKnife(state, id) {
    const i = KNIVES.findIndex(k => k.id === id);
    return i >= 0 && i <= ownedKnifeIndex(state);
  }
  // 装备（只能装备已拥有的）
  function equipKnife(state, id) {
    const k = knifeById(id);
    if (!k) return { ok: false, reason: 'unknown' };
    if (!ownsKnife(state, id)) return { ok: false, reason: 'not-owned' };
    state.knifeId = id;
    return { ok: true, knife: k };
  }

  function buyKnife(state, id) {
    const knife = knifeById(id);
    const idx = KNIVES.indexOf(knife);
    const ownIdx = ownedKnifeIndex(state);          // 拥有关系看 maxKnifeId，不看当前装备
    if (idx <= ownIdx) return { ok: false, reason: 'already-owned' };
    if (!canAfford(state, knife.cost)) return { ok: false, reason: 'poor' };
    state.coins -= knife.cost;
    state.knifeId = knife.id;                       // 买了就直接装备
    state.maxKnifeId = knife.id;                    // 同时把"拥有上限"抬上去
    return { ok: true, knife };
  }

  function buyUpgrade(state, id) {
    const up = upgradeById(id);
    if (!up) return { ok: false, reason: 'unknown' };
    const have = state.upgrades[id] || 0;
    if (have >= up.max) return { ok: false, reason: 'maxed' };
    const cost = Math.round(up.cost * Math.pow(1.75, have));
    if (!canAfford(state, cost)) return { ok: false, reason: 'poor' };
    state.coins -= cost;
    state.upgrades[id] = have + 1;
    return { ok: true, cost };
  }

  function upgradeCost(state, id) {
    const up = upgradeById(id);
    if (!up) return null;
    const have = state.upgrades[id] || 0;
    if (have >= up.max) return null;
    return Math.round(up.cost * Math.pow(1.75, have));
  }

  // Total coins still sitting on the whale — used to decide "clean".
  function remainingBarnacles(barnacles) {
    let n = 0;
    for (const b of barnacles) if (!b.dead) n++;
    return n;
  }

  // Round completion bonus grows with the round.
  function clearBonus(round) { return 3 + round * 2; }

  return {
    makeRng, KNIVES, UPGRADES, BARNACLE_KINDS, WHALE_TINTS,
    barnacleCountForRound, hpScaleForRound, airForRound, roundConfig, scatterBarnacles,
    knifeById, upgradeById, effectiveStats, applyDamage, canAfford,
    purchase, ownedKnifeIndex, ownsKnife, equipKnife, activePerk, equippedPerks, PERKS, perkById,
    pierceTargets, pierceDamage, SAVE_VERSION,
    buyKnife, buyUpgrade, upgradeCost, remainingBarnacles, clearBonus,
  };
});
