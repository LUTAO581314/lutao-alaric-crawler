/**
 * 国内社交采集器（小红书 / 抖音 / 微博 / B站 / 快手）
 *
 * 复用开源工具 MediaCrawler（https://github.com/NanmiCoder/MediaCrawler）：
 * 它是一个 Python 工具，通过浏览器自动化采集国内主流社交平台的数据，
 * 支持关键词搜索、用户主页、评论、收藏等。
 *
 * 本模块通过子进程调用已安装的 MediaCrawler，并把采集结果以文本返回。
 * 需要先按 collect/domestic-social/README.md 安装 MediaCrawler。
 */
import { spawn } from "node:child_process";
import { z } from "zod";
import { env } from "../utils/http.js";
import type { Collector, CollectorTool } from "../types.js";

const MEDIACRAWLER_DIR =
  env("MEDIACRAWLER_DIR", "collect/domestic-social/MediaCrawler");

/** 平台中文名映射 */
const PLATFORM_CMD: Record<string, string> = {
  xiaohongshu: "xhs",
  douyin: "dy",
  weibo: "wb",
  bilibili: "bili",
  kuaishou: "ks",
};

function runMediaCrawler(args: string[], timeoutMs = 180000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "python",
      [MEDIACRAWLER_DIR + "/main.py", ...args],
      { cwd: MEDIACRAWLER_DIR ? undefined : process.cwd(), shell: false }
    );
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("MediaCrawler 执行超时"));
    }, timeoutMs!);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(out || `MediaCrawler 退出码: ${code}`);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

export const domesticSocialCollector: Collector = {
  name: "domestic-social",
  description: "国内社交平台采集（小红书/抖音/微博/B站/快手，基于 MediaCrawler）",

  tools: [
    {
      tool: {
        name: "social_search",
        description:
          "在指定的国内社交平台搜索关键词内容。参数：platform（xiaohongshu/douyin/weibo/bilibili/kuaishou），keyword，limit（可选条数）。",
        inputSchema: {
          platform: z
            .enum(["xiaohongshu", "douyin", "weibo", "bilibili", "kuaishou"])
            .describe("平台"),
          keyword: z.string().describe("搜索关键词"),
          limit: z.number().int().optional().describe("采集条数，默认 20"),
        },
      },
      handler: async (args) => {
        const platform = (args.platform as string) || "";
        const keyword = (args.keyword as string) || "";
        const limit = Number(args.limit) || 20;
        const cmd = PLATFORM_CMD[platform];
        if (!cmd) return `不支持的平台: ${platform}`;
        const output = await runMediaCrawler(["--platform", cmd, "--lt", "keyword", "-k", keyword, "--limit", String(limit)]);
        return `已触发 MediaCrawler 搜索（${platform}/${keyword}）：\n${output.slice(-3000)}`;
      },
    },
  ] as CollectorTool[],
};
