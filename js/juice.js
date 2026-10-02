/* ==========================================================================
   鲸鱼搓澡店 · 动画系统
   把"能用"提升到"高级"靠的是这几件事：
     1) 缓动不再是线性 —— 统一用带过冲的弹簧曲线
     2) 命中有「顿帧」（极短的减速）+ 方向性震屏 + 挤压拉伸
     3) 物体有预备动作和跟随（前摇 / 后坐 / 残影）
     4) 金币沿弧线飞，不是直线
   ========================================================================== */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.WhaleJuice = mod;
  if (typeof window !== 'undefined') window.WhaleJuice = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------------------------------------------------------- 缓动
  const ease = {
    linear: t => t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    outQuint: t => 1 - Math.pow(1 - t, 5),
    // 冲过头一点再回来 —— 高级感的来源
    outBack: (t, s) => {
      const k = s === undefined ? 1.7 : s;
      const u = t - 1;
      return 1 + (k + 1) * u * u * u + k * u * u;
    },
    outElastic: (t, amp) => {
      const a = amp === undefined ? 1 : amp;
      if (t === 0 || t === 1) return t;
      const p = 0.34;
      return a * Math.pow(2, -10 * t) * Math.sin((t - p / 4) * TAU / p) + 1;
    },
    inQuad: t => t * t,
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    // 先蓄力再冲出去（预备动作）
    anticipate: t => t * t * (2.6 * t - 1.6),
  };

  // ---------------------------------------------------------------- 弹簧
  // 欠阻尼弹簧：给一个目标值，它会带过冲地收敛过去。UI 和镜头都用这个。
  function Spring(value, opt) {
    opt = opt || {};
    this.v = value || 0;
    this.target = this.v;
    this.vel = 0;
    this.k = opt.stiffness === undefined ? 160 : opt.stiffness;
    this.d = opt.damping === undefined ? 18 : opt.damping;
  }
  Spring.prototype.set = function (t) { this.target = t; return this; };
  Spring.prototype.snap = function (t) { this.target = this.v = t; this.vel = 0; return this; };
  Spring.prototype.step = function (dt) {
    // 固定步长积分：dt 抖动时弹簧不会炸
    let remain = Math.min(dt, 0.1);
    const h = 1 / 120;
    while (remain > 0) {
      const step = Math.min(h, remain);
      const a = -this.k * (this.v - this.target) - this.d * this.vel;
      this.vel += a * step;
      this.v += this.vel * step;
      remain -= step;
    }
    if (Math.abs(this.v - this.target) < 0.0004 && Math.abs(this.vel) < 0.0004) {
      this.v = this.target; this.vel = 0;
    }
    return this.v;
  };
  Spring.prototype.done = function () { return this.v === this.target && this.vel === 0; };

  // ---------------------------------------------------------------- 对象池化的简易补间
  function Tween(from, to, dur, e, onDone) {
    return { t: 0, from, to, dur: Math.max(0.0001, dur), e: e || ease.outCubic, onDone };
  }
  function stepTween(tw, dt) {
    tw.t += dt;
    const k = clamp(tw.t / tw.dur, 0, 1);
    if (k >= 1 && tw.onDone) { const f = tw.onDone; tw.onDone = null; f(); }
    return tw.e(k);
  }

  // ---------------------------------------------------------------- 顿帧（hit-stop）
  // 命中那一瞬间把时间压慢几十毫秒，是最有效的"打击感"手段。
  function HitStop() {
    this.left = 0;
    this.scale = 1;
    this.recover = 0;
  }
  HitStop.prototype.hit = function (dur, scale) {
    // 取更强的那个，不叠加（叠加会导致连续命中的时候卡死）
    if (dur > this.left) { this.left = dur; this.scale = scale === undefined ? 0.12 : scale; }
  };
  HitStop.prototype.step = function (dt) {
    if (this.left <= 0) { this.scale = 1; return dt; }
    this.left -= dt;
    if (this.left <= 0) { this.left = 0; this.scale = 1; }
    return dt * this.scale;
  };
  HitStop.prototype.active = function () { return this.left > 0; };

  // ---------------------------------------------------------------- 方向性震屏
  // 普通震屏是随机抖动；沿着"受力方向"抖会明显更有打击感。
  function Shake() {
    this.amp = 0;
    this.decay = 8;
    this.x = 0; this.y = 0;
    this.dx = 0; this.dy = 0;
    this.rot = 0;
    this.t = 0;
  }
  Shake.prototype.kick = function (amp, dirX, dirY) {
    this.amp = Math.max(this.amp, amp);
    const len = Math.hypot(dirX || 0, dirY || 0);
    if (len > 0.001) { this.dx = dirX / len; this.dy = dirY / len; }
  };
  Shake.prototype.step = function (dt) {
    this.t += dt;
    if (this.amp <= 0.01) { this.amp = 0; this.x = this.y = this.rot = 0; return; }
    this.amp *= Math.exp(-this.decay * dt);          // 指数衰减，比线性自然
    // 主抖动沿受力方向，副抖动垂直方向（幅度小）
    const s = this.amp;
    const t = this.t * 46;
    const along = Math.sin(t) * s;
    const side = Math.sin(t * 1.7 + 1.1) * s * 0.45;
    this.x = this.dx * along - this.dy * side;
    this.y = this.dy * along + this.dx * side;
    // 轻微旋转，幅度很小但很有效
    this.rot = Math.sin(t * 0.83) * s * 0.0016;
  };
  Shake.prototype.add = function (dt) { };
  Shake.prototype.reset = function () { this.amp = 0; this.x = this.y = this.rot = 0; };

  // ---------------------------------------------------------------- 挤压拉伸
  // 返回 {sx, sy}：沿 angle 方向压扁、垂直方向拉长
  function squash(amount, angle) {
    const a = clamp(amount, 0, 1) * 0.42;
    return { sx: 1 - a, sy: 1 + a * 0.8, angle: angle || 0 };
  }

  // ---------------------------------------------------------------- 残影缓冲
  // 给高速物体留几帧历史位置，画成半透明拖影
  function Trail(len) {
    this.pts = [];
    this.max = len || 6;
  }
  Trail.prototype.push = function (x, y, rot) {
    this.pts.push({ x, y, rot });
    if (this.pts.length > this.max) this.pts.shift();
  };
  Trail.prototype.clear = function () { this.pts.length = 0; };

  // ---------------------------------------------------------------- 数值逼近（给 UI 用）
  // 帧率无关的指数逼近：dt 变化时速度一致
  function approach(cur, target, speed, dt) {
    return cur + (target - cur) * (1 - Math.exp(-speed * dt));
  }

  return {
    ease, Spring, Tween, stepTween, HitStop, Shake, squash, Trail, approach,
    clamp, lerp, TAU,
  };
});
