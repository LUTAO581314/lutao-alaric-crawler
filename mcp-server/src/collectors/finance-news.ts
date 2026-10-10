/**
 * 财经 / 政策新闻采集器 —— 多源 RSS 聚合
 *
 * 聚合主流财经媒体的实时新闻（免费公开 RSS，无需 API key）：
 * - 华尔街见闻（wallstreetcn）：中文财经/宏观/政策
 * - 新浪财经（sina）：中文财经滚动
 * - Bloomberg（bloomberg）：英文全球市场/宏观
 *
 * 支持按关键词过滤（如 政策/央行/降准/利率/关税/GDP）快速定位政策类新闻。
 * 配合 GDELT 的 gdelt_news（按主题搜全球新闻）可覆盖 World Monitor 的
 * 「新闻情报 / 政策信号」能力。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";
import { fetchRss } from "../utils/rss.js";

const FEEDS: Record<string, { label: string; url: string }> = {
  wallstreetcn: { label: "华尔街见闻", url: "https://dedicated.wallstreetcn.com/rss.xml" },
  sina: { label: "新浪财经", url: "https://rss.sina.com.cn/finance/rollnews.xml" },
  bloomberg: { label: "Bloomberg", url: "https://feeds.bloomberg.com/markets/news.rss" },
};

const ALL_SOURCES = Object.keys(FEEDS);

export const financeNewsCollector: Collector = {
  name: "finance-news",
  description: "财经/政策新闻多源聚合（华尔街见闻/新浪/Bloomberg，免费无 key）",

  tools: [
    {
      tool: {
        name: "finance_news",
        description:
          "获取财经/政策新闻（多源 RSS 聚合）。参数：source 来源（wallstreetcn/sina/bloomberg/all，默认 all），keyword 关键词过滤（如 政策/央行/降准/利率/关税/GDP，可选），limit 条数（默认 10）。",
        inputSchema: {
          source: z
            .enum(["wallstreetcn", "sina", "bloomberg", "all"])
            .optional()
            .describe("新闻来源，默认 all（全部）"),
          keyword: z.string().optional().describe("关键词过滤，如 政策/央行/降准/关税（可选）"),
          limit: z.number().int().optional().describe("每个来源返回条数，默认 10"),
        },
      },
      handler: async (args) => {
        const source = (args.source as string) || "all";
        const keyword = (args.keyword as string) || "";
        const limit = Math.min(Number(args.limit) || 10, 30);

        const sources = source === "all" ? ALL_SOURCES : [source];
        if (sources.includes(source) && !FEEDS[source]) {
          return `未知来源: ${source}（可选 ${ALL_SOURCES.join("/")}/all）`;
        }

        const blocks: string[] = [];
        let total = 0;
        for (const src of sources) {
          const feed = FEEDS[src];
          if (!feed) continue;
          let items: { title: string; link: string; date: string }[] = [];
          try {
            // 有关键词时扫描更多条目再过滤，提高命中率
            const fetchDepth = keyword ? Math.max(limit * 6, 40) : limit;
            items = await fetchRss(feed.url, fetchDepth);
          } catch {
            blocks.push(`【${feed.label}】（获取失败，可能限频/网络波动）`);
            continue;
          }
          // 关键词过滤
          if (keyword) {
            items = items.filter((it) => it.title.toLowerCase().includes(keyword.toLowerCase()));
          }
          items = items.slice(0, limit);
          if (items.length === 0) {
            blocks.push(`【${feed.label}】${keyword ? `无匹配「${keyword}」的新闻` : "（空）"}`);
            continue;
          }
          total += items.length;
          const lines = items.map(
            (it, i) =>
              `${i + 1}. ${it.title}\n   ${it.date ? it.date + "  " : ""}${it.link}`
          );
          blocks.push(`【${feed.label}】(${items.length} 条)\n${lines.join("\n")}`);
        }

        if (total === 0) {
          return `未获取到新闻${keyword ? `（关键词「${keyword}」）` : ""}。GDELT 限频时请稍后，或换其它 source。`;
        }
        return `财经/政策新闻（${total} 条${keyword ? `，关键词「${keyword}」` : ""}）:\n\n${blocks.join("\n\n")}`;
      },
    },
  ] as CollectorTool[],
};
