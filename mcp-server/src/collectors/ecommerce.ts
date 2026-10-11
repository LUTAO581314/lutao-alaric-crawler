import { z } from 'zod';
import { chromium, type Browser } from 'playwright';
import type { Collector } from '../types.js';

interface ProductResult {
  rank: number;
  title: string;
  price: string;
  link: string;
  extra?: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * books.toscrape.com —— 稳定开放的电商练习站（真实图书商品，纯静态，无验证码）。
 * 作为 ecommerce 的默认/兜底数据源，任何网络环境都能返回真实商品。
 */
async function scrapeBooks(page: number, limit: number): Promise<{ count: number; note: string; products: ProductResult[] }> {
  const url = `https://books.toscrape.com/catalogue/page-${page}.html`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const html = await res.text();
  const blocks = html.split('<article class="product_pod">').slice(1);
  const products: ProductResult[] = [];
  for (const a of blocks) {
    const title = a.match(/<h3><a href="[^"]*" title="([^"]+)"/)?.[1];
    if (!title) continue;
    const price = a.match(/class="price_color">([^<]+)</)?.[1]?.trim() || '';
    const link = a.match(/<h3><a href="([^"]*)"/)?.[1];
    const stock = a.match(/instock availability"[\s\S]*?>([\s\S]*?)<\/p>/)?.[1]
      ?.replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    products.push({
      rank: products.length + 1,
      title,
      price,
      link: link ? `https://books.toscrape.com/catalogue/${link}` : '',
      extra: stock ? `库存: ${stock}` : '',
    });
    if (products.length >= limit) break;
  }
  return {
    count: products.length,
    note: '来源 books.toscrape.com（稳定开放电商练习站，真实图书商品）。',
    products,
  };
}

async function scrapeAmazon(page: import('playwright').Page, keyword: string, limit: number): Promise<ProductResult[]> {
  await page.goto(`https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  try {
    await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 12000 });
  } catch {
    /* 可能被反爬拦截 */
  }
  const items = await page
    .$$eval('[data-component-type="s-search-result"]', (els) =>
      els.slice(0, 30).map((el) => {
        const titleEl = el.querySelector('h2 a, h2 span');
        const priceEl = el.querySelector('.a-price .a-offscreen, .a-price span');
        const linkEl = el.querySelector('h2 a');
        const href = linkEl?.getAttribute('href') || '';
        return {
          title: titleEl?.textContent?.trim() || '',
          price: priceEl?.textContent?.trim() || '',
          link: href ? `https://www.amazon.com${href.replace(/^[?#]/, '')}` : '',
        };
      })
    )
    .catch(() => [] as { title: string; price: string; link: string }[]);
  return items.filter((i) => i.title).map((i, idx) => ({ rank: idx + 1, ...i })).slice(0, limit);
}

async function scrapeEbay(page: import('playwright').Page, keyword: string, limit: number): Promise<ProductResult[]> {
  await page.goto(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  try {
    await page.waitForSelector('li.s-item', { timeout: 12000 });
  } catch {
    /* 继续尝试 */
  }
  const items = await page
    .$$eval('li.s-item', (els) =>
      els.slice(0, 30).map((el) => {
        const titleEl = el.querySelector('.s-item__title');
        const priceEl = el.querySelector('.s-item__price');
        const linkEl = el.querySelector('a.s-item__link');
        const raw = titleEl?.textContent?.trim() || '';
        return {
          title: raw.replace(/Sponsored\s*$/i, '').trim(),
          price: priceEl?.textContent?.trim() || '',
          link: linkEl?.getAttribute('href') || '',
        };
      })
    )
    .catch(() => [] as { title: string; price: string; link: string }[]);
  return items.filter((i) => i.title).map((i, idx) => ({ rank: idx + 1, ...i })).slice(0, limit);
}

export const ecommerceCollector: Collector = {
  name: 'ecommerce',
  description: '电商平台商品搜索（books 稳定兜底 / Amazon·eBay Playwright 真实大站）',

  tools: [
    {
      tool: {
        name: 'ecommerce_search',
        description:
          '搜索电商商品。platform：books（books.toscrape.com，稳定开放站，默认，无需浏览器）/ amazon / ebay（Playwright 无头浏览器真实大站，可能受 IP 反爬影响）。amazon/ebay 需 keyword；books 需 keyword（留空抓首页）+ 可选 page 翻页。',
        inputSchema: {
          platform: z
            .enum(['books', 'amazon', 'ebay'])
            .optional()
            .describe('电商平台，默认 books（稳定开放站）'),
          keyword: z.string().optional().describe('商品关键词（books 可留空抓首页）'),
          page: z.number().int().min(1).max(50).optional().describe('books 翻页页码，默认 1'),
          limit: z.number().int().min(1).max(20).optional().describe('条数，默认 10'),
        },
      },
      handler: async (args) => {
        const platform = (args.platform as string) || 'books';
        const keyword = (args.keyword as string | undefined) ?? '';
        const page = (args.page as number | undefined) ?? 1;
        const limit = (args.limit as number | undefined) ?? 10;
        let browser: Browser | undefined;
        try {
          if (platform === 'books') {
            const r = await scrapeBooks(page, limit);
            return JSON.stringify({ platform, keyword, page, ...r }, null, 2);
          }
          if (!keyword) return 'amazon / ebay 平台需要 keyword 参数。';
          browser = await chromium.launch({
            headless: true,
            args: ['--disable-blink-features=AutomationControlled'],
          });
          const context = await browser.newContext({
            userAgent: UA,
            viewport: { width: 1366, height: 900 },
            locale: 'en-US',
            timezoneId: 'America/New_York',
            extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
          });
          await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          });
          const p = await context.newPage();
          await p.goto(platform === 'ebay' ? 'https://www.ebay.com/' : 'https://www.amazon.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          }).catch(() => {});
          const products =
            platform === 'ebay' ? await scrapeEbay(p, keyword, limit) : await scrapeAmazon(p, keyword, limit);
          const title = await p.title().catch(() => '');
          const note =
            products.length === 0
              ? '未抓到商品：该大站对当前(机房/无 cookie)网络可能触发反爬，建议换网络或先用 platform=books 验证功能。'
              : /robot|captcha|sorry|验证/i.test(title)
                ? '提示：可能遇到反爬验证，结果可能不完整。'
                : '';
          return JSON.stringify({ platform, keyword, count: products.length, note, products }, null, 2);
        } catch (e) {
          return `抓取失败: ${e instanceof Error ? e.message : String(e)}`;
        } finally {
          await browser?.close().catch(() => {});
        }
      },
    },
  ],
};
