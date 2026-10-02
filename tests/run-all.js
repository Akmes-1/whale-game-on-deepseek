'use strict';
/*
 * 一次跑完所有检查。
 * 注意：这个沙箱里不能用管道捕获子进程输出（会 EPERM），所以用 stdio:'inherit' 直接放行，
 * 只靠退出码判断成败。
 */
const { spawnSync } = require('child_process');
const path = require('path');

const GAME = 'D:/deepseek/whale-game';
const KIT = 'D:/deepseek/whale-brand-kit';
const runs = [
  ['游戏无头测试（规则 + 经济 + 循环）', path.join(GAME, 'tests/headless.js'), GAME],
  ['修复回归（藤壶消失 / 鲸鱼是蓝的 / 路径有效）', path.join(KIT, 'tools/tests/_regress_fixes.js'), KIT],
  ['完整流程（清理→变身→道谢→离开→下一条→商店）', path.join(KIT, 'tools/tests/_flow_thank.js'), KIT],
  ['新功能（直刺剑 / 特质 / 存档 / 变身形象）', path.join(KIT, 'tools/tests/_new_features.js'), KIT],
  ['藤壶落点与鲸鱼图对齐', path.join(KIT, 'tools/tests/_anchor_align.js'), KIT],
  ['节奏平衡模拟（会打偏的玩家）', path.join(KIT, 'tools/tests/_balance_sim.js'), KIT],
  ['鲸鱼路径语法（浏览器能否解析）', path.join(KIT, 'tools/tests/_path_syntax.js'), KIT],
  ['交付检查（引用是否齐全）', path.join(GAME, 'tests/_deliver_check.js'), GAME],
];
let failed = 0;
for (const [name, file, cwd] of runs) {
  console.log(`\n================= ${name} =================`);
  const r = spawnSync(process.execPath, [file], { cwd, stdio: 'inherit' });
  if (r.status === 0) {
    console.log(`→ ${name}：通过（退出码 0）`);
  } else {
    failed++;
    console.log(`→ ${name}：失败（退出码 ${r.status}）`);
  }
}
console.log(failed === 0
  ? '\n################ 全部检查通过 ################'
  : `\n################ 有 ${failed} 项失败 ################`);
process.exit(failed === 0 ? 0 : 1);
