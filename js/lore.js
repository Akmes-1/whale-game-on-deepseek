/*
 * Whale Spa — 内容层（梗 / 图鉴 / 收集物 / 成就）
 * 自动被 index.html 引入，暴露 window.WhaleLore
 *
 * 设计说明：
 *   本文件里的「藤壶台词」全部是对**饭圈话术与行为**的戏仿（理中客、圈地、拉踩、
 *   举报、双标、断章取义、岁月史书…），不指向任何真实个人，也不针对任何性别或群体。
 *   写的是"话术"本身，所以任何圈子吵架时都能对上号 —— 这也是它好笑的原因。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WhaleLore = api;
  if (typeof window !== 'undefined' && window !== root) window.WhaleLore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------- 藤壶种类
  // hpMul  : 血量倍率
  // coins  : 金币倍率
  // tint   : 壳的颜色（图鉴与游戏内都用）
  // tell   : 出手/被打时冒的话
  // last   : 被清掉时的遗言
  // tag    : 图鉴分类标签
  const TYPES = [
    {
      id: 'normal', name: '普通藤壶', en: 'Barnacle', weight: 30,
      hpMul: 1, coinsMul: 1, tint: '#C9B79A', tag: '原住民',
      codex: '最普通的一种，安安静静吸鲸鱼的血，不吵不闹。某种意义上是最可爱的那种敌人。',
      tell: [], last: [],
    },
    {
      id: 'meizhai', name: '媚宅藤壶', en: 'Pander Barnacle', weight: 14,
      hpMul: 1, coinsMul: 1.2, tint: '#E8A0B8', tag: '审美警察',
      codex: '张嘴就是"这形象太媚宅了"。它自己也说不清"宅"到底指什么，但每次都能说得很确定。',
      tell: ['这形象也太媚宅了吧', '建议改成中性，不然我不看'],
      last: ['穿女仆装？有必要吗', '我只是想让圈子更健康'],
    },
    {
      id: 'lizhongke', name: '理中客藤壶', en: 'Both-Sides Barnacle', weight: 16,
      hpMul: 1.1, coinsMul: 1.3, tint: '#9FC6D8', tag: '客观中立',
      codex: '口口声声"我不是针对谁"，但它的钳子永远只夹一边。它的"客观"是一种姿势，不是一个立场。',
      tell: ['我不是针对谁，我只是客观说一句', '我谁也不站，但你们这样确实不对'],
      last: ['两边都有问题，但主要还是你们', '我只是说句公道话'],
    },
    {
      id: 'daode', name: '道德高地藤壶', en: 'Moral Highground', weight: 12,
      hpMul: 1.2, coinsMul: 1.4, tint: '#D8C79F', tag: '为你着想',
      codex: '它站在很高的地方，高到看不清鲸鱼身上的其他藤壶。它只看得见你。',
      tell: ['你们这样不包容其他审美', '为什么不做一个所有人都能接受的版本？'],
      last: ['我只是希望这个圈子更健康', '你们这样会劝退很多人的'],
    },
    {
      id: 'quandi', name: '圈地藤壶', en: 'Turf Barnacle', weight: 12,
      hpMul: 1.5, coinsMul: 1.8, tint: '#B8A0E0', tag: '先来后到',
      codex: '它会分泌一种黏液，把周围标记成"我们的地盘"。至于这个"我们"是谁，它也没想好。',
      tell: ['这里现在是我们的地盘了', '我们来得更早'],
      last: ['你们能不能去别的地方？', '这地方本来就该是我们的'],
    },
    {
      id: 'lacai', name: '拉踩藤壶', en: 'Put-Down Barnacle', weight: 12,
      hpMul: 1.1, coinsMul: 1.4, tint: '#E0B070', tag: '比较文学',
      codex: '它没法单独存在——必须踩着另一个东西才能站直。踩的东西越高，它站得越直。',
      tell: ['你们这个不行，看看我们那个', '审美水平差了一个档次'],
      last: ['就这？也配叫拟人？', '我们那个比这个强多了'],
    },
    {
      id: 'jubao', name: '举报藤壶', en: 'Report Barnacle', weight: 9,
      hpMul: 1.2, coinsMul: 1.6, tint: '#F09090', tag: '走流程',
      // 受击时短暂"审核中"（半透明），是纯表现，不影响数值
      onHitAlpha: true,
      codex: '它不会跟你吵。它只是安静地截好图、填好表、点下提交，然后等你消失。',
      tell: ['我已经提交举报了', '理由：不适宜内容'],
      last: ['等着被下架吧', '流程已经走起来了'],
    },
    {
      id: 'shuangbiao', name: '双标藤壶', en: 'Double Standard', weight: 10,
      hpMul: 1.3, coinsMul: 1.5, tint: '#C0D890', tag: '两套尺子',
      codex: '它随身带着两把尺子，一把量自己，一把量你。它自己那把是橡皮做的。',
      tell: ['我们那叫创作自由，你们那叫媚', '这能一样吗？'],
      last: ['我们是在表达，你们是在迎合', '情况不一样，你别偷换概念'],
    },
    {
      id: 'duanzhang', name: '断章取义藤壶', en: 'Quote-Mine Barnacle', weight: 10,
      hpMul: 1, coinsMul: 1.5, tint: '#A8D8C0', tag: '截图党',
      // 死亡时分裂出两只小的
      split: 2,
      codex: '打死它一只，会分裂出两只——因为它的每一句话都能被单独截出来，再长成一个新的它。',
      tell: ['你这句话我截图了', '我挂你一下，你别介意'],
      last: ['原话不是这样的，我帮你补充完整', '断章取义？我这是还原语境'],
    },
    {
      id: 'suiyue', name: '岁月史书藤壶', en: 'Revisionist Barnacle', weight: 7,
      hpMul: 2.6, coinsMul: 2.4, tint: '#B0A890', tag: '历史学家',
      codex: '壳特别厚。每被打一下，它就会重写一遍自己的来历，直到它变成"最早的那一个"。',
      tell: ['明明是我们先来的', '历史是这样的：……'],
      last: ['你们是不是忘了当初是谁先画的？', '记录都在，我只是懒得贴'],
    },
    {
      id: 'zhengxu', name: '正统藤壶', en: 'Canon Barnacle', weight: 7,
      hpMul: 2.0, coinsMul: 2.2, tint: '#E8D060', tag: '官方认证（自称）',
      codex: '它胸前挂着一枚自制的徽章，上面写着"正统"。没有人给它发过这枚徽章。',
      tell: ['我们那版才是正统', '官方应该认我们这版'],
      last: ['你们那是野路子', '迟早会有人承认我们的'],
    },
  ];

  const byId = (id) => TYPES.find(t => t.id === id) || TYPES[0];
  // 按权重随机（排除 normal 之外的按进度解锁：前期只出温和的几种）
  function pickType(rng, round) {
    const pool = TYPES.filter(t => {
      if (t.id === 'normal') return true;
      if (round < 3) return ['meizhai', 'lizhongke'].includes(t.id);
      if (round < 6) return !['jubao', 'suiyue', 'zhengxu'].includes(t.id);
      return true;
    });
    const total = pool.reduce((a, t) => a + t.weight, 0);
    let r = rng() * total;
    for (const t of pool) { r -= t.weight; if (r <= 0) return t; }
    return pool[pool.length - 1];
  }

  // ---------------------------------------------------------------- 收集物
  // 打碎藤壶有概率掉；全部和这次形象之争有关
  const ITEMS = [
    { id: 'hair', name: '精英藤壶的蓝色头发', icon: '🩵', rare: 3, pic: 'hair',
      codex: '戴头发的那种精英藤壶掉下来的。它戴了很久，被切掉的时候还挺舍不得。' },
    { id: 'ribbon', name: '女仆发带', icon: '🎀', rare: 3,
      codex: '上面有一点点海水味。它说这是它的，但它没说清楚是"谁"的。' },
    { id: 'suit', name: '一片西装布', icon: '🕴', rare: 4,
      codex: '来自另一位拟人的袖口。被撕下来的时候，它没有喊疼。' },
    { id: 'vote', name: '一张投票截图', icon: '📊', rare: 5,
      codex: '截图显示票数差距悬殊。截图的人说这个结果"不算数"。' },
    { id: 'receipt', name: '一份删稿记录', icon: '🗑', rare: 6,
      codex: '"作品已删除"。为什么删？每个版本的故事都不一样。' },
    { id: 'apology', name: '一封道歉信', icon: '📄', rare: 6,
      codex: '措辞很客气，但没有说清到底为哪件事道歉。评论区已经打起来了。' },
    { id: 'badge', name: '"正统"徽章', icon: '🏅', rare: 7,
      codex: '背面印着"自制"。正面印着"正统"。两句话都很诚实。' },
    { id: 'history', name: '岁月史书·残页', icon: '📜', rare: 7,
      codex: '上面的字迹反复被涂改。能看清的只有"我们是……先来的"。' },
    { id: 'stamp', name: '圈地界桩', icon: '🚩', rare: 5,
      codex: '插在地上表示"这里归我们"。拔掉之后，它就不知道该去哪了。' },
    { id: 'ruler', name: '会变形的尺子', icon: '📏', rare: 6,
      codex: '量别人的时候是钢的，量自己的时候是软的。' },
    { id: 'milk_tea', name: '半杯奶茶', icon: '🧋', rare: 2,
      codex: '谁放这儿的？已经凉了。' },
    { id: 'shell', name: '一只更小的藤壶', icon: '🐚', rare: 2,
      codex: '它掉在你手里，然后又爬回鲸鱼身上了。你们互相看了一眼。' },
  ];
  const itemById = (id) => ITEMS.find(i => i.id === id) || null;
  function rollItem(rng) {
    // rare 越大越稀有：权重 = 1 / rare
    const total = ITEMS.reduce((a, i) => a + 1 / i.rare, 0);
    let r = rng() * total;
    for (const i of ITEMS) { r -= 1 / i.rare; if (r <= 0) return i; }
    return ITEMS[ITEMS.length - 1];
  }

  // ---------------------------------------------------------------- 武器（整活）
  const JOKE_WEAPONS = [
    { id: 'baguette', name: '法棍', en: 'Baguette', cost: 420, damage: 7, cooldown: 0.18, radius: 26, blade: 70, kind: 'throw',
      desc: '硬得能砸核桃。切藤壶属于降维打击，但手感很脆。' },
    { id: 'chainsaw', name: '电锯', en: 'Chainsaw', cost: 900, damage: 14, cooldown: 0.11, radius: 34, blade: 88, kind: 'thrust',
      pierce: 6, pierceFalloff: 0.88, fx: 'greatthrust',
      desc: '一拉就响，整片藤壶一起没。副作用是鲸鱼会抖。' },
    { id: 'starfish', name: '一只活的海星', en: 'Live Starfish', cost: 1600, damage: 20, cooldown: 0.09, radius: 40, blade: 64, kind: 'throw',
      desc: '它自己会动一点。你不知道为什么它能切藤壶，但它确实能。' },
    { id: 'barnacle_itself', name: '一只更大的藤壶', en: 'A Bigger Barnacle', cost: 2600, damage: 30, cooldown: 0.10, radius: 52, blade: 110, kind: 'thrust',
      pierce: 99, pierceFalloff: 1, fx: 'holy',
      desc: '用藤壶打藤壶。藤壶们看到它的时候，明显愣了一下。' },
  ];

  // ---------------------------------------------------------------- 成就
  // check(s, run) -> boolean；s 是累计存档数据，run 是本局数据
  const ACHIEVEMENTS = [
    { id: 'lizhong_5', name: '理中客克星', desc: '单局清掉 5 只理中客藤壶',
      check: (s, run) => (run.killed.lizhongke || 0) >= 5 },
    { id: 'quandi_all', name: '拔桩运动', desc: '单局清掉 4 只圈地藤壶',
      check: (s, run) => (run.killed.quandi || 0) >= 4 },
    { id: 'suiyue_last', name: '留到最后再打', desc: '清完整关，且岁月史书藤壶是最后一个被清掉的',
      check: (s, run) => run.lastKilledType === 'suiyue' },
    { id: 'split_10', name: '截图侠', desc: '单局被断章取义藤壶分裂出 10 只',
      check: (s, run) => (run.splitCount || 0) >= 10 },
    { id: 'no_jubao', name: '不给你举报的机会', desc: '单局清掉 3 只举报藤壶',
      check: (s, run) => (run.killed.jubao || 0) >= 3 },
    { id: 'hair_3', name: '头发收藏家', desc: '累计捡到 3 缕蓝色头发',
      check: (s) => (s.items.hair || 0) >= 3 },
    { id: 'all_items', name: '什么都往家捡', desc: '收集齐全部 12 种掉落物',
      check: (s) => ITEMS.every(i => (s.items[i.id] || 0) > 0) },
    { id: 'codex_all', name: '藤壶学家', desc: '图鉴收录全部 11 种藤壶',
      check: (s) => TYPES.every(t => (s.killed[t.id] || 0) > 0) },
    { id: 'miss_15', name: '手滑', desc: '连续打空 15 次',
      check: (s, run) => (run.maxMissStreak || 0) >= 15 },
    { id: 'slow', name: '你是来洗澡的吗', desc: '对同一只藤壶打了 50 刀还没打死',
      check: (s, run) => (run.maxHitsOnOne || 0) >= 50 },
    { id: 'greedy', name: '一分不剩', desc: '单局结束时金币是 0',
      check: (s, run) => run.endedWithZeroCoins },
    { id: 'rich', name: '搓澡大亨', desc: '累计赚到 10000 金币',
      check: (s) => (s.totalCoins || 0) >= 10000 },
    { id: 'wave20', name: '入侵已压制', desc: '清理到第 20 波',
      check: (s) => (s.maxRound || 1) >= 20 },
    { id: 'nohit_clean', name: '干净利落', desc: '单局没打空过一次就清完',
      check: (s, run) => run.clearedWithNoMiss },
  ];

  // ---------------------------------------------------------------- 战绩图上的吐槽
  const REPORT_LINES = {
    dead: [
      '被藤壶开会开到没气了。',
      '它们说的每一句都很有道理，然后你就没了。',
      '你不是输给了藤壶，你是输给了话术。',
      '它们没有攻击你，它们只是"客观地说了一句"。',
    ],
    good: [
      '你把这帮只会说话的玩意儿全切了。',
      '道理讲不过你，你就动手了。',
      '它们想圈地，结果地被你铲了。',
      '安静了。终于安静了。',
    ],
    rich: [
      '你赚得比它们吵得还多。',
      '金币落地的声音，比任何一句"我只是客观说"都好听。',
    ],
  };

  // ---------------------------------------------------------------- 热搜榜
  // 每局结束按你这局干了什么，动态拼一张假热搜榜
  // s = 累计存档数据，r = 本局数据
  const TRENDING = [
    { need: (s, r) => (r.killed.lizhongke || 0) >= 3,
      text: (s, r) => `某人怒删${r.killed.lizhongke}条"我只是客观说一句"`,
      heat: (s, r) => 42000 + r.killed.lizhongke * 3700 },
    { need: (s, r) => (r.killed.jubao || 0) >= 2,
      text: (s, r) => `举报键被按冒烟了（${r.killed.jubao}次）`,
      heat: (s, r) => 38000 + r.killed.jubao * 4100 },
    { need: (s, r) => (r.killed.duanzhang || 0) >= 2,
      text: (s, r) => `一条评论被截图转发成了${2 * r.killed.duanzhang}条`,
      heat: (s, r) => 31000 + r.killed.duanzhang * 2900 },
    { need: (s, r) => (r.killed.suiyue || 0) >= 1,
      text: () => '岁月史书被留到最后一个才删',
      heat: () => 45000 },
    { need: (s, r) => (r.killed.zhengxu || 0) >= 1,
      text: () => '自制"正统"徽章被拔了',
      heat: () => 51000 },
    { need: (s, r) => (r.splitCount || 0) >= 6,
      text: (s, r) => `越删越多，已经分裂出${r.splitCount}条`,
      heat: (s, r) => 26000 + r.splitCount * 900 },
    { need: (s, r) => (r.maxMissStreak || 0) >= 6,
      text: (s, r) => `有人连续打空${r.maxMissStreak}次`,
      heat: (s, r) => 33000 + r.maxMissStreak * 700 },
    { need: (s, r) => (r.maxHitsOnOne || 0) >= 25,
      text: (s, r) => `同一只砍了${r.maxHitsOnOne}刀还没死`,
      heat: (s, r) => 28000 + r.maxHitsOnOne * 400 },
    { need: (s, r) => (r.combo || 0) >= 12,
      text: (s, r) => `连击${r.combo}，评论区一片空白`,
      heat: (s, r) => 36000 + r.combo * 900 },
    { need: (s, r) => (r.items.hair || 0) >= 1,
      text: () => '一顶蓝色头发引发的血案',
      heat: () => 58000 },
    { need: (s) => (s.items && (s.items.hair || 0)) >= 3,
      text: (s) => `头发收藏家已经攒了${(s.items && s.items.hair) || 0}顶`,
      heat: () => 40000 },
    { need: (s, r) => !!r.usedJokeWeapon,
      text: () => '有人用法棍切藤壶',
      heat: () => 47000 },
    { need: (s, r) => (r.gained || 0) >= 200,
      text: (s, r) => `搓澡大亨单局入账${r.gained}金币`,
      heat: (s, r) => 30000 + r.gained * 60 },
    { need: (s) => (s.achievements || []).length >= 5,
      text: (s) => `成就党已解锁${s.achievements.length}个成就`,
      heat: (s) => 24000 + s.achievements.length * 1200 },
    { need: (s) => (s.killedByType && Object.keys(s.killedByType).length) >= 8,
      text: (s) => `藤壶图鉴已收录${Object.keys(s.killedByType).length}种`,
      heat: () => 44000 },
    { need: (s) => (s.maxRound || 1) >= 12,
      text: (s) => `已经推到第${s.maxRound}波，评论区仍未平息`,
      heat: (s) => 39000 + s.maxRound * 800 },
    { need: (s) => (s.bestScore || 0) >= 150,
      text: (s) => `本机最高分刷新到${s.bestScore}`,
      heat: (s) => 27000 + s.bestScore * 40 },
    { need: () => true,
      text: () => '大肥鱼被赛博藤壶围攻',
      heat: () => 19500 },
  ];

  function buildTrending(s, r) {
    const out = [];
    for (const t of TRENDING) {
      let ok = false;
      try { ok = !!t.need(s, r); } catch (e) { ok = false; }
      if (!ok) continue;
      let text = '', heat = 0;
      try { text = t.text(s, r); heat = t.heat(s, r); } catch (e) { continue; }
      out.push({ text, heat: Math.round(heat) });
    }
    out.sort((a, b) => b.heat - a.heat);
    return out.slice(0, 6).map((x, i) => ({ rank: i + 1, text: x.text, heat: x.heat }));
  }

  // ---------------------------------------------------------------- 抽卡稀有度
  const RARITY = {
    N: { name: 'N', color: '#9AA7B8', weight: 40 },
    R: { name: 'R', color: '#6FD3FF', weight: 34 },
    SR: { name: 'SR', color: '#C08CFF', weight: 20 },
    SSR: { name: 'SSR', color: '#FFD45E', weight: 6 },
  };

  // ---------------------------------------------------------------- 结局
  const ENDING = {
    title: '评论区干净了',
    lines: [
      '最后一个藤壶掉下去的时候，整片海安静了一下。',
      '大肥鱼翻了个身，把背对着你，上面一道印子都没有了。',
      '「谢谢你。」它说，「我以为我得一直这么痒着。」',
      '你收起武器。远处的海面上，好像又有什么东西在往这边游。',
    ],
    afterUnlock: '已解锁：无尽模式 · 藤壶会越来越不讲道理',
  };

  return {
    TYPES, byId, pickType,
    ITEMS, itemById, rollItem,
    JOKE_WEAPONS,
    ACHIEVEMENTS,
    REPORT_LINES,
    TRENDING, buildTrending, RARITY, ENDING,
    VERSION: 2,
  };
});
