'use strict';
/*
 * 一键部署到 GitHub Pages（零依赖，只用 Node 自带的 fetch）
 *
 * 用法：
 *   1) 去 GitHub 建一个 Personal Access Token（步骤见下面的说明）
 *   2) 双击「一键部署.bat」，把令牌粘进去
 *   3) 脚本自动：建仓库 -> 上传文件 -> 开启 Pages -> 打印网址
 *
 * 令牌只在这个进程的内存里用一次，不写文件、不上传别的地方。
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TOKEN = process.env.GITHUB_TOKEN || process.argv[2] || '';
const API = 'https://api.github.com';

// 上传时排除的东西（开发用的，玩家不需要）
const EXCLUDE_DIRS = new Set(['tests', '.git', 'node_modules']);
const EXCLUDE_FILES = new Set(['dev.html', 'deploy.js', '一键部署.bat']);

const REPO_NAME = process.env.REPO_NAME || 'whale-spa';
const REPO_DESC = '鲸鱼搓澡店 · 帮大肥鱼切掉身上的赛博藤壶';
const BRANCH = 'main';

if (!TOKEN) {
  console.error('\n[错误] 没有拿到令牌。');
  console.error('请用「一键部署.bat」运行，或者在命令行里：');
  console.error('  set GITHUB_TOKEN=你的令牌');
  console.error('  node deploy.js\n');
  process.exit(1);
}

// ---------------------------------------------------------------- HTTP 小工具
async function api(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    method,
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'whale-spa-deploy',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const msg = (data && data.message) || text || ('HTTP ' + res.status);
    const err = new Error(`${method} ${url} -> ${res.status} ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- 收集要上传的文件
function walk(dir, base, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(name)) continue;
      walk(full, rel, out);
    } else {
      if (EXCLUDE_FILES.has(name)) continue;
      out.push({ rel, full, size: st.size });
    }
  }
  return out;
}

(async function main() {
  console.log('\n=== 鲸鱼搓澡店 · 部署到 GitHub Pages ===\n');

  // 0) 校验令牌
  let me;
  try {
    me = await api('GET', '/user');
  } catch (e) {
    console.error('[失败] 令牌无效或没有权限：' + e.message);
    console.error('\n请确认令牌勾选了 repo（或 fine-grained 的 Contents: Read and write）权限。');
    process.exit(1);
  }
  const owner = me.login;
  console.log(`✓ 已登录：${owner}`);

  // 1) 收集文件
  const files = walk(ROOT, '', []);
  const totalKB = (files.reduce((a, f) => a + f.size, 0) / 1024).toFixed(0);
  console.log(`✓ 待上传 ${files.length} 个文件，共 ${totalKB} KB`);
  console.log('  已排除：dev.html / tests/（开发用的，玩家不需要）');

  // 2) 建仓库（已存在就直接用）
  let repo;
  try {
    repo = await api('GET', `/repos/${owner}/${REPO_NAME}`);
    console.log(`✓ 仓库已存在，直接更新：${repo.full_name}`);
  } catch (e) {
    if (e.status !== 404) throw e;
    repo = await api('POST', '/user/repos', {
      name: REPO_NAME,
      description: REPO_DESC,
      private: false,
      auto_init: false,
      has_issues: true,
    });
    console.log(`✓ 已创建仓库：${repo.full_name}`);
    await sleep(1200);
  }

  // 3) 上传：用 Git Data API 一次提交搞定
  console.log('\n--- 上传文件 ---');
  const blobs = [];
  for (const f of files) {
    const content = fs.readFileSync(f.full).toString('base64');
    const b = await api('POST', `/repos/${owner}/${REPO_NAME}/git/blobs`, {
      content, encoding: 'base64',
    });
    blobs.push({ path: f.rel, mode: '100644', type: 'blob', sha: b.sha });
    process.stdout.write(`  ${f.rel}\n`);
  }

  const tree = await api('POST', `/repos/${owner}/${REPO_NAME}/git/trees`, { tree: blobs });

  // 有没有历史提交？有就带上 parent
  let parents = [];
  try {
    const ref = await api('GET', `/repos/${owner}/${REPO_NAME}/git/ref/heads/${BRANCH}`);
    parents = [ref.object.sha];
  } catch (e) { /* 空仓库，没有 parent */ }

  const commit = await api('POST', `/repos/${owner}/${REPO_NAME}/git/commits`, {
    message: parents.length ? '更新游戏内容' : '部署鲸鱼搓澡店',
    tree: tree.sha,
    parents,
  });

  if (parents.length) {
    await api('PATCH', `/repos/${owner}/${REPO_NAME}/git/refs/heads/${BRANCH}`, {
      sha: commit.sha, force: false,
    });
    console.log('✓ 已提交更新');
  } else {
    await api('POST', `/repos/${owner}/${REPO_NAME}/git/refs`, {
      ref: `refs/heads/${BRANCH}`, sha: commit.sha,
    });
    console.log('✓ 已创建 main 分支并提交');
  }

  // 4) 开启 GitHub Pages
  console.log('\n--- 开启 GitHub Pages ---');
  let pagesOk = false;
  try {
    await api('POST', `/repos/${owner}/${REPO_NAME}/pages`, {
      source: { branch: BRANCH, path: '/' },
    });
    pagesOk = true;
    console.log('✓ Pages 已开启');
  } catch (e) {
    if (e.status === 409) {
      // 已经开过了，改成更新配置
      try {
        await api('PUT', `/repos/${owner}/${REPO_NAME}/pages`, {
          source: { branch: BRANCH, path: '/' },
        });
        pagesOk = true;
        console.log('✓ Pages 已存在，配置已更新');
      } catch (e2) { console.log('  Pages 配置更新失败（可能已开启，可忽略）：' + e2.message); }
    } else {
      console.log('  Pages 开启失败：' + e.message);
    }
  }

  const url = `https://${owner}.github.io/${REPO_NAME}/`;
  console.log('\n========================================');
  console.log('  部署完成！');
  console.log('  网址：' + url);
  console.log('========================================');
  console.log('\n注意：GitHub Pages 第一次构建要等 1~3 分钟。');
  console.log('如果打开是 404，等一会儿刷新即可。');
  if (!pagesOk) {
    console.log('\n如果一直 404，手动开一下：');
    console.log(`  仓库 Settings -> Pages -> Source 选 "Deploy from a branch" -> ${BRANCH} / (root) -> Save`);
  }
  console.log(`\n仓库地址：${repo.html_url}`);
  console.log('\n手机可以直接打开上面的网址玩（建议横屏）。\n');
})().catch(e => {
  console.error('\n[部署失败] ' + e.message);
  if (e.status === 401) console.error('令牌无效，请重新生成。');
  if (e.status === 403) console.error('令牌权限不够，需要 repo（或 Contents: Read and write）权限。');
  if (e.status === 422) console.error('可能是仓库名已被占用，试试改 REPO_NAME。');
  process.exit(1);
});
