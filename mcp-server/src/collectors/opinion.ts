/**
 * 舆情 / 舆论采集器 —— 财经快讯 + 多平台热搜
 *
 * 数据源（免费无 key）：
 * - 东方财富 7x24 全球财经快讯（实时财经舆情/政策信号）
 * - 60s 聚合 API（viki.moe）：微博/百度/知乎/B站/抖音 热搜榜（舆论风向）
 *
 * 用于捕捉舆论风向、社会热点、财经政策舆情。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; lutao-alaric-crawler)" };

/** 东方财富 7x24 财经快讯 */
async function eastmoneyFlash(limit: number): Promise<string> {
  const url = `https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_724&fastColumn=102&sortEnd=&pageSize=${limit}&req_trace=1`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: any = await res.json();
  const list: any[] = data?.data?.fastNewsList ?? [];
  if (list.length === 0) return "（暂无快讯）";
  return list
    .map((n, i) => `${i + 1}. ${n.title || n.digest}\n   ${n.showTime || ""}`)
    .join("\n");
}

/** 60s 聚合热搜 */
const HOT_SOURCES: Record<string, { label: string; url: string }> = {
  weibo: { label: "微博", url: "https://60s.viki.moe/v2/weibo" },
  baidu: { label: "百度", url: "https://60s.viki.moe/v2/baidu/hot" },
  zhihu: { label: "知乎", url: "https://60s.viki.moe/v2/zhihu" },
  bilibili: { label: "B站", url: "https://60s.viki.moe/v2/bilibili" },
  douyin: { label: "抖音", url: "https://60s.viki.moe/v2/douyin" },
};

async function hotSearch(platform: string, limit: number): Promise<string> {
  const src = HOT_SOURCES[platform] ?? HOT_SOURCES.weibo;
  const res = await fetch(src.url, { headers: UA });
  if (res.status === 429) {
    return `【${src.label}热搜】请求过于频繁（429），请稍后重试。`;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: any = await res.json();
  const list: any[] = data?.data ?? [];
  if (list.length === 0) return `【${src.label}热搜】（空）`;
  return list
    .slice(0, limit)
    .map((n, i) => `${i + 1}. ${n.title || n.word || ""}`)
    .join("\n");
}

export const opinionCollector: Collector = {
  name: "opinion",
  description: "舆情/舆论：财经快讯 + 多平台热搜（免费无 key）",

  tools: [
    {
      tool: {
        name: "finance_flash",
        description:
          "获取东方财富 7x24 全球财经快讯（实时财经舆情/政策信号）。参数：limit 条数（默认 15）。",
        inputSchema: {
          limit: z.number().int().optional().describe("条数，默认 15"),
        },
      },
      handler: async (args) => {
        const limit = Math.min(Number(args.limit) || 15, 50);
        try {
          return `东方财富 7x24 财经快讯（${limit} 条）:\n${await eastmoneyFlash(limit)}`;
        } catch (e: any) {
          return `财经快讯获取失败: ${e.message}`;
        }
      },
    },
    {
      tool: {
        name: "hot_search",
        description:
          "获取某平台热搜榜（舆论风向，60s 聚合）。参数：platform（weibo/baidu/zhihu/bilibili/douyin，默认 weibo），limit 条数（默认 15）。",
        inputSchema: {
          platform: z
            .enum(["weibo", "baidu", "zhihu", "bilibili", "douyin"])
            .optional()
            .describe("平台，默认 weibo"),
          limit: z.number().int().optional().describe("条数，默认 15"),
        },
      },
      handler: async (args) => {
        const platform = (args.platform as string) || "weibo";
        const limit = Math.min(Number(args.limit) || 15, 50);
        try {
          return `【${HOT_SOURCES[platform]?.label ?? platform}热搜】\n${await hotSearch(platform, limit)}`;
        } catch (e: any) {
          return `热搜获取失败: ${e.message}`;
        }
      },
    },
  ] as CollectorTool[],
};
