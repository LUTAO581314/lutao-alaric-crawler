# lutao-alaric-crawler

Lutao Alaric 多平台数据采集仓库 —— 统一 MCP 服务 + 多平台/多范围数据采集模块。

通过一个 MCP 服务器，向 AI 助手提供统一的数据采集能力，覆盖国内社交、电商、全球新闻资讯、全球航班、实时地图/摄像头等多类数据源。

## 特性

- **MCP 服务**：TypeScript 实现，提供统一的 tools 接口，可接入任意支持 MCP 的 AI 客户端（opencode / Claude / Cursor 等）
- **多平台采集**：按平台/范围模块化组织，各自独立
- **全球数据源**：全球航班实时数据（OpenSky）、全球新闻（Google News RSS）、全球地震（USGS）
- **World Monitor 集成**：桥接 88k+ stars 的全球实时情报仪表盘（新闻/冲突/航班/能源/金融/风险）
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
│   │   │   ├── livestream/       # 全球实时地理（USGS 地震等）
│   │   │   ├── domestic-social/  # 国内社交（MediaCrawler）
│   │   │   ├── ecommerce/        # 电商（Playwright）
│   │   │   └── world-monitor/    # World Monitor 全球情报桥接
│   │   └── utils/           # 通用工具（HTTP、环境变量等）
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

> 本仓库的 MCP 服务共暴露 **11 个工具**，分两类：本地免费采集器（开箱即用，无需 key）
> 与 World Monitor 全球情报（需 API key）。

### 本地免费采集器（无需 API key）

| 工具 | 数据源 | 说明 |
|------|--------|------|
| `flights_all` | OpenSky Network | 全球当前所有在飞民航航班实时状态 |
| `flights_area` | OpenSky Network | 指定经纬度边界框内的实时航班 |
| `flight_track` | OpenSky Network | 某航班的历史飞行轨迹 |
| `news_top` | Google News RSS | 某国家/地区实时新闻热榜 |
| `news_search` | Google News RSS | 按关键词搜索全球新闻 |
| `earthquakes_recent` | USGS | 近 24 小时全球地震 |
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
