import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import { z } from "zod";

const execAsync = promisify(exec);
const DEFAULT_LOG_FILE = "/tmp/expo.log";

const server = new McpServer({
  name: "log-watcher",
  version: "1.0.0",
});

server.registerTool(
  "get_logs",
  {
    description: "Get recent logs from Expo/React Native",
    inputSchema: { lines: z.number().optional().describe("Number of lines (default 100)") },
  },
  async ({ lines }) => {
    const numLines = lines ?? 100;
    try {
      if (!fs.existsSync(DEFAULT_LOG_FILE)) {
        return { content: [{ type: "text", text: "No log file found. Run: script -q /tmp/expo.log npx expo start" }] };
      }
      const { stdout } = await execAsync(`tail -n ${numLines} ${DEFAULT_LOG_FILE}`);
      return { content: [{ type: "text", text: stdout || "No logs" }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e}` }] };
    }
  }
);

server.registerTool(
  "get_errors",
  {
    description: "Get only errors and warnings from logs",
    inputSchema: { lines: z.number().optional().describe("Max lines (default 50)") },
  },
  async ({ lines }) => {
    const numLines = lines ?? 50;
    try {
      const { stdout } = await execAsync(
        `grep -iE "(error|warn|failed|exception)" ${DEFAULT_LOG_FILE} | tail -n ${numLines}`
      );
      return { content: [{ type: "text", text: stdout || "No errors found" }] };
    } catch (e) {
      return { content: [{ type: "text", text: "No errors found" }] };
    }
  }
);

server.registerTool(
  "search_logs",
  {
    description: "Search logs for a pattern",
    inputSchema: { pattern: z.string().describe("Text to search for") },
  },
  async ({ pattern }) => {
    try {
      const { stdout } = await execAsync(`grep -i "${pattern}" ${DEFAULT_LOG_FILE} | tail -30`);
      return { content: [{ type: "text", text: stdout || `No matches for "${pattern}"` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `No matches for "${pattern}"` }] };
    }
  }
);

server.registerTool(
  "clear_logs",
  {
    description: "Clear the log file",
    inputSchema: {},
  },
  async () => {
    try {
      fs.writeFileSync(DEFAULT_LOG_FILE, "");
      return { content: [{ type: "text", text: "Logs cleared" }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e}` }] };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
