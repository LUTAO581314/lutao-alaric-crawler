/**
 * 全球航班采集器 —— OpenSky Network 开放 API
 *
 * 提供全球任意区域实时的民航航班数据：
 * - 全量状态：所有当前飞行中的航班（位置/高度/速度/航向）
 * - 区域状态：指定经纬度范围内的航班
 * - 航班轨迹：某个航班的历史轨迹
 *
 * 参考: https://opensky-network.org/apidoc/rest.html
 * 匿名访问有频率限制（通常 src 限 400 req/h，状态接口 10 req/s）。
 */
import { z } from "zod";
import type { Collector, CollectorTool } from "../types.js";
import { httpGetJson, env } from "../utils/http.js";

const BASE = "https://opensky-network.org/api";

async function authHeaders(): Promise<Record<string, string>> {
  const u = env("OPENSKY_USERNAME");
  const p = env("OPENSKY_PASSWORD");
  if (u && p) {
    return {
      Authorization: "Basic " + Buffer.from(`${u}:${p}`).toString("base64"),
    };
  }
  return {};
}

/** 扁平化一条航班状态为可读文本 */
function formatState(state: any): string {
  const [
    icao24, callsign, originCountry, timePosition,
    lastContact, longitude, latitude, baroAltitude,
    onGround, velocity, trueTrack, verticalRate,
    sensors, geoAltitude, squawk, spi, positionSource,
  ] = state;

  return [
    `- 航班号: ${(callsign || "N/A").trim()}`,
    `  注册号/ICAO24: ${icao24}`,
    `  起降国: ${originCountry}`,
    `  位置: 纬度 ${latitude?.toFixed(4)}, 经度 ${longitude?.toFixed(4)}`,
    geoAltitude
      ? `  几何高度: ${Math.round(geoAltitude)} 米`
      : baroAltitude
        ? `  气压高度: ${Math.round(baroAltitude)} 米`
        : "  高度: N/A",
    velocity ? `  地速: ${Math.round(velocity * 3.6)} km/h` : "  速度: N/A",
    trueTrack !== undefined ? `  航向: ${Math.round(trueTrack)}°` : "  航向: N/A",
    `  是否地面: ${onGround ? "是" : "否"}`,
  ].join("\n");
}

/** 取所有在飞航班状态 */
async function allStates() {
  const headers = await authHeaders();
  const data = (await httpGetJson(`${BASE}/states/all`, headers)) as any;
  return data;
}

/** 取指定边界内的航班状态（lamin/lomin/lamax/lomax） */
async function statesInBounds(lamin: number, lomin: number, lamax: number, lomax: number) {
  const headers = await authHeaders();
  const url = `${BASE}/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  return (await httpGetJson(url, headers)) as any;
}

/** 取某航班轨迹（icao24 + 时间范围，秒时间戳） */
async function track(icao24: string, time?: number) {
  const headers = await authHeaders();
  const suffix = time ? `?time=${time}` : "";
  return (await httpGetJson(`${BASE}/tracks/all?icao24=${icao24}${suffix}`, headers)) as any;
}

export const globalFlightsCollector: Collector = {
  name: "global-flights",
  description: "全球航班实时数据（OpenSky Network）",

  tools: [
    {
      tool: {
        name: "flights_all",
        description:
          "获取全球当前所有在飞民航航班的实时状态（位置、高度、速度、航向）。可选参数 time_secs（Unix 秒时间戳，默认当前）。",
        inputSchema: {
          time_secs: z.number().int().optional().describe("Unix 秒时间戳（可选，默认当前时刻）"),
        },
      },
      handler: async (args) => {
        const time = args.time_secs as number | undefined;
        const data = await allStates();
        const states = data?.states || [];
        const lines = [
          `全球当前在飞航班数: ${states.length}`,
          `数据时刻: ${new Date((data.time ?? Date.now() / 1000) * 1000).toISOString()}`,
          "",
          ...states.slice(0, 50).map(formatState),
        ];
        if (states.length > 50) {
          lines.push("", `… 还有 ${states.length - 50} 条（已截断，请用 flights_area 按区域查询）`);
        }
        return lines.join("\n");
      },
    },
    {
      tool: {
        name: "flights_area",
        description:
          "获取指定经纬度边界框内的实时航班。参数：lamin/lomin/lamax/lomax 为矩形边界（南纬/西经为负）。",
        inputSchema: {
          lamin: z.number().describe("南边界纬度，如 北京约 39"),
          lomin: z.number().describe("西边界经度，如 北京约 115"),
          lamax: z.number().describe("北边界纬度，如 北京约 42"),
          lomax: z.number().describe("东边界经度，如 北京约 118"),
        },
      },
      handler: async (args) => {
        const { lamin, lomin, lamax, lomax } = args as Record<string, number>;
        const data = await statesInBounds(lamin, lomin, lamax, lomax);
        const states = data?.states || [];
        const lines = [
          `该区域内航班数: ${states.length}`,
          "",
          ...states.slice(0, 80).map(formatState),
        ];
        if (states.length > 80) {
          lines.push("", `… 还有 ${states.length - 80} 条`);
        }
        return lines.join("\n");
      },
    },
    {
      tool: {
        name: "flight_track",
        description:
          "查询某个航班的历史飞行轨迹。参数：icao24（航班 24 位 ICAO 编码，可在 flights_all 结果中获得）。",
        inputSchema: {
          icao24: z.string().describe("航班 ICAO24 编码，如 3c675a"),
          time_secs: z.number().int().optional().describe("Unix 秒时间戳（可选，默认最近）"),
        },
      },
      handler: async (args) => {
        const { icao24, time_secs } = args as Record<string, any>;
        const data = await track(icao24, time_secs as number | undefined);
        if (!data?.path || data.path.length === 0) {
          return `未找到航班 ${icao24} 的轨迹数据（可能时间范围内无记录）。`;
        }
        const callsign = data.callsign || "N/A";
        const lines = [
          `航班 ${icao24}（${(callsign as string).trim()}）轨迹共 ${data.path.length} 点`,
          "",
          ...data.path.slice(-30).map((pt: any) => {
            const [time, lat, lon, baroAlt, geoAlt, vx, vy] = pt;
            const v = Math.sqrt(vx * vx + vy * vy) * 3.6;
            return `- ${new Date(time * 1000).toISOString()}  ${lat.toFixed(4)},${lon.toFixed(4)}  高度${Math.round(geoAlt)}m  地速${Math.round(v)}km/h`;
          }),
        ];
        return lines.join("\n");
      },
    },
  ] as CollectorTool[],
};
