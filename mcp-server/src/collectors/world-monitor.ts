/**
 * World Monitor —— 全球实时情报集成
 *
 * World Monitor（https://github.com/koala73/worldmonitor）是一个强大的开源
 * 全球实时情报仪表盘：AI 新闻聚合、地缘政治监控、基础设施追踪、金融市场、
 * 航班、能源、供应链等。它自带 MCP 服务器（https://worldmonitor.app/mcp）和
 * REST API（https://api.worldmonitor.app，OpenAPI: /openapi.yaml）。
 *
 * 集成方式（推荐）：
 *  - 直接在 MCP 客户端里添加远程服务器 https://worldmonitor.app/mcp，
 *    用 X-WorldMonitor-Key 头或 OAuth 认证（见 README「接入 World Monitor」）。
 *  - 本模块提供一个本地桥接工具 tell_world_monitor，把请求转发到其 REST API，
 *    用于需要在本地统一入口的场景。未配置 key 时提示用户如何设置。
 *
 * 注意：World Monitor 源码为 AGPL-3.0。通过其官方公开 MCP/REST 端点调用属于
 * 使用其提供的服务，不构成对源码的修改；本模块仅做 HTTP 桥接，不含其代码。
 */
import { z } from "zod";
import { env } from "../utils/http.js";
import type { Collector, CollectorTool } from "../types.js";

const REST_BASE = env("WORLDMONITOR_API_BASE", "https://api.worldmonitor.app");

async function callWorldMonitor(
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  const key = env("WORLDMONITOR_API_KEY");
  if (!key) {
    return (
      `World Monitor 需要 API key（在 https://worldmonitor.app/pro 获取）。\n` +
      `请设置环境变量 WORLDMONITOR_API_KEY 后重试。\n` +
      `或直接在 MCP 客户端添加远程服务器: World Monitor (https://worldmonitor.app/mcp) 并使用其官方认证。`
    );
  }
  try {
    const res = await fetch(`${REST_BASE}/tools/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-WorldMonitor-Key": key,
      },
      body: JSON.stringify({ tool, args }),
    });
    if (!res.ok) {
      return `World Monitor 请求失败: HTTP ${res.status} ${res.statusText}`;
    }
    const data: any = await res.json();
    return typeof data === "string"
      ? data
      : JSON.stringify(data, null, 2).slice(0, 8000);
  } catch (e: any) {
    return `World Monitor 请求异常: ${e.message}`;
  }
}

/** World Monitor 常用工具白名单（可在配置层按需扩展） */
export const worldMonitorCollector: Collector = {
  name: "world-monitor",
  description: "World Monitor 全球实时情报（新闻/冲突/航班/能源/金融/风险），需 API key",

  tools: [
    {
      tool: {
        name: "worldmonitor_news",
        description:
          "获取全球新闻情报摘要（World Monitor）。可选参数 region/focus。需要配置 WORLDMONITOR_API_KEY。",
        inputSchema: {
          focus: z.string().optional().describe("关注主题，如 geopolitics/finance/energy"),
        },
      },
      handler: async (args) => callWorldMonitor("get_news_intelligence", args),
    },
    {
      tool: {
        name: "worldmonitor_country",
        description:
          "获取某国的风险简报/情报（World Monitor）。参数 country_code 国家名或 ISO 码。需要 WORLDMONITOR_API_KEY。",
        inputSchema: {
          country_code: z.string().describe("国家名或 ISO2 码，如 China 或 CN"),
          topic: z
            .enum(["overview", "all", "resilience", "security", "economy", "resources"])
            .optional()
            .describe("主题，默认 overview"),
        },
      },
      handler: async (args) =>
        callWorldMonitor("open_country_brief", {
          country_code: args.country_code,
          topic: args.topic || "overview",
        }),
    },
    {
      tool: {
        name: "worldmonitor_flights",
        description:
          "查询全球航班状态/实时数据（World Monitor，Wingbits ADS-B）。参数可含 area/region。需要 WORLDMONITOR_API_KEY。",
        inputSchema: {
          query: z.string().optional().describe("航班/条件查询"),
        },
      },
      handler: async (args) => callWorldMonitor("get_aviation_status", args),
    },
  ] as CollectorTool[],
};
