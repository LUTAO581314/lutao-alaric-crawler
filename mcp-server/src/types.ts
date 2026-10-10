/**
 * 采集器接口
 *
 * 每个数据源模块实现一个 Collector，向 MCP 服务注册一个或多个 tools。
 * 新增数据源：实现本接口，放入 collectors/ 下，并在 index.ts 注册。
 */
import type { ZodRawShape } from "zod";

export interface CollectorToolDef {
  name: string;
  description: string;
  /** Zod 原始 shape（字段 -> Zod 类型），SDK 据此生成 JSON Schema 并校验参数 */
  inputSchema: ZodRawShape;
}

export interface CollectorTool {
  /** MCP tool 定义（name/description/inputSchema Zod shape） */
  tool: CollectorToolDef;
  /** tool 的处理函数，输入参数（已被 SDK 校验/解析），输出结构化文本结果 */
  handler: (args: Record<string, unknown>) => Promise<string>;
}

export interface Collector {
  /** 唯一标识，如 'global-flights' */
  name: string;
  /** 人类可读描述 */
  description: string;
  /** 该采集器提供的所有 tools */
  tools: CollectorTool[];
}
