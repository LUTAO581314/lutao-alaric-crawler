/**
 * 全球新闻 / 地缘政治情报采集器 —— GDELT Project
 *
 * GDELT（https://www.gdeltproject.org/）是免费的全球新闻与事件监测项目，
 * 每 15 分钟抓取全球新闻，提供：
 * - 按关键词搜索新闻文章（DOC API, mode=ArtList, JSON）
 * - 关键词随时间变化趋势（DOC API, mode=timelinevol, 文本）
 * - 按国家/地区、语言、主题筛选
 *
 * 免费无需 API key。限频约 1 次/5 秒，本模块内置节流器防止 429。
 *
 * 可替代 World Monitor 付费的「全球新闻情报 / 地缘政治监控 / 关键词突增」能力。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

/** 简单节流器：GDELT 免费版约 1 次/5 秒 */
let lastGdeltCall = 0;
const MIN_INTERVAL_MS = 5000;

async function gdeltFetch(params: Record<string, string>): Promise<string> {
  const now = Date.now();
  const wait = lastGdeltCall + MIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGdeltCall = Date.now();

  const qs = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${BASE}?${qs}`, { signal: controller.signal });
    if (res.status === 429) {
      return "GDELT 请求过于频繁（429），请稍后（约 5 秒后）重试。";
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 解析 GDELT seendate: 20261010T120000Z -> 可读时间 */
function fmtSeenDate(s: string): string {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return s;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]} UTC`;
}

export const gdeltCollector: Collector = {
  name: "gdelt",
  description: "GDELT 全球新闻与地缘政治情报（免费无 key）",

  tools: [
    {
      tool: {
        name: "gdelt_news",
        description:
          "按关键词搜索全球新闻（GDELT）。参数：keyword 关键词（支持 GDELT 查询语法），timespan 时间范围（15min/1h/4h/day/week/month，默认 day），limit 条数（默认 10），sourcecountry 可选国家码（如 China/US）。",
        inputSchema: {
          keyword: z.string().describe("搜索关键词，如 earthquake / china / 台风"),
          timespan: z
            .enum(["15min", "1h", "4h", "day", "week", "month"])
            .optional()
            .describe("时间范围，默认 day"),
          limit: z.number().int().optional().describe("返回条数，默认 10，最大 50"),
          sourcecountry: z.string().optional().describe("来源国家码，如 China/US/JP（可选）"),
        },
      },
      handler: async (args) => {
        const keyword = (args.keyword as string) || "";
        const timespan = (args.timespan as string) || "day";
        const limit = Math.min(Number(args.limit) || 10, 50);
        const sourcecountry = args.sourcecountry as string | undefined;

        const params: Record<string, string> = {
          query: keyword,
          mode: "ArtList",
          format: "json",
          maxrecords: String(limit),
          sort: "datedesc",
          timespan,
        };
        if (sourcecountry) params.sourcecountry = sourcecountry;

        const text = await gdeltFetch(params);
        try {
          const data: any = JSON.parse(text);
          const articles: any[] = data.articles || [];
          if (articles.length === 0) return `未找到关键词 "${keyword}" 的相关新闻（${timespan}）。`;
          return [
            `关键词 "${keyword}" 全球新闻（${timespan}，共 ${articles.length} 条）:`,
            "",
            ...articles.map((a, i) =>
              [
                `${i + 1}. ${a.title}`,
                `   来源: ${a.domain} | 国家: ${a.sourcecountry || "N/A"} | ${fmtSeenDate(a.seendate || "")}`,
                `   ${a.url}`,
              ].join("\n")
            ),
          ].join("\n\n");
        } catch {
          return `GDELT 返回非 JSON（可能被限频或查询无结果）：\n${text.slice(0, 500)}`;
        }
      },
    },
    {
      tool: {
        name: "gdelt_trend",
        description:
          "查看某关键词报道量随时间的变化趋势（GDELT timelinevol）。参数：keyword 关键词，timespan 时间范围（day/week/month，默认 day）。用于发现热点/突增。",
        inputSchema: {
          keyword: z.string().describe("关键词"),
          timespan: z.enum(["day", "week", "month"]).optional().describe("时间范围，默认 day"),
        },
      },
      handler: async (args) => {
        const keyword = (args.keyword as string) || "";
        const timespan = (args.timespan as string) || "day";
        const params: Record<string, string> = {
          query: keyword,
          mode: "timelinevol",
          timespan,
        };
        const text = await gdeltFetch(params);
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return `未获取到 "${keyword}" 的趋势数据。`;
        return `关键词 "${keyword}" 报道量趋势（${timespan}）:\n\n${lines.join("\n")}`;
      },
    },
  ] as CollectorTool[],
};
