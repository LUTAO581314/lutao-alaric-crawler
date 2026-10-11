---
name: social-login
description: Login and login-state (browser_data) management for the domestic social collector (MediaCrawler) in the lutao-alaric-crawler project. Use when the user wants to scan-log-in (扫码/登录) a domestic social platform — 小红书/xiaohongshu, 抖音/douyin, B站/bilibili, 微博/weibo, 贴吧/tieba, 知乎/zhihu — or to back up / restore / list login state (备份/还原/查看 browser_data 登录态), or when the social_search MCP tool reports "not logged in".
---

# 国内社媒登录 & 登录态管理 (MediaCrawler)

本项目的国内社媒采集（MCP 工具 `social_search`）底层是 **MediaCrawler**（Python + Playwright，作者 NanmiCoder），clone 在 `tools/mediacrawler`。登录是**按平台、扫码一次、长期复用**的。本 skill 覆盖：装环境 → 扫码登录 → 备份/还原登录态 → 验证。

## 何时用
- 用户要**扫码 / 登录**某个国内平台（小红书、抖音、B站、微博、贴吧、知乎）
- 用户要**备份 / 还原 / 查看**登录态（browser_data / 登录态 / 登录 cookie）
- `social_search` 返回"未登录 / 需要登录 / not logged in"
- 问 MediaCrawler 怎么装、登录态存在哪

## 关键事实（别猜，按这个来）
- **仓库根**：`C:\Users\LT\Desktop\Workspace\lutao-alaric-crawler`（`package.json` 和 `scripts/` 在这）。所有命令都在**仓库根**运行。
- 采集入口：MCP 工具 `social_search`（属于 `lutao-alaric-crawler` 这个 MCP server）。
- **平台值**（social_search / 脚本的 `--platform`）：`bilibili` `xiaohongshu` `douyin` `weibo` `tieba` `zhihu`。内部映射到 MediaCrawler 的 `bili/xhs/dy/wb/tieba/zhihu`。
- 每个平台**独立**：登录 A 不影响 B；用哪个扫哪个，各扫一次即可。
- **登录态真实位置**：`tools/mediacrawler/browser_data/<平台>_user_data_dir/Default/Network/Cookies`（新版 Chromium 存这里；`Default/Cookies` 是空的遗留文件，别看它）。
- 登录态**长期有效**（几周量级）；只有失效了或删了 `browser_data` 才需重扫。
- 备份是**当时快照**：若 cookie 服务端已过期，还原也救不回，得重扫一次。

## 脚本（都在 `scripts/`，用 node 跑，cwd = 仓库根）
| 命令 | 作用 |
|------|------|
| `node scripts/setup-media.mjs` | 首次装 MediaCrawler：clone + `uv sync` 建 `.venv` + 装 playwright chromium + 关 CDP 模式。幂等（已装则跳过） |
| `node scripts/social-login.mjs --platform <平台>` | 打开**可见**浏览器扫码登录该平台（约 1 分钟）。可加 `--type qrcode\|phone\|cookie` |
| `node scripts/login-backup.mjs backup` | 备份当前登录态 → `backups/login-<时间戳>.tar.gz` |
| `node scripts/login-backup.mjs restore [文件]` | 还原登录态（不带参数 = 最新备份），放回 `tools/mediacrawler/browser_data` |
| `node scripts/login-backup.mjs list` | 列出 `backups/` 里的备份（新→旧） |

## 标准流程
1. **确认环境**：`Test-Path tools\mediacrawler`。没有 → 跑 `node scripts/setup-media.mjs`（需 node、python、uv；uv 缺失时脚本会自动装）。
2. **查哪些平台已登录**：见下方"登录态体检"命令。
3. **登录新平台**：`node scripts/social-login.mjs --platform <平台>`。
   - 会弹出**可见**的 Chromium 窗口 → **让用户扫码**（agent 扫不了码）。
   - 明确告诉用户"请用手机 App 扫码"，等用户确认扫完再继续。
   - 遇到验证码 / 人机校验：**别自己硬闯**，暂停让用户处理。
   - 登录成功后 → 立刻 `node scripts/login-backup.mjs backup` 存一份。
4. **验证**：调 MCP `social_search`（`platform` / `keyword` / `type=search` / `limit=3`）。返回真实内容 = 成功；返回"未登录"提示 = 该扫这个平台。

## 规则 / 坑
- 所有命令 **cwd = 仓库根**，别 cd 到 `tools/mediacrawler` 里跑脚本。
- 一个平台**扫一次**就够，长期复用；别重复扫。
- 每次**成功登录后 backup 一份**，还原时用最新的。
- **别删** `tools/mediacrawler/browser_data/`（删了登录态就没了）。
- `backups/` 默认 gitignore（含 cookie），别提交；要随仓库走再单独说。
- 登录窗口是**可见**的，别在用户扫完前关掉。
- 机房 IP 下抖音/小红书更容易出验证码——出现就暂停让用户过验证。

## 登录态体检（快速判断）
```powershell
Get-ChildItem tools\mediacrawler\browser_data -Directory | ForEach-Object {
  $ck = Join-Path $_.FullName "Default\Network\Cookies"
  $n = if (Test-Path $ck) { (Get-Item $ck).Length } else { 0 }
  "{0}  cookies={1} 字节  {2}" -f $_.Name, $n, $(if ($n -gt 0) { "已登录" } else { "未登录/失效" })
}
```
