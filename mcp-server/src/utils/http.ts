/**
 * 通用工具：HTTP 请求封装、环境变量读取
 */

/** 读取环境变量（带默认值） */
export function env(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

/** 通用 JSON GET 请求（支持超时、代理可后续扩展） */
export async function httpGetJson(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 30000
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", ...headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
