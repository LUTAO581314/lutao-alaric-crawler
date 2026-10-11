/**
 * B站采集器（国内社媒/视频）
 *
 * B站公开接口（免费无需 key，需带 Referer）：
 * - 全站热门视频
 * - 排行榜
 * - 单个视频详情（标题/UP主/播放/点赞/弹幕/评论/分区）
 *
 * 覆盖国内社媒/视频内容热度维度。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

const UA = {
  "User-Agent": "Mozilla/5.0 (compatible; lutao-alaric-crawler)",
  Referer: "https://www.bilibili.com",
};

async function biliFetch(path: string): Promise<any> {
  const res = await fetch(`https://api.bilibili.com${path}`, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: any = await res.json();
  if (data.code !== 0) throw new Error(`B站错误 code=${data.code} ${data.message}`);
  return data.data;
}

function fmtCount(n: number): string {
  if (n === undefined || n === null) return "0";
  if (n >= 1e8) return (n / 1e8).toFixed(1) + "亿";
  if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
  return String(n);
}

function fmtVideo(v: any, i: number): string {
  const stat = v.stat || {};
  return [
    `${i + 1}. ${v.title}`,
    `   UP: ${v.owner?.name ?? "N/A"} | 播放${fmtCount(stat.view)} 赞${fmtCount(stat.like)} 弹幕${fmtCount(stat.danmaku)} 评${fmtCount(stat.reply)}`,
    `   https://www.bilibili.com/video/${v.bvid}`,
  ].join("\n");
}

export const bilibiliCollector: Collector = {
  name: "bilibili",
  description: "B站国内社媒/视频（免费无 key）",

  tools: [
    {
      tool: {
        name: "bilibili_hot",
        description: "获取 B站全站热门视频。参数：limit 条数（默认 15）。",
        inputSchema: { limit: z.number().int().optional().describe("条数，默认 15") },
      },
      handler: async (args) => {
        const limit = Math.min(Number(args.limit) || 15, 50);
        try {
          const data = await biliFetch(`/x/web-interface/popular?ps=${limit}`);
          const list: any[] = data.list || [];
          if (!list.length) return "（暂无热门）";
          return `B站热门视频（${list.length}）:\n${list.map((v, i) => fmtVideo(v, i)).join("\n\n")}`;
        } catch (e: any) {
          return `B站热门获取失败: ${e.message}`;
        }
      },
    },
    {
      tool: {
        name: "bilibili_ranking",
        description:
          "获取 B站排行榜。参数：rid 分区ID（0=全站，1=动画，17=日常，18=知识，23=美食，95=科技 等，默认 0），limit 条数（默认 15）。",
        inputSchema: {
          rid: z.number().int().optional().describe("分区ID，0=全站，默认 0"),
          limit: z.number().int().optional().describe("条数，默认 15"),
        },
      },
      handler: async (args) => {
        const rid = Number(args.rid) || 0;
        const limit = Math.min(Number(args.limit) || 15, 50);
        try {
          const data = await biliFetch(`/x/web-interface/ranking/v2?rid=${rid}&type=all`);
          const list: any[] = data.list || [];
          if (!list.length) return "（排行榜为空）";
          return `B站排行榜（${list.length}）:\n${list.map((v, i) => fmtVideo(v, i)).join("\n\n")}`;
        } catch (e: any) {
          return `B站排行获取失败: ${e.message}`;
        }
      },
    },
    {
      tool: {
        name: "bilibili_video",
        description:
          "获取 B站单个视频详情（标题/UP主/播放/点赞/弹幕/评论/分区/简介）。参数：bvid 视频号（如 BV1xx411c7mD）或完整链接。",
        inputSchema: { bvid: z.string().describe("BV号或完整视频链接") },
      },
      handler: async (args) => {
        let bvid = (args.bvid as string) || "";
        const m = bvid.match(/BV[0-9A-Za-z]+/);
        if (m) bvid = m[0];
        if (!/^BV[0-9A-Za-z]+$/.test(bvid)) return "请提供有效的 BV 号或视频链接。";
        try {
          const d = await biliFetch(`/x/web-interface/view?bvid=${bvid}`);
          const stat = d.stat || {};
          return [
            `【${d.title}】`,
            `  UP主: ${d.owner?.name} | 分区: ${d.tname}`,
            `  播放: ${fmtCount(stat.view)}  点赞: ${fmtCount(stat.like)}  投币: ${fmtCount(stat.coin)}`,
            `  弹幕: ${fmtCount(stat.danmaku)}  评论: ${fmtCount(stat.reply)}  收藏: ${fmtCount(stat.favorite)}`,
            `  发布时间: ${d.pubdate ? new Date(d.pubdate * 1000).toISOString() : "N/A"}`,
            d.desc ? `  简介: ${String(d.desc).slice(0, 200)}` : null,
            `  链接: https://www.bilibili.com/video/${bvid}`,
          ]
            .filter(Boolean)
            .join("\n");
        } catch (e: any) {
          return `视频详情获取失败: ${e.message}`;
        }
      },
    },
  ] as CollectorTool[],
};
