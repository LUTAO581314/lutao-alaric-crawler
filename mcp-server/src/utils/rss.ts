/**
 * 通用 RSS 抓取与解析工具（纯字符串处理，无第三方依赖）
 */

export interface RssItem {
  title: string;
  link: string;
  date: string;
  source: string;
}

/** 简单 XML 实体解码 */
export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * 抓取并解析 RSS/Atom，返回结构化条目（最多 limit 条）。
 * 兼容 <item>（RSS）与 <entry>（Atom）。
 */
export async function fetchRss(
  url: string,
  limit = 10,
  timeoutMs = 20000
): Promise<RssItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let xml = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; lutao-alaric-crawler)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const items: RssItem[] = [];
  const entryRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(xml)) !== null && items.length < limit) {
    const block = m[1];
    const get = (tag: string) => {
      const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return mm ? decodeEntities(mm[1].trim()) : "";
    };
    // Atom 用 <link href="...">，RSS 用 <link>text</link>
    let link = get("link");
    if (!link) {
      const lm = block.match(/<link[^>]*href="([^"]+)"/i);
      link = lm ? lm[1] : "";
    }
    const title = get("title");
    if (!title) continue;
    items.push({
      title,
      link,
      date: get("pubDate") || get("updated") || get("published"),
      source: (block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "").trim(),
    });
  }
  return items;
}
