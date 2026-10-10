/**
 * 全球天气 / 气候采集器 —— Open-Meteo
 *
 * Open-Meteo（https://open-meteo.com/）提供免费、无需 API key 的天气 API：
 * - 当前天气（温度/体感/湿度/降水/风/天气状况）
 * - 多日预报
 * - 支持按城市名（内置 geocoding 自动转坐标）或经纬度查询
 *
 * 可替代 World Monitor 付费的「气候数据」能力。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";

/** WMO 天气代码 -> 中文描述 */
function weatherText(code: number): string {
  const map: Record<number, string> = {
    0: "晴", 1: "大部晴", 2: "多云", 3: "阴",
    45: "雾", 48: "雾凇",
    51: "毛毛雨", 53: "毛毛雨", 55: "浓毛毛雨",
    56: "冻毛毛雨", 57: "冻毛毛雨",
    61: "小雨", 63: "中雨", 65: "大雨",
    66: "冻雨", 67: "强冻雨",
    71: "小雪", 73: "中雪", 75: "大雪", 77: "雪粒",
    80: "小阵雨", 81: "阵雨", 82: "强阵雨",
    85: "阵雪", 86: "强阵雪",
    95: "雷暴", 96: "雷暴伴冰雹", 99: "强雷暴伴冰雹",
  };
  return map[code] ?? `代码 ${code}`;
}

/** 城市名 -> 坐标（Open-Meteo geocoding） */
async function geocode(city: string): Promise<{ lat: number; lon: number; label: string }> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=zh&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding HTTP ${res.status}`);
  const data: any = await res.json();
  const r = data?.results?.[0];
  if (!r) throw new Error(`未找到城市 "${city}"`);
  return { lat: r.latitude, lon: r.longitude, label: `${r.name}, ${r.country || ""}` };
}

async function getWeather(lat: number, lon: number, days: number): Promise<string> {
  const params: Record<string, string> = {
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    timezone: "auto",
  };
  if (days > 1) {
    params.daily = "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code";
    params.forecast_days = String(days);
  }
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`open-meteo HTTP ${res.status}`);
  const data: any = await res.json();

  const cur = data.current || {};
  const lines = [
    `当前: ${weatherText(cur.weather_code || 0)}`,
    `  温度: ${cur.temperature_2m}°C | 体感: ${cur.apparent_temperature}°C`,
    `  湿度: ${cur.relative_humidity_2m}% | 降水: ${cur.precipitation}mm | 风速: ${cur.wind_speed_10m} km/h`,
  ];

  if (days > 1 && data.daily) {
    const d = data.daily;
    lines.push("", `未来 ${days} 天预报:`);
    for (let i = 0; i < d.time?.length; i++) {
      lines.push(
        `  ${d.time[i]}: ${weatherText(d.weather_code[i])}  ${d.temperature_2m_min[i]}~${d.temperature_2m_max[i]}°C  降水${d.precipitation_sum[i]}mm`
      );
    }
  }
  return lines.join("\n");
}

export const weatherCollector: Collector = {
  name: "weather",
  description: "Open-Meteo 全球天气与气候（免费无 key）",

  tools: [
    {
      tool: {
        name: "weather_city",
        description:
          "按城市名查询天气（Open-Meteo，自动转坐标）。参数：city 城市名（中文/英文均可），days 预报天数（1=仅当前，默认 3）。",
        inputSchema: {
          city: z.string().describe("城市名，如 北京 / Tokyo / New York"),
          days: z.number().int().min(1).max(14).optional().describe("预报天数，1=仅当前，默认 3"),
        },
      },
      handler: async (args) => {
        const city = (args.city as string) || "";
        const days = Math.min(Number(args.days) || 3, 14);
        try {
          const loc = await geocode(city);
          const w = await getWeather(loc.lat, loc.lon, days);
          return `【${loc.label}】${w}`;
        } catch (e: any) {
          return `天气查询失败: ${e.message}`;
        }
      },
    },
    {
      tool: {
        name: "weather_coords",
        description:
          "按经纬度查询天气（Open-Meteo）。参数：latitude/longitude，days 预报天数（1=仅当前，默认 1）。",
        inputSchema: {
          latitude: z.number().describe("纬度，如北京 39.9"),
          longitude: z.number().describe("经度，如北京 116.4"),
          days: z.number().int().min(1).max(14).optional().describe("预报天数，默认 1"),
        },
      },
      handler: async (args) => {
        const latitude = Number(args.latitude);
        const longitude = Number(args.longitude);
        const days = Math.min(Number(args.days) || 1, 14);
        try {
          const w = await getWeather(latitude, longitude, days);
          return `【${latitude.toFixed(2)}, ${longitude.toFixed(2)}】${w}`;
        } catch (e: any) {
          return `天气查询失败: ${e.message}`;
        }
      },
    },
  ] as CollectorTool[],
};
