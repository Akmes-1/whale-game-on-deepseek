'use strict';
// 交付前检查：本地引用是否都存在
const fs = require('fs');
const path = require('path');
const dir = 'D:/deepseek/whale-game';
const s = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
let ok = 0, bad = 0;
for (const m of s.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const p = m[1];
  if (fs.existsSync(path.join(dir, p))) ok++;
  else { console.log('缺失:', p); bad++; }
}
console.log(`index.html 引用的本地文件: ${ok} 个存在, ${bad} 个缺失`);

// 关键文件是否齐全
const need = ['index.html', 'css/style.css', 'js/rules.js', 'js/assets.js', 'js/game.js', 'README.md'];
for (const f of need) {
  const p = path.join(dir, f);
  console.log(`${fs.existsSync(p) ? 'OK  ' : '缺失'} ${f}  ${fs.existsSync(p) ? (fs.statSync(p).size / 1024).toFixed(1) + ' KB' : ''}`);
}
