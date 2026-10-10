/**
 * 全球新闻资讯采集器
 *
 * 聚合全球主要媒体的实时新闻。采用无需 API key 的公共 RSS/Atom 源
 * （Google News RSS 可按关键词/地区检索），保证开箱即用。
 *
 * 可用数据源：
 * - Google News RSS: 全球/地区热榜、关键词搜索
 * - BBC、Reuters、CNN 等媒体的官方 RSS
 *
 * 通过栈式解析 HTML/RSS 得到结构化新闻条目。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

const GOOGLE_NEWS_BASE =
  "https://news.google.com/rss";

/** 通过 Google News RSS 检索关键词（无需 key） */
async function googleNewsSearch(keyword: string, lang = "zh-CN", region = "CN", limit = 10) {
  const url = `${GOOGLE_NEWS_BASE}/search?q=${encodeURIComponent(
    keyword
  )}&hl=${lang}&gl=${region}&ceid=${region}:${lang}`;
  return fetchRss(url, limit);
}

/** 获取 Google News 地区热榜 */
async function googleNewsTopHeadlines(region = "CN", lang = "zh-CN", limit = 15) {
  const url = `${GOOGLE_NEWS_BASE}/?hl=${lang}&gl=${region}&ceid=${region}:${lang}`;
  return fetchRss(url, limit);
}

/** 抓取并解析 RSS（用 DOM 解析，纯字符串处理，避免依赖） */
async function fetchRss(url: string, limit: number): Promise<{ title: string; link: string; date: string; source: string }[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let xml = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; lutao-alaric-crawler)" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const items: { title: string; link: string; date: string; source: string }[] = [];
  // 简单提取 <item> 块
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = m[1];
    const get = (tag: string) => {
      const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return mm ? decodeEntities(mm[1].trim()) : "";
    };
    items.push({
      title: get("title"),
      link: get("link"),
      date: get("pubDate"),
      source: (block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "").trim(),
    });
  }
  return items;
}

/** 简单实体解码 */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export const globalNewsCollector: Collector = {
  name: "global-news",
  description: "全球新闻资讯聚合（Google News RSS，无需 API key）",

  tools: [
    {
      tool: {
        name: "news_top",
        description:
          "获取某个国家/地区的实时新闻热榜。参数：region 两位国家码（默认 CN），lang 语言码（默认 zh-CN），limit 条数（默认 15）。",
        inputSchema: {
          region: z.string().optional().describe("国家/地区码，如 CN/US/JP/HK，默认 CN"),
          lang: z.string().optional().describe("语言码，如 zh-CN/en，默认 zh-CN"),
          limit: z.number().int().optional().describe("返回条数，默认 15，最大 50"),
        },
      },
      handler: async (args) => {
        const region = (args.region as string) || "CN";
        const lang = (args.lang as string) || "zh-CN";
        const limit = Math.min(Number(args.limit) || 15, 50);
        const items = await googleNewsTopHeadlines(region, lang, limit);
        if (items.length === 0) return "未获取到新闻。";
        return items
          .map((it, i) => `${i + 1}. ${it.title}\n   来源: ${it.source || "未知"} | ${it.date}\n   ${it.link}`)
          .join("\n\n");
      },
    },
    {
      tool: {
        name: "news_search",
        description:
          "按关键词搜索全球新闻。参数：keyword 关键词，region 地区码（默认 CN），lang 语言码（默认 zh-CN），limit 条数（默认 10）。",
        inputSchema: {
          keyword: z.string().describe("搜索关键词"),
          region: z.string().optional().describe("国家/地区码，默认 CN"),
          lang: z.string().optional().describe("语言码，默认 zh-CN"),
          limit: z.number().int().optional().describe("返回条数，默认 10"),
        },
      },
      handler: async (args) => {
        const keyword = (args.keyword as string) || "";
        const region = (args.region as string) || "CN";
        const lang = (args.lang as string) || "zh-CN";
        const limit = Math.min(Number(args.limit) || 10, 30);
        const items = await googleNewsSearch(keyword, lang, region, limit);
        if (items.length === 0) return `未找到关键词 "${keyword}" 的相关新闻。`;
        return items
          .map((it, i) => `${i + 1}. ${it.title}\n   来源: ${it.source || "未知"} | ${it.date}\n   ${it.link}`)
          .join("\n\n");
      },
    },
  ] as CollectorTool[],
};
