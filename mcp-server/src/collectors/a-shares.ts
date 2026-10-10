/**
 * A股 / 板块 / 榜单采集器 —— 东方财富
 *
 * 东方财富 push2 接口提供免费的 A股 实时行情数据（无需 API key）：
 * - 个股实时行情（价格/涨跌幅/换手/成交量/成交额）
 * - 行业板块 / 概念板块 排行
 * - A股涨幅/跌幅/成交额 榜单
 * - 支持中文名称/代码自动解析（东方财富搜索接口）
 *
 * 补充 World Monitor 覆盖不到的 A股/行业/概念维度。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; lutao-alaric-crawler)" };

/** 按代码判断市场前缀（沪/深/北） */
function secid(code: string): string {
  const c = code.replace(/\D/g, "");
  if (/^(6|9)/.test(c)) return `1.${c}`; // 沪市
  return `0.${c}`; // 深市/北交所
}

/** 中文名称 -> 代码（东方财富 suggest 接口） */
async function resolveCode(name: string): Promise<{ code: string; market: string } | null> {
  const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(
    name
  )}&type=14&count=1&token=D43BF722C8E33BDC906FB84D85E326E8`;
  try {
    const res = await fetch(url, { headers: UA });
    const data: any = await res.json();
    const item = data?.QuotationCodeTable?.Data?.[0];
    if (!item) return null;
    return { code: item.Code, market: item.Name };
  } catch {
    return null;
  }
}

/** 通用 clist 列表接口（板块/榜单） */
async function clist(params: Record<string, string>): Promise<{ total: number; diff: any[] }> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(
    `https://push2.eastmoney.com/api/qt/clist/get?${qs}`,
    { headers: UA }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: any = await res.json();
  return { total: data?.data?.total ?? 0, diff: data?.data?.diff ?? [] };
}

/** 个股实时行情（stock/get，fltt=2 返回浮点） */
async function stockQuote(code: string): Promise<string> {
  const s = secid(code);
  const fields = "f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f168,f169,f170,f171";
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${s}&invt=2&fltt=2&fields=${fields}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: any = await res.json();
  const d = data?.data;
  if (!d || d.f57 === undefined) throw new Error("无数据（代码可能无效）");
  const lines = [
    `【${d.f58} ${d.f57}】`,
    `  最新: ${d.f43}  涨跌: ${d.f169} (${d.f170}%)  昨收: ${d.f60}`,
    `  今开: ${d.f46}  最高: ${d.f44}  最低: ${d.f45}`,
    `  成交量: ${fmtVol(d.f47)}  成交额: ${fmtAmt(d.f48)}`,
    d.f168 ? `  换手率: ${d.f168}%  振幅: ${d.f171}%` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return lines;
}

function fmtVol(n: number): string {
  if (n === undefined || n === null) return "N/A";
  if (n >= 1e8) return (n / 1e8).toFixed(2) + " 亿手";
  if (n >= 1e4) return (n / 1e4).toFixed(2) + " 万手";
  return String(n);
}
function fmtAmt(n: number): string {
  if (n === undefined || n === null) return "N/A";
  if (n >= 1e8) return (n / 1e8).toFixed(2) + " 亿元";
  if (n >= 1e4) return (n / 1e4).toFixed(2) + " 万元";
  return String(n);
}

export const aSharesCollector: Collector = {
  name: "a-shares",
  description: "东方财富 A股/行业/概念/榜单（免费无 key）",

  tools: [
    {
      tool: {
        name: "a_stock",
        description:
          "查询 A股个股实时行情（东方财富）。参数：query 股票代码（如 600519/300750/000001）或中文名称（如 贵州茅台/宁德时代）。",
        inputSchema: {
          query: z.string().describe("股票代码或中文名称，如 600519 / 贵州茅台"),
        },
      },
      handler: async (args) => {
        const q = (args.query as string) || "";
        const digits = q.replace(/\D/g, "");
        const code = digits.length === 6 ? q : (await resolveCode(q))?.code || q;
        try {
          const res = await stockQuote(code);
          return res;
        } catch (e: any) {
          return `A股查询失败（${code}）: ${e.message}`;
        }
      },
    },
    {
      tool: {
        name: "a_sectors",
        description:
          "查询 A股行业板块/概念板块排行（东方财富）。参数：kind（industry=行业 / concept=概念，默认 industry），limit 条数（默认 10）。",
        inputSchema: {
          kind: z.enum(["industry", "concept"]).optional().describe("行业或概念，默认 industry"),
          limit: z.number().int().optional().describe("条数，默认 10"),
        },
      },
      handler: async (args) => {
        const kind = (args.kind as string) || "industry";
        const limit = Math.min(Number(args.limit) || 10, 30);
        const fs = kind === "concept" ? "m:90+t:3" : "m:90+t:2";
        try {
          const { total, diff } = await clist({
            pn: "1", pz: String(limit), po: "1", np: "1", fltt: "2", invt: "2",
            fid: "f3", fs, fields: "f2,f3,f12,f14",
          });
          const label = kind === "concept" ? "概念板块" : "行业板块";
          const lines = diff.map((d: any, i: number) =>
            `${i + 1}. ${d.f14}  ${d.f3}%`
          );
          return `${label}涨幅榜（共 ${total} 个，前 ${diff.length}）:\n${lines.join("\n")}`;
        } catch (e: any) {
          return `板块查询失败: ${e.message}`;
        }
      },
    },
    {
      tool: {
        name: "a_ranking",
        description:
          "A股个股榜单（东方财富）。参数：sort（gain=涨幅榜 / loss=跌幅榜 / amount=成交额榜，默认 gain），limit 条数（默认 10）。",
        inputSchema: {
          sort: z.enum(["gain", "loss", "amount"]).optional().describe("榜单类型，默认 gain"),
          limit: z.number().int().optional().describe("条数，默认 10"),
        },
      },
      handler: async (args) => {
        const sort = (args.sort as string) || "gain";
        const limit = Math.min(Number(args.limit) || 10, 30);
        const fid = sort === "amount" ? "f6" : "f3";
        const po = sort === "loss" ? "0" : "1";
        const label = sort === "gain" ? "涨幅榜" : sort === "loss" ? "跌幅榜" : "成交额榜";
        try {
          const { total, diff } = await clist({
            pn: "1", pz: String(limit), po, np: "1", fltt: "2", invt: "2",
            fid, fs: "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23", fields: "f2,f3,f6,f12,f14",
          });
          const lines = diff.map((d: any, i: number) =>
            `${i + 1}. ${d.f14}(${d.f12})  ${d.f3}%  成交额${fmtAmt(d.f6)}`
          );
          return `A股${label}（全市场 ${total} 只，前 ${diff.length}）:\n${lines.join("\n")}`;
        } catch (e: any) {
          return `榜单查询失败: ${e.message}`;
        }
      },
    },
  ] as CollectorTool[],
};
