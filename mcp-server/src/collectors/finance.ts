/**
 * 全球大盘 / 指数 / 外汇 / 大宗采集器 —— Yahoo Finance
 *
 * Yahoo Finance 提供免费的匿名行情 API（chart 端点），可查询：
 * - 全球主要股指（上证/深成/恒生/纳指/标普/道指/日经/富时/DAX 等）
 * - 外汇（美元/人民币、美元指数等）
 * - 大宗商品（黄金、原油等）
 * - 个股（苹果 AAPL、特斯拉 TSLA、比特币 BTC-USD 等）
 *
 * 免费无需 API key。支持中文名称/常见别名自动映射到 Yahoo 代码。
 * 可替代 World Monitor 付费的「金融雷达 / 市场行情」能力。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

/** 中文名/别名 -> Yahoo Finance 代码 */
const NAME_MAP: Record<string, string> = {
  // 中国
  "上证": "000001.SS", "上证指数": "000001.SS", "沪指": "000001.SS", "shanghai": "000001.SS",
  "深成指": "399001.SZ", "深证成指": "399001.SZ", "shenzhen": "399001.SZ",
  "创业板": "399006.SZ", "chinext": "399006.SZ",
  "科创50": "000688.SH",
  // 港股
  "恒生": "^HSI", "恒指": "^HSI", "恒生指数": "^HSI", "hsi": "^HSI",
  // 美股
  "纳指": "^IXIC", "纳斯达克": "^IXIC", "nasdaq": "^IXIC",
  "标普": "^GSPC", "标普500": "^GSPC", "s&p500": "^GSPC", "spx": "^GSPC",
  "道指": "^DJI", "道琼斯": "^DJI", "djia": "^DJI",
  "罗素2000": "^RUT",
  // 亚太/欧洲
  "日经": "^N225", "日经225": "^N225", "nikkei": "^N225",
  "富时": "^FTSE", "富时100": "^FTSE", "ftse": "^FTSE",
  "dax": "^GDAXI", "德国dax": "^GDAXI",
  "法国cac": "^FCHI", "cac40": "^FCHI",
  // 外汇
  "美元人民币": "CNY=X", "usdcny": "CNY=X", "人民币": "CNY=X",
  "美元指数": "DX-Y.NYB", "dxy": "DX-Y.NYB",
  "欧元美元": "EURUSD=X", "美元日元": "JPY=X", "usdjpy": "JPY=X",
  "港币美元": "HKD=X",
  // 大宗
  "黄金": "GC=F", "gold": "GC=F",
  "原油": "CL=F", "wti": "CL=F", "美油": "CL=F",
  "布伦特": "BZ=F", "brent": "BZ=F",
  "白银": "SI=F", "铜": "HG=F",
  // 加密/个股示例
  "比特币": "BTC-USD", "btc": "BTC-USD",
  "以太坊": "ETH-USD", "eth": "ETH-USD",
};

/** 解析名称/代码 -> Yahoo 代码 */
function resolveSymbol(input: string): string {
  const s = input.trim();
  const key = s.toLowerCase();
  if (NAME_MAP[key]) return NAME_MAP[key];
  // 已经是代码形式（含 . 或 ^ 或 = 或 F），原样返回
  if (/^[A-Z0-9.^=F-]+$/.test(s)) return s.toUpperCase();
  return s.toUpperCase();
}

interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number | null;
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  currency: string;
  time: string;
}

async function fetchQuote(symbol: string): Promise<Quote> {
  const enc = encodeURIComponent(symbol);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let data: any;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?range=1d&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; lutao-alaric-crawler)" },
        signal: controller.signal,
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }
  const r = data?.chart?.result?.[0];
  if (!r) throw new Error("无数据（代码可能无效）");
  const m = r.meta;
  const price = m.regularMarketPrice ?? 0;
  const prevClose = m.chartPreviousClose ?? m.previousClose ?? 0;
  const change = price - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  return {
    symbol: m.symbol || symbol,
    price,
    prevClose,
    change,
    changePct,
    dayHigh: m.regularMarketDayHigh ?? null,
    dayLow: m.regularMarketDayLow ?? null,
    week52High: m.fiftyTwoWeekHigh ?? null,
    week52Low: m.fiftyTwoWeekLow ?? null,
    currency: m.currency || "",
    time: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : "",
  };
}

function fmtNum(n: number | null, digits = 2): string {
  return n === null ? "N/A" : n.toFixed(digits);
}

function formatQuote(q: Quote): string {
  const arrow = q.change > 0 ? "▲" : q.change < 0 ? "▼" : "＝";
  const sign = q.change > 0 ? "+" : "";
  return [
    `${arrow} ${q.symbol}  ${fmtNum(q.price)} ${q.currency}`,
    `   涨跌: ${sign}${fmtNum(q.change)} (${sign}${fmtNum(q.changePct)}%)  前收: ${fmtNum(q.prevClose)}`,
    q.dayHigh !== null
      ? `   日内: ${fmtNum(q.dayLow)} ~ ${fmtNum(q.dayHigh)}`
      : null,
    q.week52High !== null
      ? `   52周: ${fmtNum(q.week52Low)} ~ ${fmtNum(q.week52High)}`
      : null,
    q.time ? `   时间: ${q.time}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export const financeCollector: Collector = {
  name: "finance",
  description: "Yahoo Finance 全球大盘/指数/外汇/大宗（免费无 key）",

  tools: [
    {
      tool: {
        name: "market_index",
        description:
          "查询大盘指数/外汇/大宗/个股行情（Yahoo Finance）。参数：name 名称或代码，支持中文别名（如 上证/纳指/标普/恒生/道指/黄金/原油/比特币）或直接代码（如 AAPL/000001.SS/^GSPC）。",
        inputSchema: {
          name: z.string().describe("指数/品种名称或代码，如 上证 / 纳指 / 黄金 / AAPL"),
        },
      },
      handler: async (args) => {
        const name = (args.name as string) || "";
        const symbol = resolveSymbol(name);
        try {
          const q = await fetchQuote(symbol);
          return `${name}（${q.symbol}）\n${formatQuote(q)}`;
        } catch (e: any) {
          return `行情查询失败（${symbol}）: ${e.message}\n提示：可试 上证/深成指/恒生/纳指/标普/道指/日经/黄金/原油/美元人民币 等。`;
        }
      },
    },
    {
      tool: {
        name: "market_multi",
        description:
          "批量查询多个大盘/指数/外汇/大宗行情（Yahoo Finance）。参数：symbols 逗号或空格分隔的名称/代码列表，如 “上证,纳指,标普,黄金,原油”。",
        inputSchema: {
          symbols: z.string().describe("多个名称/代码，用逗号或空格分隔，如 上证,纳指,标普,黄金,美元人民币"),
        },
      },
      handler: async (args) => {
        const raw = (args.symbols as string) || "";
        const symbols = raw
          .split(/[,\s，、]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map(resolveSymbol);
        if (symbols.length === 0) return "未提供要查询的代码。";
        const lines: string[] = [];
        for (const sym of symbols) {
          try {
            const q = await fetchQuote(sym);
            lines.push(formatQuote(q));
          } catch (e: any) {
            lines.push(`✗ ${sym}: ${e.message}`);
          }
        }
        return `批量行情（${symbols.length} 项）:\n\n${lines.join("\n\n")}`;
      },
    },
  ] as CollectorTool[],
};
