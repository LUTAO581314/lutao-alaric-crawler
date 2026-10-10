/**
 * lutao-alaric-crawler —— MCP 服务入口
 *
 * 通过 stdio 暴露一组数据采集 tools 给 MCP 客户端。
 * 数据源分两类：
 *  1. 本地免费采集器（OpenSky 航班 / GoogleNews 新闻 / USGS 地震 /
 *     MediaCrawler 国内社交 / Playwright 电商）——开箱即用
 *  2. World Monitor 全球情报（需 API key，经其官方 MCP/REST 接入，
 *     见 README「接入 World Monitor」）
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { globalFlightsCollector } from "./collectors/global-flights.js";
import { globalNewsCollector } from "./collectors/global-news.js";
import { livestreamCollector } from "./collectors/livestream.js";
import { domesticSocialCollector } from "./collectors/domestic-social.js";
import { ecommerceCollector } from "./collectors/ecommerce.js";
import { worldMonitorCollector } from "./collectors/world-monitor.js";
import type { Collector } from "./types.js";

const collectors: Collector[] = [
  globalFlightsCollector,
  globalNewsCollector,
  livestreamCollector,
  domesticSocialCollector,
  ecommerceCollector,
  worldMonitorCollector,
];

const server = new McpServer({
  name: "lutao-alaric-crawler",
  version: "0.1.0",
});

// 汇总工具并注册（inputSchema 为 Zod shape，SDK 据此生成 JSON Schema 并校验参数）
let toolCount = 0;
for (const collector of collectors) {
  for (const { tool, handler } of collector.tools) {
    const callback = async (args: any) => {
      const text = await handler((args ?? {}) as Record<string, unknown>);
      return { content: [{ type: "text" as const, text }] };
    };
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      callback as any
    );
    toolCount++;
  }
}
console.error(`[lutao-alaric-crawler] registered ${toolCount} tools from ${collectors.length} collectors`);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("lt-alaric-crawler fatal:", err);
  process.exit(1);
});
