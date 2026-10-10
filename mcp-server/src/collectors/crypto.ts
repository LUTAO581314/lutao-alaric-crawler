/**
 * 加密货币行情采集器 —— 多源容错
 *
 * 加密行情在国内网络对单一源不稳定（DNS/限频/超时），本模块按顺序尝试
 * 多个免费源，返回第一个成功的结果：
 *   OKX -> Binance -> CoinGecko -> Yahoo Finance
 * 均免费无需 API key。
 *
 * 补充 World Monitor 覆盖不到的加密货币行情维度。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; lutao-alaric-crawler)" };

interface CoinResult {
  symbol: string;
  price: number;
  change24h: number | null;
  source: string;
}

/** 币种名 -> 各源符号 */
const COINS: Record<string, { okx: string; binance: string; coingecko: string; yahoo: string; label: string }> = {
  btc: { okx: "BTC-USDT", binance: "BTCUSDT", coingecko: "bitcoin", yahoo: "BTC-USD", label: "比特币" },
  eth: { okx: "ETH-USDT", binance: "ETHUSDT", coingecko: "ethereum", yahoo: "ETH-USD", label: "以太坊" },
  sol: { okx: "SOL-USDT", binance: "SOLUSDT", coingecko: "solana", yahoo: "SOL-USD", label: "Solana" },
  bnb: { okx: "BNB-USDT", binance: "BNBUSDT", coingecko: "binancecoin", yahoo: "BNB-USD", label: "BNB" },
  xrp: { okx: "XRP-USDT", binance: "XRPUSDT", coingecko: "ripple", yahoo: "XRP-USD", label: "Ripple" },
  doge: { okx: "DOGE-USDT", binance: "DOGEUSDT", coingecko: "dogecoin", yahoo: "DOGE-USD", label: "Doge" },
  usdt: { okx: "USDT-USDC", binance: "USDTUSDC", coingecko: "tether", yahoo: "USDT-USD", label: "USDT" },
  ada: { okx: "ADA-USDT", binance: "ADAUSDT", coingecko: "cardano", yahoo: "ADA-USD", label: "Cardano" },
  avax: { okx: "AVAX-USDT", binance: "AVAXUSDT", coingecko: "avalanche-2", yahoo: "AVAX-USD", label: "Avalanche" },
  ton: { okx: "TON-USDT", binance: "TONUSDT", coingecko: "the-open-network", yahoo: "TON-USD", label: "Toncoin" },
};

async function fetchOkx(sym: string): Promise<CoinResult | null> {
  const r = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${sym}`, { headers: UA });
  if (!r.ok) return null;
  const d: any = await r.json();
  const t = d?.data?.[0];
  if (!t?.last) return null;
  let change: number | null = null;
  const open24 = parseFloat(t.open24h);
  const last = parseFloat(t.last);
  if (open24 && last) change = ((last - open24) / open24) * 100;
  return { symbol: sym, price: last, change24h: change, source: "OKX" };
}

async function fetchBinance(sym: string): Promise<CoinResult | null> {
  const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`, { headers: UA });
  if (!r.ok) return null;
  const d: any = await r.json();
  if (!d?.lastPrice) return null;
  return {
    symbol: sym,
    price: parseFloat(d.lastPrice),
    change24h: parseFloat(d.priceChangePercent) || null,
    source: "Binance",
  };
}

async function fetchCoinGecko(id: string): Promise<CoinResult | null> {
  const r = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
    { headers: UA }
  );
  if (!r.ok) return null;
  const d: any = await r.json();
  const v = d?.[id]?.usd;
  if (!v) return null;
  return { symbol: id, price: v, change24h: d?.[id]?.usd_24h_change ?? null, source: "CoinGecko" };
}

async function fetchYahoo(sym: string): Promise<CoinResult | null> {
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`,
    { headers: UA }
  );
  if (!r.ok) return null;
  const d: any = await r.json();
  const m = d?.chart?.result?.[0]?.meta;
  if (!m?.regularMarketPrice) return null;
  const prev = m.chartPreviousClose ?? m.previousClose ?? 0;
  const change = prev ? ((m.regularMarketPrice - prev) / prev) * 100 : null;
  return { symbol: sym, price: m.regularMarketPrice, change24h: change, source: "Yahoo" };
}

async function getCoin(key: string): Promise<CoinResult> {
  const c = COINS[key.toLowerCase()];
  if (!c) throw new Error(`未知币种: ${key}（支持 ${Object.keys(COINS).join("/")}）`);
  const sources: Array<() => Promise<CoinResult | null>> = [
    () => fetchOkx(c.okx),
    () => fetchBinance(c.binance),
    () => fetchCoinGecko(c.coingecko),
    () => fetchYahoo(c.yahoo),
  ];
  for (const s of sources) {
    try {
      const r = await s();
      if (r) return r;
    } catch {
      /* 尝试下一个源 */
    }
  }
  throw new Error("所有加密行情源都不可用（网络限频/超时），请稍后重试");
}

export const cryptoCollector: Collector = {
  name: "crypto",
  description: "加密货币行情（多源容错：OKX/Binance/CoinGecko/Yahoo，免费无 key）",

  tools: [
    {
      tool: {
        name: "crypto_price",
        description:
          "查询加密货币行情（多源容错，免费）。参数：symbols 币种，逗号分隔，如 btc / btc,eth,sol。",
        inputSchema: {
          symbols: z.string().describe("币种，逗号分隔，如 btc,eth,sol（支持 btc/eth/sol/bnb/xrp/doge/ada/avax/ton）"),
        },
      },
      handler: async (args) => {
        const keys = (args.symbols as string)
          .split(/[,，\s]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (keys.length === 0) keys.push("btc");
        const lines: string[] = [];
        for (const k of keys) {
          try {
            const r = await getCoin(k);
            const arrow = r.change24h === null ? "＝" : r.change24h >= 0 ? "▲" : "▼";
            const sign = r.change24h !== null && r.change24h >= 0 ? "+" : "";
            const chg = r.change24h === null ? "N/A" : `${sign}${r.change24h.toFixed(2)}%`;
            lines.push(`${arrow} ${COINS[k]?.label ?? k}(${r.symbol})  $${r.price.toLocaleString(undefined, { maximumFractionDigits: r.price < 1 ? 4 : 2 })}  24h ${chg}  [${r.source}]`);
          } catch (e: any) {
            lines.push(`✗ ${k}: ${e.message}`);
          }
        }
        return `加密货币行情:\n${lines.join("\n")}`;
      },
    },
  ] as CollectorTool[],
};
