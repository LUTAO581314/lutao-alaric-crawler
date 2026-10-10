# 国内社交采集（domestic-social）

基于开源工具 [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) 采集国内主流社交平台数据。

## 支持平台

小红书（xhs）、抖音（dy）、微博（wb）、B站（bili）、快手（ks）

## 安装步骤

1. 克隆 MediaCrawler 到本目录：

   ```bash
   cd collect/domestic-social
   git clone https://github.com/NanmiCoder/MediaCrawler.git
   cd MediaCrawler
   ```

2. 安装依赖（Python 3.11+）：

   ```bash
   pip install -r requirements.txt
   # 安装 playwright 浏览器
   playwright install chromium
   ```

3. 配置 `.env`（复制示例）：

   ```bash
   cp .env.example .env
   ```

   按需在 `.env` 设置采集方式（cookie 登录 / playwright 扫码）、平台开关等。

4. 设置本仓库的 `MEDIACRAWLER_DIR` 环境变量指向该目录（默认 `collect/domestic-social/MediaCrawler`）。

## 通过 MCP 调用

安装完成后，本仓库 MCP 服务的 `social_search` 工具会调用 MediaCrawler 主程序：

```
social_search(platform="xiaohongshu", keyword="咖啡", limit=20)
```

## 手动运行

也可以直接运行 MediaCrawler：

```bash
cd collect/domestic-social/MediaCrawler
python main.py --platform xhs --lt keyword -k "咖啡" --limit 20
```

> 反爬提示：国内平台反爬较强，建议配置代理（`.env` 中 `PROXY_URL`）并使用稳定的
> cookie/账号登录态。
