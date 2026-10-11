/**
 * Shopify 海外商城采集器
 *
 * Shopify 商店的 products.json 是公开免费的（无需 key）：
 *   https://<store-domain>/products.json?limit=50
 * 任意一个 Shopify 商店都可以直接查商品（标题/价格/供应商/是否在售/图片）。
 *
 * 覆盖海外独立站/商城商品数据。支持按店铺列商品、按关键词店内检索。
 * 说明：亚马逊/Shopee/淘宝/京东/拼多多 等平台的深层商品数据反爬较强，
 * 通常需要 key 或登录，推荐用 JustOneAPI（见 ecommerce 模块）获取。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

const UA = {
  "User-Agent": "Mozilla/5.0 (compatible; lutao-alaric-crawler)",
  Accept: "application/json",
};

/** 规范化店铺域名 */
function storeDomain(input: string): string {
  let s = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (s.includes("myshopify.com")) return s;
  if (s.includes(".")) return s;
  return s + ".com";
}

interface Product {
  title: string;
  price: string;
  vendor: string;
  tags: string;
  available: boolean;
  image: string;
  sku: string;
}

async function fetchProducts(store: string, limit: number, page = 1): Promise<Product[]> {
  const res = await fetch(
    `https://${store}/products.json?limit=${Math.min(limit, 250)}&page=${page}`,
    { headers: UA }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}（确认该站是否为 Shopify 商店）`);
  const data: any = await res.json();
  return (data.products || []).map((p: any) => ({
    title: p.title || "",
    price: p.variants?.[0]?.price ?? p.price ?? "",
    vendor: p.vendor || "",
    tags: p.tags || "",
    available: p.available ?? false,
    image: p.images?.[0]?.src ?? "",
    sku: p.variants?.[0]?.sku ?? "",
  }));
}

export const shopifyCollector: Collector = {
  name: "shopify",
  description: "Shopify 海外商城商品（products.json，免费无 key）",

  tools: [
    {
      tool: {
        name: "shopify_products",
        description:
          "列出某 Shopify 商店的商品（标题/价格/供应商/是否在售）。参数：store 店铺域名（如 allbirds.com 或 xxx.myshopify.com），limit 条数（默认 15）。",
        inputSchema: {
          store: z.string().describe("店铺域名，如 allbirds.com"),
          limit: z.number().int().optional().describe("条数，默认 15"),
        },
      },
      handler: async (args) => {
        const store = storeDomain((args.store as string) || "");
        const limit = Math.min(Number(args.limit) || 15, 250);
        try {
          const prods = await fetchProducts(store, limit);
          if (!prods.length) return `商店 ${store} 未返回商品（可能不是 Shopify 或暂时无货）。`;
          return [
            `【${store}】商品 ${prods.length} 个:`,
            ...prods.map((p, i) => {
              const tag = p.available ? "在售" : "售罄";
              return `${i + 1}. ${p.title}  $${p.price}  [${tag}]${p.vendor ? "  " + p.vendor : ""}`;
            }),
          ].join("\n");
        } catch (e: any) {
          return `Shopify 商品获取失败: ${e.message}`;
        }
      },
    },
    {
      tool: {
        name: "shopify_search",
        description:
          "在某 Shopify 商店内按关键词检索商品（标题/供应商/标签）。参数：store 店铺域名，keyword 关键词，limit 条数（默认 10）。",
        inputSchema: {
          store: z.string().describe("店铺域名"),
          keyword: z.string().describe("关键词"),
          limit: z.number().int().optional().describe("条数，默认 10"),
        },
      },
      handler: async (args) => {
        const store = storeDomain((args.store as string) || "");
        const keyword = ((args.keyword as string) || "").toLowerCase();
        const limit = Math.min(Number(args.limit) || 10, 50);
        try {
          // 拉取该店全部商品再过滤（店内检索）
          const prods = await fetchProducts(store, 250);
          const hits = prods
            .filter(
              (p) =>
                p.title.toLowerCase().includes(keyword) ||
                p.vendor.toLowerCase().includes(keyword) ||
                p.tags.toLowerCase().includes(keyword)
            )
            .slice(0, limit);
          if (!hits.length) return `商店 ${store} 内未找到「${keyword}」相关商品。`;
          return [
            `【${store}】「${keyword}」相关商品 ${hits.length} 个:`,
            ...hits.map((p, i) => `${i + 1}. ${p.title}  $${p.price}${p.vendor ? "  " + p.vendor : ""}`),
          ].join("\n");
        } catch (e: any) {
          return `店内检索失败: ${e.message}`;
        }
      },
    },
  ] as CollectorTool[],
};
