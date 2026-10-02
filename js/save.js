/*
 * Whale Spa — 存档系统（localStorage）。
 * 存：金币、当前刀、已买道具、已买特质、最高关卡、音效开关、总金币。
 * 用 try/catch 包住，隐私模式下 localStorage 不可用时游戏照常能玩（只是不存档）。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  // 浏览器挂在全局上；同时挂 window，避免不同环境变量名不一致
  root.WhaleSave = api;
  if (typeof window !== 'undefined' && window !== root) window.WhaleSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const KEY = 'whale-spa-save-v3';

  function blank() {
    return {
      version: 3,
      coins: 0,
      knifeId: 'rusty',
      upgrades: { wide: 0, crit: 0, magnet: 0, gloves: 0, tank: 0 },
      perks: [],
      maxRound: 1,      // 已经打到第几关（用来显示进度）
      totalCoins: 0,
      sound: true,
      fx: 'max',        // 光污染档位：'off' 关闭 / 'normal' 标准 / 'max' 拉满
      storySeen: [],    // 已经看过的剧情波数（同一段只播一次）
      items: {},        // 掉落物收集
      killedByType: {}, // 藤壶图鉴
      achievements: [], // 已解锁成就
      bestScore: 0,     // 本机最高分
      savedAt: 0,
    };
  }

  const FX_LEVELS = ['off', 'normal', 'max'];
  function normFx(v) {
    return FX_LEVELS.indexOf(v) >= 0 ? v : 'max';
  }

  function storage() {
    try {
      if (typeof localStorage === 'undefined') return null;
      // 试探一次读写（隐私模式会抛错）
      localStorage.setItem('__whale_probe', '1');
      localStorage.removeItem('__whale_probe');
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function load() {
    const ls = storage();
    if (!ls) return { ok: false, reason: 'no-storage', data: blank() };
    let raw = null;
    try { raw = ls.getItem(KEY); } catch (e) { return { ok: false, reason: 'read-error', data: blank() }; }
    if (!raw) return { ok: false, reason: 'empty', data: blank() };
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { return { ok: false, reason: 'corrupt', data: blank() }; }
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'corrupt', data: blank() };
    if (parsed.version !== 3) return { ok: false, reason: 'old-version', data: blank() };
    // 补齐缺失字段，避免旧存档把游戏弄崩
    const base = blank();
    const data = {
      version: 3,
      coins: Math.max(0, Number(parsed.coins) || 0),
      knifeId: typeof parsed.knifeId === 'string' ? parsed.knifeId : base.knifeId,
      upgrades: Object.assign({}, base.upgrades, parsed.upgrades || {}),
      perks: Array.isArray(parsed.perks) ? parsed.perks.slice(0, 8) : [],
      maxRound: Math.max(1, Number(parsed.maxRound) || 1),
      totalCoins: Math.max(0, Number(parsed.totalCoins) || 0),
      sound: parsed.sound !== false,
      fx: normFx(parsed.fx),
      storySeen: Array.isArray(parsed.storySeen)
        ? parsed.storySeen.map(Number).filter(n => isFinite(n) && n > 0).slice(0, 60)
        : [],
      items: (parsed.items && typeof parsed.items === 'object') ? parsed.items : {},
      killedByType: (parsed.killedByType && typeof parsed.killedByType === 'object') ? parsed.killedByType : {},
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements.slice(0, 60) : [],
      bestScore: Math.max(0, Number(parsed.bestScore) || 0),
      savedAt: Number(parsed.savedAt) || 0,
    };
    return { ok: true, reason: 'loaded', data };
  }

  function save(data) {
    const ls = storage();
    if (!ls) return { ok: false, reason: 'no-storage' };
    const payload = {
      version: 3,
      coins: Math.max(0, Math.round(data.coins || 0)),
      knifeId: data.knifeId || 'rusty',
      upgrades: data.upgrades || {},
      perks: data.perks || [],
      maxRound: Math.max(1, Math.round(data.maxRound || 1)),
      totalCoins: Math.max(0, Math.round(data.totalCoins || 0)),
      sound: data.sound !== false,
      fx: normFx(data.fx),
      storySeen: Array.isArray(data.storySeen) ? data.storySeen.slice(0, 60) : [],
      items: data.items || {},
      killedByType: data.killedByType || {},
      achievements: Array.isArray(data.achievements) ? data.achievements.slice(0, 60) : [],
      bestScore: Math.max(0, Math.round(data.bestScore || 0)),
      savedAt: Date.now(),
    };
    try {
      ls.setItem(KEY, JSON.stringify(payload));
      return { ok: true, bytes: JSON.stringify(payload).length };
    } catch (e) {
      return { ok: false, reason: 'write-error' };
    }
  }

  function clear() {
    const ls = storage();
    if (!ls) return { ok: false, reason: 'no-storage' };
    try { ls.removeItem(KEY); return { ok: true }; } catch (e) { return { ok: false, reason: 'write-error' }; }
  }

  // 存档是否存在且有效（标题页用来决定显示"继续游戏"还是"开始游戏"）
  function hasSave() { return load().ok; }

  return { KEY, blank, load, save, clear, hasSave, FX_LEVELS, normFx };
});
