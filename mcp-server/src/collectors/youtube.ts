/**
 * YouTube 采集器（全球社媒/视频）
 *
 * YouTube oEmbed 接口（免费无需 key）：
 * - 视频信息（标题/频道/缩略图）
 *
 * 说明：YouTube 完整搜索/频道/播放量需要 Data API v3 的 key（免费额度），
 * 本模块用 oEmbed 提供无需 key 的视频信息查询。如需搜索/频道数据，
 * 可配置 YOUTUBE_API_KEY 后扩展。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; lutao-alaric-crawler)" };

/** 从各种形式的输入提取视频 ID */
function extractVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function youtubeInfo(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d: any = await res.json();
  return [
    `【${d.title}】`,
    `  频道: ${d.author_name}`,
    `  缩略图: ${d.thumbnail_url}`,
    `  频道主页: ${d.author_url}`,
    `  视频: https://www.youtube.com/watch?v=${videoId}`,
  ].join("\n");
}

export const youtubeCollector: Collector = {
  name: "youtube",
  description: "YouTube 全球视频（oEmbed，免费无 key）",

  tools: [
    {
      tool: {
        name: "youtube_video",
        description:
          "获取 YouTube 视频信息（标题/频道/缩略图，oEmbed 免费）。参数：video 视频ID 或完整链接。",
        inputSchema: { video: z.string().describe("视频ID 或完整链接，如 dQw4w9WgXcQ 或 https://youtu.be/xxx") },
      },
      handler: async (args) => {
        const video = (args.video as string) || "";
        const id = extractVideoId(video);
        if (!id) return "无法解析视频 ID，请提供 11 位 ID 或完整 YouTube 链接。";
        try {
          return await youtubeInfo(id);
        } catch (e: any) {
          return `视频信息获取失败: ${e.message}`;
        }
      },
    },
  ] as CollectorTool[],
};
