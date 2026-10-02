/*
 * Whale Spa — rendering + game loop.
 * Draws everything procedurally on canvas from the traced mark path (no sprite sheets needed),
 * with the mascot's own palette so the celebration rig matches the supplied artwork.
 */
(function () {
  'use strict';
  const R = window.WhaleRules;
  const L = window.WhaleLore;
  // 把「整活武器」并进武器表（图鉴/商店都按这张表走）
  if (L && L.JOKE_WEAPONS) {
    for (const w of L.JOKE_WEAPONS) {
      if (!R.KNIVES.some(k => k.id === w.id)) R.KNIVES.push(w);
    }
  }
  const A = window.WHALE_ASSETS;

  // ------------------------------------------------------------------ palette (from the mascot art)
  const P = {
    skin: '#FCEBE5', skinShade: '#F2D3C9',
    cuff: '#F0EFE6', cuffShade: '#DCD9CC', gold: '#D9BE85',
    navy: '#3B3C63', navyDeep: '#2A2B48',
    apron: '#FBF4F3', lace: '#FFFFFF',
    hair: '#59679A', hairLight: '#789ECA',
    ink: '#0B1220', paper: '#F7F9FF',
    abyss: '#4D6BFE',
    shellA: '#EFE6D8', shellB: '#CFC1AC', shellC: '#8E8271', shellDark: '#5C5346',
    cut: '#FFE9D2', meat: '#F6B98C',
  };

  // ------------------------------------------------------------------ virtual canvas
  // 虚拟画布尺寸是「活」的：横屏用 1280x720，竖屏用 720x1280。
  // 这样手机竖屏时画面能铺满整块屏幕，藤壶也够大点得中（不用旋转手机）。
  let VW = 1280, VH = 720;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  let scale = 1, offX = 0, offY = 0, dpr = 1;
  let portrait = false;

  // 按当前方向重算：虚拟尺寸 + 鲸鱼大小 + 出生点 + 武器导轨
  function layout() {
    const cssW = canvas.clientWidth || Math.round(window.innerWidth) || 1280;
    const cssH = canvas.clientHeight || Math.round(window.innerHeight) || 720;
    portrait = cssH > cssW * 1.05;              // 明显更高就是竖屏

    if (portrait) {
      // 竖屏：固定虚拟宽度 720，高度按手机实际宽高比算 → 正好铺满，不留黑边
      // （手机比例五花八门 16:9 / 19.5:9 / 20:9，所以不能写死 1280）
      VW = 720;
      const h = Math.round(720 * cssH / cssW);
      VH = Math.max(1100, Math.min(1900, h));
    } else {
      VW = 1280; VH = 720;                      // 横屏：16:9（桌面就是这个比例）
    }

    // 鲸鱼宽度：横屏占 720，竖屏略窄一点留出边距
    WHALE_W = portrait ? 650 : 720;
    whaleScale = WHALE_W / MARK.w;
    WHALE_H = MARK.h * whaleScale;

    // 出生点 + 导轨：竖屏时把「鲸鱼 + 导轨」当成一整块垂直居中，
    // 否则手机会出现上面一只鲸鱼、最下面一条导轨、中间空一大片的情况。
    if (portrait) {
      const gap = 130;                                    // 鲸鱼和导轨之间留的空
      const playH = WHALE_H + gap + 90;                   // 整块的高度（含导轨本身）
      const top = Math.max(70, (VH - playH) / 2);
      HOME.x = VW / 2;
      HOME.y = top + WHALE_H / 2;
      RAIL.y = top + WHALE_H + gap;
    } else {
      HOME.x = VW / 2 + 30;
      HOME.y = VH * 0.44;
      RAIL.y = VH - 74;
    }

    const margin = portrait ? 70 : 118;
    RAIL.x0 = margin;
    RAIL.x1 = VW - margin;
    RAIL.cx = (RAIL.x0 + RAIL.x1) / 2;
    RAIL.amp = (RAIL.x1 - RAIL.x0) / 2;
    LAUNCHER.x = RAIL.x0 - 22;
    LAUNCHER.y = RAIL.y;
  }

  function resize() {
    const cssW = canvas.clientWidth || Math.round(window.innerWidth) || 1280;
    const cssH = canvas.clientHeight || Math.round(window.innerHeight) || 720;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    layout();                                    // 先定虚拟尺寸，再算缩放
    scale = Math.min(canvas.width / VW, canvas.height / VH);
    offX = (canvas.width - VW * scale) / 2;
    offY = (canvas.height - VH * scale) / 2;
  }

  // 下面这些会在 layout() 里被重算，所以是 let 而不是 const
  let whaleScale = 1;
  const HOME = { x: 1280 / 2 + 30, y: 720 * 0.44 };
  const LAUNCHER = { x: 96, y: 720 - 74 };
  const RAIL = { y: 720 - 74, x0: 118, x1: 1280 - 118, cx: 640, amp: 522, speed: 1.45 };

  // ------------------------------------------------------------------ whale geometry
  const MARK = { w: A.markViewBox[2], h: A.markViewBox[3] };
  const whalePath = new Path2D(A.markPath);
  const cleanPath = whalePath;
  const ANCHOR_SETS = {
    all: A.anchors,
    large: A.largeAnchors && A.largeAnchors.length ? A.largeAnchors : A.anchors,
    medium: A.mediumAnchors && A.mediumAnchors.length ? A.mediumAnchors : A.anchors,
    small: A.smallAnchors && A.smallAnchors.length ? A.smallAnchors : A.anchors,
  };

  // 鲸鱼在屏幕上的尺寸：横屏 720 宽，竖屏略窄（都是 layout() 里重算）
  let WHALE_W = 720;
  let WHALE_H = MARK.h * (720 / MARK.w);

  // ------------------------------------------------------------------ state
  const state = {
    phase: 'title',        // title | play | celebrate | depart | arrive | shop | failed
    round: 1,
    coins: 0,
    totalCoins: 0,
    knifeId: 'rusty',      // 当前装备的武器
    maxKnifeId: 'rusty',   // 拥有过的最高档武器（决定"拥有"，切换武器不会丢东西）
    bagTab: 'weapon',      // 背包页签：weapon | perk | up | item
    upgrades: { wide: 0, crit: 0, magnet: 0, gloves: 0, tank: 0 },
    perks: [],
    maxRound: 1,
    storySeen: [],         // 已播放过的剧情波数
    codexTab: 'types',     // 图鉴当前页签
    codexFrom: 'title',    // 从哪打开的图鉴
    codexDetail: null,     // 图鉴里正在看哪一个藤壶的详情（typeId）
    codexOrigin: null,     // 从哪张卡展开的（做动画用）
    shopTab: 'trend',      // 商店页签：trend | gacha | knife | perk | up
    // ---- 内容层：收集 / 图鉴 / 成就 / 最高分 ----
    items: {},             // 掉落物收集：{ itemId: 数量 }
    killedByType: {},      // 藤壶图鉴：{ typeId: 累计击杀 }
    achievements: [],      // 已解锁成就 id
    bestScore: 0,          // 本机最高分（单局总金币）
    gameCleared: false,    // 是否通关过一次（解锁无尽模式）
    endless: false,        // 无尽模式中
    gachaLog: [],          // 最近抽卡结果
    inputMode: 'pc',       // 操作模式：'pc' 鼠标 / 'touch' 手机
    run: null,             // 本局统计
    barnacles: [],
    knives: [],            // in-flight projectiles
    slashes: [],           // 直刺的剑光特效
    bolts: [],             // 雷刃电弧
    flashes: [],           // 出手的枪口闪光
    shake: 0,              // 屏幕震动强度
    motes: [],             // 前景漂浮光尘
    sweep: 0,              // 剑的左右扫动相位
    sweepDir: 1,
    impactRings: [],       // 命中冲击光环
    flashScreen: 0,        // 整屏闪光强度
    flashColor: '#FFFFFF',
    fx: 'max',             // 光污染档位：off / normal / max
    coinsFly: [],
    particles: [],
    floaters: [],
    combo: 0,
    comboTimer: 0,
    cool: 0,
    air: 1,                // 1 = full tank
    maxAir: 26,
    pendingShop: false,
    whale: { x: HOME.x, y: HOME.y, hit: 0, rot: 0, scale: 1, tint: R.WHALE_TINTS[0] },
    aim: { x: VW / 2, y: VH / 2, inside: false },
    time: 0,
    cleanFx: 0,
    thankFx: 0,
    thankUntil: 0,
    thankLine: '',
    thankNextLine: 0,
    thankStart: 0,
    leaveFx: 0,
    leaveStartX: 0,
    autoShop: false,
    shopAfterArrive: 0,
    celebrateUntil: 0,
    failUntil: 0,
    pendingShop: false,
  };

  // 武器站的「导轨平面」：架在屏幕下方，整条轨道自己左右来回移动。
  // 位置不归玩家管，玩家只用鼠标决定「朝哪个方向发射」。
  // LAUNCHER / RAIL 的实际数值在 layout() 里按横竖屏重算（定义见文件上方）。
  RAIL.speed = 1.45;                // 来回速度（弧度/秒）

  // 武器当前所在的 x（自动左右移动）
  function railX() {
    return RAIL.cx + Math.sin(state.sweep) * RAIL.amp;
  }
  // 当前移动方向：1 = 往右，-1 = 往左
  function railDir() {
    return Math.cos(state.sweep) >= 0 ? 1 : -1;
  }
  // 武器当前坐标
  function gunPos() {
    return { x: railX(), y: RAIL.y };
  }

  // Debug handle: read-only introspection for the automated frame renderer / tests.
  if (typeof window !== 'undefined') window.__whaleDebug = state;

  function stats() { return R.effectiveStats(state); }

  function startRound(round) {
    const cfg = R.roundConfig(round, 20240601);
    state.round = round;
    state.barnacles = R.scatterBarnacles(ANCHOR_SETS, cfg.barnacleCount, cfg.seed, A.jitter);
    // barnacles get tougher with depth
    for (const b of state.barnacles) {
      b.hp = b.maxHp = Math.max(1, Math.round(b.maxHp * cfg.hpScale));
      // 内容层：抽一个种类（血量/金币按种类倍率调整）
      if (L) {
        const t = L.pickType(R.makeRng((cfg.seed + (b.seed || 0) * 31) >>> 0), round);
        b.typeId = t.id;
        b.typeName = t.name;
        b.tintColor = t.tint;
        b.hp = b.maxHp = Math.max(1, Math.round(b.hp * t.hpMul));
        b.coins = Math.max(1, Math.round((b.coins || 1) * t.coinsMul));
      }
    }
    // 细节：两种「精英藤壶」
    //   crown = 金冠精英：更硬更大，掉 4 倍金币
    //   hair  = 戴头发的精英（用户给的头发图）：更稀有，掉一大堆金币（爆金币）
    const rngE = R.makeRng(cfg.seed + 977);
    let elites = 0, hairs = 0;
    for (const b of state.barnacles) {
      const roll = rngE();
      if (b.size < 14) continue;
      if (roll < 0.05) {
        b.elite = true;
        b.eliteType = 'hair';
        b.size *= 1.42;
        b.hp = b.maxHp = Math.round(b.maxHp * 2.4);
        b.coins = (b.coins || 1) * 12;     // 一次爆一大堆
        hairs++;
      } else if (roll < 0.18) {
        b.elite = true;
        b.eliteType = 'crown';
        b.size *= 1.28;
        b.hp = b.maxHp = Math.round(b.maxHp * 1.8);
        b.coins = (b.coins || 1) * 4;
        elites++;
      }
    }
    state.eliteCount = elites + hairs;
    state.hairCount = hairs;
    state.whale.tint = cfg.tint;
    state.whale.x = -WHALE_W * 0.8;
    state.whale.y = HOME.y;
    state.whale.hit = 0;
    state.whale.rot = 0;
    state.whale.scale = 1;
    state.knives.length = 0;
    state.coinsFly.length = 0;
    state.combo = 0;
    // 内容层：重置本局统计（成就要用）
    state.run = {
      killed: {}, items: {}, splitCount: 0, missStreak: 0, maxMissStreak: 0,
      maxHitsOnOne: 0, lastKilledType: null, clearedWithNoMiss: true,
      endedWithZeroCoins: false, startCoins: state.coins, gained: 0,
    };
    state.maxAir = R.airForRound(round, state.upgrades);
    state.air = state.maxAir;
    state.phase = 'arrive';
    banner(`第 ${round} 关 · ${state.barnacles.length} 个藤壶`, cfg.tint.name + ' 鲸鱼下潜到第 ' + round + ' 层');
  }

  // ------------------------------------------------------------------ input
  function toVirtual(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    return { x: (x - offX) / scale, y: (y - offY) / scale };
  }
  // 手机模式下"正在拖动瞄准"（松手才发射）
  let dragging = false;
  const isTouchMode = () => state.inputMode === 'touch';
  // 真的触摸事件也按手机逻辑走，避免用户忘了切模式
  const treatAsTouch = (e) => isTouchMode() || e.pointerType === 'touch';

  canvas.addEventListener('pointermove', (e) => {
    const p = toVirtual(e.clientX, e.clientY);
    state.aim.x = p.x; state.aim.y = p.y; state.aim.inside = true;
  });
  canvas.addEventListener('pointerleave', () => {
    // 手机模式下手指抬起不该让准星消失（不然拖到一半线就断了）
    if (!isTouchMode()) state.aim.inside = false;
  });
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = toVirtual(e.clientX, e.clientY);
    state.aim.x = p.x; state.aim.y = p.y; state.aim.inside = true;
    if (treatAsTouch(e)) {
      // 手机：先瞄准，松手再发射 —— 这样能先把方向线对准了再打
      dragging = true;
      try { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      return;
    }
    // 电脑：鼠标只决定「朝向」，按下即发射
    throwKnife(p.x, p.y);
  });
  // 松手发射（手指拖出画布也能收到，靠 pointer capture）
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    const p = toVirtual(e.clientX, e.clientY);
    state.aim.x = p.x; state.aim.y = p.y; state.aim.inside = true;
    throwKnife(p.x, p.y);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  // 甩掉旧的扫动辅助（现在位置由轨道自动决定，鼠标只给方向）
  function aimPoint() {
    return { x: state.aim.x, y: state.aim.y };
  }

  function throwKnife(tx, ty) {
    if (state.phase !== 'play') return;
    if (state.cool > 0) return;
    const s = stats();
    state.cool = s.cooldown;
    // 从「武器当前所在位置」出发，朝鼠标方向发射（位置自动左右移动，方向由玩家定）
    const gun = gunPos();
    const dx = tx - gun.x, dy = ty - gun.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const thrust = s.kind === 'thrust';
    const ang = Math.atan2(dy, dx);
    state.knives.push({
      x: gun.x, y: gun.y,
      // 直刺更快、不旋转；飞刀慢一点、会旋转
      vx: ux * (thrust ? 2600 : 1750),
      vy: uy * (thrust ? 2600 : 1750),
      rot: ang,
      spin: thrust ? 0 : 15,
      kind: s.kind,
      pierce: s.pierce,
      pierceFalloff: s.pierceFalloff,
      hitIds: [],
      blade: s.blade, radius: s.radius, damage: s.damage,
      crit: Math.random() < s.critChance,
      fx: s.fx,
      life: 0, stuck: false,
    });
    // 音效：刀是刀风，剑是剑鸣（圣剑更亮）
    if (thrust) { if (s.fx === 'holy') SFX.shootHoly(); else SFX.shootSword(); }
    else SFX.throwKnife();
    // 枪口闪光（每把武器颜色/力度不同）
    spawnMuzzleFx(ang, s.fx || 'throw', s.fx === 'holy' ? 1.6 : s.fx === 'greatthrust' ? 1.35 : thrust ? 1.15 : 1);
    // 直刺的发射特效：从武器位置冲出去的一道剑光
    if (thrust) {
      state.slashes.push({
        x: gun.x, y: gun.y, ang,
        len: 260 + s.blade * 3.2, width: s.blade * 0.55,
        life: 0, max: s.fx === 'holy' ? 0.5 : 0.34,
        style: s.fx || 'thrust',
      });
      spawnHitFx(gun.x + ux * 46, gun.y + uy * 46, true, false);
    }
  }

  // 把一个藤壶的点（MARK 空间）换算到屏幕坐标
  function markToScreen(mx, my) {
    const sc = whaleScale * state.whale.scale;
    return {
      x: (mx - MARK.w / 2) * sc + state.whale.x,
      y: (my - MARK.h / 2) * sc + state.whale.y,
    };
  }

  // 精英藤壶的装饰：金冠 / 头发（用户给的那张头发图）
  const hairImg = new Image();
  let hairReady = false;
  hairImg.onload = () => { hairReady = true; };
  if (A.hairSrc) hairImg.src = A.hairSrc;
  const HAIR = { w: (A.hairSize && A.hairSize[0]) || 180, h: (A.hairSize && A.hairSize[1]) || 195 };

  // ------------------------------------------------------------------ barnacle drawing
  // A barnacle is a volcanic cone: ridged shell + a dark jagged opening. Damage shows as cracks
  // and a wider, angrier opening; a dead one is drawn as a broken rim with the meat scooped out.
  function drawBarnacle(g, b) {
    if (b.dead) return;
    // 刚被清掉的短暂"消失动画"：快速缩小 + 淡出，让玩家看到它是真的没了
    const dying = b.pop != null ? b.pop : null;
    const rng = R.makeRng(b.seed);
    const dmg = 1 - b.hp / b.maxHp;
    const s = b.size * (dying != null ? Math.max(0.05, 1 - dying) : 1);
    g.save();
    if (dying != null) g.globalAlpha = Math.max(0, 1 - dying * 1.25);
    g.translate(b.x, b.y);
    g.rotate((b.seed % 100) / 100 * Math.PI * 2);

    // damage flash（只有被命中的那一两帧才用 shadowBlur）
    if (b.hit > 0) {
      g.globalAlpha = 1;
      g.shadowColor = 'rgba(255,240,180,' + (0.9 * b.hit).toFixed(3) + ')';
      g.shadowBlur = 14 * b.hit;
    }

    // ground shadow so it reads as sitting ON the whale
    g.beginPath();
    g.ellipse(0, s * 0.30, s * 1.15, s * 0.42, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(12,18,40,0.20)';
    g.fill();

    // 精英藤壶：底下一圈金色光晕（远处就能认出来）
    if (b.elite) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 4 + b.seed * 0.01);
      const eg = g.createRadialGradient(0, s * 0.1, s * 0.2, 0, s * 0.1, s * 1.9);
      eg.addColorStop(0, `rgba(255,214,110,${(0.42 + 0.22 * pulse).toFixed(3)})`);
      eg.addColorStop(0.6, 'rgba(255,190,70,0.14)');
      eg.addColorStop(1, 'rgba(255,180,60,0)');
      g.fillStyle = eg;
      g.beginPath();
      g.arc(0, s * 0.1, s * 1.9, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // 特殊种类：壳外面套一圈该种类颜色的光环，远远就能分辨
    if (b.typeId && b.typeId !== 'normal' && !fxOff()) {
      const col = b.tintColor || '#C9B79A';
      g.save();
      g.globalCompositeOperation = 'lighter';
      const pulse = 0.55 + 0.45 * Math.sin(state.time * 2.6 + b.seed * 0.01);
      g.globalAlpha = (b.elite ? 0.5 : 0.32) * pulse;
      g.strokeStyle = col;
      g.lineWidth = Math.max(2, s * 0.17);
      g.beginPath();
      g.arc(0, s * 0.12, s * 1.34, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = (b.elite ? 0.24 : 0.14) * pulse;
      g.lineWidth = Math.max(4, s * 0.34);
      g.beginPath();
      g.arc(0, s * 0.12, s * 1.34, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    // shell body (irregular cone)
    const sides = 12;
    g.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const wob = 1 + 0.10 * Math.sin(a * 3 + b.seed * 0.001) + 0.06 * Math.sin(a * 5);
      const rr = s * (0.52 + 0.48 * (1 - Math.abs(Math.cos(a)) * 0.35)) * wob;
      const x = Math.cos(a) * rr * 1.08, y = Math.sin(a) * rr * 0.66 + s * 0.16;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    // 性能：卡的时候（budget 降低）用纯色代替渐变，几十个藤壶能省下大量渐变对象
    // 壳的颜色跟种类走：这样不同藤壶一眼能区分开
    const base = b.tintColor || P.shellB;
    if (PERF.budget > 0.6) {
      const grad = g.createLinearGradient(0, -s, 0, s);
      grad.addColorStop(0, shade(base, 0.34));
      grad.addColorStop(0.55, base);
      grad.addColorStop(1, shade(base, -0.32));
      g.fillStyle = grad;
    } else {
      g.fillStyle = base;
    }
    g.fill();
    g.strokeStyle = 'rgba(70,60,48,0.55)';
    g.lineWidth = Math.max(1, s * 0.09);
    g.stroke();

    // vertical ridges
    g.strokeStyle = 'rgba(120,108,90,0.45)';
    g.lineWidth = Math.max(0.8, s * 0.055);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.85 + (i / 5) * Math.PI * 1.7;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.30, Math.sin(a) * s * 0.20 + s * 0.10);
      g.lineTo(Math.cos(a) * s * 0.92, Math.sin(a) * s * 0.60 + s * 0.20);
      g.stroke();
    }

    // top opening: jagged ring, dark inside
    const open = s * (0.30 + 0.10 * dmg);
    g.beginPath();
    const teeth = 9;
    for (let i = 0; i <= teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const jag = (i % 2 === 0 ? 1.0 : 0.78) * (1 + 0.12 * Math.sin(a * 4 + b.seed));
      const x = Math.cos(a) * open * jag, y = Math.sin(a) * open * 0.68 * jag - s * 0.42;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    if (b.dead) {
      g.fillStyle = P.cut;
      g.fill();
      g.strokeStyle = 'rgba(120,90,60,0.5)';
      g.lineWidth = Math.max(1, s * 0.08);
      g.stroke();
      // scooped-out highlight
      g.beginPath();
      g.ellipse(0, -s * 0.42, open * 0.5, open * 0.32, 0, 0, Math.PI * 2);
      g.fillStyle = P.meat;
      g.globalAlpha = 0.55;
      g.fill();
      g.globalAlpha = 1;
    } else {
      g.fillStyle = P.shellDark;
      g.fill();
      g.strokeStyle = 'rgba(230,214,190,0.75)';
      g.lineWidth = Math.max(1, s * 0.07);
      g.stroke();
      // inner rim
      g.beginPath();
      g.ellipse(0, -s * 0.44, open * 0.62, open * 0.40, 0, 0, Math.PI * 2);
      g.fillStyle = '#3A342C';
      g.fill();
    }

    // 精英藤壶：头顶装饰
    if (b.elite && b.eliteType === 'hair') {
      // 戴头发的：头发压在藤壶上，飘动 + 金色光晕（一眼看出是「爆金币」的那种）
      const hw = s * 2.5, hh = hw * (HAIR.h / HAIR.w);
      const sway = Math.sin(state.time * 2.2 + b.seed * 0.01) * 0.09;
      const float = Math.sin(state.time * 1.8 + b.seed * 0.02) * s * 0.08;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 3.6 + b.seed * 0.01);
      const hg = g.createRadialGradient(0, -s * 0.2, s * 0.2, 0, -s * 0.2, s * 2.2);
      hg.addColorStop(0, `rgba(255,228,140,${(0.5 + 0.25 * pulse).toFixed(3)})`);
      hg.addColorStop(0.55, 'rgba(255,200,80,0.18)');
      hg.addColorStop(1, 'rgba(255,190,60,0)');
      g.fillStyle = hg;
      g.beginPath();
      g.arc(0, -s * 0.2, s * 2.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
      if (hairReady) {
        g.save();
        g.translate(0, -s * 0.55 + float);
        g.rotate(sway);
        g.drawImage(hairImg, -hw / 2, -hh * 0.72, hw, hh);
        g.restore();
      }
      // 星光
      g.save();
      g.globalCompositeOperation = 'lighter';
      GLOW.star(g, -s * 0.9, -s * 0.9, s * 0.7, '#FFF3C4', state.time * 1.9 + b.seed, 0.7);
      GLOW.star(g, s * 1.0, -s * 0.6, s * 0.5, '#FFE9A8', -state.time * 2.3 + b.seed, 0.6);
      g.restore();
    } else if (b.elite) {
      const cy2 = -s * 0.62;
      g.save();
      g.globalCompositeOperation = 'lighter';
      GLOW.star(g, 0, cy2, s * 0.9, '#FFE9A8', state.time * 1.6 + b.seed, 0.75);
      g.restore();
      g.beginPath();
      g.moveTo(-s * 0.46, cy2 + s * 0.16);
      g.lineTo(-s * 0.46, cy2 - s * 0.14);
      g.lineTo(-s * 0.20, cy2 + s * 0.04);
      g.lineTo(0, cy2 - s * 0.22);
      g.lineTo(s * 0.20, cy2 + s * 0.04);
      g.lineTo(s * 0.46, cy2 - s * 0.14);
      g.lineTo(s * 0.46, cy2 + s * 0.16);
      g.closePath();
      g.fillStyle = '#FFD45E';
      g.fill();
      g.strokeStyle = 'rgba(120,80,10,0.65)';
      g.lineWidth = Math.max(1, s * 0.05);
      g.stroke();
      g.beginPath();
      g.arc(0, cy2 - s * 0.06, s * 0.075, 0, Math.PI * 2);
      g.fillStyle = '#FFF6C9';
      g.fill();
    }

    // 种类角标：不跟着藤壶转，固定贴在左下角，字要看得清
    if (b.typeId && TYPE_MARK[b.typeId]) {
      const rot = (b.seed % 100) / 100 * Math.PI * 2;
      const t = Math.max(7, s * 0.78);          // 半径
      g.save();
      g.rotate(-rot);                            // 抵消藤壶自身的旋转
      g.translate(-s * 1.15, s * 1.0);           // 固定在左下角
      g.beginPath();
      g.arc(0, 0, t, 0, Math.PI * 2);
      g.fillStyle = 'rgba(6,14,30,0.9)';
      g.fill();
      g.strokeStyle = b.tintColor || '#C9B79A';
      g.lineWidth = Math.max(1.4, t * 0.22);
      g.stroke();
      g.fillStyle = '#FFFFFF';
      g.font = 'bold ' + (t * 1.35).toFixed(0) + 'px system-ui, "Microsoft YaHei", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(TYPE_MARK[b.typeId], 0, t * 0.06);
      g.restore();
    }

    // cracks appear as it takes damage
    if (dmg > 0.2 && !b.dead) {
      g.strokeStyle = 'rgba(60,50,40,' + (0.55 * dmg).toFixed(2) + ')';
      g.lineWidth = Math.max(1, s * 0.07);
      const cracks = Math.round(1 + dmg * 4);
      for (let i = 0; i < cracks; i++) {
        const a = (rng() * Math.PI * 2);
        const x0 = Math.cos(a) * s * 0.25, y0 = Math.sin(a) * s * 0.18 - s * 0.35;
        g.beginPath();
        g.moveTo(x0, y0);
        let x = x0, y = y0;
        for (let k = 0; k < 3; k++) {
          x += Math.cos(a + (rng() - 0.5)) * s * 0.28;
          y += Math.sin(a + (rng() - 0.5)) * s * 0.20 + s * 0.08;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    g.restore();
  }

  // ------------------------------------------------------------------ whale drawing
  // 鲸鱼贴图：用用户最终给的透明 PNG（不是我自己描的矢量图）
  const whaleImg = new Image();
  let whaleReady = false;
  whaleImg.onload = () => { whaleReady = true; };
  whaleImg.src = A.whaleSrc;
  // 图片尺寸（MARK 空间 -> 图片空间的换算，保证藤壶落点对齐）
  let WHALE_IMG = { w: 1024, h: 778 };

  function drawWhale(g, dt) {
    const w = state.whale;
    // 清干净后鲸鱼会缩小消失（celebrate），随后进入 thank/leaving 阶段就完全不再画鲸鱼
    const cleaned = state.phase === 'celebrate';
    if (state.phase === 'thank' || state.phase === 'leaving' || state.phase === 'shop') return;
    const cleanK = state.phase === 'celebrate' ? state.cleanFx : 0;
    const shrink = 1 - 0.55 * cleanK;
    g.save();
    g.translate(w.x, w.y);
    g.rotate(w.rot);
    const s = whaleScale * w.scale * shrink;
    g.scale(s, s);
    if (cleanK > 0) g.globalAlpha = Math.max(0, 1 - cleanK * 1.15);
    g.translate(-MARK.w / 2, -MARK.h / 2);

    // body：直接贴用户的透明 PNG
    g.save();
    if (w.hit > 0) {
      const k = w.hit;
      g.translate(MARK.w / 2, MARK.h / 2);
      g.scale(1 + 0.018 * k, 1 - 0.014 * k);
      g.rotate(0.006 * k * Math.sin(state.time * 60));
      g.translate(-MARK.w / 2, -MARK.h / 2);
    }
    if (whaleReady) {
      // MARK 空间 = 图片空间（等比），所以直接按 MARK 尺寸贴图，藤壶就能精准落在身上
      // 性能：不用 shadowBlur（大图上很贵），改成把贴图放大一点、低透明度叠加两层当光晕，
      // 视觉接近但快得多；卡了（budget<1）就自动只叠一层。
      if (!fxOff()) {
        const cyc = GLOW.rainbow(state.time, 110, 0);
        g.save();
        g.globalCompositeOperation = 'lighter';
        const layers = (PERF.budget > 0.7 && fxMax()) ? 2 : 1;
        for (let i = layers; i >= 1; i--) {
          const k = 1 + 0.028 * i;
          g.globalAlpha = (i === 1 ? 0.26 : 0.14) * fxScale();
          g.fillStyle = cyc;
          // 用一个略大的 tinted 副本当光晕（drawImage 走 lighter 叠加）
          g.globalAlpha *= 1;
          g.drawImage(whaleImg, (MARK.w - MARK.w * k) / 2, (MARK.h - MARK.h * k) / 2, MARK.w * k, MARK.h * k);
        }
        g.restore();
        g.drawImage(whaleImg, 0, 0, MARK.w, MARK.h);
      } else {
        g.drawImage(whaleImg, 0, 0, MARK.w, MARK.h);
      }
    } else {
      // 图片还没解码完时先填纯色，避免出现空白
      g.fillStyle = w.tint.body;
      g.fill(whalePath, 'evenodd');
    }
    g.restore();

    // 图片本身已经带好颜色，不再叠加渐变（避免盖住用户的图）

    g.restore();

    // sparkle ring while celebrating
    if (state.phase === 'celebrate') {
      g.save();
      g.translate(w.x, w.y);
      const k = 1 - state.cleanFx;
      g.globalAlpha = 0.5 * k;
      g.strokeStyle = '#FFF6C9';
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(0, 0, WHALE_W * (0.45 + 0.5 * state.cleanFx), WHALE_H * (0.45 + 0.5 * state.cleanFx), 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  // ---------------------------------------------------------------- 变身形象
  // 清干净后：鲸鱼消失 -> 换成第一张 Q 版女仆立绘（白底保留，所以套一张圆角白卡）。
  const kickImg = new Image();
  let avatarReady = false;
  kickImg.onload = () => { avatarReady = true; };
  kickImg.src = A.avatarSrc;
  const AVATAR = { w: (A.avatarSize && A.avatarSize[0]) || 440, h: (A.avatarSize && A.avatarSize[1]) || 499 };

  // 道谢台词（随机挑一句）
  const THANKS = [
    '谢谢你帮我清干净啦～',
    '哇！身上轻多了，好舒服！',
    '这些藤壶痒了我好久，谢谢！',
    '你刀法真好，下次还找你！',
    '谢谢你～这是我的小小心意！',
  ];

  function drawAvatar(g) {
    if (!avatarReady) return;
    const leaving = state.phase === 'leaving';
    const k = leaving ? 1 : Math.min(1, state.thankFx);   // 出场进度 0..1
    const ease = 1 - Math.pow(1 - k, 3);
    const H = WHALE_W * 0.80;
    const baseScale = H / AVATAR.h;
    const w0 = AVATAR.w * baseScale, h0 = AVATAR.h * baseScale;
    // 登场时来一下「弹一下 + 踢腿」的动感：短暂横向挤压 + 轻微旋转
    const kick = leaving ? 0 : Math.max(0, 1 - Math.abs(state.time - (state.thankStart || 0)) * 2.2);
    const kickWave = kick > 0 ? Math.sin(kick * Math.PI) : 0;
    const bob = Math.sin(state.time * 2.2) * 6;
    const breathe = 1 + Math.sin(state.time * 3.1) * 0.01;
    const squash = 1 + 0.06 * kickWave;
    const stretch = 1 - 0.05 * kickWave;

    g.save();
    g.translate(state.whale.x, state.whale.y + bob + (1 - ease) * 46);
    g.globalAlpha = ease;
    g.rotate(-0.05 * kickWave);
    g.scale((0.92 + 0.08 * ease) * breathe * squash, (0.92 + 0.08 * ease) / breathe * stretch);
    const w = w0, h = h0;

    // 卡片外框
    const padX = w * 0.045, padY = h * 0.035;
    const cw = w + padX * 2, ch = h + padY * 2;
    const r = Math.min(cw, ch) * 0.06;

    // 投影
    g.save();
    g.globalAlpha = ease * 0.30;
    g.fillStyle = '#03101F';
    g.beginPath();
    g.roundRect(-cw / 2 + 6, -ch / 2 + 12, cw, ch, r);
    g.fill();
    g.restore();

    // 白卡 + 描边
    g.beginPath();
    g.roundRect(-cw / 2, -ch / 2, cw, ch, r);
    g.fillStyle = '#FFFFFF';
    g.fill();
    g.strokeStyle = 'rgba(120,150,210,0.55)';
    g.lineWidth = 3;
    g.stroke();

    // 立绘（白底，正好和卡片白底融成一体）
    g.drawImage(kickImg, -w / 2, -h / 2, w, h);

    g.restore();
  }

  // 剑光：直刺武器发射时冲出的一道长条光刃
  function drawSlashes(g) {
    for (const s of state.slashes) {
      const k = s.life / s.max;               // 0..1
      const ease = 1 - Math.pow(1 - k, 2);
      const styles = {
        thrust: { core: '#FFFFFF', glow: 'rgba(150,200,255,0.55)', len: 1 },
        greatthrust: { core: '#EAF3FF', glow: 'rgba(120,170,255,0.6)', len: 1.25 },
        holy: { core: '#FFFBE0', glow: 'rgba(255,225,130,0.75)', len: 1.5 },
      };
      const st = styles[s.style] || styles.thrust;
      g.save();
      g.translate(s.x, s.y);
      g.rotate(s.ang);
      g.globalAlpha = (1 - k) * 0.95;
      const len = s.len * st.len * ease;
      const w = s.width * (0.4 + 0.9 * (1 - k));
      // 外发光
      const grad = g.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, st.glow);
      grad.addColorStop(0.35, st.glow);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -w);
      g.lineTo(len, -w * 0.18);
      g.lineTo(len, w * 0.18);
      g.lineTo(0, w);
      g.closePath();
      g.fill();
      // 剑芯
      g.globalAlpha = (1 - k);
      g.fillStyle = st.core;
      g.beginPath();
      g.moveTo(0, -w * 0.34);
      g.lineTo(len * 0.96, -w * 0.05);
      g.lineTo(len * 0.96, w * 0.05);
      g.lineTo(0, w * 0.34);
      g.closePath();
      g.fill();
      // 前端冲击环
      if (s.style === 'holy' || s.style === 'greatthrust') {
        g.globalAlpha = (1 - k) * 0.7;
        g.strokeStyle = st.core;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(len * 0.9, 0, w * (0.6 + 1.6 * k), -0.7, 0.7);
        g.stroke();
      }
      g.restore();
    }
  }

  // 雷刃电弧
  function drawBolts(g) {
    for (const b of state.bolts) {
      const k = b.life / b.max;
      g.save();
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#CDE9FF';
      g.lineWidth = 3.5;
      g.beginPath();
      const segs = 6;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = b.x1 + (b.x2 - b.x1) * t;
        const y = b.y1 + (b.y2 - b.y1) * t;
        const off = i === 0 || i === segs ? 0 : (Math.random() - 0.5) * 22;
        if (i === 0) g.moveTo(x, y + off); else g.lineTo(x, y + off);
      }
      g.stroke();
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = 1.6;
      g.stroke();
      g.restore();
    }
  }

  function drawKnives(g, dt) {
    for (const k of state.knives) {
      const isSword = k.kind === 'thrust';
      g.save();
      g.translate(k.x, k.y);
      g.rotate(k.rot + (k.stuck ? 0 : k.life * k.spin));
      const L = k.blade;
      if (!k.stuck) {
        // 拖尾：剑更长更亮
        g.globalAlpha = isSword ? 0.55 : 0.35;
        const tg = g.createLinearGradient(-L * (isSword ? 2.4 : 1.5), 0, -L * 0.4, 0);
        tg.addColorStop(0, 'rgba(255,255,255,0)');
        tg.addColorStop(1, isSword ? 'rgba(200,230,255,0.95)' : 'rgba(255,255,255,0.9)');
        g.strokeStyle = tg;
        g.lineWidth = isSword ? L * 0.16 : 2;
        g.beginPath();
        g.moveTo(-L * (isSword ? 2.4 : 1.5), 0);
        g.lineTo(-L * 0.4, 0);
        g.stroke();
        g.globalAlpha = 1;
      }
      if (isSword) {
        // 能量光环：在剑身外侧套一层脉动光晕（圣剑是金色）
        const auraColor = k.fx === 'holy' ? 'rgba(255,220,120,'
          : k.fx === 'greatthrust' ? 'rgba(120,175,255,' : 'rgba(150,205,255,';
        const pulse = 0.55 + 0.45 * Math.sin(state.time * 22 + k.life * 8);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = auraColor + (0.30 * pulse).toFixed(3) + ')';
        g.lineWidth = L * 0.34;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-L * 0.06, 0);
        g.lineTo(L * 0.92, 0);
        g.stroke();
        g.strokeStyle = auraColor + (0.5 * pulse).toFixed(3) + ')';
        g.lineWidth = L * 0.14;
        g.beginPath();
        g.moveTo(-L * 0.06, 0);
        g.lineTo(L * 0.98, 0);
        g.stroke();
        g.restore();
        // 剑：细长剑身 + 护手 + 剑柄 + 剑尖
        const grad = g.createLinearGradient(0, -L * 0.12, 0, L * 0.12);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.45, k.crit ? '#FFE9A8' : '#DCE6F5');
        grad.addColorStop(1, '#8E9BB0');
        g.beginPath();
        g.moveTo(-L * 0.06, -L * 0.075);
        g.lineTo(L * 0.82, -L * 0.05);
        g.lineTo(L * 1.0, 0);
        g.lineTo(L * 0.82, L * 0.05);
        g.lineTo(-L * 0.06, L * 0.075);
        g.closePath();
        g.fillStyle = grad;
        g.fill();
        g.strokeStyle = 'rgba(30,40,60,0.55)';
        g.lineWidth = 1.4;
        g.stroke();
        // 护手
        g.fillStyle = P.gold;
        g.beginPath();
        g.roundRect(-L * 0.08, -L * 0.16, L * 0.06, L * 0.32, 3);
        g.fill();
        // 剑柄
        g.fillStyle = '#43325A';
        g.beginPath();
        g.roundRect(-L * 0.40, -L * 0.05, L * 0.32, L * 0.10, 4);
        g.fill();
        g.fillStyle = P.gold;
        g.beginPath();
        g.arc(-L * 0.42, 0, L * 0.055, 0, Math.PI * 2);
        g.fill();
        // 命中瞬间的剑光
        if (k.hitIds.length) {
          g.globalAlpha = 0.5;
          g.strokeStyle = '#FFFFFF';
          g.lineWidth = 2.5;
          g.beginPath();
          g.moveTo(0, -L * 0.25);
          g.lineTo(L * 0.9, -L * 0.1);
          g.stroke();
        }
      } else {
        // 刀：原来的样式
        g.beginPath();
        g.moveTo(-L * 0.12, -L * 0.15);
        g.lineTo(L * 0.62, -L * 0.10);
        g.lineTo(L * 0.80, 0);
        g.lineTo(L * 0.62, L * 0.10);
        g.lineTo(-L * 0.12, L * 0.15);
        g.closePath();
        const bg = g.createLinearGradient(0, -L * 0.2, 0, L * 0.2);
        bg.addColorStop(0, '#FFFFFF');
        bg.addColorStop(0.5, k.crit ? '#FFE9A8' : '#D7DEEA');
        bg.addColorStop(1, '#8E9BB0');
        g.fillStyle = bg;
        g.fill();
        g.strokeStyle = 'rgba(30,40,60,0.6)';
        g.lineWidth = 1.6;
        g.stroke();
        g.fillStyle = '#6B4A2F';
        g.beginPath();
        g.roundRect(-L * 0.62, -L * 0.11, L * 0.5, L * 0.22, L * 0.06);
        g.fill();
      }
      g.restore();
    }
  }

  function spawnHitFx(x, y, big, crit, color) {
    const room = PERF.maxParticles - state.particles.length;
    if (room <= 0) return;
    const n = Math.min(room, pc(big ? 16 : 9));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 200;
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.4 + Math.random() * 0.5, max: 0.9,
        r: 1.6 + Math.random() * (big ? 4 : 2.4),
        c: color || (crit ? '#FFD45E' : (Math.random() < 0.5 ? P.shellB : P.shellA)),
      });
    }
  }

  function spawnFloater(x, y, text, color, talk) {
    // talk=true 是藤壶说的话：更小、飘得更久、颜色偏灰，和伤害数字区分开
    if (talk) state.floaters.push({ x, y, text, color, life: 1.8, max: 1.8, vy: -26, talk: true });
    else state.floaters.push({ x, y, text, color, life: 1.1, max: 1.1, vy: -46 });
  }

  // ------------------------------------------------------------------ update
  function update(dt) {
    state.time += dt;
    if (state.cool > 0) state.cool = Math.max(0, state.cool - dt);
    if (state.whale.hit > 0) state.whale.hit = Math.max(0, state.whale.hit - dt * 4);
    if (state.comboTimer > 0) { state.comboTimer -= dt; if (state.comboTimer <= 0) state.combo = 0; }
    for (const b of state.barnacles) {
      if (b.hit > 0) b.hit = Math.max(0, b.hit - dt * 3);
      // 被清掉的藤壶播放"缩小+淡出"，放完就彻底不再绘制
      if (b.dead && b.pop != null && b.pop < 1.2) b.pop += dt * 4.5;
    }

    // air — the dive only lasts so long, so the player cannot farm forever
    if (state.phase === 'play') {
      state.air = Math.max(0, state.air - dt);
      hudTick += dt;
      if (hudTick > 0.1) { hudTick = 0; updateHud(); }
      if (state.air <= 0) onOutOfAir();
    }

    // whale idle bob
    const target = HOME;
    if (state.phase === 'play' || state.phase === 'celebrate') {
      state.whale.x += (target.x - state.whale.x) * Math.min(1, dt * 4);
      state.whale.y = target.y + Math.sin(state.time * 1.6) * 7;
      state.whale.rot = Math.sin(state.time * 1.1) * 0.012;
    }

    if (state.phase === 'arrive') {
      state.whale.x += (target.x - state.whale.x) * Math.min(1, dt * 2.6);
      state.whale.y = target.y + Math.sin(state.time * 2.4) * 10;
      state.whale.rot = Math.sin(state.time * 2.0) * 0.03;
      if (Math.abs(state.whale.x - target.x) < 6) {
        state.whale.x = target.x;
        state.phase = 'play';
        // 上一条鲸鱼清完后自动接上的：等新鲸鱼到位，再弹出结算商店
        if (state.autoShop) {
          state.autoShop = false;
          state.shopAfterArrive = state.time + 0.7;
        }
        // 叙事层：到达剧情波数时，先让大肥鱼说两句再开打（同一段只放一次）
        const story = storyFor(state.round);
        if (story && !(state.storySeen || []).includes(state.round)) {
          state.storySeen = (state.storySeen || []).concat([state.round]);
          openStory(state.round);
        }
      }
    }

    if (state.shopAfterArrive && state.time > state.shopAfterArrive) {
      state.shopAfterArrive = 0;
      openShop();
    }

    if (state.phase === 'celebrate') {
      // 鲸鱼冒出星星、快速缩小（相当于"被清干净了"）
      state.cleanFx = Math.min(1, state.cleanFx + dt * 1.8);
      if (state.time > state.celebrateUntil) {
        // 鲸鱼移除 -> 人物立绘登场
        state.phase = 'thank';
        state.thankFx = 0;
        state.thankStart = state.time;
        state.thankUntil = state.time + 3.6;
        state.thankLine = THANKS[Math.floor(Math.random() * THANKS.length)];
        spawnFloater(state.whale.x, state.whale.y - 170, state.thankLine, '#FFFFFF');
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 420;
          state.particles.push({
            x: state.whale.x, y: state.whale.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
            life: 0.7 + Math.random() * 1.2, max: 1.9,
            r: 2 + Math.random() * 4.5,
            c: ['#FFF6C9', '#FFD45E', '#BFD4FF', '#FFFFFF', '#9BE7C4'][i % 5],
          });
        }
      }
    }

    if (state.phase === 'thank') {
      state.thankFx = Math.min(1, state.thankFx + dt * 1.8);
      // 每隔一会儿再冒一句感谢的话
      if (state.time > (state.thankNextLine || 0)) {
        state.thankNextLine = state.time + 1.2;
        state.thankLine = THANKS[Math.floor(Math.random() * THANKS.length)];
        spawnFloater(state.whale.x + (Math.random() - 0.5) * 120, state.whale.y - 150, state.thankLine, '#FFFFFF');
      }
      if (state.time > state.thankUntil) {
        // 道谢完毕：人物往右离开屏幕
        state.phase = 'leaving';
        state.leaveFx = 0;
        state.leaveStartX = state.whale.x;
      }
    }

    if (state.phase === 'leaving') {
      state.leaveFx = Math.min(1, state.leaveFx + dt / 1.4);
      const k = state.leaveFx;
      state.whale.x = state.leaveStartX + (VW + WHALE_W) * (k * k);   // 加速离场
      state.whale.y = HOME.y - k * 60 + Math.sin(state.time * 6) * 12;
      if (state.leaveFx >= 1) {
        // 第一次推完最后一波：先看结局，再进商店
        if (L && state.round >= INVASION_TOTAL_WAVES && !state.gameCleared) { openEnding(); state.leaveFx = 0; return; }
        // 人物走出屏幕 -> 先进商店结算。
        // 【重要】这里不能再 startRound(round+1)：否则商店里点「下一条鲸鱼」时又会 +1，
        // 关卡号一次跳 2 关（玩家反馈的「跳关」就是这个原因）。
        // 下一条鲸鱼统一由「下一条鲸鱼」按钮触发，保证每清一关只 +1。
        openShop();
      }
    }

    if (state.phase === 'failed') {
      state.whale.x += dt * 620;
      state.whale.y -= dt * 90;
      state.whale.rot += dt * 0.5;
      if (state.time > state.failUntil) {
        state.whale.x = HOME.x;
        state.whale.y = HOME.y;
        state.whale.rot = 0;
        state.phase = 'shop';
        openShop();
      }
    }

    // knives / swords
    for (let i = state.knives.length - 1; i >= 0; i--) {
      const k = state.knives[i];
      k.life += dt;
      if (!k.stuck) {
        const steps = k.kind === 'thrust' ? 4 : 3;
        for (let s = 0; s < steps; s++) {
          k.x += k.vx * dt / steps; k.y += k.vy * dt / steps;
          const hits = hitTest(k);
          if (hits.length) {
            resolveHit(k, hits);
            // 贯穿打满了就停下，否则继续飞
            if (k.kind !== 'thrust' || k.hitIds.length >= k.pierce) {
              if (k.kind === 'thrust') { k.stuck = true; k.vx = k.vy = 0; }
              break;
            }
          }
        }
        if (k.x < -160 || k.x > VW + 160 || k.y < -160 || k.y > VH + 160) {
          // 内容层：一次都没打中就是「打空」，用于成就统计
          if (state.run && !k.hitIds.length) {
            state.run.missStreak++;
            if (state.run.missStreak > state.run.maxMissStreak) state.run.maxMissStreak = state.run.missStreak;
          }
          state.knives.splice(i, 1);
        }
      } else if (k.life > 0.5) {
        state.knives.splice(i, 1);
      }
    }

    // 剑光特效
    for (let i = state.slashes.length - 1; i >= 0; i--) {
      const s = state.slashes[i];
      s.life += dt;
      if (s.life >= s.max) state.slashes.splice(i, 1);
    }
    // 枪口闪光 + 屏幕震动衰减
    for (let i = state.flashes.length - 1; i >= 0; i--) {
      const f = state.flashes[i];
      f.life += dt;
      if (f.life >= f.max) state.flashes.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 42);

    // 武器导轨自动左右移动（位置不归玩家管）+ 前景光尘 + 命中冲击环
    state.sweep += dt * RAIL.speed;
    if (state.sweep > Math.PI * 2000) state.sweep -= Math.PI * 2000;
    updateMotes(dt);
    const rings = [];
    for (const r of state.impactRings) {
      r.life += dt;
      if (r.life < r.max) rings.push(r);
    }
    state.impactRings = rings;
    if (state.flashScreen > 0) state.flashScreen = Math.max(0, state.flashScreen - dt * 3.6);
    // 电弧特效
    for (let i = state.bolts.length - 1; i >= 0; i--) {
      const b = state.bolts[i];
      b.life += dt;
      if (b.life >= b.max) state.bolts.splice(i, 1);
    }
    // 炎刃灼烧
    if (state.phase === 'play') {
      for (const b of state.barnacles) {
        if (b.dead || !b.burn) continue;
        if (state.time > b.burn.until) { b.burn = null; continue; }
        b.burnTick = (b.burnTick || 0) + dt;
        if (b.burnTick >= 0.25) {
          b.burnTick = 0;
          const w = markToScreen(b.x, b.y);
          const res = R.applyDamage(b, Math.max(1, Math.round(b.burn.dps * 0.25)));
          spawnHitFx(w.x, w.y, false, false, '#FFB35C');
          if (res.killed) onBarnacleKilled(b, w.x, w.y);
        }
      }
    }

    // particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      p.vy += 520 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i--) {
      const f = state.floaters[i];
      f.life -= dt; f.y += f.vy * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }

    // coin pickups
    const st = stats();
    for (let i = state.coinsFly.length - 1; i >= 0; i--) {
      const c = state.coinsFly[i];
      c.t += dt;
      // magnet toward the HUD coin counter (top-right)
      const hx = VW - 132, hy = 40;
      if (Math.hypot(hx - c.x, hy - c.y) < st.magnetRadius + c.t * 260) {
        const dx = hx - c.x, dy = hy - c.y, l = Math.hypot(dx, dy) || 1;
        const sp = 420 + c.t * 700;
        c.x += (dx / l) * sp * dt; c.y += (dy / l) * sp * dt;
      } else {
        c.vy += 900 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
      }
      if (Math.hypot(hx - c.x, hy - c.y) < 26) {
        const amt = c.amount || 1;
        state.coins += amt; state.totalCoins += amt;
        if (state.run) state.run.gained += amt;
        SFX.coin();
        state.coinsFly.splice(i, 1);
      } else if (c.t > 5) {
        const amt = c.amount || 1;
        state.coins += amt; state.totalCoins += amt;
        if (state.run) state.run.gained += amt;
        SFX.coin();
        state.coinsFly.splice(i, 1);
      }
    }
  }

  // Convert a virtual-space point into whale-local mark space.
  function toMark(x, y) {
    const s = whaleScale * state.whale.scale;
    const dx = (x - state.whale.x) / s + MARK.w / 2;
    const dy = (y - state.whale.y) / s + MARK.h / 2;
    return { x: dx, y: dy };
  }

  // 命中检测：飞刀取刀尖附近一个；直刺取沿刀身一条线上的所有目标（贯穿）
  function hitTest(k) {
    const tip = { x: k.x + Math.cos(k.rot) * k.blade * 0.7, y: k.y + Math.sin(k.rot) * k.blade * 0.7 };
    if (k.kind === 'thrust') {
      const m = toMark(tip.x, tip.y);
      const dir = { x: Math.cos(k.rot), y: Math.sin(k.rot) };
      // 把一个屏幕向量换算到 MARK 空间的方向（等比缩放，方向不变）
      const list = R.pierceTargets(state.barnacles, m, dir, k.blade * 1.6, k.radius);
      // 已经打过的目标不再重复命中
      return list.filter(b => !k.hitIds.includes(b.id)).slice(0, Math.max(1, k.pierce));
    }
    const m = toMark(tip.x, tip.y);
    let best = null, bestD = Infinity;
    for (const b of state.barnacles) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - m.x, b.y - m.y);
      const reach = b.size * 0.95 + k.radius;
      if (d < reach && d < bestD) { bestD = d; best = b; }
    }
    return best ? [best] : [];
  }

  // 对单个藤壶结算一次伤害（含暴击、连击、金币、特质效果）
  // 内容层：让藤壶说话（受击时偶尔冒一句，清掉时必冒遗言）
  function barnacleSpeak(b, wx, wy, kind) {
    if (!L || !b.typeId) return;
    const t = L.byId(b.typeId);
    const lines = kind === 'last' ? t.last : t.tell;
    if (!lines || !lines.length) return;
    if (kind === 'tell' && Math.random() > 0.22) return;   // 挨打时只是偶尔插嘴
    const text = lines[Math.floor(Math.random() * lines.length)];
    spawnFloater(wx, wy - (kind === 'last' ? 30 : 14), text, kind === 'last' ? '#FFD9D9' : '#DCE8FF', true);
  }

  function damageBarnacle(k, b, dmg, crit) {
    const res = R.applyDamage(b, dmg);
    const w = markToScreen(b.x, b.y);
    state.whale.hit = 1;
    spawnHitFx(w.x, w.y, !!res.killed, crit);
    // 命中冲击光环（会心更大更亮）——关闭光污染时不画
    if (!fxOff()) {
      state.impactRings.push({
        x: w.x, y: w.y, life: 0, max: crit ? 0.42 : 0.3,
        r0: crit ? 10 : 7, r1: crit ? 96 : 62,
        color: crit ? '#FFD45E' : '#CDE9FF', width: crit ? 5 : 3,
      });
    }
    if (res.killed) {
      if (!fxOff()) {
        state.impactRings.push({ x: w.x, y: w.y, life: 0, max: 0.55, r0: 6, r1: 150, color: '#FFFFFF', width: 4 });
        // 整屏闪光（光污染：击杀瞬间泛一下）
        state.flashScreen = Math.max(state.flashScreen, (crit ? 0.85 : 0.5) * fxScale());
        state.flashColor = crit ? '#FFE9A8' : '#FFFFFF';
        state.shake = Math.max(state.shake, (crit ? 9 : 5) * fxScale());
      }
    }

    const perks = R.equippedPerks(state);

    // 霜刃：命中点周围的藤壶也吃一份溅射
    const frost = perks.find(p => p.id === 'frost');
    if (frost && res.damage > 0) {
      for (const o of state.barnacles) {
        if (o === b || o.dead) continue;
        if (Math.hypot(o.x - b.x, o.y - b.y) > frost.sweepRadius) continue;
        const sr = R.applyDamage(o, Math.max(1, Math.round(dmg * frost.sweep)));
        const sw = markToScreen(o.x, o.y);
        spawnHitFx(sw.x, sw.y, false, false, '#BFE9FF');
        if (sr.killed) onBarnacleKilled(o, sw.x, sw.y);
      }
    }
    // 炎刃：点燃持续伤害
    const flame = perks.find(p => p.id === 'flame');
    if (flame && !b.dead) {
      b.burn = { dps: flame.burn.dps * (1 + state.round * 0.12), until: state.time + flame.burn.duration };
    }
    // 雷刃：电弧跳到附近另一个藤壶
    const shock = perks.find(p => p.id === 'shock');
    if (shock && !b.dead) {
      let nearest = null, nd = Infinity;
      for (const o of state.barnacles) {
        if (o === b || o.dead) continue;
        const d = Math.hypot(o.x - b.x, o.y - b.y);
        if (d < 220 && d < nd) { nd = d; nearest = o; }
      }
      if (nearest) {
        const a1 = markToScreen(b.x, b.y), a2 = markToScreen(nearest.x, nearest.y);
        state.bolts.push({ x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y, life: 0, max: 0.22 });
        const sr = R.applyDamage(nearest, Math.max(1, Math.round(dmg * shock.chain.ratio)));
        spawnHitFx(a2.x, a2.y, false, false, '#CDE4FF');
        if (sr.killed) onBarnacleKilled(nearest, a2.x, a2.y);
      }
    }

    if (res.killed) onBarnacleKilled(b, w.x, w.y, crit); else SFX.hit();
    updateHud();
    return res;
  }

  // 藤壶被清掉：消失动画 + 掉金币 + 连击
  function onBarnacleKilled(b, wx, wy, crit) {
    SFX.kill();
    // ---- 内容层：图鉴记录 + 遗言 + 掉落物 ----
    if (L && b.typeId) {
      state.killedByType[b.typeId] = (state.killedByType[b.typeId] || 0) + 1;
      if (state.run) {
        state.run.killed[b.typeId] = (state.run.killed[b.typeId] || 0) + 1;
        state.run.lastKilledType = b.typeId;
      }
      barnacleSpeak(b, wx, wy, 'last');
      // 掉落物：约 18% 概率，精英必掉
      const chance = b.elite ? 1 : 0.18;
      if (Math.random() < chance) {
        // 戴头发的精英：必掉那顶蓝色头发
        const it = (b.eliteType === 'hair' && L.itemById('hair'))
          ? L.itemById('hair') : L.rollItem(Math.random);
        state.items[it.id] = (state.items[it.id] || 0) + 1;
        if (state.run) state.run.items[it.id] = (state.run.items[it.id] || 0) + 1;
        spawnFloater(wx, wy - 58, it.icon + ' ' + it.name, '#9BE7C4', true);
        state.itemPops = (state.itemPops || []).concat([{ x: wx, y: wy, t: 0, icon: it.icon }]);
        SFX.perk();
      }
      // 断章取义藤壶：死亡时分裂
      const t = L.byId(b.typeId);
      if (t.split && !b.noSplit) {
        for (let i = 0; i < t.split; i++) {
          const a = Math.random() * Math.PI * 2, d = b.size * 2.2;
          const nb = {
            id: 'split' + (state.splitSeq = (state.splitSeq || 0) + 1),
            x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d,
            size: Math.max(8, b.size * 0.6),
            hp: Math.max(1, Math.round(b.maxHp * 0.25)), maxHp: Math.max(1, Math.round(b.maxHp * 0.25)),
            coins: 1, dead: false, seed: b.seed + i * 37, hit: 0, pop: null,
            typeId: 'normal', typeName: '普通藤壶', tintColor: '#C9B79A', noSplit: true,
          };
          state.barnacles.push(nb);
          if (state.run) state.run.splitCount++;
        }
        spawnFloater(wx, wy - 74, '它分裂了！', '#FFB35C', true);
      }
    }
    b.pop = 0;
    b.hit = 0;
    b.burn = null;
    state.combo += 1;
    state.comboTimer = 1.6;
    const bonus = state.combo >= 3 ? Math.min(3, Math.floor(state.combo / 3)) : 0;
    const gold = R.equippedPerks(state).find(p => p.id === 'gold');
    const value = b.coins + bonus + (gold ? gold.coinBonus : 0);
    const isHair = b.eliteType === 'hair';

    if (isHair) {
      // 戴头发的精英：金币喷泉。
      // 性能要点：金币用 amount 合并（收益一分不少，但对象数少得多），粒子也走预算。
      const burst = Math.min(18, pc(14));
      const per = Math.max(1, Math.ceil(value / burst));
      for (let i = 0; i < burst; i++) {
        const a = (i / burst) * Math.PI * 2 + Math.random() * 0.4;
        const sp = 220 + Math.random() * 380;
        state.coinsFly.push({
          x: wx, y: wy,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 240,
          t: 0, spin: Math.random() * 8, big: true, amount: per,
        });
      }
      state.flashScreen = Math.max(state.flashScreen, 0.9 * fxScale());
      state.flashColor = '#FFD45E';
      state.shake = Math.max(state.shake, 11 * fxScale());
      if (!fxOff() && state.impactRings.length < PERF.maxRings) {
        state.impactRings.push({ x: wx, y: wy, life: 0, max: 0.6, r0: 8, r1: 210, color: '#FFD45E', width: 6 });
      }
      spawnHitFx(wx, wy, true, true, '#FFD45E');
      spawnHitFx(wx, wy, true, true, '#FFF6C9');
      spawnFloater(wx, wy - 46, '金币喷泉 +' + value + '！', '#FFD45E');
      SFX.arp([659, 784, 988, 1318, 1568], 70, 0.2, 'triangle', 0.18);
    } else {
      // 普通/金冠藤壶：金币也按 amount 合并，避免一次几十个对象
      let left = value;
      const per = left > 12 ? Math.ceil(left / 10) : 1;
      while (left > 0) {
        const amt = Math.min(per, left);
        left -= amt;
        state.coinsFly.push({
          x: wx, y: wy, vx: (Math.random() - 0.5) * 200, vy: -140 - Math.random() * 120,
          t: 0, spin: Math.random() * 6, amount: amt,
        });
      }
      spawnFloater(wx, wy - 30, '+' + value, '#FFD45E');
      if (bonus) spawnFloater(wx + 26, wy - 52, '连击 x' + state.combo, '#9BE7C4');
    }
    // 金币对象总量限流（超了就合并到已有金币上）
    if (state.coinsFly.length > PERF.maxCoins) {
      const extra = state.coinsFly.splice(PERF.maxCoins);
      let sum = 0;
      for (const c of extra) sum += (c.amount || 1);
      if (sum > 0) state.coinsFly[0].amount = (state.coinsFly[0].amount || 1) + sum;
    }
    if (R.remainingBarnacles(state.barnacles) === 0) onWhaleClean();
  }

  // 命中结算：飞刀停下，直刺继续往前贯穿
  function resolveHit(k, targets) {
    const crit = k.crit;
    const base = k.damage * (crit ? 2 : 1);
    targets.forEach((b, i) => {
      if (b.dead) return;
      const dmg = k.kind === 'thrust'
        ? R.pierceDamage(base, i, k.pierceFalloff)
        : base;
      k.hitIds.push(b.id);
      if (state.run) {
        state.run.missStreak = 0;
        b.hitCount = (b.hitCount || 0) + 1;
        if (b.hitCount > state.run.maxHitsOnOne) state.run.maxHitsOnOne = b.hitCount;
      }
      if (state.run && L && L.JOKE_WEAPONS.some(w => w.id === state.knifeId)) state.run.usedJokeWeapon = true;
      const res = damageBarnacle(k, b, dmg, crit && i === 0);
      if (!res.killed && !k.hitIds.includes(b.id)) k.hitIds.push(b.id);
      if (i === 0) spawnFloater(markToScreen(b.x, b.y).x, markToScreen(b.x, b.y).y - 22, '-' + dmg, '#FFFFFF');
      if (crit && i === 0) spawnFloater(markToScreen(b.x, b.y).x, markToScreen(b.x, b.y).y - 46, '会心！', '#FFD45E');
    });
    // 直刺不吸附，继续飞（打到上限或飞出屏幕才消失）
    if (k.kind !== 'thrust') {
      k.stuck = true;
      k.vx = k.vy = 0;
    }
  }

  function onWhaleClean() {
    state.phase = 'celebrate';
    // 给一点点时间冒星星，然后换人
    state.celebrateUntil = state.time + 1.1;
    state.cleanFx = 0;
    // reward: coins for the clear, plus a little air back for the trouble
    const bonus = R.clearBonus(state.round);
    for (let i = 0; i < bonus; i++) {
      state.coinsFly.push({
        x: VW / 2 + (Math.random() - 0.5) * 200, y: VH * 0.4,
        vx: (Math.random() - 0.5) * 260, vy: -220 - Math.random() * 160, t: 0,
      });
    }
    spawnFloater(VW / 2, VH * 0.26, '清理奖励 +' + bonus, '#FFE9A8');
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 420;
      state.particles.push({
        x: state.whale.x, y: state.whale.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.7 + Math.random() * 1.1, max: 1.8,
        r: 2 + Math.random() * 4,
        c: ['#FFF6C9', '#9BE7C4', '#BFD4FF', '#FFFFFF'][i % 4],
      });
    }
    state.pendingShop = true;
    SFX.clear();
    // 内容层：结算本局 + 检查成就 + 最高分
    checkAchievements(true);
    commitScore();
    persist('清干净');
    updateHud();
  }

  // Ran out of air mid-dive: the whale leaves with barnacles still on it, and the player is
  // pushed into the shop before trying the same depth again.
  function onOutOfAir() {
    state.phase = 'failed';
    state.failUntil = state.time + 2.2;
    banner('氧气用完了！', '鲸鱼先走了…回去换把更好的刀再来');
    SFX.fail();
    checkAchievements(true);
    commitScore();
    persist('氧气耗尽');
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 260;
      state.particles.push({
        x: state.whale.x + (Math.random() - 0.5) * 240, y: state.whale.y + (Math.random() - 0.5) * 160,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200,
        life: 0.6 + Math.random() * 0.9, max: 1.5, r: 2 + Math.random() * 5,
        c: 'rgba(220,240,255,0.9)',
      });
    }
    updateHud();
  }

  // ------------------------------------------------------------------ draw
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // water background inside the letterboxed area
    ctx.save();
    // 屏幕震动：轻微的随机偏移，出手命中时更有打击感
    const sh = state.shake || 0;
    const shx = sh > 0 ? (Math.random() - 0.5) * sh : 0;
    const shy = sh > 0 ? (Math.random() - 0.5) * sh : 0;
    ctx.translate(offX + shx, offY + shy);
    ctx.scale(scale, scale);
    ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();

    const wg = ctx.createLinearGradient(0, 0, 0, VH);
    wg.addColorStop(0, '#8FD3F4');
    wg.addColorStop(0.45, '#4FA8E0');
    wg.addColorStop(1, '#123A6B');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, VW, VH);

    // light shafts
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * 270 + Math.sin(state.time * 0.4 + i) * 26;
      ctx.beginPath();
      ctx.moveTo(x, -40);
      ctx.lineTo(x + 90, -40);
      ctx.lineTo(x + 250, VH + 40);
      ctx.lineTo(x + 40, VH + 40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // bubbles
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#EAF6FF';
    for (let i = 0; i < 26; i++) {
      const seed = i * 977;
      const bx = ((seed * 13) % VW);
      const by = VH - ((state.time * (26 + (i % 5) * 12) + seed) % (VH + 120));
      const r = 3 + (i % 4) * 2.6;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    // seabed
    ctx.fillStyle = 'rgba(10,30,58,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, VH - 46);
    for (let x = 0; x <= VW; x += 90) ctx.lineTo(x, VH - 46 + Math.sin(x * 0.01) * 14);
    ctx.lineTo(VW, VH); ctx.lineTo(0, VH);
    ctx.closePath(); ctx.fill();

    // ---- 背景光污染（画在鲸鱼后面，背景够花、鲸鱼还清晰）----
    drawBackdropFX(ctx, state.time);

    // ---- 鲸鱼 / 人物立绘 + 藤壶（清干净后鲸鱼消失，由人物立绘接手）----
    if (state.phase === 'thank' || state.phase === 'leaving') {
      drawAvatar(ctx);
    } else {
      drawWhale(ctx, 0);
    }

    // barnacles are drawn in whale-local space so they ride the bob
    ctx.save();
    ctx.translate(state.whale.x, state.whale.y);
    ctx.rotate(state.whale.rot);
    const s = whaleScale * state.whale.scale;
    ctx.scale(s, s);
    ctx.translate(-MARK.w / 2, -MARK.h / 2);
    // 藤壶只在有鲸鱼的时候画；死掉的直接跳过（修 bug：以前死了还留着贴图，看着像打不动）
    if (state.phase !== 'thank' && state.phase !== 'shop') {
      for (const b of state.barnacles) {
        if (b.dead) continue;
        drawBarnacle(ctx, b);
      }
    }
    ctx.restore();

    drawSlashes(ctx);
    drawKnives(ctx, 0);
    drawBolts(ctx);
    drawFlashes(ctx);
    // 命中冲击光环
    for (const r of state.impactRings) {
      const k = r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 3));
      GLOW.ring(ctx, r.x, r.y, rad, r.width * (1 - k), r.color, (1 - k) * 0.9);
      GLOW.star(ctx, r.x, r.y, rad * 0.5, '#FFFFFF', r.life * 3, (1 - k) * 0.7);
    }
    // 光污染叠层 + 前景光尘
    // 前景：光尘 + 闪屏 + 暗角
    if (!fxOff()) drawMotes(ctx);
    drawOverlayFX(ctx, state.time);
    drawLauncherGlow(ctx);

    // ---- 武器导轨（整条轨道自己左右移动，玩家只管方向）----
    const st = stats();
    const ready = state.cool <= 0;
    const gx = railX();                       // 武器当前 x
    const isSwordNow = st.kind === 'thrust';
    const pvCol = st.fx === 'holy' ? '#FFD45E'
      : st.fx === 'greatthrust' ? '#7FB0FF'
        : isSwordNow ? '#9FD0FF' : '#DCEAFF';
    const L = st.blade;
    const dir = railDir();

    // 1) 轨道本体：一条横贯屏幕的光轨 + 刻度
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const railG = ctx.createLinearGradient(RAIL.x0, 0, RAIL.x1, 0);
    railG.addColorStop(0, 'rgba(120,180,255,0)');
    railG.addColorStop(0.5, pvCol);
    railG.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = railG;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(RAIL.x0, RAIL.y + 20);
    ctx.lineTo(RAIL.x1, RAIL.y + 20);
    ctx.stroke();
    // 刻度线
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.5;
    for (let x = RAIL.x0; x <= RAIL.x1; x += 62) {
      const big = Math.abs((x - RAIL.cx) % 248) < 2;
      ctx.beginPath();
      ctx.moveTo(x, RAIL.y + 20);
      ctx.lineTo(x, RAIL.y + 20 + (big ? 13 : 7));
      ctx.stroke();
    }
    // 两端端点
    for (const x of [RAIL.x0, RAIL.x1]) {
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(x, RAIL.y + 20, 5, 0, Math.PI * 2);
      ctx.fillStyle = pvCol;
      ctx.fill();
    }
    ctx.restore();

    // 2) 滑行时的拖影（让「在移动」这件事一眼可见）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 6; i++) {
      const bx = RAIL.cx + Math.sin(state.sweep - dir * i * 0.11) * RAIL.amp;
      ctx.globalAlpha = (ready ? 0.20 : 0.09) / i;
      ctx.fillStyle = pvCol;
      ctx.beginPath();
      ctx.ellipse(bx, RAIL.y + 12, 40 - i * 3, 9 - i * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3) 移动方向箭头（贴在轨道上，指出它正往哪走）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pvCol;
    const ax = gx + dir * 62;
    ctx.beginPath();
    ctx.moveTo(ax + dir * 20, RAIL.y + 20);
    ctx.lineTo(ax, RAIL.y + 12);
    ctx.lineTo(ax, RAIL.y + 28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ---- 武器站本体（跟着轨道滑）----
    ctx.save();
    ctx.translate(gx, RAIL.y);
    ctx.fillStyle = 'rgba(6,20,40,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 26, 56, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.navyDeep;
    ctx.beginPath(); ctx.roundRect(-42, -18, 84, 46, 12); ctx.fill();
    ctx.fillStyle = P.gold;
    ctx.beginPath(); ctx.roundRect(-42, -18, 84, 7, 4); ctx.fill();
    // 底座小轮子
    ctx.fillStyle = '#0A1830';
    ctx.beginPath(); ctx.arc(-26, 30, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(26, 30, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ---- 武器朝向：始终指向鼠标（玩家控制方向）----
    const aimAng = Math.atan2(state.aim.y - RAIL.y, state.aim.x - gx);
    ctx.save();
    ctx.translate(gx, RAIL.y - 4);
    ctx.globalAlpha = ready ? 1 : 0.45;
    ctx.rotate(aimAng);
    ctx.shadowColor = pvCol;
    ctx.shadowBlur = ready && PERF.budget > 0.6 ? 18 : 0;
    if (isSwordNow) {
      const grad = ctx.createLinearGradient(0, -L * 0.12, 0, L * 0.12);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.5, pvCol);
      grad.addColorStop(1, '#8E9BB0');
      ctx.beginPath();
      ctx.moveTo(-L * 0.06, -L * 0.075);
      ctx.lineTo(L * 0.82, -L * 0.05);
      ctx.lineTo(L * 1.0, 0);
      ctx.lineTo(L * 0.82, L * 0.05);
      ctx.lineTo(-L * 0.06, L * 0.075);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = 'rgba(20,30,50,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = P.gold;
      ctx.beginPath(); ctx.roundRect(-L * 0.08, -L * 0.16, L * 0.06, L * 0.32, 3); ctx.fill();
      ctx.fillStyle = '#43325A';
      ctx.beginPath(); ctx.roundRect(-L * 0.40, -L * 0.05, L * 0.32, L * 0.10, 4); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-L * 0.12, -L * 0.15);
      ctx.lineTo(L * 0.62, -L * 0.10);
      ctx.lineTo(L * 0.80, 0);
      ctx.lineTo(L * 0.62, L * 0.10);
      ctx.lineTo(-L * 0.12, L * 0.15);
      ctx.closePath();
      ctx.fillStyle = '#E8EEF8'; ctx.fill();
      ctx.strokeStyle = 'rgba(20,30,50,0.6)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#6B4A2F';
      ctx.beginPath(); ctx.roundRect(-L * 0.62, -L * 0.11, L * 0.5, L * 0.22, L * 0.06); ctx.fill();
    }
    // 冷却环
    if (!ready) {
      ctx.strokeStyle = '#FFE9A8'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-L * 0.2, 0, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - state.cool / st.cooldown));
      ctx.stroke();
    }
    ctx.restore();

    // ---- 瞄准射线：从武器出发朝鼠标方向拉一条虚线，明确「方向由鼠标定」----
    if (state.phase === 'play' && state.aim.inside) {
      const ux = Math.cos(aimAng), uy = Math.sin(aimAng);
      const far = 1400;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lineG = ctx.createLinearGradient(gx, RAIL.y, gx + ux * far, RAIL.y + uy * far);
      lineG.addColorStop(0, pvCol);
      lineG.addColorStop(0.35, 'rgba(180,220,255,0.45)');
      lineG.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.strokeStyle = lineG;
      ctx.lineWidth = 2.5;
      if (ctx.setLineDash) ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(gx + ux * (L + 18), RAIL.y + uy * (L + 18));
      ctx.lineTo(gx + ux * far, RAIL.y + uy * far);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.restore();
    }

    // particles
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // coin pickups（性能：不用 shadowBlur，改成画一圈亮边，快很多但一样亮）
    for (const c of state.coinsFly) {
      ctx.save();
      ctx.translate(c.x, c.y);
      const rad = c.big ? 15 : 11;
      ctx.scale(Math.max(0.25, Math.abs(Math.cos(state.time * 6 + c.spin))), 1);
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.fillStyle = c.big ? '#FFE9A8' : '#FFD45E'; ctx.fill();
      if (c.big) {
        ctx.strokeStyle = 'rgba(255,233,168,0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, rad + 4, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = c.big ? '#FFD45E' : '#B9861F'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#B9861F';
      ctx.font = `bold ${c.big ? 16 : 13}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('¥', 0, 1);
      ctx.restore();
    }

    // floating text
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      if (f.talk) {
        ctx.font = '600 13px system-ui, "Segoe UI", sans-serif';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,16,34,0.85)';
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
        continue;
      }
      ctx.font = 'bold 22px system-ui, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,16,34,0.75)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // crosshair：鼠标只决定「朝向」，所以准星画在鼠标处，并画出它到武器的连线
    if (state.phase === 'play' && state.aim.inside) {
      const ap = aimPoint();
      const chCol = GLOW.rainbow(state.time, 130, 0);
      ctx.save();
      ctx.translate(ap.x, ap.y);
      ctx.globalCompositeOperation = 'lighter';
      // 外圈旋转弧线（卡的时候不发光）
      ctx.strokeStyle = chCol;
      ctx.lineWidth = 3;
      ctx.shadowColor = chCol;
      ctx.shadowBlur = PERF.budget > 0.6 ? 20 : 0;
      for (let i = 0; i < 3; i++) {
        const a0 = state.time * 2.4 + i * (Math.PI * 2 / 3);
        ctx.beginPath(); ctx.arc(0, 0, 21 + i * 4, a0, a0 + 1.25); ctx.stroke();
      }
      // 十字
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = PERF.budget > 0.6 ? 14 : 0;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-26, 0); ctx.lineTo(-8, 0);
      ctx.moveTo(8, 0); ctx.lineTo(26, 0);
      ctx.moveTo(0, -26); ctx.lineTo(0, -8);
      ctx.moveTo(0, 8); ctx.lineTo(0, 26);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // phase banner
    if (bannerUntil > state.time) {
      const k = Math.min(1, (bannerUntil - state.time) / 0.4);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.font = 'bold 40px system-ui, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(8,16,34,0.6)';
      ctx.strokeText(bannerTitle, VW / 2, VH * 0.20);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(bannerTitle, VW / 2, VH * 0.20);
      if (bannerSub) {
        ctx.font = '600 20px system-ui, "Segoe UI", sans-serif';
        ctx.strokeText(bannerSub, VW / 2, VH * 0.20 + 32);
        ctx.fillStyle = '#CDE4FF';
        ctx.fillText(bannerSub, VW / 2, VH * 0.20 + 32);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // ------------------------------------------------------------------ banner
  let bannerTitle = '', bannerSub = '', bannerUntil = 0;
  function banner(title, sub) {
    bannerTitle = title; bannerSub = sub || '';
    bannerUntil = state.time + 1.6;
  }

  // 出手特效：发射台的枪口闪光（每把武器颜色/力度不同）+ 屏幕轻微震动
  const FX_STYLE = {
    throw: { core: '#FFFFFF', glow: 'rgba(200,225,255,0.85)', ring: 'rgba(180,215,255,0.75)', shake: 2.5, sparks: 10 },
    thrust: { core: '#FFFFFF', glow: 'rgba(150,200,255,0.9)', ring: 'rgba(140,190,255,0.8)', shake: 5, sparks: 16 },
    greatthrust: { core: '#EAF3FF', glow: 'rgba(120,170,255,0.95)', ring: 'rgba(110,160,255,0.85)', shake: 7, sparks: 22 },
    holy: { core: '#FFFBE0', glow: 'rgba(255,228,140,0.95)', ring: 'rgba(255,215,110,0.9)', shake: 9, sparks: 30 },
  };

  function spawnMuzzleFx(ang, style, power) {
    const st = FX_STYLE[style] || FX_STYLE.throw;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const gun = gunPos();
    const ox = gun.x + ux * 34, oy = gun.y + uy * 34;
    state.flashes.push({
      x: ox, y: oy, ang, life: 0, max: style === 'throw' ? 0.16 : 0.26,
      style, power: power || 1,
    });
    // 火花
    for (let i = 0; i < st.sparks; i++) {
      const spread = (Math.random() - 0.5) * (style === 'throw' ? 1.1 : 0.7);
      const a = ang + spread;
      const sp = 180 + Math.random() * 420 * (power || 1);
      state.particles.push({
        x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: 0.25 + Math.random() * 0.35, max: 0.6,
        r: 1.5 + Math.random() * 3 * (power || 1),
        c: Math.random() < 0.5 ? st.core : st.glow,
      });
    }
    // 屏幕震动
    state.shake = Math.max(state.shake || 0, st.shake * (power || 1) * fxScale());
  }

  // 枪口闪光绘制：一圈扩散环 + 一个亮斑 + 一道短光锥
  function drawFlashes(g) {
    for (const f of state.flashes) {
      const k = f.life / f.max;
      const st = FX_STYLE[f.style] || FX_STYLE.throw;
      const ease = 1 - Math.pow(1 - k, 3);
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.ang);
      const p = f.power || 1;
      // 扩散环
      g.globalAlpha = (1 - k) * 0.9;
      g.strokeStyle = st.ring;
      g.lineWidth = 6 * p * (1 - k * 0.6);
      g.beginPath();
      g.arc(0, 0, 16 + 90 * p * ease, -0.9, 0.9);
      g.stroke();
      // 光锥
      const grad = g.createLinearGradient(0, 0, 150 * p, 0);
      grad.addColorStop(0, st.glow);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = (1 - k) * 0.75;
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -22 * p * (1 - k));
      g.lineTo(150 * p * ease, -6 * p);
      g.lineTo(150 * p * ease, 6 * p);
      g.lineTo(0, 22 * p * (1 - k));
      g.closePath();
      g.fill();
      // 亮斑
      g.globalAlpha = (1 - k);
      g.fillStyle = st.core;
      g.beginPath();
      g.ellipse(0, 0, 26 * p * (1 - k * 0.5), 16 * p * (1 - k * 0.5), 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  // ------------------------------------------------------------------ 光污染档位
  // 'off' 关闭 / 'normal' 标准 / 'max' 拉满
  const FX_LEVELS = ['off', 'normal', 'max'];
  const FX_LABEL = { off: '🚫', normal: '🌤', max: '✨' };
  const FX_NAME = { off: '关闭', normal: '标准', max: '拉满' };
  function fxLevel() {
    return FX_LEVELS.indexOf(state.fx) >= 0 ? state.fx : 'max';
  }
  const fxOff = () => fxLevel() === 'off';
  const fxMax = () => fxLevel() === 'max';
  // 强度系数：关闭 = 0，标准 = 0.55，拉满 = 1
  function fxScale() {
    const l = fxLevel();
    return l === 'off' ? 0 : l === 'normal' ? 0.55 : 1;
  }

  // ------------------------------------------------------------------ 性能预算
  // 特效多了以后「打碎那一下」最吃性能：粒子/金币瞬间暴涨，而且每个都带 shadowBlur。
  // 这里统一限流 + 自适应降级，保证再花也不掉帧。
  const PERF = {
    maxParticles: 260,       // 粒子上限
    maxCoins: 90,            // 金币对象上限（金币可以用 amount 合并，不影响收益）
    maxRings: 10,
    budget: 1,               // 1 = 全效果；卡了就自动降
    frameAvg: 16.7,
    slowFrames: 0,
  };
  function noteFrameTime(ms) {
    PERF.frameAvg = PERF.frameAvg * 0.9 + ms * 0.1;
    if (PERF.frameAvg > 26) {
      PERF.slowFrames++;
      if (PERF.slowFrames > 45 && PERF.budget > 0.35) { PERF.budget = Math.max(0.35, PERF.budget - 0.2); PERF.slowFrames = 0; }
    } else if (PERF.frameAvg < 19) {
      PERF.slowFrames = 0;
      if (PERF.budget < 1) PERF.budget = Math.min(1, PERF.budget + 0.05);
    }
  }
  // 按预算裁剪数量
  function pc(n) {
    return Math.max(1, Math.round(n * PERF.budget));
  }

  // ------------------------------------------------------------------ 光效工具箱
  // 「怎么光污染怎么来」：统一的霓虹发光 / 旋转彩虹 / 放射光柱 / 镜头光环
  const GLOW = {
    // 给一个绘制动作套上多层辉光（卡的时候自动只画一层、不发光的）
    neon(g, color, blur, times, fn) {
      const n = PERF.budget > 0.6 ? (times || 2) : 1;
      const useBlur = PERF.budget > 0.6;
      g.save();
      if (useBlur) g.shadowColor = color;
      for (let i = 0; i < n; i++) {
        g.shadowBlur = useBlur ? (blur || 18) * (i + 1) * 0.7 : 0;
        fn(g);
      }
      g.restore();
    },
    // 旋转彩虹色：hue 随时间变化
    rainbow(t, speed, offset) {
      const h = ((t * (speed || 60) + (offset || 0)) % 360 + 360) % 360;
      return `hsl(${h.toFixed(0)}, 100%, 62%)`;
    },
    // 放射光柱：从中心向外的一圈锥形光
    rays(g, x, y, r, t, color, count, alpha) {
      const n = count || 12;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.translate(x, y);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 0.35;
        const len = r * (0.75 + 0.35 * Math.sin(t * 2.2 + i * 1.7));
        const wid = 0.045 + 0.03 * Math.sin(t * 3.1 + i);
        g.save();
        g.rotate(a);
        g.globalAlpha = (alpha === undefined ? 0.28 : alpha) * (0.55 + 0.45 * Math.sin(t * 3 + i * 2));
        const grad = g.createLinearGradient(0, 0, len, 0);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(len, -len * wid);
        g.lineTo(len, len * wid);
        g.closePath();
        g.fill();
        g.restore();
      }
      g.restore();
    },
    // 镜头光环：一圈光环扩散（命中/出手时用）
    ring(g, x, y, r, width, color, alpha) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = alpha === undefined ? 0.8 : alpha;
      g.strokeStyle = color;
      g.lineWidth = width || 3;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    },
    // 六芒星/火花闪光
    star(g, x, y, r, color, rot, alpha) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.translate(x, y);
      g.rotate(rot || 0);
      g.globalAlpha = alpha === undefined ? 0.9 : alpha;
      g.fillStyle = color;
      const spikes = 4;
      g.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.28;
        if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      g.restore();
    },
    // 彩虹描边文字（浮字用）
    glowText(g, text, x, y, size, color, blur) {
      g.save();
      g.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (PERF.budget > 0.6) {
        g.shadowColor = color;
        g.shadowBlur = blur || 16;
      }
      g.fillStyle = '#FFFFFF';
      g.fillText(text, x, y);
      g.fillStyle = color;
      g.globalAlpha = 0.55;
      g.fillText(text, x, y);
      g.restore();
    },
  };

  // 背景光污染（画在鲸鱼后面：彩虹光环 + 旋转扫光 + 放射光柱）
  // 放在鲸鱼后面，这样背景足够花，鲸鱼本体还能保持清晰醒目。
  // 背景光污染（画在鲸鱼后面：彩虹光环 + 旋转扫光 + 放射光柱）
  // 放在鲸鱼后面，这样背景足够花，鲸鱼本体还能保持清晰醒目。
  // 性能：把所有渐变对象缓存起来复用（每帧 new 几十个渐变是主要卡顿来源之一）。
  const FX_CACHE = { rings: new Map(), beams: new Map(), vignette: null, vignetteH: 0 };
  function cachedRadial(g, key, cx, cy, r0, r1, hue) {
    let gr = FX_CACHE.rings.get(key);
    if (!gr) {
      gr = g.createRadialGradient(cx, cy, r0, cx, cy, r1);
      gr.addColorStop(0, `hsla(${hue},100%,66%,0)`);
      gr.addColorStop(0.5, `hsla(${hue},100%,68%,1)`);
      gr.addColorStop(1, `hsla(${(hue + 60) % 360},100%,60%,0)`);
      FX_CACHE.rings.set(key, gr);
      if (FX_CACHE.rings.size > 48) FX_CACHE.rings.clear();
    }
    return gr;
  }
  function cachedBeam(g, key, hue) {
    let gr = FX_CACHE.beams.get(key);
    if (!gr) {
      gr = g.createLinearGradient(0, 0, VW * 1.1, 0);
      gr.addColorStop(0, `hsla(${hue},100%,72%,1)`);
      gr.addColorStop(0.35, `hsla(${(hue + 50) % 360},100%,64%,0.5)`);
      gr.addColorStop(1, 'hsla(0,0%,100%,0)');
      FX_CACHE.beams.set(key, gr);
      if (FX_CACHE.beams.size > 48) FX_CACHE.beams.clear();
    }
    return gr;
  }

  function drawBackdropFX(g, t) {
    if (fxOff()) return;                      // 光污染关闭：整层跳过
    const K = fxScale();                      // 标准档整体减弱
    const s = state;
    const cx = s.whale.x, cy = s.whale.y;

    // 0) 鲸鱼背后的大彩虹光环（脉动）
    // 性能：这些都是大面积「叠加」填充，是常态帧的主要开销，所以数量跟性能预算走
    g.save();
    g.globalCompositeOperation = 'lighter';
    const ringR = WHALE_W * (0.72 + 0.05 * Math.sin(t * 1.7));
    const ringCount = Math.min(fxMax() ? 4 : 3, pc(fxMax() ? 4 : 3));
    for (let i = 0; i < ringCount; i++) {
      const hue = Math.round(((t * 90 + i * 60) % 360) / 12) * 12;   // 量化，提升缓存命中
      g.globalAlpha = (0.16 + 0.08 * Math.sin(t * 2.4 + i * 1.3)) * K;
      const r0 = ringR * (0.25 + i * 0.14), r1 = ringR * (0.52 + i * 0.15);
      g.fillStyle = cachedRadial(g, `${i}|${hue}|${Math.round(r0)}|${Math.round(r1)}`, cx, cy, r0, r1, hue);
      g.beginPath();
      g.ellipse(cx, cy, r1, r1 * 0.93, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // 1) 旋转彩虹扫光
    g.save();
    g.globalCompositeOperation = 'lighter';
    const beamA = t * 0.8;
    const BEAMS = Math.max(2, Math.min(fxMax() ? 5 : 3, pc(fxMax() ? 5 : 3)));
    g.translate(cx, cy);
    for (let i = 0; i < BEAMS; i++) {
      const hue = Math.round(((t * 120 + i * 45) % 360) / 15) * 15;
      g.save();
      g.rotate(beamA + i * (Math.PI * 2 / BEAMS));
      g.globalAlpha = (0.3 + 0.16 * Math.sin(t * 3.4 + i * 1.1)) * K;
      g.fillStyle = cachedBeam(g, String(hue), hue);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(VW * 1.1, -VW * 0.11);
      g.lineTo(VW * 1.1, VW * 0.11);
      g.closePath();
      g.fill();
      g.restore();
    }
    g.restore();

    // 2) 放射光柱（只有拉满 + 性能够才画）
    if (fxMax() && PERF.budget > 0.75 && (s.phase === 'play' || s.phase === 'celebrate' || s.phase === 'arrive')) {
      GLOW.rays(g, cx, cy, WHALE_W * 1.15, t, 'rgba(255,255,255,0.7)', pc(18), 0.22);
      GLOW.rays(g, cx, cy, WHALE_W * 0.85, -t * 1.5, 'rgba(170,225,255,0.55)', pc(12), 0.18);
    }
  }

  // 前景叠加（画在鲸鱼之后：闪屏 + 暗角）
  function drawOverlayFX(g, t) {
    if (fxOff()) return;
    const K = fxScale();
    // 命中/击杀闪屏
    if (state.flashScreen > 0) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = state.flashScreen * 0.4 * K;
      g.fillStyle = state.flashColor || '#FFFFFF';
      g.fillRect(0, 0, VW, VH);
      g.restore();
    }
    // 上下暗角 + 呼吸（渐变缓存，尺寸不变就复用）
    g.save();
    if (!FX_CACHE.vignette || FX_CACHE.vignetteH !== VH) {
      const vg = g.createLinearGradient(0, 0, 0, VH);
      vg.addColorStop(0, 'rgba(2,8,20,0.44)');
      vg.addColorStop(0.45, 'rgba(2,8,20,0)');
      vg.addColorStop(1, 'rgba(1,6,16,0.52)');
      FX_CACHE.vignette = vg;
      FX_CACHE.vignetteH = VH;
    }
    g.globalAlpha = 0.72 + 0.14 * Math.sin(t * 1.6);
    g.fillStyle = FX_CACHE.vignette;
    g.fillRect(0, 0, VW, VH);
    g.globalAlpha = 1;
    g.restore();
  }

  // 前景漂浮光尘（细节层：大小/速度/色相都不同，带视差）
  function updateMotes(dt) {
    const keep = [];
    for (const m of state.motes) {
      m.life -= dt;
      if (m.life <= 0) continue;
      m.x += m.vx * dt * (1 + m.depth * 0.8);
      m.y += m.vy * dt;
      m.tw += dt * (2 + m.depth * 3);
      keep.push(m);
    }
    state.motes = keep;
    // 补充（数量随性能预算走）
    const cap = Math.round(30 * PERF.budget);
    if (state.motes.length < cap && Math.random() < 0.75) {
      const depth = Math.random();
      state.motes.push({
        x: Math.random() * VW,
        y: VH + 20,
        vx: (Math.random() - 0.5) * 26,
        vy: -(10 + depth * 34),
        r: 1 + depth * 5.5,
        hue: Math.floor(Math.random() * 60) + 180,
        tw: Math.random() * 6,
        life: 6 + Math.random() * 10,
        max: 16,
        depth,
      });
    }
  }

  function drawMotes(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const m of state.motes) {
      const a = Math.max(0, Math.min(1, m.life / 3)) * (0.35 + 0.65 * Math.abs(Math.sin(m.tw)));
      g.globalAlpha = a * (0.35 + m.depth * 0.5);
      g.fillStyle = `hsl(${m.hue},100%,${(65 + m.depth * 15) | 0}%)`;
      g.beginPath();
      g.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      g.fill();
      // 大颗粒加个小十字星芒（卡的时候不画）
      if (m.depth > 0.72 && PERF.budget > 0.6) {
        g.globalAlpha = a * 0.5;
        g.strokeStyle = '#FFFFFF';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(m.x - m.r * 2.4, m.y);
        g.lineTo(m.x + m.r * 2.4, m.y);
        g.moveTo(m.x, m.y - m.r * 2.4);
        g.lineTo(m.x, m.y + m.r * 2.4);
        g.stroke();
      }
    }
    g.restore();
  }

  // 发射台的霓虹光晕
  function drawLauncherGlow(g) {
    const t = state.time;
    const col = GLOW.rainbow(t, 90, 0);
    const gx = railX();
    // 发射台光晕（用叠加圆代替 shadowBlur，省很多）
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.45;
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(gx, RAIL.y + 10, 66, 34, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.3;
    g.beginPath();
    g.ellipse(gx, RAIL.y + 10, 92, 46, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // 台子上的一圈旋转刻线
    g.save();
    g.translate(gx, RAIL.y + 4);
    g.globalAlpha = 0.75;
    g.strokeStyle = col;
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = t * 1.6 + i * (Math.PI * 2 / 3);
      g.beginPath();
      g.arc(0, 0, 40 + i * 7, a, a + 1.1);
      g.stroke();
    }
    g.restore();
  }

  // 把 #RRGGBB 调亮(k>0)/调暗(k<0)，用来从一个种类色推出整颗藤壶的配色
  function shade(hex, k) {
    if (typeof hex !== 'string' || hex[0] !== '#') return '#C9B79A';
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    else { r *= (1 + k); g *= (1 + k); b *= (1 + k); }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  // 种类角标：贴在藤壶右下角，一眼看出是哪一种
  const TYPE_MARK = {
    meizhai: '宅', lizhongke: '中', daode: '德', quandi: '圈', lacai: '踩',
    jubao: '举', shuangbiao: '双', duanzhang: '截', suiyue: '史', zhengxu: '正',
  };

  // ------------------------------------------------------------------ 内容层：成就 / 图鉴 / 战绩
  function checkAchievements(finished) {
    if (!L || !state.run) return;
    const acc = {
      items: state.items || {}, killed: state.killedByType || {},
      totalCoins: state.totalCoins || 0, maxRound: state.maxRound || 1,
    };
    const run = state.run;
    if (finished) {
      run.endedWithZeroCoins = state.coins === 0;
      run.clearedWithNoMiss = run.maxMissStreak === 0;
    }
    for (const a of L.ACHIEVEMENTS) {
      if (state.achievements.includes(a.id)) continue;
      let ok = false;
      try { ok = !!a.check(acc, run); } catch (e) { ok = false; }
      if (ok) {
        state.achievements.push(a.id);
        toast('🏆 成就解锁：' + a.name, a.desc);
        SFX.perk();
      }
    }
  }

  // 本机最高分：单局赚到的金币
  function scoreOfRun() { return state.run ? state.run.gained : 0; }
  function commitScore() {
    const sc = scoreOfRun();
    if (sc > (state.bestScore || 0)) {
      state.bestScore = sc;
      return true;
    }
    return false;
  }

  function toast(title, sub) {
    const el2 = el('toast');
    if (!el2) return;
    const d = document.createElement('div');
    d.className = 'toastitem';
    d.innerHTML = '<b>' + title + '</b>' + (sub ? '<span>' + sub + '</span>' : '');
    el2.appendChild(d);
    // 定时移除；没有计时器的环境（测试沙箱）就退化成"一直挂着"或立即移除
    if (typeof setTimeout === 'function') {
      setTimeout(() => {
        d.classList.add('gone');
        if (d.parentNode) d.parentNode.removeChild(d);
      }, 4200);
    }
    // 保险：弹条最多留 6 个，超了从最早的开始删
    while (el2.children.length > 6) el2.removeChild(el2.children[0]);
  }

  // ------------------------------------------------------------------ 叙事层
  // 世界观：大肥鱼被「赛博藤壶」入侵，玩家是来救它的。
  // 每 5 波插一段大肥鱼的通讯（轻松搞笑的调子，和 Q 版女仆道谢的风格统一）。
  const INVASION_TOTAL_WAVES = 20;      // 清除度按这个总波数算百分比

  const STORY = {
    5: {
      title: '「等等……你听得见我说话？」',
      text: '大肥鱼眨了眨眼，声音有点发抖。\n\n「这些藤壶……是赛博的？谁在我身上装藤壶啊喂！」\n「左边那只特别痒，你先、你先弄它。」',
    },
    10: {
      title: '「它们开始动了！」',
      text: '大肥鱼扭来扭去，水花溅了你一脸。\n\n「不是那边！哎呀你别戳我眼睛……」\n「……话说回来，你刀法是不是变好了？」',
    },
    15: {
      title: '「有只特别大的。」',
      text: '大肥鱼的语气突然沉下来。\n\n「背上那块……它在下崽。切一个长两个那种。」\n「我知道很恶心。但你得先打它，拜托了。」',
    },
    20: {
      title: '「谢谢你。」',
      text: '藤壶清空的那一刻，大肥鱼安静了很久。\n\n「其实我一直没敢说——我以为我撑不到有人来。」\n「结果你来了，还换了把剑。……你怎么这么厉害啊。」',
    },
    25: {
      title: '「更深的地方还有。」',
      text: '大肥鱼翻了个身，露出还没被清理的侧面。\n\n「它们不只是长在皮肤上，好像往里面钻了。」\n「不过这次我不怕了。你继续切，我忍着。」',
    },
    30: {
      title: '「继续下潜。」',
      text: '「又来了……这帮藤壶是把我当公寓了吗？」\n\n大肥鱼叹了口气，然后笑了。\n「来吧。这次我准备好痒了。」',
    },
  };
  function storyFor(round) { return STORY[round] || null; }

  // 入侵清除度：按已清理的波数算
  function invasionPct(clearedWaves) {
    return Math.max(0, Math.min(100, Math.round((clearedWaves / INVASION_TOTAL_WAVES) * 100)));
  }

  // ------------------------------------------------------------------ 音效（WebAudio 现场合成）
  // 不依赖任何音频文件：用振荡器 + 噪声拼出刀风、切割、金币、通关等音效。
  const SFX = (() => {
    let ctxA = null, enabled = true, master = null;
    function ac() {
      if (ctxA) return ctxA;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctxA = new AC();
        master = ctxA.createGain();
        master.gain.value = 0.22;
        master.connect(ctxA.destination);
      } catch (e) { ctxA = null; }
      return ctxA;
    }
    // 浏览器的自动播放限制：第一次用户操作后才能出声
    function unlock() {
      const a = ac();
      if (a && a.state === 'suspended' && a.resume) { try { a.resume(); } catch (e) {} }
    }
    function tone(freq, dur, type, vol, slideTo) {
      if (!enabled) return;
      const a = ac();
      if (!a || !master) return;
      try {
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, a.currentTime);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), a.currentTime + dur);
        g.gain.setValueAtTime(0, a.currentTime);
        g.gain.linearRampToValueAtTime(vol === undefined ? 0.5 : vol, a.currentTime + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0008, a.currentTime + dur);
        o.connect(g); g.connect(master);
        o.start(); o.stop(a.currentTime + dur + 0.02);
      } catch (e) { /* 音效失败不影响游戏 */ }
    }
    function noise(dur, vol, hp) {
      if (!enabled) return;
      const a = ac();
      if (!a || !master) return;
      try {
        const len = Math.max(1, Math.floor(a.sampleRate * dur));
        const buf = a.createBuffer(1, len, a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = a.createBufferSource();
        src.buffer = buf;
        const g = a.createGain();
        g.gain.value = vol === undefined ? 0.35 : vol;
        if (hp && a.createBiquadFilter) {
          const f = a.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = hp;
          src.connect(f); f.connect(g);
        } else {
          src.connect(g);
        }
        g.connect(master);
        src.start();
      } catch (e) {}
    }
    return {
      unlock,
      setEnabled(v) { enabled = !!v; },
      isEnabled() { return enabled; },
      throwKnife() { noise(0.10, 0.18, 900); tone(520, 0.08, 'triangle', 0.12, 260); },
      shootSword() { tone(240, 0.22, 'sawtooth', 0.16, 900); noise(0.14, 0.22, 1600); },
      shootHoly() { tone(320, 0.30, 'triangle', 0.18, 1400); tone(640, 0.26, 'sine', 0.12, 1800); noise(0.16, 0.20, 2000); },
      hit() { noise(0.05, 0.22, 400); tone(180, 0.05, 'square', 0.10); },
      kill() { tone(660, 0.07, 'square', 0.16, 990); noise(0.09, 0.26, 700); },
      coin() { tone(1180, 0.06, 'sine', 0.14); tone(1560, 0.07, 'sine', 0.11); },
      buy() { tone(520, 0.08, 'triangle', 0.16); tone(780, 0.10, 'triangle', 0.14); },
      fail() { tone(220, 0.5, 'sawtooth', 0.16, 90); },
      // 琶音；没有 setTimeout 的环境（比如测试沙箱）就直接一次性响
      arp(freqs, step, dur, type, vol) {
        if (typeof setTimeout !== 'function') {
          freqs.forEach(f => tone(f, dur, type, vol));
          return;
        }
        freqs.forEach((f, i) => setTimeout(() => tone(f, dur, type, vol), i * step));
      },
      clear() { this.arp([523, 659, 784, 1046], 110, 0.22, 'triangle', 0.16); },
      perk() { this.arp([400, 600, 900, 1300], 70, 0.18, 'sine', 0.14); },
    };
  })();

  // ------------------------------------------------------------------ 存档
  const Save = window.WhaleSave || null;
  function snapshot() {
    return {
      coins: state.coins,
      knifeId: state.knifeId,
      maxKnifeId: state.maxKnifeId || state.knifeId,
      upgrades: Object.assign({}, state.upgrades),
      perks: (state.perks || []).slice(),
      maxRound: Math.max(state.maxRound || 1, state.round),
      totalCoins: state.totalCoins,
      sound: SFX.isEnabled(),
      fx: fxLevel(),
      storySeen: (state.storySeen || []).slice(0, 60),
      items: state.items || {},
      killedByType: state.killedByType || {},
      achievements: (state.achievements || []).slice(0, 60),
      bestScore: state.bestScore || 0,
      gameCleared: !!state.gameCleared,
      gachaPity: state.gachaPity || 0,
      inputMode: state.inputMode === 'touch' ? 'touch' : 'pc',
    };
  }
  function persist(label) {
    if (!Save) return;
    const r = Save.save(snapshot());
    const el2 = el('saveState');
    if (el2) {
      el2.textContent = r.ok
        ? `进度已自动保存（${new Date().toLocaleTimeString()}）`
        : `未能保存：${r.reason || '未知原因'}（不影响继续玩）`;
    }
    state.maxRound = Math.max(state.maxRound || 1, state.round);
  }
  function applySave(data) {
    state.coins = data.coins || 0;
    state.totalCoins = data.totalCoins || 0;
    state.knifeId = data.knifeId || 'rusty';
    // 老存档没有 maxKnifeId：用 knifeId 兜底（不会丢已买的武器）
    state.maxKnifeId = data.maxKnifeId || data.knifeId || 'rusty';
    state.upgrades = Object.assign({ wide: 0, crit: 0, magnet: 0, gloves: 0, tank: 0 }, data.upgrades || {});
    state.perks = (data.perks || []).slice();
    state.maxRound = data.maxRound || 1;
    SFX.setEnabled(data.sound !== false);
    state.storySeen = (data.storySeen || []).slice(0, 60);
    state.items = Object.assign({}, data.items || {});
    state.killedByType = Object.assign({}, data.killedByType || {});
    state.achievements = (data.achievements || []).slice(0, 60);
    state.bestScore = data.bestScore || 0;
    state.gameCleared = !!data.gameCleared;
    state.gachaPity = data.gachaPity || 0;
    state.inputMode = data.inputMode === 'touch' ? 'touch' : 'pc';
    state.endless = !!data.gameCleared;
    state.fx = (Save && Save.normFx) ? Save.normFx(data.fx) : (FX_LEVELS.indexOf(data.fx) >= 0 ? data.fx : 'max');
    updateHud();
  }

  // ------------------------------------------------------------------ HUD + shop (DOM)
  const el = (id) => document.getElementById(id);
  function updateHud() {
    el('coins').textContent = state.coins;
    el('round').textContent = state.round;
    el('left').textContent = R.remainingBarnacles(state.barnacles);
    el('knifeName').textContent = R.knifeById(state.knifeId).name;
    el('combo').textContent = state.combo > 1 ? ('x' + state.combo) : '';
    const fill = el('airFill');
    if (fill) {
      const frac = state.maxAir > 0 ? Math.max(0, state.air / state.maxAir) : 0;
      fill.style.width = (frac * 100).toFixed(1) + '%';
      if (frac < 0.3) fill.classList.add('low'); else fill.classList.remove('low');
    }
    const secs = el('airSecs');
    if (secs) secs.textContent = Math.ceil(Math.max(0, state.air)) + 's';
  }
  let hudTick = 0;

  // ---------------------------------------------------------------- 背包
  const BAG_TABS = ['weapon', 'perk', 'up', 'item'];
  function renderBag() {
    const body = el('bagBody');
    if (!body) return;
    const tab = BAG_TABS.indexOf(state.bagTab) >= 0 ? state.bagTab : 'weapon';
    state.bagTab = tab;
    const wallet = el('bagCoins');
    if (wallet) wallet.textContent = state.coins;
    const bar = el('bagTabs');
    if (bar && bar.querySelectorAll) {
      const btns = bar.querySelectorAll('.stab');
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        if (b && b.classList && b.dataset) b.classList.toggle('on', b.dataset.btab === tab);
      }
    }
    let html = '';
    if (tab === 'weapon') {
      const ownIdx = R.ownedKnifeIndex(state);
      const total = R.KNIVES.length;
      const have = Math.min(ownIdx + 1, total);
      html += '<p class="codexsum">武器 · 已拥有 <b>' + have + ' / ' + total + '</b>　点一下就能换上</p>';
      html += '<div class="baglist">';
      R.KNIVES.map((k, i) => ({ k, i })).forEach(({ k, i }) => {
        const owned = i <= ownIdx;
        const equipped = k.id === state.knifeId;
        const isSword = (k.kind || 'throw') === 'thrust';
        html += '<div class="bagrow' + (equipped ? ' eq' : '') + (owned ? '' : ' locked') + '"' +
          ' data-equip="' + k.id + '"' +
          (owned && !equipped ? ' onclick="__bagEquip(\'' + k.id + '\')"' : '') + '>' +
          '<canvas class="bagicon" width="112" height="58"></canvas>' +
          '<div class="bagmeta">' +
          '<strong>' + (owned ? k.name : '？？？') + (isSword ? ' ⚔' : '') + '</strong>' +
          '<span class="bagstat">伤害 ' + k.damage + ' · 冷却 ' + k.cooldown.toFixed(2) + 's' +
          (isSword ? ' · 贯穿 ' + (k.pierce >= 99 ? '无限' : k.pierce + ' 个') : '') + '</span>' +
          '<span class="bagdesc">' + (owned ? k.desc : (isSword ? '抽卡才能拿到' : '还没买到')) + '</span>' +
          '</div>' +
          '<span class="bagtag' + (equipped ? ' on' : '') + '">' +
          (equipped ? '使用中' : (owned ? '点击装备' : (isSword ? '抽卡获得' : '🪙 ' + k.cost))) +
          '</span></div>';
      });
      html += '</div>';
    } else if (tab === 'perk') {
      const perks = state.perks || [];
      html += '<p class="codexsum">特质 · 已拥有 <b>' + perks.length + ' / ' + R.PERKS.length + '</b>　（买了就一直生效，不用切换）</p>';
      html += '<div class="baglist">';
      R.PERKS.forEach((p) => {
        const owned = perks.includes(p.id);
        html += '<div class="bagrow' + (owned ? ' eq' : ' locked') + '">' +
          '<div class="bagmeta">' +
          '<strong>' + (owned ? p.name : '？？？') + '</strong>' +
          '<span class="bagdesc">' + (owned ? (p.desc || '') : '还没解锁') + '</span>' +
          '</div><span class="bagtag' + (owned ? ' on' : '') + '">' +
          (owned ? '已生效' : '🪙 ' + p.cost) + '</span></div>';
      });
      html += '</div>';
    } else if (tab === 'up') {
      let lv = 0, maxLv = 0;
      R.UPGRADES.forEach(u => { lv += (state.upgrades[u.id] || 0); maxLv += u.max; });
      html += '<p class="codexsum">道具 · 等级 <b>' + lv + ' / ' + maxLv + '</b>　（数值升级，一直生效）</p>';
      html += '<div class="baglist">';
      R.UPGRADES.forEach((u) => {
        const l = state.upgrades[u.id] || 0;
        html += '<div class="bagrow' + (l > 0 ? ' eq' : '') + '">' +
          '<div class="bagmeta">' +
          '<strong>' + u.name + '</strong>' +
          '<span class="bagstat">等级 ' + l + ' / ' + u.max + '</span>' +
          '<span class="bagdesc">' + (u.desc || '') + '</span>' +
          '</div><span class="bagtag' + (l > 0 ? ' on' : '') + '">' + (l > 0 ? 'Lv.' + l : '未购买') + '</span></div>';
      });
      html += '</div>';
    } else {
      const items = state.items || {};
      const kinds = L ? L.ITEMS.filter(it => (items[it.id] || 0) > 0) : [];
      const totalCount = Object.values(items).reduce((a, b) => a + b, 0);
      html += '<p class="codexsum">收藏 · 已收集 <b>' + kinds.length + ' / ' + (L ? L.ITEMS.length : 0) +
        '</b> 种，共 <b>' + totalCount + '</b> 个</p>';
      if (!kinds.length) {
        html += '<p class="cdnone">还没捡到任何掉落物。切藤壶的时候会随机掉。</p>';
      } else {
        html += '<div class="baglist">';
        kinds.forEach((it) => {
          html += '<div class="bagrow eq"><div class="bagmeta">' +
            '<strong>' + it.name + '</strong>' +
            '<span class="bagdesc">' + (it.desc || '') + '</span>' +
            '</div><span class="bagtag on">×' + items[it.id] + '</span></div>';
        });
        html += '</div>';
      }
    }
    body.innerHTML = html;
    // 武器图标
    const icons = body.querySelectorAll ? body.querySelectorAll('.bagicon') : [];
    const ownIdx2 = R.ownedKnifeIndex(state);
    R.KNIVES.forEach((k, i) => {
      if (i < icons.length && icons[i]) drawKnifeIcon(icons[i], k);
    });
  }
  // 背包里点一下换武器（行是 innerHTML 拼的，所以用内联 onclick 调这个）
  if (typeof window !== 'undefined') {
    window.__bagEquip = function (id) {
      const res = R.equipKnife(state, id);
      if (!res.ok) return;
      SFX.buy();
      updateHud(); renderBag(); renderShop(); persist('换武器');
      if (typeof toast === 'function') toast('已换上 <b>' + res.knife.name + '</b>', 'weapon');
    };
  }

  function bindBagTabs() {
    const bar = el('bagTabs');
    if (!bar || !bar.querySelectorAll) return;
    const btns = bar.querySelectorAll('.stab');
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      if (!b || !b.dataset) continue;
      b.onclick = () => {
        state.bagTab = b.dataset.btab;
        renderBag();
        const body = el('bagBody');
        if (body) body.scrollTop = 0;
      };
    }
  }
  function openBag(from) {
    state.bagFrom = from || state.phase;
    if (state.phase !== 'bag') state.bagPrevPhase = state.phase;
    state.phase = 'bag';                 // 打开背包 = 暂停（氧气不掉）
    renderBag();
    el('bag').classList.add('show');
  }
  function closeBag() {
    el('bag').classList.remove('show');
    // 还原到打开前的阶段（从标题页开的就回标题页，从游戏里开的就继续打）
    state.phase = state.bagPrevPhase || (state.bagFrom === 'title' ? 'title' : 'play');
    if (state.phase === 'title') el('title').classList.add('show');
  }

  // ---------------------------------------------------------------- 图鉴
  // 把某种藤壶「游戏内的样子」画到一个小画布上（用的就是游戏里同一个绘制函数，
  // 所以图鉴里看到的就是你实际会打的那只）
  function drawBarnaclePreview(cv, type) {
    if (!cv || !type) return;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const scale = Math.min(cv.width, cv.height) / 150;
    const fake = {
      id: 'preview', x: 0, y: 0,
      size: 44,
      hp: Math.max(1, Math.round(6 * (type.hpMul || 1))),
      maxHp: Math.max(1, Math.round(6 * (type.hpMul || 1))),
      dead: false, pop: null, hit: 0, hitCount: 0,
      seed: 1234, coins: 1,
      typeId: type.id, typeName: type.name, tintColor: type.tint,
    };
    g.save();
    g.translate(cv.width / 2, cv.height / 2 + 6 * scale);
    g.scale(scale, scale);
    try { drawBarnacle(g, fake); } catch (e) { /* 画不出来也不影响文字 */ }
    g.restore();
  }

  // 图鉴卡片的点击入口（卡片是 innerHTML 拼的，所以用内联 onclick 调这个）
  if (typeof window !== 'undefined') {
    // 打开详情：顺手记住「点的是哪张卡」，让详情从那张卡的位置展开（手机开 App 的感觉）
    window.__codexOpen = function (id, ev) {
      state.codexDetail = id;
      state.codexOrigin = null;
      try {
        const card = ev && ev.currentTarget;
        const body = el('codexBody');
        if (card && body && card.getBoundingClientRect && body.getBoundingClientRect) {
          const a = card.getBoundingClientRect();
          const b = body.getBoundingClientRect();
          if (a.width && b.width) {
            state.codexOrigin = { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top };
          }
        }
      } catch (e) { state.codexOrigin = null; }
      renderCodex();
      const body = el('codexBody');
      if (body) body.scrollTop = 0;          // 打开详情后滚回顶部
    };
    // 返回：让列表从左上角淡回来（反向收缩交给 CSS）
    window.__codexBack = function () {
      state.codexDetail = null;
      state.codexFrom_ = state.codexFrom;
      renderCodex();
      const body = el('codexBody');
      if (body) body.scrollTop = 0;
    };
  }

  function renderCodex() {
    if (!L) return;
    const wrap = el('codexBody');
    if (!wrap) return;
    const tab = state.codexTab || 'types';
    // 页签高亮
    for (const t of ['types', 'items', 'achv', 'hall']) {
      const b = el('tab_' + t);
      if (b) b.classList.toggle('on', t === tab);
    }
    // 注意：filter 会把「种类对象」传进来，所以要取 t.id（原来写成 t，导致收录数永远是 0）
    const owned = (t) => (state.killedByType[t.id] || 0) > 0;

    // ---- 详情页：点开某一个藤壶 ----
    if (state.codexDetail) {
      const t = L.byId(state.codexDetail);
      const c = state.killedByType[t.id] || 0;
      const rar = L.rarityOf ? L.rarityOf(t) : { text: '', pct: 0 };
      const seen = c > 0;
      const lines = [].concat(t.tell || [], t.last || []);
      // 生长原点：有卡片位置就从卡片长出来，没有就居中
      const org = state.codexOrigin;
      const orgStyle = org
        ? ' style="transform-origin:' + Math.round(org.x) + 'px ' + Math.round(org.y) + 'px"'
        : ' style="transform-origin:50% 0%"';
      let d = '<div class="cxdetail cxopen"' + orgStyle + '>';
      d += '<button class="fxbtn backbtn" id="cxBack" onclick="__codexBack()">← 返回图鉴</button>';
      d += '<div class="cdhead">' +
        '<div class="cdpic"><canvas width="230" height="200"></canvas></div>' +
        '<div class="cdinfo">' +
        '<h3>' + t.name + '</h3>' +
        '<p class="cden">' + (t.en || '') + '</p>' +
        '<p class="cdtags"><span class="tagpill" style="border-color:' + t.tint + '">' + t.tag + '</span>' +
        '<span class="tagpill rar' + (rar.text === '稀有' ? ' rare' : '') + '">' + rar.text + ' · ' + rar.pct.toFixed(0) + '%</span>' +
        (t.elite ? '' : '') + '</p>' +
        '<p class="cdcount">已清理 <b>' + c + '</b> 只' + (seen ? '' : '（还没遇到过）') + '</p>' +
        '</div></div>';

      d += '<h4>特殊效果</h4>';
      if (t.effects && t.effects.length) {
        d += '<ul class="cdeffects">' + t.effects.map(e => '<li>' + e + '</li>').join('') + '</ul>';
      } else {
        d += '<p class="cdnone">没有特殊效果 —— 就是一只老老实实的藤壶。</p>';
      }
      if (t.tip) d += '<p class="cdtip">💡 ' + t.tip + '</p>';

      d += '<h4>图鉴条目</h4><p class="cdcodex">' + (seen ? t.codex : '还没遇到过，先把它打出来再来看介绍。') + '</p>';

      if (lines.length) {
        d += '<h4>它会说的话</h4><ul class="cdlines">' +
          lines.map(l => '<li>「' + l + '」</li>').join('') + '</ul>';
      }
      d += '</div>';
      wrap.innerHTML = d;
      const cv = wrap.querySelector('canvas');
      drawBarnaclePreview(cv, t);
      return;
    }

    let html = '';
    if (tab === 'types') {
      const got = L.TYPES.filter(owned).length;
      html += '<p class="codexsum">藤壶图鉴 · 已收录 <b>' + got + ' / ' + L.TYPES.length + '</b></p><div class="codexgrid">';
      for (const t of L.TYPES) {
        const c = state.killedByType[t.id] || 0;
        const seen = c > 0;
        html += '<div class="codexcard clickable' + (seen ? '' : ' locked') + '"' +
          ' onclick="__codexOpen(\'' + t.id + '\', event)" title="点击查看详情">' +
          '<div class="cxhead"><span class="cxdot" style="background:' + t.tint + '"></span>' +
          '<b>' + (seen ? t.name : '？？？') + '</b><em>' + (seen ? t.tag : '未收录') + '</em></div>' +
          (seen
            ? '<p class="cxdesc">' + t.codex + '</p>' +
              (t.tell && t.tell.length ? '<p class="cxline">「' + t.tell[0] + '」</p>' : '') +
              '<p class="cxcount">已清理 ' + c + ' 只 · <span class="cxgo">查看详情 ›</span></p>'
            : '<p class="cxdesc">还没遇到过这种藤壶。</p>') +
          '</div>';
      }
      html += '</div>';
      state.codexDetail = null;
      state.codexOrigin = null;
    } else if (tab === 'items') {
      const got = L.ITEMS.filter(i => (state.items[i.id] || 0) > 0).length;
      html += '<p class="codexsum">掉落物收藏 · 已收集 <b>' + got + ' / ' + L.ITEMS.length + '</b></p><div class="codexgrid">';
      for (const it of L.ITEMS) {
        const c = state.items[it.id] || 0;
        // 有贴图的（比如那顶头发）直接显示图片，比 emoji 直观
        const thumb = (it.pic === 'hair' && A.hairSrc)
          ? '<img class="cxthumb" src="' + A.hairSrc + '" alt="">'
          : '<span class="cxicon">' + (c ? it.icon : '❔') + '</span>';
        html += '<div class="codexcard' + (c ? '' : ' locked') + '">' +
          '<div class="cxhead">' + thumb +
          '<b>' + (c ? it.name : '？？？') + '</b><em>' + (c ? '×' + c : '未获得') + '</em></div>' +
          '<p class="cxdesc">' + (c ? it.codex : '还没捡到过。') + '</p></div>';
      }
      html += '</div>';
    } else if (tab === 'hall') {
      // 名人堂：按击杀数排行，记录它最经典的一句话
      const rows = L.TYPES
        .map(t => ({ t, c: state.killedByType[t.id] || 0 }))
        .filter(x => x.c > 0)
        .sort((a, b) => b.c - a.c);
      if (!rows.length) {
        html += '<p class="codexsum">名人堂还空着。先去清理几只再说。</p>';
      } else {
        html += '<p class="codexsum">名人堂 · 已收录 <b>' + rows.length + '</b> 种，共清理 <b>' +
          rows.reduce((a, x) => a + x.c, 0) + '</b> 只</p><div class="halllist">';
        rows.forEach((x, i) => {
          const line = (x.t.tell && x.t.tell[0]) || (x.t.last && x.t.last[0]) || '（它什么也没说）';
          html += '<div class="hallrow">' +
            '<span class="hrank' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span>' +
            '<span class="hdot" style="background:' + x.t.tint + '"></span>' +
            '<span class="hname">' + x.t.name + '</span>' +
            '<span class="hline">「' + line + '」</span>' +
            '<span class="hcount">' + x.c + ' 只</span>' +
            '</div>';
        });
        html += '</div>';
      }
    } else {
      const got = state.achievements.length;
      html += '<p class="codexsum">成就 · 已解锁 <b>' + got + ' / ' + L.ACHIEVEMENTS.length + '</b></p><div class="codexgrid">';
      for (const a of L.ACHIEVEMENTS) {
        const yes = state.achievements.includes(a.id);
        html += '<div class="codexcard' + (yes ? ' got' : ' locked') + '">' +
          '<div class="cxhead"><span class="cxicon">' + (yes ? '🏆' : '🔒') + '</span>' +
          '<b>' + a.name + '</b></div>' +
          '<p class="cxdesc">' + a.desc + '</p></div>';
      }
      html += '</div>';
    }
    wrap.innerHTML = html;
  }

  function openCodex() {
    state.codexFrom = state.phase;
    state.codexDetail = null;
    state.phase = 'codex';
    renderCodex();
    el('codex').classList.add('show');
  }
  function closeCodex() {
    el('codex').classList.remove('show');
    // 从商店打开就回商店，从标题打开就回标题
    state.phase = state.codexFrom === 'shop' ? 'shop' : 'title';
  }

  // ---------------------------------------------------------------- 战绩图
  // 把这一局的成绩画成一张可以保存分享的图
  function buildReport() {
    const cv = document.createElement('canvas');
    cv.width = 720; cv.height = 480;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 720, 480);
    bg.addColorStop(0, '#0B1B36'); bg.addColorStop(1, '#16305C');
    g.fillStyle = bg; g.fillRect(0, 0, 720, 480);
    // 边框
    g.strokeStyle = 'rgba(150,190,255,0.4)'; g.lineWidth = 3;
    g.strokeRect(14, 14, 692, 452);
    g.textAlign = 'left';
    g.fillStyle = '#9FC4F5';
    g.font = '600 17px system-ui, sans-serif';
    g.fillText('鲸鱼搓澡店 · 战绩', 40, 58);
    g.fillStyle = '#FFFFFF';
    g.font = '800 40px system-ui, sans-serif';
    g.fillText('第 ' + state.round + ' 波', 40, 116);
    // 数据
    const rows = [
      ['本局金币', String(scoreOfRun())],
      ['本机最高分', String(state.bestScore || 0)],
      ['武器', R.knifeById(state.knifeId).name],
      ['图鉴', L ? (L.TYPES.filter(t => (state.killedByType[t.id] || 0) > 0).length + '/' + L.TYPES.length) : '-'],
      ['掉落物', L ? (L.ITEMS.filter(i => (state.items[i.id] || 0) > 0).length + '/' + L.ITEMS.length) : '-'],
      ['成就', L ? (state.achievements.length + '/' + L.ACHIEVEMENTS.length) : '-'],
    ];
    g.font = '600 19px system-ui, sans-serif';
    rows.forEach((r, i) => {
      const y = 178 + i * 36;
      g.fillStyle = '#8AA6CC'; g.fillText(r[0], 40, y);
      g.fillStyle = '#FFD45E'; g.fillText(r[1], 250, y);
    });
    // 吐槽
    const pool = (state.round >= 8) ? L.REPORT_LINES.good : L.REPORT_LINES.dead;
    const line = pool[Math.floor(Math.random() * pool.length)];
    g.fillStyle = '#DCE8FF';
    g.font = '600 21px system-ui, sans-serif';
    g.fillText('「' + line + '」', 40, 412);
    g.fillStyle = '#7E97BC';
    g.font = '500 15px system-ui, sans-serif';
    g.fillText('大肥鱼：谢谢你，下次带个电锯来吧。', 40, 444);
    return cv;
  }

  function showReport() {
    const cv = buildReport();
    const holder = el('reportShot');
    if (!holder) return;
    state.reportFrom = state.phase;
    state.phase = 'report';
    holder.innerHTML = '';
    holder.appendChild(cv);
    const a = el('reportSave');
    if (a) {
      try {
        a.href = cv.toDataURL('image/png');
        a.download = 'whale-spa-wave' + state.round + '.png';
      } catch (e) { /* 某些环境不允许导出，忽略 */ }
    }
    el('report').classList.add('show');
  }
  function closeReport() {
    el('report').classList.remove('show');
    state.phase = state.reportFrom === 'title' ? 'title' : 'shop';
  }

  // ---------------------------------------------------------------- 热搜榜
  function renderTrending() {
    const box = el('trendList');
    if (!box || !L) return;
    const acc = {
      items: state.items || {}, killedByType: state.killedByType || {},
      achievements: state.achievements || [], bestScore: state.bestScore || 0,
      maxRound: state.maxRound || 1, totalCoins: state.totalCoins || 0,
    };
    const run = state.run || { killed: {}, items: {}, gained: 0 };
    const list = L.buildTrending(acc, run);
    box.innerHTML = list.map(t =>
      '<div class="trendrow">' +
      '<span class="trank' + (t.rank <= 3 ? ' hot' : '') + '">' + t.rank + '</span>' +
      '<span class="ttext">' + t.text + '</span>' +
      '<span class="theat">' + (t.heat >= 10000 ? (t.heat / 10000).toFixed(1) + '万' : t.heat) + '</span>' +
      '</div>'
    ).join('');
  }

  // ---------------------------------------------------------------- 抽卡
  // 穿刺武器是抽卡专属，所以抽卡是拿到剑的唯一途径 —— 价格贵、爆率低、有保底
  const GACHA_COST = { one: 150, ten: 1350 };
  const GACHA_RATE = { N: 45, R: 34, SR: 18, SSR: 3 };   // 百分比（合计 100）
  const SSR_PITY = 20;                                     // 连续 20 抽不出 SSR 就必出
  function rollRarity(forceMin) {
    const pool = ['N', 'R', 'SR', 'SSR'].filter(k => !forceMin || ['SR', 'SSR'].includes(k));
    const total = pool.reduce((a, k) => a + GACHA_RATE[k], 0);
    let r = Math.random() * total;
    for (const k of pool) { r -= GACHA_RATE[k]; if (r <= 0) return k; }
    return pool[pool.length - 1];
  }
  // 只出穿刺武器的池子（绝不包含普通武器）
  function thrustPool() {
    const ownIdx = R.ownedKnifeIndex(state);   // 看"拥有上限"，不看当前装备
    return R.KNIVES
      .map((k, i) => ({ k, i }))
      .filter(x => (x.k.kind || 'throw') === 'thrust' && x.i > ownIdx)
      .map(x => x.k);
  }
  // 抽一次：返回 { rarity, label, kind }
  function drawOnce(forceMin) {
    let rar = rollRarity(forceMin);
    // 保底：连着抽太多次没出 SSR，这一次强制 SSR
    state.gachaPity = (state.gachaPity || 0) + 1;
    if (state.gachaPity >= SSR_PITY) rar = 'SSR';
    if (rar === 'SSR') state.gachaPity = 0;
    const notOwned = thrustPool();     // ★ 只可能是穿刺武器，普通武器绝不会出现
    // 注意：纯金币的返还【必须低于单抽成本】，否则玩家可以靠抽卡无限刷钱。
    if (rar === 'SSR') {
      if (notOwned.length) {
        // 从最接近当前档位的那把开始给，保证是稳步变强而不是跳级
        const pick = notOwned[0];
        state.knifeId = pick.id;
        state.maxKnifeId = pick.id;
        return { rarity: rar, label: '穿刺武器 · ' + pick.name, kind: 'knife', coins: 0 };
      }
      state.coins += 300;
      return { rarity: rar, label: '穿刺武器全齐了，折现 300 金币', kind: 'coin', coins: 300 };
    }
    if (rar === 'SR') {
      const noPerk = R.PERKS.filter(p => !(state.perks || []).includes(p.id));
      const upg = R.UPGRADES.filter(u => (state.upgrades[u.id] || 0) < u.max);
      if (noPerk.length && (Math.random() < 0.5 || !upg.length)) {
        const p = noPerk[Math.floor(Math.random() * noPerk.length)];
        state.perks = (state.perks || []).concat([p.id]);
        return { rarity: rar, label: '特质 · ' + p.name, kind: 'perk', coins: 0 };
      }
      if (upg.length) {
        const u = upg[Math.floor(Math.random() * upg.length)];
        state.upgrades[u.id] = (state.upgrades[u.id] || 0) + 1;
        return { rarity: rar, label: '道具 · ' + u.name + ' Lv.' + state.upgrades[u.id], kind: 'upgrade', coins: 0 };
      }
      state.coins += 60;
      return { rarity: rar, label: '都满了，折现 60 金币', kind: 'coin', coins: 60 };
    }
    if (rar === 'R') {
      state.coins += 35;
      return { rarity: rar, label: '35 金币', kind: 'coin', coins: 35 };
    }
    state.coins += 12;
    return { rarity: rar, label: '12 金币', kind: 'coin', coins: 12 };
  }

  function doGacha(times) {
    const cost = times === 10 ? GACHA_COST.ten : GACHA_COST.one;
    if (state.coins < cost) { toast('金币不够', '需要 🪙' + cost); return; }
    state.coins -= cost;
    const results = [];
    for (let i = 0; i < times; i++) {
      // 十连保底：第 10 抽至少 SR
      const forceMin = times === 10 && i === times - 1 && !results.some(r => r.rarity === 'SR' || r.rarity === 'SSR');
      results.push(drawOnce(forceMin));
    }
    state.gachaLog = results.concat(state.gachaLog || []).slice(0, 20);
    const best = results.reduce((a, r) => {
      const order = { N: 0, R: 1, SR: 2, SSR: 3 };
      return order[r.rarity] > order[a.rarity] ? r : a;
    }, results[0]);
    SFX.arp(best.rarity === 'SSR' ? [784, 988, 1318, 1568] : [523, 659, 784], 80, 0.2, 'triangle', 0.16);
    renderGacha();
    renderShop();
    updateHud();
    persist('抽卡');
  }

  function renderGacha() {
    const box = el('gachaLog');
    if (!box) return;
    // 保底进度 + 还剩几把穿刺武器没拿到
    const pity = el('gachaPity');
    if (pity) {
      const p = state.gachaPity || 0;
      const left = Math.max(0, SSR_PITY - p);
      const swords = thrustPool().length;
      pity.innerHTML = '保底进度 <b>' + p + ' / ' + SSR_PITY + '</b>　·　' +
        (swords > 0 ? '还没拿到的穿刺武器 <b>' + swords + '</b> 把' : '<b>穿刺武器已全齐</b>') +
        (left > 0 ? '　·　再抽 ' + left + ' 次必出 SSR' : '　·　<b>下一抽必出 SSR</b>');
    }
    const log = (state.gachaLog || []).slice(0, 12);
    const allOwned = thrustPool().length === 0
      && R.PERKS.every(p => (state.perks || []).includes(p.id))
      && R.UPGRADES.every(u => (state.upgrades[u.id] || 0) >= u.max);
    const tip = allOwned
      ? '<div class="gempty">所有穿刺武器/特质/道具都满了 —— 现在抽卡只能换金币，会亏。</div>'
      : '';
    box.innerHTML = tip + (log.map((r, i) => {
      const c = (L.RARITY[r.rarity] || {}).color || '#9AA7B8';
      return '<div class="grow' + (i === 0 ? ' fresh' : '') + '" style="border-color:' + c + '">' +
        '<b style="color:' + c + '">' + r.rarity + '</b><span>' + r.label + '</span></div>';
    }).join('') || '<div class="gempty">还没抽过。剑只能从这里出。</div>');
  }

  // ---------------------------------------------------------------- 结局
  function openEnding() {
    state.phase = 'ending';
    const lines = L.ENDING.lines.map(t => '<p>' + t + '</p>').join('');
    const sum = el('endingStats');
    if (sum) {
      const rows = [
        ['清理波数', state.round],
        ['本机最高分', state.bestScore || 0],
        ['累计金币', state.totalCoins || 0],
        ['藤壶图鉴', Object.keys(state.killedByType || {}).length + ' / ' + L.TYPES.length],
        ['掉落物', L.ITEMS.filter(i => (state.items[i.id] || 0) > 0).length + ' / ' + L.ITEMS.length],
        ['成就', state.achievements.length + ' / ' + L.ACHIEVEMENTS.length],
      ];
      sum.innerHTML = rows.map(r => '<div class="erow"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    }
    const t = el('endingTitle');
    if (t) t.textContent = L.ENDING.title;
    const b = el('endingText');
    if (b) b.innerHTML = lines;
    const u = el('endingUnlock');
    if (u) u.textContent = L.ENDING.afterUnlock;
    el('ending').classList.add('show');
    SFX.arp([523, 659, 784, 1046, 1318], 160, 0.35, 'triangle', 0.18);
  }
  function closeEnding() {
    el('ending').classList.remove('show');
    state.gameCleared = true;
    state.endless = true;
    persist('通关');
    openShop();
  }

  // ---- 商店页签：热搜 / 抽卡 / 武器 / 特质 / 道具 ----
  const SHOP_TABS = ['trend', 'gacha', 'knife', 'perk', 'up'];
  function applyShopTab() {
    const t = SHOP_TABS.indexOf(state.shopTab) >= 0 ? state.shopTab : 'trend';
    state.shopTab = t;
    const scroll = el('shopScroll');
    if (scroll && scroll.dataset) scroll.dataset.active = t;
    const bar = el('shopTabs');
    if (bar && bar.querySelectorAll) {
      const btns = bar.querySelectorAll('.stab');
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        if (b && b.classList && b.dataset) b.classList.toggle('on', b.dataset.stab === t);
      }
    }
    if (scroll) scroll.scrollTop = 0;
  }
  function setShopTab(t) { state.shopTab = t; applyShopTab(); }
  function bindShopTabs() {
    const bar = el('shopTabs');
    if (!bar || !bar.querySelectorAll) return;
    const btns = bar.querySelectorAll('.stab');
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      if (!b || !b.dataset) continue;
      b.onclick = () => setShopTab(b.dataset.stab);
    }
  }

  function openShop() {
    state.phase = 'shop';
    renderShop();
    el('shop').classList.add('show');
    applyShopTab();
    // 入侵清除度
    const cleared = Math.max(0, (state.maxRound || state.round) - 1);
    const pct = invasionPct(cleared);
    const inv = el('invasion');
    if (inv) {
      const fill = el('invFill');
      if (fill) fill.style.width = pct + '%';
      const p = el('invPct');
      if (p) p.textContent = pct + '%';
      const sub = el('invSub');
      if (sub) {
        sub.textContent = pct >= 100
          ? `已清理 ${cleared} 波 · 入侵已压制，但你感觉它们还会回来`
          : `已清理 ${cleared} / ${INVASION_TOTAL_WAVES} 波 · 大肥鱼还在等你`;
      }
      inv.classList.toggle('full', pct >= 100);
    }
    // 内容层：进商店时金币已经飞完了，这时候才是结算最高分/成就的正确时机
    checkAchievements(true);
    commitScore();
    const bi = el('bestInfo');
    if (bi) bi.textContent = '本机最高分：' + (state.bestScore || 0);
    renderTrending();
    renderGacha();
    // 鼠标滚轮 / 方向键滚动商店内容（商品变多了，一屏放不下）
    const sc = el('shopScroll');
    if (sc) sc.scrollTop = 0;
  }
  function closeShop() { el('shop').classList.remove('show'); }

  // 剧情弹窗：显示 / 关闭
  function openStory(round) {
    const s = storyFor(round);
    if (!s) return false;
    state.phase = 'story';
    const w = el('storyWave');
    if (w) w.textContent = `第 ${round} 波`;
    const t = el('storyTitle');
    if (t) t.textContent = s.title;
    const x = el('storyText');
    if (x) x.textContent = s.text;
    el('story').classList.add('show');
    return true;
  }
  function closeStory() {
    el('story').classList.remove('show');
    state.phase = 'play';
    persist('剧情');
  }

  // 商店滚动：滚轮 + 上下键 + PageUp/PageDown + Home/End
  function bindShopScroll() {
    const sc = el('shopScroll');
    if (!sc) return;
    sc.addEventListener('wheel', (e) => {
      // 内容没超出时不用管；超出时自己滚（避免滚到外面把页面滚走）
      if (sc.scrollHeight > sc.clientHeight) {
        sc.scrollTop += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (state.phase !== 'shop') return;
      const step = 90;
      switch (e.key) {
        case 'ArrowDown': sc.scrollTop += step; e.preventDefault(); break;
        case 'ArrowUp': sc.scrollTop -= step; e.preventDefault(); break;
        case 'PageDown': sc.scrollTop += sc.clientHeight * 0.9; e.preventDefault(); break;
        case 'PageUp': sc.scrollTop -= sc.clientHeight * 0.9; e.preventDefault(); break;
        case 'Home': sc.scrollTop = 0; e.preventDefault(); break;
        case 'End': sc.scrollTop = sc.scrollHeight; e.preventDefault(); break;
        default: break;
      }
    });
  }

  function renderShop() {
    const wallet = el('shopCoins');
    wallet.textContent = state.coins;
    const kList = el('knifeList');
    kList.innerHTML = '';
    const ownIdx = R.ownedKnifeIndex(state);
    const eqIdx = R.KNIVES.findIndex(k => k.id === state.knifeId);
    // 穿刺类武器（剑/电锯/大藤壶）是抽卡专属，商店不卖 —— 这里过滤掉，
    // 但保留它在 KNIVES 里的原始索引，用来判断"是否已拥有"。
    R.KNIVES.map((k, i) => ({ k, i }))
      .filter(x => (x.k.kind || 'throw') !== 'thrust')
      .forEach(({ k, i }) => {
      const owned = i <= ownIdx;
      const equipped = k.id === state.knifeId;
      const isSword = (k.kind || 'throw') === 'thrust';
      const card = document.createElement('button');
      card.className = 'card' + (owned ? ' owned' : '') + (equipped ? ' current' : '') + (isSword ? ' sword' : '');
      card.innerHTML = `
        <canvas width="140" height="72"></canvas>
        <div class="meta">
          <strong>${k.name}${isSword ? ' ⚔' : ''}</strong>
          <span class="en">${k.en}${isSword ? ' · 直刺贯穿' : ''}</span>
          <span class="stat">伤害 ${k.damage} · 冷却 ${k.cooldown.toFixed(2)}s${isSword ? ` · 贯穿 ${k.pierce >= 99 ? '无限' : k.pierce + ' 个'}` : ''}</span>
          <span class="desc">${k.desc}</span>
        </div>
        <div class="price">${equipped ? '使用中' : (owned ? '已拥有' : '🪙 ' + k.cost)}</div>`;
      drawKnifeIcon(card.querySelector('canvas'), k);
      if (!owned && state.coins >= k.cost) card.classList.add('afford');
      // 已拥有但没装备 → 点了就换上；没买 → 点了就买
      card.disabled = equipped;
      card.onclick = () => {
        if (!owned) {
          const res = R.purchase(state, 'knife', k.id);
          if (res.ok) { SFX.buy(); updateHud(); renderShop(); renderBag(); persist(); }
          return;
        }
        const res = R.equipKnife(state, k.id);
        if (res.ok) {
          SFX.buy(); updateHud(); renderShop(); renderBag(); persist('换武器');
          if (typeof toast === 'function') toast('已换上 <b>' + k.name + '</b>', 'weapon');
        }
      };
      kList.appendChild(card);
    });

    // 特质
    const pList = el('perkList');
    if (pList) {
      pList.innerHTML = '';
      R.PERKS.forEach((p) => {
        const owned = (state.perks || []).includes(p.id);
        const card = document.createElement('button');
        card.className = 'card perk' + (owned ? ' owned' : '');
        card.innerHTML = `
          <div class="meta">
            <strong>${p.name}</strong>
            <span class="en">${p.en}</span>
            <span class="desc">${p.desc}</span>
          </div>
          <div class="price">${owned ? '已拥有' : '🪙 ' + p.cost}</div>`;
        if (!owned && state.coins >= p.cost) card.classList.add('afford');
        card.disabled = owned;
        card.onclick = () => {
          const res = R.purchase(state, 'perk', p.id);
          if (res.ok) { SFX.perk(); updateHud(); renderShop(); persist(); }
        };
        pList.appendChild(card);
      });
    }

    const uList = el('upgradeList');
    uList.innerHTML = '';
    R.UPGRADES.forEach((u) => {
      const have = state.upgrades[u.id] || 0;
      const cost = R.upgradeCost(state, u.id);
      const maxed = cost === null;
      const card = document.createElement('button');
      card.className = 'card up' + (maxed ? ' owned' : '');
      card.innerHTML = `
        <div class="meta">
          <strong>${u.name} <em>${have}/${u.max}</em></strong>
          <span class="en">${u.en}</span>
          <span class="desc">${u.desc}</span>
        </div>
        <div class="price">${maxed ? '已满级' : '🪙 ' + cost}</div>`;
      if (!maxed && state.coins >= cost) card.classList.add('afford');
      card.disabled = maxed;
      card.onclick = () => {
        const res = R.purchase(state, 'upgrade', u.id);
        if (res.ok) { SFX.buy(); updateHud(); renderShop(); persist(); }
      };
      uList.appendChild(card);
    });
  }

  function drawKnifeIcon(cv, knife) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const isSword = (knife.kind || 'throw') === 'thrust';
    g.save();
    g.translate(cv.width / 2, cv.height / 2);
    g.rotate(isSword ? -0.25 : -0.35);
    const L = isSword ? 54 + knife.blade * 0.16 : 30 + knife.blade * 0.55;
    if (isSword) {
      // 剑：细长直刃 + 护手 + 剑柄 + 剑柄头
      const grad = g.createLinearGradient(0, -8, 0, 8);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.45, '#DCE6F5');
      grad.addColorStop(1, '#8E9BB0');
      g.beginPath();
      g.moveTo(-L * 0.06, -5);
      g.lineTo(L * 0.82, -3.2);
      g.lineTo(L * 1.0, 0);
      g.lineTo(L * 0.82, 3.2);
      g.lineTo(-L * 0.06, 5);
      g.closePath();
      g.fillStyle = grad; g.fill();
      g.strokeStyle = 'rgba(30,40,60,0.55)'; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = '#D9BE85';
      g.beginPath(); g.roundRect(-L * 0.09, -11, 4, 22, 2); g.fill();
      g.fillStyle = '#43325A';
      g.beginPath(); g.roundRect(-L * 0.44, -4, L * 0.34, 8, 3); g.fill();
      g.fillStyle = '#D9BE85';
      g.beginPath(); g.arc(-L * 0.46, 0, 4, 0, Math.PI * 2); g.fill();
      // 剑光
      g.globalAlpha = 0.5;
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-L * 0.2, -12); g.lineTo(L * 0.7, -6); g.stroke();
      g.globalAlpha = 1;
    } else {
      g.beginPath();
      g.moveTo(-L * 0.12, -L * 0.15);
      g.lineTo(L * 0.62, -L * 0.10);
      g.lineTo(L * 0.80, 0);
      g.lineTo(L * 0.62, L * 0.10);
      g.lineTo(-L * 0.12, L * 0.15);
      g.closePath();
      const bg = g.createLinearGradient(0, -12, 0, 12);
      bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(0.5, '#D7DEEA'); bg.addColorStop(1, '#8E9BB0');
      g.fillStyle = bg; g.fill();
      g.strokeStyle = 'rgba(20,30,50,0.6)'; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#6B4A2F';
      g.beginPath(); g.roundRect(-L * 0.62, -L * 0.11, L * 0.5, L * 0.22, L * 0.06); g.fill();
      g.fillStyle = '#D9BE85';
      g.fillRect(-L * 0.14, -L * 0.19, 5, L * 0.38);
    }
    g.restore();
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    resize();
    window.addEventListener('resize', resize);
    bindShopTabs();
    bindBagTabs();

    // 标题页的头像：用新角色图
    const portrait = el('portrait');
    if (portrait) portrait.src = A.avatarSrc;

    // ---- 存档：读出来，决定标题页显示"继续"还是"开始新游戏" ----
    // 没存档时：触摸设备默认给手机模式（用户随时能切回来）
    const coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || ('ontouchstart' in window);
    if (coarse) state.inputMode = 'touch';

    const loaded = Save ? Save.load() : { ok: false, data: null };
    const saveInfo = el('saveInfo');
    const btnContinue = el('btnContinue');
    const btnWipe = el('btnWipe');
    if (loaded.ok && loaded.data) {
      applySave(loaded.data);
      if (saveInfo) {
        const knife = R.knifeById(loaded.data.knifeId);
        const perks = (loaded.data.perks || []).map(id => (R.perkById(id) || {}).name).filter(Boolean);
        saveInfo.innerHTML = `发现存档：最高到第 <b>${loaded.data.maxRound}</b> 关 · ${loaded.data.coins} 金币 · 武器 <b>${knife.name}</b>` +
          (perks.length ? ` · 特质 ${perks.join('、')}` : '');
      }
      if (btnContinue) btnContinue.classList.remove('hidden');
      if (btnWipe) btnWipe.classList.remove('hidden');
    } else {
      if (saveInfo) saveInfo.textContent = '还没有存档，开始新游戏吧（进度会自动保存）';
    }

    // 音效开关
    const btnSound = el('btnSound');
    function refreshSoundBtn() {
      if (!btnSound) return;
      btnSound.textContent = SFX.isEnabled() ? '🔊' : '🔇';
      btnSound.title = SFX.isEnabled() ? '音效开（点击关闭）' : '音效关（点击打开）';
    }
    refreshSoundBtn();
    if (btnSound) {
      btnSound.onclick = () => {
        SFX.setEnabled(!SFX.isEnabled());
        refreshSoundBtn();
        if (SFX.isEnabled()) { SFX.unlock(); SFX.buy(); }
        persist('音效开关');
      };
    }

    // 开发者按钮：只在地址栏带 ?dev=1 时出现，普通玩家看不到
    const btnDev = el('btnDev');
    if (btnDev) {
      const isDev = /(^|[?&])dev=1(&|$)/.test((window.location && window.location.search) || '');
      if (isDev) {
        btnDev.classList.remove('hidden');
        btnDev.onclick = () => { window.open('dev.html', '_blank'); };
      }
    }

    // ---- 操作模式：PC / 手机 ----
    const MODE_NAME = { pc: '电脑', touch: '手机' };
    const MODE_TIP = {
      pc: '电脑：鼠标指向哪就朝哪打，按下即发射',
      touch: '手机：拖动瞄准，松手发射（按钮也放大了）',
    };
    function applyMode() {
      const t = state.inputMode === 'touch';
      if (document.body && document.body.classList) document.body.classList.toggle('mode-touch', t);
      const b = el('btnMode');
      if (b) {
        b.textContent = t ? '👆' : '🖱';
        b.title = '当前：' + MODE_NAME[state.inputMode] + '模式（点击切换）· ' + MODE_TIP[state.inputMode];
      }
      const info = el('modeInfo');
      if (info) info.textContent = MODE_TIP[state.inputMode];

      for (const [id, mode] of [['btnModePc', 'pc'], ['btnModeTouch', 'touch']]) {
        const btn = el(id);
        if (btn) btn.classList.toggle('on', state.inputMode === mode);
      }
      // 手机模式给 body 加个类，方便 CSS 把面板排成单列（不改游戏逻辑）
      if (document.body && document.body.classList) {
        document.body.classList.toggle('ui-touch', t);
      }
    }
    function setMode(m) {
      state.inputMode = (m === 'touch') ? 'touch' : 'pc';
      applyMode();
      persist('操作模式');
    }
    const bm = el('btnMode');
    if (bm) bm.onclick = () => setMode(state.inputMode === 'touch' ? 'pc' : 'touch');
    const bp = el('btnModePc'); if (bp) bp.onclick = () => setMode('pc');
    const bt = el('btnModeTouch'); if (bt) bt.onclick = () => setMode('touch');
    // 竖屏提示上的「先用电脑模式」：手机上竖屏时被提示盖住也能逃出来


    // 竖屏/横屏切换时重新算布局（手机版竖屏是原生支持的，不需要旋转）
    window.addEventListener('resize', () => { resize(); });
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    applyMode();

    // 光污染开关：关闭 → 标准 → 拉满 → 关闭…
    const btnFx = el('btnFx');
    function refreshFxBtn() {
      if (!btnFx) return;
      const l = fxLevel();
      btnFx.textContent = FX_LABEL[l];
      btnFx.title = `光污染：${FX_NAME[l]}（点击切换 关闭 / 标准 / 拉满）`;
      btnFx.classList.toggle('off', l === 'off');
      const info = el('fxInfo');
      if (info) info.textContent = `光污染：${FX_NAME[l]}`;
    }
    refreshFxBtn();
    if (btnFx) {
      btnFx.onclick = () => {
        const i = FX_LEVELS.indexOf(fxLevel());
        state.fx = FX_LEVELS[(i + 1) % FX_LEVELS.length];
        // 立刻清掉残留特效，切换是马上生效的
        state.flashes.length = 0;
        state.impactRings.length = 0;
        state.flashScreen = 0;
        state.shake = 0;
        refreshFxBtn();
        persist('光污染开关');
      };
    }
    // 标题页的三档按钮
    const fxButtons = ['btnFxTitle', 'btnFxTitle2', 'btnFxTitle3'].map(el).filter(Boolean);
    function refreshFxButtons() {
      for (const b of fxButtons) b.classList.toggle('on', b.dataset.fx === fxLevel());
      refreshFxBtn();
    }
    for (const b of fxButtons) {
      b.onclick = () => {
        state.fx = b.dataset.fx;
        state.flashes.length = 0;
        state.impactRings.length = 0;
        state.flashScreen = 0;
        state.shake = 0;
        refreshFxButtons();
        persist('光污染档位');
      };
    }
    refreshFxButtons();

    function beginGame(fromRound) {
      el('title').classList.remove('show');
      SFX.unlock();
      state.combo = 0;
      state.perks = state.perks || [];
      updateHud();
      startRound(fromRound || 1);
      persist('开始');
    }

    el('btnStart').onclick = () => {
      // 新游戏：清空进度（剧情也重置，可以重新看一遍）
      state.coins = 0; state.totalCoins = 0;
      state.knifeId = 'rusty';
      state.maxKnifeId = 'rusty';
      state.upgrades = { wide: 0, crit: 0, magnet: 0, gloves: 0, tank: 0 };
      state.perks = [];
      state.storySeen = [];
      state.maxRound = 1;
      beginGame(1);
    };
    if (btnContinue) {
      btnContinue.onclick = () => {
        const d = Save ? Save.load() : { ok: false };
        if (d.ok) applySave(d.data);
        beginGame((state.maxRound || 1));
      };
    }
    // 一键删除存档：彻底重置，连成就 / 收集物 / 图鉴 / 最高分 / 通关记录一起清掉
    function wipe() {
      if (typeof confirm === 'function' &&
        !confirm('确定删除存档？\n\n这会重置所有东西：\n金币、武器、道具、特质、成就、\n掉落物收集、藤壶图鉴、最高分、通关记录。\n删掉之后无法恢复。')) return;
      if (Save) Save.clear();
      // ---- 进度 ----
      state.coins = 0; state.totalCoins = 0;
      state.knifeId = 'rusty';
      state.maxKnifeId = 'rusty';
      state.upgrades = { wide: 0, crit: 0, magnet: 0, gloves: 0, tank: 0 };
      state.perks = [];
      state.storySeen = [];
      state.maxRound = 1;
      // ---- 收集 / 成就 / 记录（原来漏了这几项，所以"删档"之后成就和图鉴还留着）----
      state.items = {};
      state.killedByType = {};
      state.achievements = [];
      state.bestScore = 0;
      state.gameCleared = false;
      state.endless = false;
      state.gachaPity = 0;
      state.gachaLog = [];
      state.run = null;
      state.round = 1;          // ★ 也要重置当前关号，否则删完档点「下一关」会接着老进度打
      // ---- 界面：关掉所有弹层，回到标题页重新开始 ----
      const toastBox = el('toast');
      if (toastBox) toastBox.innerHTML = '';
      closeShop();
      const cvCodex = el('codex'); if (cvCodex) cvCodex.classList.remove('show');
      const cvReport = el('report'); if (cvReport) cvReport.classList.remove('show');
      const cvEnding = el('ending'); if (cvEnding) cvEnding.classList.remove('show');
      const cvStory = el('story'); if (cvStory) cvStory.classList.remove('show');
      const cvTitle = el('title'); if (cvTitle) cvTitle.classList.add('show');
      state.phase = 'title';
      const msg = '存档已删除（金币、武器、成就、收集物、图鉴、最高分都已重置）。回到标题页重新开始。';
      if (saveInfo) {
        saveInfo.textContent = msg;
      }
      if (btnContinue) btnContinue.classList.add('hidden');
      if (btnWipe) btnWipe.classList.add('hidden');
      const ss = el('saveState');
      if (ss) ss.textContent = msg;
      const best = el('bestInfo');
      if (best) best.textContent = '本机最高分：0';
      updateHud();
      // 不再回写空档：Save.clear() 已经把 key 删掉，重新打开页面就是「还没有存档」
    }
    if (btnWipe) btnWipe.onclick = wipe;
    const btnWipe2 = el('btnWipe2');
    if (btnWipe2) btnWipe2.onclick = wipe;

    // 背包入口：HUD 图标 + 商店底部 + 标题页
    const bagEntry = (id, from) => {
      const b = el(id);
      if (b) b.onclick = () => { SFX.unlock(); openBag(from); };
    };
    bagEntry('btnBag', 'play');
    bagEntry('btnBagShop', 'shop');
    bagEntry('btnBagTitle', 'title');
    const btnBagClose = el('btnBagClose');
    if (btnBagClose) btnBagClose.onclick = () => closeBag();

    el('btnResume').onclick = () => {
      closeShop();
      SFX.unlock();
      startRound(state.round + 1);
      persist('下一关');
    };
    const btnStory = el('btnStory');
    if (btnStory) btnStory.onclick = () => { SFX.buy(); closeStory(); };

    // ---- 内容层：图鉴 / 战绩图 / 页签 ----
    function refreshBest() {
      const b = el('bestInfo');
      if (b) b.textContent = '本机最高分：' + (state.bestScore || 0);
      const cc = el('codexCoins');
      if (cc) cc.textContent = state.coins;
    }
    const openCodexBtn = (id, from) => {
      const b = el(id);
      if (b) b.onclick = () => { state.codexFrom = from; openCodex(); refreshBest(); };
    };
    openCodexBtn('btnCodexTitle', 'title');
    openCodexBtn('btnCodex', 'shop');
    openCodexBtn('btnAchvTitle', 'title');
    const btnAchv = el('btnAchvTitle');
    if (btnAchv) btnAchv.onclick = () => { state.codexFrom = 'title'; state.codexTab = 'achv'; openCodex(); refreshBest(); };
    const btnCodexTitle = el('btnCodexTitle');
    if (btnCodexTitle) btnCodexTitle.onclick = () => { state.codexFrom = 'title'; state.codexTab = 'types'; openCodex(); refreshBest(); };
    const btnCodexShop = el('btnCodex');
    if (btnCodexShop) btnCodexShop.onclick = () => { state.codexFrom = 'shop'; state.codexTab = 'types'; openCodex(); refreshBest(); };

    for (const t of ['types', 'items', 'achv', 'hall']) {
      const b = el('tab_' + t);
      if (b) b.onclick = () => { state.codexTab = t; state.codexDetail = null; renderCodex(); };
    }
    const bg1 = el('btnGacha1'); if (bg1) bg1.onclick = () => doGacha(1);
    const bg10 = el('btnGacha10'); if (bg10) bg10.onclick = () => doGacha(10);
    const be = el('btnEnding'); if (be) be.onclick = () => closeEnding();
    const bc = el('btnCodexClose');
    if (bc) bc.onclick = () => { closeCodex(); refreshBest(); };
    const br = el('btnReport');
    if (br) br.onclick = () => { commitScore(); showReport(); refreshBest(); };
    const brc = el('btnReportClose');
    if (brc) brc.onclick = closeReport;
    refreshBest();
    el('btnRestart').onclick = () => {
      closeShop();
      state.phase = 'title';
      const d = Save ? Save.load() : { ok: false };
      if (btnContinue) btnContinue.classList.toggle('hidden', !d.ok);
      if (btnWipe) btnWipe.classList.toggle('hidden', !d.ok);
      if (d.ok && saveInfo) {
        saveInfo.innerHTML = `存档：最高到第 <b>${d.data.maxRound}</b> 关 · ${d.data.coins} 金币 · 武器 <b>${R.knifeById(d.data.knifeId).name}</b>`;
      }
      el('title').classList.add('show');
    };

    // 页面隐藏时存一次（切标签、关页面）
    window.addEventListener('visibilitychange', () => { if (document.hidden) persist('页面隐藏'); });
    window.addEventListener('beforeunload', () => persist('关闭'));
    bindShopScroll();

    updateHud();
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      const frameMs = now - last;
      last = now;
      noteFrameTime(frameMs);          // 自适应降级：卡了自动减特效
      // 图鉴 / 战绩图 / 剧情弹窗打开时也要暂停游戏，否则氧气会在后台偷偷掉
      const rot = el('rotate');
      const paused = state.phase === 'title' || state.phase === 'shop'
        || state.phase === 'story' || state.phase === 'codex' || state.phase === 'report'
        || state.phase === 'bag'
        || (rot && rot.classList.contains('show'));
      if (!paused) update(dt);
      else state.time += dt;
      draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
