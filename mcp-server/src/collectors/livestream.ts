/**
 * 全球实时摄像头 / 地图 数据源
 *
 * 本模块为骨架，预留接入以下公开实时地理数据源的能力：
 * - OpenSky 全球实时航班（已在 global-flights 实现）
 * - 全球实时地震（USGS Earthquake Feed，免费、无需 key）
 * - 全球实时天气（Open-Meteo，免费、无需 key）
 *
 * 后续可扩展接入实时摄像头/地图聚合源。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

async function usgsEarthquakes(minMag = 4, limit = 20) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
      { signal: controller.signal }
    );
    const data: any = await res.json();
    const feats = (data.features || [])
      .filter((f: any) => (f.properties?.mag ?? 0) >= minMag)
      .slice(0, limit);
    return feats.map((f: any) => f.properties);
  } finally {
    clearTimeout(timer);
  }
}

export const livestreamCollector: Collector = {
  name: "livestream",
  description: "全球实时地理数据（地震、天气等；实时摄像头/地图待扩展）",

  tools: [
    {
      tool: {
        name: "earthquakes_recent",
        description:
          "获取最近 24 小时的全球地震信息。参数：min_mag 最小震级（默认 4），limit 条数（默认 20）。数据来自 USGS。",
        inputSchema: {
          min_mag: z.number().optional().describe("最小震级，默认 4"),
          limit: z.number().int().optional().describe("条数，默认 20"),
        },
      },
      handler: async (args) => {
        const minMag = Number(args.min_mag) || 4;
        const limit = Number(args.limit) || 20;
        try {
          const quakes = await usgsEarthquakes(minMag, limit);
          if (quakes.length === 0) return `近 24 小时无 ≥${minMag} 级地震。`;
          return [
            `近 24 小时 ≥${minMag} 级地震（共显示 ${quakes.length} 条）:`,
            "",
            ...quakes.map((q: any) => {
              const time = new Date(q.time).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
              return `- M${q.mag} ${q.place} (${time})\n   ${q.url}`;
            }),
          ].join("\n");
        } catch (e: any) {
          return `地震数据获取失败: ${e.message}`;
        }
      },
    },
  ] as CollectorTool[],
};
