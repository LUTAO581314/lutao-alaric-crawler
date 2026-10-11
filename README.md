# lutao-alaric-crawler

Lutao Alaric 多平台数据采集仓库 —— 统一 MCP 服务 + 多平台/多范围数据采集模块。

通过一个 MCP 服务器，向 AI 助手提供统一的数据采集能力，覆盖国内社交、电商、全球新闻资讯、全球航班、实时地图/摄像头等多类数据源。

## 特性

- **MCP 服务**：TypeScript 实现，提供统一的 tools 接口，可接入任意支持 MCP 的 AI 客户端（opencode / Claude / Cursor 等）
- **多平台采集**：按平台/范围模块化组织，各自独立，**30 个工具、16 个采集器**
- **全球数据源（全免费无 key）**：全球航班（OpenSky）、全球新闻/地缘政治（GDELT + Google News RSS）、全球天气（Open-Meteo）、全球地震（USGS）
- **金融行情（免费无 key）**：全球大盘/指数/外汇/大宗/国债/央行利率（Yahoo Finance），加密货币多源容错（OKX/Binance/CoinGecko/Yahoo），中文别名直查
- **A股/板块（免费无 key）**：东方财富个股/行业板块/概念板块/涨幅榜，中文名称自动解析
- **财经/政策新闻 + 舆情（免费无 key）**：华尔街见闻/新浪/Bloomberg 财经 RSS + 东方财富 7x24 快讯 + 微博/百度/知乎/B站/抖音热搜
- **跨平台社媒 + 商城（免费无 key）**：B站热门/排行/视频、YouTube 视频、Shopify 任意店铺商品
- **World Monitor 集成（可选，付费）**：桥接 88k+ stars 的全球实时情报仪表盘
- **可扩展**：新增采集器只需在 `mcp-server/src/collectors` 添加一个模块并在入口注册

## 模块结构

```
lutao-alaric-crawler/
├── mcp-server/              # MCP 服务（Node/TypeScript）
│   ├── src/
│   │   ├── index.ts         # MCP 服务入口，注册所有 tools
│   │   ├── types.ts         # Collector 接口定义
│   │   ├── collectors/      # 各平台/数据源采集器
│   │   │   ├── global-flights/   # 全球航班（OpenSky）
│   │   │   ├── global-news/      # 全球新闻（Google News RSS）
│   │   │   ├── gdelt/            # 全球新闻/地缘政治（GDELT，免费）
│   │   │   ├── weather/          # 全球天气（Open-Meteo，免费）
│   │   │   ├── finance/          # 大盘/指数/外汇/大宗（Yahoo Finance，免费）
│   │   │   ├── finance-news/     # 财经/政策新闻（多源 RSS，免费）
│   │   │   ├── a-shares/         # A股/行业/概念/榜单（东方财富，免费）
│   │   │   ├── opinion/          # 舆情：财经快讯 + 多平台热搜（免费）
│   │   │   ├── crypto/           # 加密货币行情（多源容错，免费）
│   │   │   ├── bilibili/         # B站社媒/视频（热门/排行/视频，免费）
│   │   │   ├── youtube/          # YouTube 视频（oEmbed，免费）
│   │   │   ├── shopify/          # Shopify 海外商城商品（免费）
│   │   │   ├── livestream/       # 全球实时地理（USGS 地震等）
│   │   │   ├── domestic-social/  # 国内社交（MediaCrawler）
│   │   │   ├── ecommerce/        # 电商（Playwright）
│   │   │   └── world-monitor/    # World Monitor 全球情报桥接（可选付费）
│   │   └── utils/           # 通用工具（HTTP、RSS、环境变量等）
├── collect/                 # 各采集器的独立脚本/子模块（Python 等）
│   ├── domestic-social/     # MediaCrawler 等开源工具集成
│   ├── ecommerce/
│   ├── global-news/
│   ├── global-flights/
│   └── livestream/
├── config/                  # 配置文件（API key、代理、频率等）
├── scripts/                 # 辅助脚本（启动、调度、部署）
└── .env                     # 环境变量（不入库，见 .env.example）
```

## 快速开始

### 环境要求

- Node.js 18+
- （可选）Python 3.10+：部分国内社交采集依赖 MediaCrawler 等开源工具

### 安装

```bash
npm install
```

### 配置

复制并填写环境变量：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | （可选）OpenAI 兼容接口 Key |
| `OPENSKY_USERNAME` / `OPENSKY_PASSWORD` | OpenSky 航班 API（可选，免费匿名可调） |
| `NEWS_API_KEY` | 新闻聚合 API Key（可选） |
| `PROXY_URL` | 代理（可选，抓国内平台时用） |

### 运行 MCP 服务

```bash
npm run dev      # 开发模式
npm run build    # 编译
npm start        # 运行编译产物
```

以 stdio 方式运行，供 MCP 客户端连接。

## MCP 接入示例（opencode）

在 opencode 全局配置 `~/.config/opencode/opencode.json` 的 `mcp` 段加入：

```json
{
  "mcp": {
    "lutao-alaric-crawler": {
      "type": "local",
      "command": ["node", "/path/to/lutao-alaric-crawler/dist/index.js"],
      "enabled": true
    }
  }
}
```

## 各数据源说明

> 本仓库的 MCP 服务共暴露 **30 个工具**：本地免费采集器（开箱即用，无需 key）
> 与 World Monitor 全球情报（可选，需 API key）。

