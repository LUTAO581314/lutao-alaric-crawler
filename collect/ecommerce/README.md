# 电商数据采集（ecommerce）

电商平台数据采集模块。电商反爬较强，推荐组合使用：

1. **JustOneAPI**（国内平台全覆盖，付费，MCP 远程接入）
2. **Apify**（1000+ Actor，含电商，按需付费，有免费额度）
3. 本模块的 **Playwright 通用抓取**（免费，自建）

## 本模块当前实现

`ecommerce_search` 工具目前为 Playwright 抓取骨架（amazon/ebay 演示）。完整实现需：

```bash
npm install playwright
npx playwright install chromium
```

## 推荐：接入 JustOneAPI MCP（国内电商全）

JustOneAPI（https://github.com/justoneapi-official/justoneapi-mcp）提供淘宝/京东/
1688/闲鱼/Shopee/亚马逊等电商数据接口。在 MCP 客户端添加远程服务器：

```json
{
  "mcpServers": {
    "justoneapi": {
      "url": "https://mcp.justoneapi.com/mcp",
      "headers": { "Authorization": "Bearer your_token" }
    }
  }
}
```

## 推荐：接入 Apify（海外电商 + 免费额度）

Apify（https://apify.com）有大量电商 Actor（淘宝/亚马逊/Shopee/Shopify 等），
有免费额度，可装 Apify MCP 接入。
