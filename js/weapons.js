/* ==========================================================================
   鲸鱼搓澡店 · 武器美术
   所有武器都画在同一个坐标系里：
     原点 = 握把中心
     +X   = 指向刀尖/剑尖
     len  = 刃长（从护手到尖端），其它尺寸都按 len 的比例算
   光照方向统一：左上来光，所以上缘亮、下缘暗。
   ========================================================================== */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.WhaleWeapons = mod;
  if (typeof window !== 'undefined') window.WhaleWeapons = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------- 小工具
  function lg(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    for (const s of stops) gr.addColorStop(s[0], s[1]);
    return gr;
  }
  // 刀身：横向的金属渐变（上亮下暗）
  function bladeGrad(g, half, tone) {
    const t = tone || ['#FFFFFF', '#DCE5F2', '#9AA8BD', '#6B788C'];
    return lg(g, 0, -half, 0, half, [[0, t[0]], [0.38, t[1]], [0.72, t[2]], [1, t[3]]]);
  }
  // 木柄
  function woodGrad(g, half) {
    return lg(g, 0, -half, 0, half, [[0, '#8A5F3C'], [0.45, '#6B4A2F'], [1, '#3F2A19']]);
  }
  function outline(g, w, col) {
    g.strokeStyle = col || 'rgba(16,22,34,0.6)';
    g.lineWidth = w === undefined ? 1.2 : w;
    g.stroke();
  }
  function poly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else {
      const k = Math.min(r, w / 2, h / 2);
      g.moveTo(x + k, y);
      g.lineTo(x + w - k, y); g.quadraticCurveTo(x + w, y, x + w, y + k);
      g.lineTo(x + w, y + h - k); g.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
      g.lineTo(x + k, y + h); g.quadraticCurveTo(x, y + h, x, y + h - k);
      g.lineTo(x, y + k); g.quadraticCurveTo(x, y, x + k, y);
      g.closePath();
    }
  }

  // ================================================================ 各把武器
  const ART = {};

  // ---- 生锈小刀：短、窄、有豁口、锈斑、缠胶布的柄 ----
  ART.rusty = function (g, len) {
    const h = len * 0.085;
    // 刀身（上缘平、下缘略有弧）
    poly(g, [[0, -h], [len * 0.78, -h * 0.86], [len, -h * 0.18], [len * 0.9, h * 0.62], [0, h * 0.9]]);
    g.fillStyle = bladeGrad(g, h, ['#B9BFC8', '#98A0AC', '#7C858F', '#5E666F']);
    g.fill(); outline(g, 1.1);
    // 锈斑
    g.fillStyle = 'rgba(150,84,38,0.55)';
    g.beginPath(); g.ellipse(len * 0.3, h * 0.1, len * 0.1, h * 0.42, 0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(len * 0.62, -h * 0.2, len * 0.07, h * 0.3, -0.2, 0, Math.PI * 2); g.fill();
    // 刃口豁了两个口
    g.fillStyle = 'rgba(20,26,38,0.85)';
    g.beginPath(); g.moveTo(len * 0.42, h * 0.75); g.lineTo(len * 0.5, h * 0.2); g.lineTo(len * 0.55, h * 0.8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(len * 0.7, h * 0.55); g.lineTo(len * 0.76, h * 0.05); g.lineTo(len * 0.8, h * 0.6); g.closePath(); g.fill();
    // 柄：木 + 胶布
    const hl = len * 0.42;
    rr(g, -hl, -h * 1.05, hl * 0.94, h * 2.1, h * 0.5);
    g.fillStyle = woodGrad(g, h);
    g.fill(); outline(g, 1);
    g.fillStyle = 'rgba(210,208,196,0.85)';
    g.fillRect(-hl * 0.72, -h * 1.1, h * 0.5, h * 2.2);
    g.fillRect(-hl * 0.34, -h * 1.05, h * 0.42, h * 2.1);
  };

  // ---- 锋利厨刀：高刀跟、弧刃、三铆钉西式柄 ----
  ART.sharp = function (g, len) {
    const hh = len * 0.30;            // 刀跟高度
    // 刀身：刀跟高、背平、腹弧
    g.beginPath();
    g.moveTo(0, -hh * 0.78);
    g.lineTo(len * 0.86, -hh * 0.5);
    g.quadraticCurveTo(len * 1.02, -hh * 0.16, len * 0.96, hh * 0.1);
    g.quadraticCurveTo(len * 0.6, hh * 0.62, 0, hh);
    g.closePath();
    g.fillStyle = bladeGrad(g, hh, ['#FFFFFF', '#E4EBF6', '#A7B4C7', '#77839A']);
    g.fill(); outline(g, 1.2);
    // 刃口高光
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(len * 0.04, hh * 0.9);
    g.quadraticCurveTo(len * 0.6, hh * 0.55, len * 0.94, hh * 0.08);
    g.stroke();
    // 刀跟处的护指
    g.fillStyle = '#8D949E';
    g.fillRect(-len * 0.02, -hh * 0.9, len * 0.05, hh * 1.95);
    // 柄：黑色 + 三颗铆钉
    const hl = len * 0.42, hh2 = hh * 0.62;
    rr(g, -hl, -hh2, hl * 0.98, hh2 * 2, hh2 * 0.75);
    g.fillStyle = lg(g, 0, -hh2, 0, hh2, [[0, '#3A3F47'], [0.45, '#22262C'], [1, '#12151A']]);
    g.fill(); outline(g, 1);
    g.fillStyle = '#C9D1DC';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(-hl * (0.24 + i * 0.3), 0, hh2 * 0.22, 0, Math.PI * 2);
      g.fill();
    }
  };

  // ---- 大砍刀：宽、长、微微上翘、方形刀尖 ----
  ART.big = function (g, len) {
    const h = len * 0.13;
    g.beginPath();
    g.moveTo(0, -h * 1.15);
    g.quadraticCurveTo(len * 0.5, -h * 1.3, len * 0.94, -h * 1.5);
    g.lineTo(len, -h * 0.7);
    g.quadraticCurveTo(len * 0.62, h * 0.2, 0, h * 0.55);
    g.closePath();
    g.fillStyle = bladeGrad(g, h, ['#EDF2F8', '#C8D3E0', '#8C99AC', '#5C6878']);
    g.fill(); outline(g, 1.2);
    // 血槽
    g.strokeStyle = 'rgba(40,50,66,0.4)';
    g.lineWidth = h * 0.22;
    g.beginPath();
    g.moveTo(len * 0.12, -h * 0.5);
    g.quadraticCurveTo(len * 0.55, -h * 0.66, len * 0.9, -h * 0.86);
    g.stroke();
    // 背齿（砍刀的小锯齿）
    g.fillStyle = 'rgba(30,38,52,0.5)';
    for (let i = 0; i < 5; i++) {
      const x = len * (0.16 + i * 0.15);
      g.beginPath(); g.moveTo(x, -h * 1.24); g.lineTo(x + len * 0.05, -h * 1.1); g.lineTo(x + len * 0.1, -h * 1.26); g.closePath(); g.fill();
    }
    // 柄：木 + 尾孔
    const hl = len * 0.36, hh = h * 0.95;
    rr(g, -hl, -hh, hl * 0.96, hh * 2, hh * 0.6);
    g.fillStyle = woodGrad(g, hh);
    g.fill(); outline(g, 1);
    g.fillStyle = 'rgba(20,24,32,0.7)';
    g.beginPath(); g.arc(-hl * 0.86, 0, hh * 0.28, 0, Math.PI * 2); g.fill();
  };

  // ---- 巨刃剁刀：方方正正一大块、背厚、带个孔 ----
  ART.cleaver = function (g, len) {
    const hh = len * 0.44;
    // 刀身：接近长方形，刃口略弧
    g.beginPath();
    g.moveTo(0, -hh);
    g.lineTo(len * 0.96, -hh * 0.94);
    g.quadraticCurveTo(len * 1.04, -hh * 0.7, len * 1.0, -hh * 0.3);
    g.quadraticCurveTo(len * 0.96, hh * 0.72, len * 0.62, hh * 0.92);
    g.quadraticCurveTo(len * 0.3, hh * 1.0, 0, hh * 0.94);
    g.closePath();
    g.fillStyle = bladeGrad(g, hh, ['#FFFFFF', '#E7EDF7', '#AEBACB', '#7C8899']);
    g.fill(); outline(g, 1.3);
    // 背（加厚的一条）
    g.fillStyle = 'rgba(120,132,150,0.85)';
    g.beginPath();
    g.moveTo(0, -hh);
    g.lineTo(len * 0.96, -hh * 0.94);
    g.lineTo(len * 0.96, -hh * 0.74);
    g.lineTo(0, -hh * 0.8);
    g.closePath(); g.fill();
    // 挂孔
    g.fillStyle = 'rgba(10,14,22,0.85)';
    g.beginPath(); g.arc(len * 0.84, -hh * 0.62, hh * 0.1, 0, Math.PI * 2); g.fill();
    // 刃口高光
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(len * 0.06, hh * 0.92);
    g.quadraticCurveTo(len * 0.6, hh * 0.9, len * 0.98, hh * 0.3);
    g.stroke();
    // 柄：短粗木柄
    const hl = len * 0.3, hh2 = hh * 0.34;
    rr(g, -hl, -hh2, hl * 0.98, hh2 * 2, hh2 * 0.6);
    g.fillStyle = woodGrad(g, hh2);
    g.fill(); outline(g, 1);
    g.fillStyle = 'rgba(200,205,215,0.7)';
    g.fillRect(-hl * 0.5, -hh2 * 1.05, hh2 * 0.45, hh2 * 2.1);
  };

  // ---- 直刺细剑：针一样细、杯形护手、缠线柄 ----
  ART.rapier = function (g, len) {
    const h = len * 0.028;
    // 剑身：细菱形
    poly(g, [[0, -h * 1.5], [len * 0.94, -h * 0.55], [len, 0], [len * 0.94, h * 0.55], [0, h * 1.5]]);
    g.fillStyle = bladeGrad(g, h * 1.6, ['#FFFFFF', '#E8EFF9', '#B6C3D6', '#8B98AC']);
    g.fill(); outline(g, 0.9);
    // 中脊
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = h * 0.5;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.95, 0); g.stroke();
    // 杯形护手
    g.fillStyle = lg(g, -len * 0.1, 0, 0, 0, [[0, '#E6C77E'], [0.5, '#C9A24E'], [1, '#8C6C2A']]);
    g.beginPath();
    g.ellipse(-len * 0.02, 0, len * 0.075, len * 0.13, 0, 0, Math.PI * 2);
    g.fill(); outline(g, 1);
    g.fillStyle = 'rgba(255,240,200,0.5)';
    g.beginPath();
    g.ellipse(-len * 0.05, -len * 0.03, len * 0.035, len * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    // 缠线柄
    const hl = len * 0.26, hh = len * 0.032;
    rr(g, -hl, -hh, hl * 0.96, hh * 2, hh);
    g.fillStyle = lg(g, 0, -hh, 0, hh, [[0, '#5A4630'], [0.5, '#3D2F20'], [1, '#241B12']]);
    g.fill(); outline(g, 0.9);
    g.strokeStyle = 'rgba(210,180,120,0.6)'; g.lineWidth = hh * 0.5;
    for (let i = 0; i < 5; i++) {
      const x = -hl * (0.12 + i * 0.19);
      g.beginPath(); g.moveTo(x, -hh); g.lineTo(x - hh * 1.4, hh); g.stroke();
    }
    // 剑首
    g.fillStyle = '#C9A24E';
    g.beginPath(); g.arc(-hl * 0.96, 0, hh * 1.4, 0, Math.PI * 2); g.fill();
    outline(g, 0.9);
  };

  // ---- 深海巨剑：宽双刃、血槽、十字护手、双手长柄 ----
  ART.greatsword = function (g, len) {
    const h = len * 0.085;
    poly(g, [[0, -h], [len * 0.86, -h * 0.82], [len, 0], [len * 0.86, h * 0.82], [0, h]]);
    g.fillStyle = bladeGrad(g, h, ['#F2F8FF', '#CFE0F5', '#8FA6C6', '#5F7392']);
    g.fill(); outline(g, 1.3);
    // 血槽
    g.fillStyle = 'rgba(50,70,100,0.34)';
    g.beginPath();
    g.moveTo(len * 0.08, -h * 0.26);
    g.lineTo(len * 0.8, -h * 0.2);
    g.lineTo(len * 0.8, h * 0.2);
    g.lineTo(len * 0.08, h * 0.26);
    g.closePath(); g.fill();
    // 刃口亮线
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(len * 0.06, -h * 0.96); g.lineTo(len * 0.92, -h * 0.6); g.stroke();
    // 十字护手
    g.fillStyle = lg(g, 0, -h * 3.4, 0, h * 3.4, [[0, '#E3CB8E'], [0.5, '#B99A54'], [1, '#7E6530']]);
    rr(g, -len * 0.035, -h * 3.2, len * 0.045, h * 6.4, h * 0.5);
    g.fill(); outline(g, 1);
    // 长柄
    const hl = len * 0.3, hh = h * 0.52;
    rr(g, -hl, -hh, hl * 0.97, hh * 2, hh * 0.8);
    g.fillStyle = lg(g, 0, -hh, 0, hh, [[0, '#3C4A63'], [0.5, '#26313F'], [1, '#141A24']]);
    g.fill(); outline(g, 1);
    g.strokeStyle = 'rgba(150,180,220,0.35)'; g.lineWidth = hh * 0.28;
    for (let i = 0; i < 4; i++) {
      const x = -hl * (0.14 + i * 0.22);
      g.beginPath(); g.moveTo(x, -hh); g.lineTo(x - hh, hh); g.stroke();
    }
    // 剑首
    g.fillStyle = '#B99A54';
    g.beginPath(); g.arc(-hl * 0.97, 0, hh * 1.5, 0, Math.PI * 2); g.fill();
    outline(g, 1);
  };

  // ---- 鲸落圣剑：金色、符文、翼形护手、宝石 ----
  ART.excalibur = function (g, len) {
    const h = len * 0.075;
    // 外发光
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35;
    g.fillStyle = 'rgba(255,226,140,0.9)';
    g.beginPath();
    g.ellipse(len * 0.5, 0, len * 0.62, h * 3.2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // 剑身
    poly(g, [[0, -h], [len * 0.84, -h * 0.72], [len, 0], [len * 0.84, h * 0.72], [0, h]]);
    g.fillStyle = lg(g, 0, -h, 0, h, [[0, '#FFFDF2'], [0.34, '#FFE9A8'], [0.7, '#E7B94E'], [1, '#A87B1E']]);
    g.fill(); outline(g, 1.2, 'rgba(120,84,10,0.7)');
    // 符文
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 4; i++) {
      const x = len * (0.2 + i * 0.16);
      g.fillRect(x, -h * 0.22, len * 0.02, h * 0.44);
      g.fillRect(x - len * 0.012, -h * 0.3, len * 0.044, h * 0.1);
    }
    // 翼形护手
    g.fillStyle = lg(g, 0, -h * 4, 0, h * 4, [[0, '#FFF0BE'], [0.5, '#D9AE45'], [1, '#8A6519']]);
    g.beginPath();
    g.moveTo(-len * 0.02, 0);
    g.quadraticCurveTo(-len * 0.12, -h * 4.2, -len * 0.02, -h * 3.0);
    g.quadraticCurveTo(len * 0.02, -h * 1.4, len * 0.04, 0);
    g.quadraticCurveTo(len * 0.02, h * 1.4, -len * 0.02, h * 3.0);
    g.quadraticCurveTo(-len * 0.12, h * 4.2, -len * 0.02, 0);
    g.closePath();
    g.fill(); outline(g, 1, 'rgba(120,84,10,0.7)');
    // 柄
    const hl = len * 0.24, hh = h * 0.62;
    rr(g, -hl, -hh, hl * 0.97, hh * 2, hh * 0.8);
    g.fillStyle = lg(g, 0, -hh, 0, hh, [[0, '#6A5330'], [0.5, '#432F16'], [1, '#241809']]);
    g.fill(); outline(g, 1, 'rgba(120,84,10,0.7)');
    // 宝石剑首
    g.fillStyle = '#7FD8FF';
    g.beginPath(); g.arc(-hl * 1.05, 0, hh * 1.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#D9AE45'; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(-hl * 1.05 - hh * 0.5, -hh * 0.5, hh * 0.45, 0, Math.PI * 2); g.fill();
  };

  // ---- 法棍 ----
  ART.baguette = function (g, len) {
    const h = len * 0.11;
    g.beginPath();
    g.moveTo(0, -h);
    g.quadraticCurveTo(len * 0.5, -h * 1.25, len, -h * 0.28);
    g.quadraticCurveTo(len * 1.05, 0, len, h * 0.28);
    g.quadraticCurveTo(len * 0.5, h * 1.25, 0, h);
    g.quadraticCurveTo(-len * 0.08, 0, 0, -h);
    g.closePath();
    g.fillStyle = lg(g, 0, -h * 1.3, 0, h * 1.3, [[0, '#F0CE94'], [0.4, '#D9A65E'], [1, '#A5702F']]);
    g.fill(); outline(g, 1.2, 'rgba(90,54,16,0.65)');
    // 表面的裂口（割包）
    g.strokeStyle = 'rgba(255,240,205,0.85)';
    g.lineWidth = h * 0.36;
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const x = len * (0.2 + i * 0.2);
      g.beginPath();
      g.moveTo(x - len * 0.05, -h * 0.5);
      g.quadraticCurveTo(x, -h * 0.75, x + len * 0.05, -h * 0.45);
      g.stroke();
    }
    // 面粉
    g.fillStyle = 'rgba(255,250,235,0.5)';
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.arc(len * (0.12 + i * 0.12), -h * (0.1 + (i % 3) * 0.35), h * 0.1, 0, Math.PI * 2);
      g.fill();
    }
  };

  // ---- 电锯 ----
  ART.chainsaw = function (g, len) {
    const h = len * 0.16;
    // 导板
    g.beginPath();
    g.moveTo(len * 0.22, -h * 0.62);
    g.lineTo(len * 1.02, -h * 0.34);
    g.quadraticCurveTo(len * 1.1, 0, len * 1.02, h * 0.34);
    g.lineTo(len * 0.22, h * 0.62);
    g.closePath();
    g.fillStyle = lg(g, 0, -h * 0.7, 0, h * 0.7, [[0, '#D5DAE2'], [0.45, '#9AA2AE'], [1, '#5E6672']]);
    g.fill(); outline(g, 1.1);
    // 链条齿
    g.fillStyle = '#C9D0DA';
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      const x = len * (0.24 + t * 0.76);
      const y = -h * (0.6 - t * 0.28);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * 0.035, y - h * 0.24); g.lineTo(x + len * 0.06, y); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x, -y); g.lineTo(x + len * 0.035, -y + h * 0.24); g.lineTo(x + len * 0.06, -y); g.closePath(); g.fill();
    }
    // 机身
    rr(g, -len * 0.3, -h * 1.15, len * 0.56, h * 2.3, h * 0.42);
    g.fillStyle = lg(g, 0, -h * 1.2, 0, h * 1.2, [[0, '#FF9F45'], [0.45, '#E8721C'], [1, '#A34708']]);
    g.fill(); outline(g, 1.2);
    // 散热口
    g.fillStyle = 'rgba(40,20,4,0.5)';
    for (let i = 0; i < 4; i++) g.fillRect(-len * 0.24 + i * len * 0.05, -h * 0.8, len * 0.02, h * 1.6);
    // 提手
    g.strokeStyle = '#2C2C2E'; g.lineWidth = h * 0.5;
    g.beginPath();
    g.moveTo(-len * 0.3, -h * 0.9);
    g.quadraticCurveTo(-len * 0.46, 0, -len * 0.3, h * 0.9);
    g.stroke();
    // 握把
    rr(g, -len * 0.34, h * 1.0, len * 0.2, h * 0.85, h * 0.3);
    g.fillStyle = '#23262B'; g.fill(); outline(g, 1);
  };

  // ---- 一只活的海星 ----
  ART.starfish = function (g, len) {
    const R = len * 0.44, r = R * 0.42;
    g.save();
    g.rotate(-0.2);
    // 五条腕
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? R : r;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = lg(g, 0, -R, 0, R, [[0, '#FFC98A'], [0.45, '#FF9A5C'], [1, '#D95F2B']]);
    g.fill(); outline(g, 1.2, 'rgba(120,50,10,0.6)');
    // 腕上的凸起
    g.fillStyle = 'rgba(255,225,190,0.85)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      for (let j = 1; j <= 3; j++) {
        const rad = r + (R - r) * (j / 4);
        g.beginPath();
        g.arc(Math.cos(a) * rad, Math.sin(a) * rad, R * 0.055, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 中心
    g.fillStyle = 'rgba(255,180,140,0.9)';
    g.beginPath(); g.arc(0, 0, r * 0.72, 0, Math.PI * 2); g.fill();
    // 两只小眼睛（它确实是"活的"）
    g.fillStyle = '#20140C';
    g.beginPath(); g.arc(-R * 0.16, -R * 0.1, R * 0.09, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(R * 0.16, -R * 0.1, R * 0.09, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFFFFF';
    g.beginPath(); g.arc(-R * 0.13, -R * 0.13, R * 0.03, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(R * 0.19, -R * 0.13, R * 0.03, 0, Math.PI * 2); g.fill();
    g.restore();
  };

  // ---- 一只更大的藤壶 ----
  ART.barnacle_itself = function (g, len) {
    const R = len * 0.42;
    // 底盘
    g.fillStyle = 'rgba(90,110,130,0.9)';
    g.beginPath(); g.ellipse(0, 0, R * 1.05, R * 0.42, 0, 0, Math.PI * 2); g.fill();
    // 壳体（锥形，由几片灰岩板拼成）
    const plates = 6;
    for (let i = 0; i < plates; i++) {
      const a0 = (i / plates) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / plates) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.moveTo(Math.cos(a0) * R * 0.98, Math.sin(a0) * R * 0.4);
      g.lineTo(Math.cos(a1) * R * 0.98, Math.sin(a1) * R * 0.4);
      g.lineTo(Math.cos(a1) * R * 0.3, Math.sin(a1) * R * 0.12 - R * 0.86);
      g.lineTo(Math.cos(a0) * R * 0.3, Math.sin(a0) * R * 0.12 - R * 0.86);
      g.closePath();
      const shade = 0.72 + 0.28 * Math.cos(a0 + Math.PI / 2);
      const c = Math.round(190 * shade), c2 = Math.round(205 * shade);
      g.fillStyle = 'rgb(' + c + ',' + c2 + ',' + Math.round(215 * shade) + ')';
      g.fill();
      outline(g, 0.9, 'rgba(50,64,84,0.5)');
    }
    // 顶部的开口（黑）
    g.fillStyle = '#181F2B';
    g.beginPath(); g.ellipse(0, -R * 0.84, R * 0.3, R * 0.12, 0, 0, Math.PI * 2); g.fill();
    // 里面的触手
    g.strokeStyle = 'rgba(255,180,120,0.85)';
    g.lineWidth = R * 0.06;
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = -R * 0.2 + i * R * 0.1;
      g.beginPath();
      g.moveTo(x, -R * 0.86);
      g.quadraticCurveTo(x + R * 0.08, -R * 1.05, x + R * 0.16, -R * 0.92);
      g.stroke();
    }
    // 高光
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.ellipse(-R * 0.3, -R * 0.5, R * 0.14, R * 0.3, -0.5, 0, Math.PI * 2); g.fill();
  };

  // 兜底：不认识的武器画成一把普通小刀
  ART._fallback = function (g, len) {
    const h = len * 0.1;
    poly(g, [[0, -h], [len * 0.85, -h * 0.8], [len, 0], [len * 0.85, h * 0.8], [0, h]]);
    g.fillStyle = bladeGrad(g, h);
    g.fill(); outline(g, 1.1);
    const hl = len * 0.36, hh = h * 0.9;
    rr(g, -hl, -hh, hl * 0.96, hh * 2, hh * 0.6);
    g.fillStyle = woodGrad(g, hh); g.fill(); outline(g, 1);
  };

  // 每种武器的包围盒（单位 = 刃长 len），用来做图标自适应缩放
  //   x0 握把末端，x1 尖端，y 上下半高
  const EXT = {
    rusty: { x0: -0.44, x1: 1.02, y: 0.10 },
    sharp: { x0: -0.44, x1: 1.00, y: 0.32 },
    big: { x0: -0.38, x1: 1.02, y: 0.18 },
    cleaver: { x0: -0.32, x1: 1.06, y: 0.46 },
    rapier: { x0: -0.32, x1: 1.02, y: 0.15 },
    greatsword: { x0: -0.34, x1: 1.02, y: 0.30 },
    excalibur: { x0: -0.30, x1: 1.02, y: 0.32 },
    baguette: { x0: -0.10, x1: 1.06, y: 0.16 },
    chainsaw: { x0: -0.48, x1: 1.12, y: 0.28 },
    starfish: { x0: -0.48, x1: 0.48, y: 0.48 },
    barnacle_itself: { x0: -0.48, x1: 0.48, y: 0.52 },
    _fallback: { x0: -0.40, x1: 1.02, y: 0.16 },
  };

  // ================================================================ 对外接口
  // opts: { len: 刃长, rot: 额外旋转, crit: 暴击时刃身泛金 }
  function draw(g, knife, opts) {
    opts = opts || {};
    const id = typeof knife === 'string' ? knife : (knife && (knife.id || knife.wid));
    const len = opts.len || (knife && knife.blade) || 40;
    const fn = ART[id] || ART._fallback;
    g.save();
    if (opts.rot) g.rotate(opts.rot);
    // 暴击：整体罩一层暖金
    if (opts.crit) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.28;
      g.fillStyle = '#FFD98A';
      g.beginPath();
      g.ellipse(len * 0.45, 0, len * 0.6, len * 0.16, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    try { fn(g, len); } catch (e) { ART._fallback(g, len); }
    g.restore();
  }

  // 给商店 / 背包 / 图鉴的图标用：按包围盒自动缩放并居中
  function drawIcon(g, knife, w, h) {
    const id = typeof knife === 'string' ? knife : (knife && knife.id);
    const len = (knife && knife.blade) || 40;
    const e = EXT[id] || EXT._fallback;
    const bx0 = e.x0 * len, bx1 = e.x1 * len, by = e.y * len;
    const bw = bx1 - bx0, bh = by * 2;
    const pad = 0.10;                                   // 留 10% 边距
    const s = Math.min((w * (1 - pad * 2)) / bw, (h * (1 - pad * 2)) / bh);
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate((knife && knife.kind === 'thrust') ? -0.10 : -0.14);
    g.scale(s, s);
    g.translate(-(bx0 + bx1) / 2, 0);                    // 把包围盒中心移到原点
    draw(g, knife, { len });
    g.restore();
  }

  return { draw, drawIcon, ART, EXT, has: (id) => !!ART[id] };
});
