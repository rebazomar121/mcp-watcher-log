import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import { z } from "zod";

const execAsync = promisify(exec);

// Type Definitions
type LogSource = "expo" | "nodejs" | "nextjs";

interface LogSourceConfig {
  file: string;
  description: string;
  captureCommand: string;
  alternativeCommands?: string[];
}

// Log source configurations
const LOG_SOURCES: Record<LogSource, LogSourceConfig> = {
  expo: {
    file: "/tmp/expo.log",
    description: "Expo/React Native development server",
    captureCommand: "script -q /tmp/expo.log npx expo start -c --go",
  },
  nodejs: {
    file: "/tmp/node.log",
    description: "Node.js application",
    captureCommand: "script -q /tmp/node.log npm start",
    alternativeCommands: ["script -q /tmp/node.log npm run dev"],
  },
  nextjs: {
    file: "/tmp/nextjs.log",
    description: "Next.js development server",
    captureCommand: "script -q /tmp/nextjs.log npm run dev",
  },
};

const DEFAULT_SOURCE: LogSource = "expo";
const VALID_SOURCES = ["expo", "nodejs", "nextjs"] as const;

// Helper functions
function getLogFile(source: LogSource): string {
  return LOG_SOURCES[source].file;
}

function resolveSource(source?: string): LogSource {
  if (!source) return DEFAULT_SOURCE;
  if (VALID_SOURCES.includes(source as LogSource)) {
    return source as LogSource;
  }
  throw new Error(`Invalid source: ${source}. Valid sources: ${VALID_SOURCES.join(", ")}`);
}

// Reusable Zod schema for source parameter
const sourceSchema = z
  .enum(VALID_SOURCES)
  .optional()
  .describe('Log source: "expo", "nodejs", or "nextjs" (default: "expo")');

// Server setup
const server = new McpServer({
  name: "log-watcher",
  version: "1.0.0",
});

// get_logs tool
server.registerTool(
  "get_logs",
  {
    description: "Get recent logs from a development server (Expo, Node.js, or Next.js)",
    inputSchema: {
      lines: z.number().optional().describe("Number of lines (default 100)"),
      source: sourceSchema,
    },
  },
  async ({ lines, source }) => {
    const numLines = lines ?? 100;
    const resolvedSource = resolveSource(source);
    const logFile = getLogFile(resolvedSource);

    try {
      if (!fs.existsSync(logFile)) {
        const config = LOG_SOURCES[resolvedSource];
        return {
          content: [{
            type: "text",
            text: `No log file found for ${resolvedSource}. Run: ${config.captureCommand}`,
          }],
        };
      }
      const { stdout } = await execAsync(`tail -n ${numLines} ${logFile}`);
      return { content: [{ type: "text", text: stdout || `No logs for ${resolvedSource}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e}` }] };
    }
  }
);

// get_errors tool
server.registerTool(
  "get_errors",
  {
    description: "Get only errors and warnings from logs (Expo, Node.js, or Next.js)",
    inputSchema: {
      lines: z.number().optional().describe("Max lines (default 50)"),
      source: sourceSchema,
    },
  },
  async ({ lines, source }) => {
    const numLines = lines ?? 50;
    const resolvedSource = resolveSource(source);
    const logFile = getLogFile(resolvedSource);

    try {
      if (!fs.existsSync(logFile)) {
        const config = LOG_SOURCES[resolvedSource];
        return {
          content: [{
            type: "text",
            text: `No log file found for ${resolvedSource}. Run: ${config.captureCommand}`,
          }],
        };
      }
      const { stdout } = await execAsync(
        `grep -iE "(error|warn|failed|exception)" ${logFile} | tail -n ${numLines}`
      );
      return { content: [{ type: "text", text: stdout || `No errors found in ${resolvedSource} logs` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `No errors found in ${resolvedSource} logs` }] };
    }
  }
);

// search_logs tool
server.registerTool(
  "search_logs",
  {
    description: "Search logs for a pattern (Expo, Node.js, or Next.js)",
    inputSchema: {
      pattern: z.string().describe("Text to search for"),
      source: sourceSchema,
    },
  },
  async ({ pattern, source }) => {
    const resolvedSource = resolveSource(source);
    const logFile = getLogFile(resolvedSource);

    try {
      if (!fs.existsSync(logFile)) {
        const config = LOG_SOURCES[resolvedSource];
        return {
          content: [{
            type: "text",
            text: `No log file found for ${resolvedSource}. Run: ${config.captureCommand}`,
          }],
        };
      }
      const { stdout } = await execAsync(`grep -i "${pattern}" ${logFile} | tail -30`);
      return { content: [{ type: "text", text: stdout || `No matches for "${pattern}" in ${resolvedSource} logs` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `No matches for "${pattern}" in ${resolvedSource} logs` }] };
    }
  }
);

// clear_logs tool
server.registerTool(
  "clear_logs",
  {
    description: "Clear the log file for a specific source (Expo, Node.js, or Next.js)",
    inputSchema: {
      source: sourceSchema,
    },
  },
  async ({ source }) => {
    const resolvedSource = resolveSource(source);
    const logFile = getLogFile(resolvedSource);

    try {
      if (!fs.existsSync(logFile)) {
        return { content: [{ type: "text", text: `No log file exists for ${resolvedSource}` }] };
      }
      fs.writeFileSync(logFile, "");
      return { content: [{ type: "text", text: `Logs cleared for ${resolvedSource}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error clearing ${resolvedSource} logs: ${e}` }] };
    }
  }
);

// setup_capture tool
server.registerTool(
  "setup_capture",
  {
    description: "Get the shell command to capture logs for a specific project type",
    inputSchema: {
      source: z.enum(VALID_SOURCES).describe('Project type: "expo", "nodejs", or "nextjs"'),
    },
  },
  async ({ source }) => {
    const config = LOG_SOURCES[source];

    let output = `## Log Capture Setup for ${source.charAt(0).toUpperCase() + source.slice(1)}\n\n`;
    output += `**Description:** ${config.description}\n\n`;
    output += `**Command:**\n\`\`\`bash\n${config.captureCommand}\n\`\`\`\n`;

    if (config.alternativeCommands && config.alternativeCommands.length > 0) {
      output += `\n**Alternative commands:**\n`;
      for (const cmd of config.alternativeCommands) {
        output += `\`\`\`bash\n${cmd}\n\`\`\`\n`;
      }
    }

    output += `\n**Tip:** You can also create a shell alias:\n`;
    output += `\`\`\`bash\nalias ${source}dev='${config.captureCommand}'\n\`\`\``;

    return { content: [{ type: "text", text: output }] };
  }
);

// list_sources tool
server.registerTool(
  "list_sources",
  {
    description: "List all available log sources and their status",
    inputSchema: {},
  },
  async () => {
    let output = "## Available Log Sources\n\n";

    for (const [source, config] of Object.entries(LOG_SOURCES)) {
      const exists = fs.existsSync(config.file);
      let status = exists ? "Active" : "No log file";
      let lastModified = "";

      if (exists) {
        try {
          const stats = fs.statSync(config.file);
          lastModified = ` (last modified: ${stats.mtime.toLocaleString()})`;
        } catch {
          // ignore
        }
      }

      output += `### ${source}\n`;
      output += `- **Status:** ${status}${lastModified}\n`;
      output += `- **File:** ${config.file}\n`;
      output += `- **Description:** ${config.description}\n\n`;
    }

    return { content: [{ type: "text", text: output }] };
  }
);

// Main entry point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
