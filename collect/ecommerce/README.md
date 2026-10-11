# 电商数据采集（ecommerce）

`ecommerce_search` 工具通过 HTTP / Playwright 无头浏览器抓取电商商品（标题/价格/链接/库存）。

## 支持平台

| platform | 数据源 | 说明 |
|----------|--------|------|
| `books`（默认） | books.toscrape.com | 稳定开放电商练习站，真实图书商品 + 价格 + 库存，任何网络环境都能返回（推荐先用它验证功能）；支持 `page` 翻页 |
| `amazon` | Amazon | Playwright 真实抓取。大站对机房 IP / 无 cookie 有反爬，结果可能不完整或为空 |
| `ebay` | eBay | Playwright 真实抓取，反爬同上 |

```
ecommerce_search(platform="books", limit=10)
ecommerce_search(platform="amazon", keyword="mechanical keyboard", limit=10)
```

## 依赖

```bash
npm install playwright
npx playwright install chromium
```

（本仓库已装好。）

## 补充：更强的电商数据源（可选）

若需要淘宝/京东/拼多多/抖音电商等国内平台的大盘商品数据（销量/榜单），纯免费难拿到，可再接：

1. **JustOneAPI**（国内平台全覆盖，付费，MCP 远程接入）：
   ```json
   { "mcpServers": { "justoneapi": {
     "url": "https://mcp.justoneapi.com/mcp",
     "headers": { "Authorization": "Bearer your_token" } } } }
   ```
2. **Apify**（2000+ Actor，含电商，有免费额度）：可装 Apify MCP 接入。
