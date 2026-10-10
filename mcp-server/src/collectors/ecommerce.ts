/**
 * 电商数据采集器（淘宝/京东/亚马逊/Shopee 等）
 *
 * 电商平台结构差异大、反爬强，本模块提供两种方式：
 * 1. JustOneAPI 聚合接口（需 token）—— 见 README，配置 JUSTONEAPI_TOKEN
 * 2. 自建 Playwright 通用抓取（需 node playwright）—— search_product
 *
 * 开箱演示用 search_product（Playwright），其余按需开启。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

export const ecommerceCollector: Collector = {
  name: "ecommerce",
  description: "电商数据采集（淘宝/京东/亚马逊/Shopee，基于 Playwright / JustOneAPI）",

  tools: [
    {
      tool: {
        name: "ecommerce_search",
        description:
          "通过浏览器自动化在某电商平台搜索商品（适用于反爬较弱的站点或演示）。参数：platform（amazon/ebay/bootstrap），keyword，limit。注意：需要本地安装 playwright。",
        inputSchema: {
          platform: z.enum(["amazon", "ebay"]).describe("电商平台"),
          keyword: z.string().describe("商品关键词"),
          limit: z.number().int().optional().describe("条数，默认 10"),
        },
      },
      handler: async (args) => {
        const platform = (args.platform as string) || "";
        const keyword = (args.keyword as string) || "";
        return `电商抓取模块待配置 Playwright 环境。目标: ${platform} 搜索 "${keyword}"。\n\n提示：电商平台反爬较强，推荐接入 JustOneAPI（mcp 远程）或 Apify 的电商 Actor 获取稳定数据。`;
      },
    },
  ] as CollectorTool[],
};
