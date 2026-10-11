#!/usr/bin/env node
// 备份 / 还原 MediaCrawler 登录态（browser_data 文件夹）
//
// 用法（在仓库根运行）：
//   node scripts/login-backup.mjs backup           # 备份当前登录态到 backups/
//   node scripts/login-backup.mjs restore [文件]    # 还原（不带参数 = 最新备份）
//   node scripts/login-backup.mjs list             # 列出所有备份
//
// 原理：browser_data 是 Chromium 的登录态/cookies，纯文件夹，可直接压缩备份；
// 还原后放回 tools/mediacrawler/browser_data，social_search 即免登录复用。
// 注意：备份的是"当时"的登录快照——若 cookie 服务端已失效，还原也救不回，仍需重扫。
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const MEDIA = path.join(root, 'tools', 'mediacrawler');
const BD = path.join(MEDIA, 'browser_data');
const BACKUP_DIR = path.join(root, 'backups');

function listBackups() {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('login-') && f.endsWith('.tar.gz'))
    .map((f) => path.join(BACKUP_DIR, f))
    .sort();
}

const cmd = process.argv[2] || 'list';

if (cmd === 'backup') {
  if (!existsSync(BD)) {
    console.error('browser_data 不存在，还没有登录态可备份（先扫码登录）。');
    process.exit(1);
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const out = path.join(BACKUP_DIR, `login-${ts}.tar.gz`);
  execSync(`tar -czf "${out}" -C "${MEDIA}" browser_data`, { stdio: 'inherit' });
  console.log('\n已备份登录态到:', out);
  console.log('还原命令: node scripts/login-backup.mjs restore');
} else if (cmd === 'restore') {
  let file = process.argv[3];
  if (!file) {
    const files = listBackups();
    if (!files.length) {
      console.error('backups/ 里没有备份文件。先跑 backup。');
      process.exit(1);
    }
    file = files[files.length - 1];
  }
  if (!existsSync(file)) {
    console.error('备份文件不存在:', file);
    process.exit(1);
  }
  mkdirSync(MEDIA, { recursive: true });
  execSync(`tar -xzf "${file}" -C "${MEDIA}"`, { stdio: 'inherit' });
  console.log('\n已还原登录态（来自）:', file);
  console.log('现在可直接调用 social_search 采集。');
} else if (cmd === 'list') {
  const files = listBackups();
  if (!files.length) console.log('暂无备份（backups/）。');
  else {
    console.log('备份列表（新->旧）:');
    [...files].reverse().forEach((f) => console.log('  ', path.basename(f)));
  }
} else {
  console.log('用法: node scripts/login-backup.mjs backup|restore [文件]|list');
}
