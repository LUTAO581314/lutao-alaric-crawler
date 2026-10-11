#!/usr/bin/env node
// MediaCrawler 一键扫码登录
// 用法（在仓库根运行）：
//   node scripts/social-login.mjs --platform bilibili
// 会打开一个真实浏览器窗口，用对应 App 扫码登录；成功后登录态保存到
// tools/mediacrawler/browser_data/<platform>，之后 social_search 工具即可免登录采集。
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const MEDIA_ROOT = path.join(root, 'tools', 'mediacrawler');
const PYTHON =
  process.platform === 'win32'
    ? path.join(MEDIA_ROOT, '.venv/Scripts/python.exe')
    : path.join(MEDIA_ROOT, '.venv/bin/python');

const MAP = {
  xiaohongshu: 'xhs',
  douyin: 'dy',
  kuaishou: 'ks',
  bilibili: 'bili',
  weibo: 'wb',
  tieba: 'tieba',
  zhihu: 'zhihu',
};

let platform = 'bilibili';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--platform' && argv[i + 1]) platform = argv[i + 1];
}
const mc = MAP[platform];
if (!mc) {
  console.log(`未知平台: ${platform}\n可选: ${Object.keys(MAP).join(' / ')}`);
  process.exit(1);
}
if (!existsSync(PYTHON)) {
  console.log(`未找到 MediaCrawler 的 Python 环境: ${PYTHON}\n请先安装依赖（见 README「国内社媒采集」）。`);
  process.exit(1);
}

console.log(`\n=== MediaCrawler 登录: ${platform} (${mc}) ===`);
console.log('即将打开一个浏览器窗口，请用它对应 App 的“扫一扫”登录（约 1 分钟）。');
console.log('登录成功后登录态自动保存到 browser_data/' + mc + '。\n');

const child = spawn(
  PYTHON,
  [
    'main.py',
    '--platform', mc,
    '--type', 'search',
    '--keywords', '登录',
    '--save_data_option', 'jsonl',
    '--lt', 'qrcode',
    '--headless', 'false',
    '--get_comment', 'false',
    '--get_media', 'false',
    '--crawler_max_notes_count', '1',
  ],
  {
    cwd: MEDIA_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      PATH: process.env.PATH ? `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` : path.dirname(process.execPath),
      PATHEXT: process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC',
    },
  }
);

child.on('error', (e) => {
  console.log('启动失败:', e.message);
  process.exit(1);
});
child.on('close', (code) => {
  const bd = path.join(MEDIA_ROOT, 'browser_data', mc);
  const ok = existsSync(bd) && readdirSync(bd).length > 0;
  console.log(`\n=== 登录流程结束 (退出码 ${code}) ===`);
  if (ok) {
    console.log(`✅ 登录态已保存到 browser_data/${mc}，现在 social_search 可采集 ${platform}。`);
  } else {
    console.log(`⚠️ 未检测到登录态（browser_data/${mc} 为空）。若已扫码，请重试。`);
  }
});
