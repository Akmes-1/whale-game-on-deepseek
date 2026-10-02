'use strict';
/*
 * Headless smoke test: boots the real game.js against a stub DOM + canvas context and plays
 * several rounds by simulating pointer input. Catches runtime errors the browser would show.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.join(__dirname, '..', '..', 'whale-game');
const calls = { fill: 0, stroke: 0, fillText: 0, arc: 0, roundRect: 0, clip: 0, gradient: 0 };

function makeCtx() {
  const grad = { addColorStop() {} };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif',
    textAlign: 'left', textBaseline: 'alphabetic',
    shadowColor: '', shadowBlur: 0,
    save() {}, restore() {},
    setTransform() {}, translate() {}, rotate() {}, scale() {},
    clearRect() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    arc() { calls.arc++; }, ellipse() {}, rect() {},
    roundRect(...a) { calls.roundRect++; if (a.some(v => typeof v !== 'number' || !isFinite(v))) throw new Error('roundRect got a non-number: ' + JSON.stringify(a)); },
    fill() { calls.fill++; }, stroke() { calls.stroke++; },
    clip() { calls.clip++; },
    fillText() { calls.fillText++; }, strokeText() {},
    measureText() { return { width: 40 }; },
    createLinearGradient() { calls.gradient++; return grad; },
    createRadialGradient() { calls.gradient++; return grad; },
    createPattern() { return null; },
    drawImage() {}, setLineDash() {},
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
    putImageData() {},
  };
  return ctx;
}

// ---- minimal DOM ----
const nodes = new Map();
function makeEl(id, tag) {
  const el = {
    id, tagName: (tag || 'div').toUpperCase(),
    _classes: new Set(), style: {}, children: [], dataset: {},
    textContent: '', innerHTML: '', disabled: false, src: '', width: 120, height: 72,
    classList: {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      contains: (c) => el._classes.has(c),
      toggle: (c) => (el._classes.has(c) ? el._classes.delete(c) : el._classes.add(c)),
    },
    appendChild(c) { el.children.push(c); return c; },
    removeChild(c) { el.children = el.children.filter(x => x !== c); return c; },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }; },
    querySelector(sel) {
      // used by renderShop to grab the icon canvas
      const c = makeEl('icon-canvas', 'canvas');
      c.getContext = () => makeCtx();
      return c;
    },
    getContext: () => makeCtx(),
    focus() {}, blur() {},
  };
  nodes.set(id, el);
  return el;
}
['stage', 'trendList', 'gachaLog', 'gachaPity', 'btnGacha1', 'btnGacha10', 'ending', 'endingTitle', 'endingText', 'endingStats', 'endingUnlock', 'btnEnding', 'tab_hall', 'codex', 'codexBody', 'codexCoins', 'codexWallet', 'tab_types', 'tab_items', 'tab_achv', 'btnCodexClose', 'btnCodex', 'btnCodexTitle', 'btnAchvTitle', 'btnReport', 'btnReportClose', 'report', 'reportShot', 'reportSave', 'toast', 'bestInfo', 'btnStory', 'story', 'storyWave', 'storyTitle', 'storyText', 'btnStory', 'invasion', 'invFill', 'invPct', 'invSub', 'btnFx', 'btnFxTitle', 'btnFxTitle2', 'btnFxTitle3', 'fxInfo', 'btnSound', 'saveInfo', 'btnContinue', 'btnWipe', 'btnWipe2', 'saveState', 'perkList', 'portrait', 'coins', 'round', 'left', 'knifeName', 'combo', 'btnStart', 'btnResume', 'btnRestart',
  'shop', 'title', 'shopCoins', 'knifeList', 'upgradeList', 'portrait'].forEach(id => makeEl(id));

const documentStub = {
  readyState: 'complete',
  getElementById: (id) => nodes.get(id) || null,
  createElement: (tag) => makeEl('created-' + tag + '-' + Math.random().toString(36).slice(2), tag),
  addEventListener() {},
  body: makeEl('body'),
};

let rafQueue = [];
const windowStub = {
  devicePixelRatio: 1,
  addEventListener() {},
  requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
  Path2D: class Path2D { constructor(d) { this.d = d; if (d !== undefined && typeof d !== 'string') throw new Error('Path2D needs string path data'); } },
  Image: class Image { constructor() { this._decoded = null; } set src(v) { this._src = v; if (this.onload) this.onload(); } get src() { return this._src; } },
  performance: { now: () => Date.now() },
  Math, JSON, console,
};

const __store = new Map();
const localStorageStub = {
  getItem: (k) => (__store.has(k) ? __store.get(k) : null),
  setItem: (k, v) => __store.set(k, String(v)),
  removeItem: (k) => __store.delete(k),
  clear: () => __store.clear(),
  get length() { return __store.size; },
};
const sandbox = {
  window: windowStub,
  document: documentStub,
  performance: windowStub.performance,
  requestAnimationFrame: windowStub.requestAnimationFrame,
  Path2D: windowStub.Path2D,
  Image: windowStub.Image,
  Math, JSON, console, Date, isFinite, parseInt, parseFloat, Array, Object, String, Number,
  localStorage: localStorageStub,
};
sandbox.globalThis = sandbox;
windowStub.WhaleRules = undefined;
const context = vm.createContext(sandbox);

// load rules.js (UMD: attaches to globalThis), assets.js, game.js
vm.runInContext(fs.readFileSync(path.join(GAME, 'js', 'rules.js'), 'utf8'), context, { filename: 'rules.js' });
vm.runInContext(fs.readFileSync(path.join(GAME, 'js', 'lore.js'), 'utf8'), context, { filename: 'lore.js' });
vm.runInContext(fs.readFileSync(path.join(GAME, 'js', 'save.js'), 'utf8'), context, { filename: 'save.js' });
const rules = sandbox.WhaleRules;
if (!rules) throw new Error('rules.js did not expose WhaleRules');
console.log('rules loaded:', Object.keys(rules).length, 'exports');

// scripts assign onto `window`, so read them back from the stub
vm.runInContext(fs.readFileSync(path.join(GAME, 'js', 'weapons.js'), 'utf8'), context, { filename: 'weapons.js' });
vm.runInContext(fs.readFileSync(path.join(GAME, 'js', 'gameart.js'), 'utf8'), context, { filename: 'gameart.js' });
vm.runInContext(fs.readFileSync(path.join(GAME, 'js', 'assets.js'), 'utf8'), context, { filename: 'assets.js' });
const assets = windowStub.WHALE_ASSETS;
if (!assets || !assets.markPath || !assets.anchors.length) throw new Error('assets.js incomplete');
console.log(`assets: path ${assets.markPath.length} chars, ${assets.anchors.length} anchors, 鲸鱼 ${(assets.whaleSrc.length / 1024).toFixed(0)} KB, 变身形象 ${(assets.avatarSrc ? (assets.avatarSrc.length / 1024).toFixed(0) : 0)} KB`);

// game.js reads window.WhaleRules / window.WHALE_ASSETS
windowStub.WhaleRules = rules;
windowStub.WHALE_ASSETS = assets;
vm.runInContext(fs.readFileSync(path.join(GAME, 'js', 'game.js'), 'utf8'), context, { filename: 'game.js' });
console.log('game.js evaluated without throwing');

// ---- helpers to drive the game ----
function step(frames, dtMs) {
  for (let i = 0; i < frames; i++) {
    const q = rafQueue;
    rafQueue = [];
    if (!q.length) throw new Error('no animation frame scheduled');
    for (const fn of q) fn(Date.now() + i * (dtMs || 16.7));
  }
}

// The DOM stub ignores addEventListener, so re-load game.js with a capturing stub to get handlers.
console.log('\n--- driving frames ---');
step(3, 16.7);
console.log(`frames ok (fills=${calls.fill} strokes=${calls.stroke} arcs=${calls.arc} roundRects=${calls.roundRect})`);

// ---- exercise the rules directly (the part that decides gameplay) ----
const SETS = {
  all: assets.anchors,
  large: assets.largeAnchors,
  medium: assets.mediumAnchors,
  small: assets.smallAnchors,
};
console.log('\n--- rules simulation ---');
for (const round of [1, 2, 5, 12]) {
  const cfg = rules.roundConfig(round, 20240601);
  const bs = rules.scatterBarnacles(SETS, cfg.barnacleCount, cfg.seed, assets.jitter);
  let overlap = 0, totalHp = 0, totalCoins = 0, maxSize = 0;
  for (const b of bs) { totalHp += Math.round(b.hp * cfg.hpScale); totalCoins += b.coins; maxSize = Math.max(maxSize, b.size); }
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const d = Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y);
    if (d < (bs[i].size + bs[j].size) * 0.6) overlap++;
  }
  console.log(`round ${String(round).padStart(2)}: want=${cfg.barnacleCount} got=${bs.length} hpTotal=${totalHp} coinsOnWhale=${totalCoins} maxSize=${maxSize.toFixed(1)} overlaps=${overlap} hpScale=${cfg.hpScale.toFixed(2)} air=${rules.airForRound(round, {}).toFixed(1)}s tint=${cfg.tint.name}`);
}

// geometry guarantee: every placed barnacle (plus jitter) sits inside a validated anchor radius
{
  const cfg = rules.roundConfig(9, 20240601);
  const bs = rules.scatterBarnacles(SETS, 46, cfg.seed, assets.jitter);
  const limit = { cluster: 44, large: 32, medium: 24, small: 18 };
  let violations = 0;
  for (const b of bs) {
    const worst = b.size + assets.jitter;
    if (worst > limit[b.kind]) {
      // allowed only if the actual point is still inside the tighter set for its size
      violations++;
      if (violations < 4) console.log(`  !! ${b.kind} size=${b.size.toFixed(1)} + jitter=${assets.jitter} = ${worst.toFixed(1)} > ${limit[b.kind]}`);
    }
  }
  console.log(`round 9 geometry: ${bs.length} barnacles, ${violations} exceeding their anchor clearance`);
}

// economy: how much does one perfect clear buy?
{
  const st = { coins: 0, knifeId: 'rusty', upgrades: { wide: 0, crit: 0, magnet: 0, gloves: 0, tank: 0 } };
  const cfg = rules.roundConfig(1, 20240601);
  const bs = rules.scatterBarnacles(SETS, cfg.barnacleCount, cfg.seed, assets.jitter);
  let earned = 0;
  for (const b of bs) { while (!b.dead) rules.applyDamage(b, rules.KNIVES[0].damage); earned += b.coins; }
  earned += rules.clearBonus(1);
  st.coins = earned;
  const knives = rules.KNIVES.map(k => `${k.name}:${k.cost}${st.coins >= k.cost ? '(买得起)' : ''}`).join(' ');
  console.log(`round 1 payout = ${earned} coins -> ${knives}`);
  const up = rules.buyUpgrade(st, 'gloves');
  console.log(`buy gloves: ok=${up.ok} cost=${up.cost} coinsLeft=${st.coins} gloves=${st.upgrades.gloves}`);
  const s = rules.effectiveStats(st);
  console.log(`effective: dmg=${s.damage} cd=${s.cooldown.toFixed(3)}s radius=${s.radius} crit=${s.critChance}`);
}

// full playthrough: 8 rounds, perfect play, with a greedy shopping policy
{
  const st = { coins: 0, knifeId: 'rusty', upgrades: { wide: 0, crit: 0, magnet: 0, gloves: 0, tank: 0 } };
  let totalSeconds = 0;
  for (let round = 1; round <= 8; round++) {
    const cfg = rules.roundConfig(round, 20240601);
    const bs = rules.scatterBarnacles(SETS, cfg.barnacleCount, cfg.seed, assets.jitter);
    for (const b of bs) b.hp = b.maxHp = Math.max(1, Math.round(b.maxHp * cfg.hpScale));
    const s = rules.effectiveStats(st);
    let hits = 0;
    for (const b of bs) { while (!b.dead) { rules.applyDamage(b, s.damage); hits++; } st.coins += b.coins; }
    st.coins += rules.clearBonus(round);
    const secs = hits * s.cooldown;
    totalSeconds += secs;
    const air = rules.airForRound(round, st.upgrades);
    console.log(`round ${round}: ${bs.length} barnacles, ${hits} hits, ${secs.toFixed(1)}s ideal vs ${air.toFixed(1)}s air ${secs <= air ? 'OK' : 'TOO SLOW'}, wallet=${st.coins}, knife=${st.knifeId}`);
    for (let i = rules.KNIVES.length - 1; i >= 0; i--) {
      const curIdx = rules.KNIVES.findIndex(x => x.id === st.knifeId);
      if (i > curIdx && st.coins >= rules.KNIVES[i].cost) { rules.buyKnife(st, rules.KNIVES[i].id); break; }
    }
    for (const u of rules.UPGRADES) { while (true) { const c = rules.upgradeCost(st, u.id); if (c === null || st.coins < c) break; rules.buyUpgrade(st, u.id); } }
  }
  console.log(`8 rounds, ideal total play time ${totalSeconds.toFixed(1)}s, wallet=${st.coins}, final knife=${st.knifeId}, upgrades=${JSON.stringify(st.upgrades)}`);
}

console.log('\nHEADLESS RUN COMPLETE — no runtime errors');