### 全球数据源（无需 API key）

| 工具 | 数据源 | 说明 |
|------|--------|------|
| `flights_all` / `flights_area` / `flight_track` | OpenSky Network | 全球航班实时状态/区域/轨迹 |
| `news_top` / `news_search` | Google News RSS | 地区新闻热榜 / 关键词搜索 |
| `gdelt_news` / `gdelt_trend` | GDELT Project | 全球新闻（含地缘政治）/ 关键词趋势 |
| `weather_city` / `weather_coords` | Open-Meteo | 城市/坐标 天气 + 预报（自动转坐标） |
| `earthquakes_recent` | USGS | 近 24 小时全球地震 |

### 金融行情（无需 API key）

| 工具 | 数据源 | 说明 |
|------|--------|------|
| `market_index` / `market_multi` | Yahoo Finance | 大盘/指数/外汇/大宗/国债/央行利率，中文别名直查，可批量 |
| `crypto_price` | OKX/Binance/CoinGecko/Yahoo | 加密货币行情（多源容错，自动切换） |

### A股 / 板块（无需 API key）

| 工具 | 数据源 | 说明 |
|------|--------|------|
| `a_stock` | 东方财富 | A股个股实时行情（代码或中文名，自动解析） |
| `a_sectors` | 东方财富 | 行业板块 / 概念板块涨幅榜 |
| `a_ranking` | 东方财富 | A股涨幅榜 / 跌幅榜 / 成交额榜 |

### 财经新闻 / 舆情 / 舆论（无需 API key）

| 工具 | 数据源 | 说明 |
|------|--------|------|
| `finance_news` | 华尔街见闻/新浪/Bloomberg | 财经/政策新闻多源聚合，支持关键词过滤 |
| `finance_flash` | 东方财富 7x24 | 全球财经快讯（实时舆情/政策信号） |
| `hot_search` | 60s 聚合 | 微博/百度/知乎/B站/抖音 热搜榜（舆论风向） |

### 跨平台社媒 / 商城（无需 API key）

| 工具 | 数据源 | 说明 |
|------|--------|------|
| `bilibili_hot` / `bilibili_ranking` / `bilibili_video` | B站 | 热门视频 / 分区排行 / 视频详情 |
| `youtube_video` | YouTube oEmbed | 视频信息（标题/频道/缩略图） |
| `shopify_products` / `shopify_search` | Shopify | 任意 Shopify 店铺商品 / 店内检索 |

### 其它

| 工具 | 数据源 | 说明 |
|------|--------|------|
| `social_search` | MediaCrawler（需安装） | 小红书/抖音/微博/B站/快手 关键词搜索 |
| `ecommerce_search` | Playwright（需安装） | 电商搜索（骨架，见 README） |

### World Monitor 全球实时情报（需 API key）

| 工具 | 说明 |
|------|------|
| `worldmonitor_news` | 全球新闻情报摘要 |
| `worldmonitor_country` | 某国风险简报/情报 |
| `worldmonitor_flights` | 全球航班状态（Wingbits ADS-B） |

[World Monitor](https://github.com/koala73/worldmonitor)（88k+ stars）是强大的开源全球实时
情报仪表盘：AI 新闻聚合、地缘政治监控、基础设施追踪、金融/能源/供应链等，共 90 个工具。

## 接入 World Monitor（重要）

World Monitor 本身就是一个**完整的 MCP 服务器**（`https://worldmonitor.app/mcp`，
Streamable HTTP），提供 90 个工具。两种接入方式：

**方式 A：直接在 MCP 客户端添加远程服务器（推荐）**

在你的 MCP 客户端（opencode / Claude / Cursor 等）配置里添加：

```json
{
  "mcpServers": {
    "worldmonitor": {
      "url": "https://worldmonitor.app/mcp",
      "headers": { "X-WorldMonitor-Key": "wm_xxx" }
    }
  }
}
```

Key 在 <https://worldmonitor.app/pro> 获取，也支持 OAuth。这种方式能直接获得全部 90 个
World Monitor 工具，无需经过本仓库。

**方式 B：通过本仓库的本地桥接工具**

设置环境变量 `WORLDMONITOR_API_KEY` 后，本仓库的 `worldmonitor_*` 工具会把请求转发
到 World Monitor REST API（`https://api.worldmonitor.app`）。适合希望在本地统一入口
的场景。未配置 key 时这些工具会提示你如何设置。

> 许可证说明：World Monitor 源码为 AGPL-3.0。本仓库通过其**官方公开 MCP/REST 端点**
> 调用，属于使用其提供的服务，不构成对源码的修改，故与本仓库的 MIT 许可不冲突。

### 国内社交（domestic-social）
通过 [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) 开源工具采集小红书、抖音、微博、B 站、快手等。参见 `collect/domestic-social/README.md`。

### 全球航班（global-flights）
基于 [OpenSky Network](https://opensky-network.org/) 开放 API，获取全球任意区域实时的民航航班位置、高度、速度、航向等数据。无需 key 可匿名调用。

### 全球新闻资讯（global-news）
聚合全球主要媒体的实时新闻资讯（Google News RSS，无需 key）。

### 全球实时摄像头/地图（livestream）
全球实时地理数据源模块（当前含 USGS 地震；实时摄像头/地图待扩展，可直接用 World Monitor 的航班/地图数据）。

## License

MIT
