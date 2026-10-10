// 临时测试：通过 stdio 连接本地 MCP 服务器并列出工具
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.platform === "win32" ? "npx" : "npx",
  args: ["tsx", "mcp-server/src/index.ts"],
  cwd: process.cwd(),
});

const client = new Client({ name: "test-client", version: "0.0.1" });
await client.connect(transport);
const { tools } = await client.listTools();
console.log("=== TOOLS (" + tools.length + ") ===");
for (const t of tools) {
  console.log("- " + t.name + "  [" + (t.inputSchema?.required?.join(",") || "no-req") + "]");
}

// 测试调用一个免费工具（全球航班区域查询）
console.log("\n=== TEST: flights_area (北京周边) ===");
const res = await client.callTool({
  name: "flights_area",
  arguments: { lamin: 39, lomin: 115, lamax: 42, lomax: 118 },
});
console.log((res.content?.[0]?.text || "").slice(0, 600));

await client.close();
process.exit(0);
