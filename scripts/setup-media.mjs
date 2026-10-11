#!/usr/bin/env node
// 一键安装 MediaCrawler（国内社媒采集依赖）
// 用法（在仓库根运行）：node scripts/setup-media.mjs
// 步骤：clone MediaCrawler -> uv sync 装依赖 -> 装 chromium -> 关闭 CDP 模式
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const MEDIA = path.join(root, 'tools', 'mediacrawler');

function sh(cmd, opts = {}) {
  console.log('$', cmd);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

console.log('=== 安装 MediaCrawler（国内社媒采集依赖）===\n');

// 0. 检查 uv
try {
  execSync('uv --version', { stdio: 'ignore' });
} catch {
  console.error('未找到 uv。请先安装：pip install uv（或见 https://docs.astral.sh/uv/）');
  process.exit(1);
}

// 1. clone
if (existsSync(path.join(MEDIA, 'main.py'))) {
  console.log('已存在 tools/mediacrawler，跳过 clone。\n');
} else {
  mkdirSync(path.join(root, 'tools'), { recursive: true });
  sh(`git clone --depth 1 https://github.com/NanmiCoder/MediaCrawler.git "${MEDIA}"`);
}

// 2. 依赖（独立 venv，不污染主环境）
sh('uv sync', { cwd: MEDIA });

// 3. 浏览器
sh('uv run python -m playwright install chromium', { cwd: MEDIA });

// 4. 关闭 CDP 模式（避免连接本地 Chrome 及其代理；用 playwright 自己的 chromium）
const cfg = path.join(MEDIA, 'config', 'base_config.py');
try {
  let src = readFileSync(cfg, 'utf-8');
  if (/^\s*ENABLE_CDP_MODE\s*=\s*True/m.test(src)) {
    src = src.replace(/^\s*ENABLE_CDP_MODE\s*=\s*True/m, 'ENABLE_CDP_MODE = False');
    writeFileSync(cfg, src, 'utf-8');
    console.log('\n已将 config/base_config.py 的 ENABLE_CDP_MODE 设为 False。');
  }
} catch (e) {
  console.log('跳过 CDP 配置（读取 base_config.py 失败）:', e.message);
}

console.log('\n=== 安装完成。下一步：扫码登录（每个平台一次性，约 1 分钟）===');
console.log('  node scripts/social-login.mjs --platform bilibili');
console.log('  node scripts/social-login.mjs --platform xiaohongshu');
console.log('\n登录后即可调用 social_search 工具采集对应平台。');
