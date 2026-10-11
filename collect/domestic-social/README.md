# 国内社交采集（domestic-social）

基于开源工具 [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler)（无头浏览器）深度采集国内主流社交平台的内容，返回标题、播放/点赞/弹幕/评论/收藏/投币等统计、链接、作者。

## 支持平台

bilibili（B站）、xiaohongshu（小红书）、douyin（抖音）、weibo（微博）、tieba（贴吧）、zhihu（知乎）。

## 安装（一次性）

MediaCrawler 已 clone 到 `tools/mediacrawler`，依赖用 `uv` 管理在独立 venv（不污染主环境）：

```bash
cd tools/mediacrawler
uv sync                                   # 安装 Python 依赖
uv run python -m playwright install chromium   # 安装浏览器
```

> 本仓库已把 MediaCrawler 改为 standard 模式 + 关闭代理（`config/base_config.py` 的
> `ENABLE_CDP_MODE = False`），不依赖本地 Chrome 及其代理设置。

## 登录（每个平台一次性，扫码）

MediaCrawler 用真实浏览器 + 登录态采集，首次需扫码；登录态存于
`tools/mediacrawler/browser_data/<平台>`，之后 headless 复用免登录。

```bash
node scripts/social-login.mjs --platform bilibili
node scripts/social-login.mjs --platform xiaohongshu
```

## 通过 MCP 调用

登录后调用 `social_search`（headless 复用登录态，只返回本次关键词新增结果）：

```
social_search(platform="bilibili", keyword="机器学习", limit=10)
social_search(platform="bilibili", type="creator", creator_ids="xxx", limit=10)
```

未登录时该工具会提示你先运行上面的登录脚本。

> 反爬提示：国内平台反爬较强，建议用稳定的登录态；`tools/mediacrawler/config/base_config.py`
> 里可开 `ENABLE_IP_PROXY` 配代理。
