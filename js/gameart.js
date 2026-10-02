/* ==========================================================================
   鲸鱼搓澡店 · 游戏内美术
   把画面里的东西画得更"真"一点：
     · barnacleShell  藤壶：层叠壳板 + 生长纹 + 盖板 + 高光 + 接触阴影
     · caustics       水面焦散：鲸鱼身上流动的光带
     · launcher       武器台
   坐标系：调用前已经 translate 到目标位置，原点 = 物体中心
   ========================================================================== */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.WhaleGameArt = mod;
  if (typeof window !== 'undefined') window.WhaleGameArt = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------- 颜色小工具
  function hex2rgb(h) {
    if (typeof h !== 'string') return [180, 168, 144];
    let s = h.replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    if (isNaN(n)) return [180, 168, 144];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(c, k) {
    const [r, gg, b] = hex2rgb(c);
    const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
    return 'rgb(' + f(r) + ',' + f(gg) + ',' + f(b) + ')';
  }
  function rgba(c, a) {
    const [r, gg, b] = hex2rgb(c);
    return 'rgba(' + r + ',' + gg + ',' + b + ',' + a + ')';
  }

  // 伪随机（每个藤壶的 seed 固定 → 长相固定，不会每帧抖）
  function rngFrom(seed) {
    let s = (seed | 0) || 1;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  // ================================================================ 藤壶壳
  /*
   * o = {
   *   s      半径基准（和原来一样：藤壶的 size）
   *   seed   随机种子
   *   tint   壳色（跟种类走）
   *   dead   是否已被清掉（露出被吃掉的内部）
   *   dmg    0..1 已受伤害
   *   time   全局时间（用来做极轻微的呼吸）
   *   simple 省电模式：卡顿时用纯色填充，不建渐变
   * }
   */
  function barnacleShell(g, o) {
    const s = o.s;
    const rnd = rngFrom(o.seed);
    const tint = o.tint || '#C9B79A';
    const simple = !!o.simple;

    // 透视参数：底面是扁椭圆，顶面更小更高
    const rx = s * 1.02, ry = s * 0.64;
    const topR = s * 0.40, topY = -s * 0.56;
    const baseY = s * 0.18;

    // ---- 1. 贴地接触阴影（环境遮蔽）----
    // 每个藤壶一次 radial gradient，几十个就是几十次；性能一般时用纯色代替
    if (!simple && !o.noAo) {
      const ao = g.createRadialGradient(0, baseY, rx * 0.3, 0, baseY, rx * 1.34);
      ao.addColorStop(0, 'rgba(10,16,34,0.34)');
      ao.addColorStop(0.72, 'rgba(10,16,34,0.16)');
      ao.addColorStop(1, 'rgba(10,16,34,0)');
      g.fillStyle = ao;
      g.beginPath();
      g.ellipse(0, baseY, rx * 1.34, ry * 1.3, 0, 0, Math.PI * 2);
      g.fill();
    }

    // ---- 2. 壳板：6 片层叠的石灰质板 ----
    const PLATES = 5;
    const LIGHT = -Math.PI * 0.72;          // 光从左上来
    const seedA = (o.seed % 100) / 100 * 0.5;   // 整体转一点，每只朝向不同
    for (let i = 0; i < PLATES; i++) {
      const a0 = seedA + (i / PLATES) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / PLATES * 1.12;   // 多 12% → 板与板重叠
      // 这块板的朝向决定明暗
      const mid = (a0 + a1) / 2;
      const lit = Math.cos(mid - LIGHT) * 0.5 + 0.5;   // 0=背光 1=正对光
      const jitter = 0.94 + rnd() * 0.12;

      g.beginPath();
      // 底边（沿底面椭圆走一段）
      const steps = 4;
      for (let k = 0; k <= steps; k++) {
        const a = a0 + (a1 - a0) * (k / steps);
        const wob = 1 + 0.06 * Math.sin(a * 3.3 + o.seed * 0.01);
        const x = Math.cos(a) * rx * wob * jitter;
        const y = Math.sin(a) * ry * wob * jitter + baseY;
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      // 顶边（沿顶面椭圆往回走）
      for (let k = steps; k >= 0; k--) {
        const a = a0 + (a1 - a0) * (k / steps);
        const x = Math.cos(a) * topR;
        const y = Math.sin(a) * topR * 0.62 + topY;
        g.lineTo(x, y);
      }
      g.closePath();

      // 板面：竖向渐变 + 朝向明暗
      // 注意：不能调太亮，否则种类颜色会被冲成一片白（玩法上要靠颜色分辨种类）
      const lit2 = 0.55 + 0.45 * lit;      // 0.55~1.0，明暗对比保留但不夸张
      const top = 0.10 + 0.26 * lit2;
      if (simple) {
        g.fillStyle = shade(tint, 0.02 * lit2);
      } else {
        const pg = g.createLinearGradient(0, topY, 0, baseY + ry);
        pg.addColorStop(0, shade(tint, top));
        pg.addColorStop(0.42, shade(tint, -0.02));
        pg.addColorStop(1, shade(tint, -0.38 - 0.10 * (1 - lit2)));
        g.fillStyle = pg;
      }
      g.fill();
      // 板缝
      g.strokeStyle = simple ? 'rgba(70,58,42,0.4)' : 'rgba(58,48,34,0.45)';
      g.lineWidth = Math.max(0.6, s * 0.045);
      g.stroke();

      // ---- 3. 生长纹：每块板上几道横向弧线 ----
      if (!simple) {
        g.strokeStyle = 'rgba(255,255,255,0.16)';
        g.lineWidth = Math.max(0.5, s * 0.032);
        for (let r = 1; r <= 2; r++) {
          const t = r / 4.2;
          g.beginPath();
          for (let k = 0; k <= steps; k++) {
            const a = a0 + (a1 - a0) * (k / steps);
            const bx = Math.cos(a) * rx * jitter, by = Math.sin(a) * ry * jitter + baseY;
            const tx = Math.cos(a) * topR, ty = Math.sin(a) * topR * 0.62 + topY;
            const x = bx + (tx - bx) * t, y = by + (ty - by) * t;
            if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
      }
    }

    // ---- 4. 顶部壳口：一圈带齿的边 ----
    const open = s * 0.30;
    g.beginPath();
    const teeth = 11;
    for (let i = 0; i <= teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const jag = (i % 2 === 0 ? 1.0 : 0.86) * (1 + 0.10 * Math.sin(a * 4.5 + o.seed * 0.02));
      const x = Math.cos(a) * topR * jag;
      const y = Math.sin(a) * topR * 0.62 * jag + topY;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = shade(tint, 0.42);
    g.fill();
    g.strokeStyle = 'rgba(58,48,34,0.5)';
    g.lineWidth = Math.max(0.7, s * 0.05);
    g.stroke();

    // ---- 5. 盖板（operculum）：中间那两块小甲片 ----
    if (o.dead) {
      // 被清掉了：露出里面被吃空的洞
      g.beginPath();
      g.ellipse(0, topY, open * 0.94, open * 0.62, 0, 0, Math.PI * 2);
      g.fillStyle = '#4A3B2A';
      g.fill();
      g.strokeStyle = 'rgba(230,214,190,0.7)';
      g.lineWidth = Math.max(0.8, s * 0.06);
      g.stroke();
      // 洞里的一点残渣高光
      g.beginPath();
      g.ellipse(-open * 0.2, topY - open * 0.12, open * 0.36, open * 0.22, -0.4, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,240,210,0.28)';
      g.fill();
    } else {
      // 活着的：两片小盖板半开着
      const gapK = 1 + o.dmg * 0.5;
      g.beginPath();
      g.ellipse(0, topY, open * 0.90, open * 0.56, 0, 0, Math.PI * 2);
      g.fillStyle = '#2A251C';
      g.fill();
      // 里面一点点湿润的反光
      g.beginPath();
      g.ellipse(0, topY + open * 0.06, open * 0.62, open * 0.3, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(120,150,170,0.30)';
      g.fill();
      // 两片盖板
      for (const dir of [-1, 1]) {
        g.beginPath();
        g.ellipse(dir * open * 0.34 * gapK, topY - open * 0.06, open * 0.40, open * 0.42, dir * 0.5, 0, Math.PI * 2);
        g.fillStyle = shade(tint, 0.34);
        g.fill();
        g.strokeStyle = 'rgba(58,48,34,0.5)';
        g.lineWidth = Math.max(0.6, s * 0.04);
        g.stroke();
      }
    }

    // ---- 6. 高光：左上角一片柔光 ----
    if (!simple) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const hg = g.createRadialGradient(-rx * 0.34, topY * 0.42, 0, -rx * 0.34, topY * 0.42, s * 0.9);
      hg.addColorStop(0, 'rgba(255,255,255,0.17)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hg;
      g.beginPath();
      g.ellipse(-rx * 0.3, topY * 0.36, s * 0.62, s * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // ---- 7. 受伤裂纹 ----
    if (o.dmg > 0.25 && !simple) {
      g.strokeStyle = 'rgba(40,32,22,' + (0.30 + o.dmg * 0.45).toFixed(2) + ')';
      g.lineWidth = Math.max(0.7, s * 0.05);
      const cracks = o.dmg > 0.7 ? 3 : (o.dmg > 0.45 ? 2 : 1);
      for (let c = 0; c < cracks; c++) {
        const a = (o.seed % 60) / 60 * Math.PI * 2 + c * 2.1;
        g.beginPath();
        g.moveTo(Math.cos(a) * topR * 0.9, Math.sin(a) * topR * 0.6 + topY);
        g.lineTo(Math.cos(a) * rx * 0.62, Math.sin(a) * ry * 1.1 + baseY * 0.9);
        g.stroke();
      }
    }
  }

  // ================================================================ 水面焦散
  /*
   * 鲸鱼身上流动的光带。用几条正弦叠加，开销很小。
   * o = { w, h, time, strength }
   */
  function caustics(g, o) {
    const w = o.w, h = o.h, t = o.time || 0;
    const strength = o.strength === undefined ? 1 : o.strength;
    if (strength <= 0) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    // 两组交错的细光带 → 像水面的光网，而不是平行条纹
    const bands = 7;
    for (let i = 0; i < bands; i++) {
      const p = i / bands;
      const y = -h * 0.5 + h * (p + 0.05 * Math.sin(t * 0.5 + i));
      const amp = h * (0.022 + 0.014 * Math.sin(i * 1.7));
      const speed = 0.32 + (i % 3) * 0.09;
      const a = (0.055 + 0.045 * Math.sin(t * 0.9 + i * 2.1)) * strength;
      if (a <= 0) continue;
      g.strokeStyle = 'rgba(200,238,255,' + a.toFixed(3) + ')';
      g.lineWidth = h * (0.0045 + 0.0035 * ((i % 3) / 2));
      g.beginPath();
      const steps = 10;
      for (let k = 0; k <= steps; k++) {
        const x = -w * 0.5 + w * (k / steps);
        const yy = y + Math.sin(x * 0.031 + t * speed + i) * amp
          + Math.sin(x * 0.077 - t * speed * 0.7 + i * 2) * amp * 0.4;
        if (k === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    // 第二组：近乎竖直的短线，和横带交叉成网格
    const cols = 5;
    for (let i = 0; i < cols; i++) {
      const p = i / cols;
      const x = -w * 0.5 + w * (p + 0.05 * Math.cos(t * 0.4 + i * 1.3));
      const amp = h * 0.02;
      const a = (0.035 + 0.03 * Math.sin(t * 1.1 + i * 1.9)) * strength;
      if (a <= 0) continue;
      g.strokeStyle = 'rgba(190,232,255,' + a.toFixed(3) + ')';
      g.lineWidth = h * 0.005;
      g.beginPath();
      const steps = 7;
      for (let k = 0; k <= steps; k++) {
        const y = -h * 0.5 + h * (k / steps);
        const xx = x + Math.sin(y * 0.02 + t * 0.6 + i) * amp;
        if (k === 0) g.moveTo(xx, y); else g.lineTo(xx, y);
      }
      g.stroke();
    }
    g.restore();
  }

  // ================================================================ 武器台
  /*
   * 轨道上滑动的那个装置。o = { w, h, dir, charging, color }
   */
  function launcher(g, o) {
    const w = o.w, h = o.h;
    const col = o.color || '#6C8CFF';
    const dir = o.dir || 0;

    // 底座的接触阴影
    g.beginPath();
    g.ellipse(0, h * 0.52, w * 0.62, h * 0.20, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(6,10,20,0.42)';
    g.fill();

    // 主体：六边形舱体
    g.beginPath();
    const rx = w * 0.46, ry = h * 0.50;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    const bg = g.createLinearGradient(0, -ry, 0, ry);
    bg.addColorStop(0, '#4A5568');
    bg.addColorStop(0.42, '#2C3444');
    bg.addColorStop(1, '#141A26');
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = 'rgba(180,205,240,0.34)';
    g.lineWidth = Math.max(1, h * 0.05);
    g.stroke();

    // 中间的发光口（朝向射击方向）
    g.save();
    g.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + 0.4 * Math.sin((o.time || 0) * 5);
    const cg = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.34);
    cg.addColorStop(0, rgba(col, (0.55 * pulse).toFixed(3)));
    cg.addColorStop(1, rgba(col, '0'));
    g.fillStyle = cg;
    g.beginPath();
    g.arc(0, 0, w * 0.34, 0, Math.PI * 2);
    g.fill();
    g.restore();

    g.beginPath();
    g.arc(0, 0, w * 0.15, 0, Math.PI * 2);
    g.fillStyle = col;
    g.fill();
    g.beginPath();
    g.arc(0, 0, w * 0.07, 0, Math.PI * 2);
    g.fillStyle = '#FFFFFF';
    g.fill();

    // 炮口：朝 dir 方向伸出的一小段
    g.save();
    g.rotate(dir);
    g.beginPath();
    g.roundRect(w * 0.30, -h * 0.14, w * 0.30, h * 0.28, h * 0.08);
    g.fillStyle = '#39424F';
    g.fill();
    g.strokeStyle = 'rgba(180,205,240,0.3)';
    g.lineWidth = Math.max(1, h * 0.04);
    g.stroke();
    // 顶面高光
    g.beginPath();
    g.roundRect(w * 0.32, -h * 0.12, w * 0.26, h * 0.07, h * 0.03);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fill();
    g.restore();

    // 顶面高光
    g.beginPath();
    g.ellipse(-rx * 0.16, -ry * 0.44, rx * 0.42, ry * 0.20, -0.2, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fill();
  }

  return { barnacleShell, caustics, launcher, shade, rgba, hex2rgb };
});
