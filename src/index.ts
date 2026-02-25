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
    alternativeCommands: ["script -q /tmp/node.log npm run dev", "script -q /tmp/node.log bun run dev"],
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

// watch_logs tool - Real-time log streaming (returns recent + new entries)
server.registerTool(
  "watch_logs",
  {
    description: "Watch logs in real-time - returns the most recent logs and marks the position for subsequent calls to show only new entries",
    inputSchema: {
      source: sourceSchema,
      lines: z.number().optional().describe("Initial lines to show (default 20)"),
      since_bytes: z.number().optional().describe("Resume from this byte position (returned from previous call)"),
    },
  },
  async ({ source, lines, since_bytes }) => {
    const resolvedSource = resolveSource(source);
    const logFile = getLogFile(resolvedSource);
    const numLines = lines ?? 20;

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

      const stats = fs.statSync(logFile);
      const currentSize = stats.size;

      if (since_bytes !== undefined && since_bytes >= 0) {
        // Read only new content since last position
        if (currentSize <= since_bytes) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                new_logs: "",
                message: "No new logs",
                bytes_position: currentSize,
                source: resolvedSource,
              }),
            }],
          };
        }

        const fd = fs.openSync(logFile, "r");
        const buffer = Buffer.alloc(currentSize - since_bytes);
        fs.readSync(fd, buffer, 0, buffer.length, since_bytes);
        fs.closeSync(fd);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              new_logs: buffer.toString("utf-8"),
              bytes_position: currentSize,
              source: resolvedSource,
            }),
          }],
        };
      }

      // Initial call - return last N lines and current position
      const { stdout } = await execAsync(`tail -n ${numLines} ${logFile}`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            initial_logs: stdout,
            bytes_position: currentSize,
            source: resolvedSource,
            hint: "Call again with since_bytes to get only new logs",
          }),
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error watching logs: ${e}` }] };
    }
  }
);

// filter_logs tool - Advanced filtering by severity, timestamp, tags
server.registerTool(
  "filter_logs",
  {
    description: "Filter logs by severity level, time range, or custom patterns",
    inputSchema: {
      source: sourceSchema,
      severity: z
        .enum(["error", "warn", "info", "debug", "all"])
        .optional()
        .describe('Filter by severity: "error", "warn", "info", "debug", or "all" (default)'),
      since_minutes: z.number().optional().describe("Show logs from last N minutes"),
      pattern: z.string().optional().describe("Additional regex pattern to match"),
      exclude_pattern: z.string().optional().describe("Regex pattern to exclude"),
      limit: z.number().optional().describe("Max lines to return (default 100)"),
    },
  },
  async ({ source, severity, since_minutes, pattern, exclude_pattern, limit }) => {
    const resolvedSource = resolveSource(source);
    const logFile = getLogFile(resolvedSource);
    const maxLines = limit ?? 100;

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

      // Read entire file for filtering
      const content = fs.readFileSync(logFile, "utf-8");
      let lines = content.split("\n");

      // Filter by severity
      if (severity && severity !== "all") {
        const severityPatterns: Record<string, RegExp> = {
          error: /\b(error|err|exception|fatal|crash|failed)\b/i,
          warn: /\b(warn|warning|deprecated)\b/i,
          info: /\b(info|log|notice)\b/i,
          debug: /\b(debug|trace|verbose)\b/i,
        };
        const regex = severityPatterns[severity];
        if (regex) {
          lines = lines.filter((line) => regex.test(line));
        }
      }

      // Filter by time (looks for common timestamp patterns)
      if (since_minutes && since_minutes > 0) {
        const cutoff = Date.now() - since_minutes * 60 * 1000;
        const timePatterns = [
          /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/,  // ISO format
          /(\d{2}:\d{2}:\d{2})/,  // HH:MM:SS
          /(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/,  // syslog format
        ];

        lines = lines.filter((line) => {
          for (const pattern of timePatterns) {
            const match = line.match(pattern);
            if (match) {
              const timestamp = new Date(match[1]).getTime();
              if (!isNaN(timestamp) && timestamp >= cutoff) {
                return true;
              }
            }
          }
          // If no timestamp found, include the line
          return true;
        });
      }

      // Filter by custom pattern
      if (pattern) {
        const regex = new RegExp(pattern, "i");
        lines = lines.filter((line) => regex.test(line));
      }

      // Exclude pattern
      if (exclude_pattern) {
        const regex = new RegExp(exclude_pattern, "i");
        lines = lines.filter((line) => !regex.test(line));
      }

      // Limit results
      const result = lines.slice(-maxLines).join("\n");

      return {
        content: [{
          type: "text",
          text: result || `No logs matching filters in ${resolvedSource}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error filtering logs: ${e}` }] };
    }
  }
);

// log_stats tool - Analytics and summaries
server.registerTool(
  "log_stats",
  {
    description: "Get statistics and analytics for logs including error frequency, log volume, and patterns",
    inputSchema: {
      source: sourceSchema,
      include_top_errors: z.boolean().optional().describe("Include top recurring errors (default true)"),
      include_timeline: z.boolean().optional().describe("Include hourly breakdown (default true)"),
    },
  },
  async ({ source, include_top_errors, include_timeline }) => {
    const resolvedSource = resolveSource(source);
    const logFile = getLogFile(resolvedSource);
    const showTopErrors = include_top_errors !== false;
    const showTimeline = include_timeline !== false;

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

      const stats = fs.statSync(logFile);
      const content = fs.readFileSync(logFile, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());

      // Count by severity
      const severityCounts = {
        errors: 0,
        warnings: 0,
        info: 0,
        other: 0,
      };

      const errorMessages: Map<string, number> = new Map();
      const hourlyActivity: Map<number, number> = new Map();

      for (const line of lines) {
        // Count severity
        if (/\b(error|err|exception|fatal|crash|failed)\b/i.test(line)) {
          severityCounts.errors++;

          // Extract error message for top errors
          if (showTopErrors) {
            const errorMatch = line.match(/(error|exception|failed)[:\s]+(.{0,100})/i);
            if (errorMatch) {
              const msg = errorMatch[2].trim().substring(0, 80);
              errorMessages.set(msg, (errorMessages.get(msg) || 0) + 1);
            }
          }
        } else if (/\b(warn|warning|deprecated)\b/i.test(line)) {
          severityCounts.warnings++;
        } else if (/\b(info|log|notice)\b/i.test(line)) {
          severityCounts.info++;
        } else {
          severityCounts.other++;
        }

        // Extract hour for timeline
        if (showTimeline) {
          const timeMatch = line.match(/(\d{2}):\d{2}:\d{2}/);
          if (timeMatch) {
            const hour = parseInt(timeMatch[1], 10);
            hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + 1);
          }
        }
      }

      // Build output
      let output = `## Log Statistics for ${resolvedSource}\n\n`;
      output += `**File:** ${logFile}\n`;
      output += `**Size:** ${(stats.size / 1024).toFixed(2)} KB\n`;
      output += `**Total Lines:** ${lines.length}\n`;
      output += `**Last Modified:** ${stats.mtime.toLocaleString()}\n\n`;

      output += `### Severity Breakdown\n`;
      output += `- Errors: ${severityCounts.errors}\n`;
      output += `- Warnings: ${severityCounts.warnings}\n`;
      output += `- Info: ${severityCounts.info}\n`;
      output += `- Other: ${severityCounts.other}\n\n`;

      if (showTopErrors && errorMessages.size > 0) {
        output += `### Top Recurring Errors\n`;
        const sortedErrors = [...errorMessages.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        for (const [msg, count] of sortedErrors) {
          output += `- (${count}x) ${msg}\n`;
        }
        output += "\n";
      }

      if (showTimeline && hourlyActivity.size > 0) {
        output += `### Hourly Activity\n`;
        const sortedHours = [...hourlyActivity.entries()].sort((a, b) => a[0] - b[0]);
        for (const [hour, count] of sortedHours) {
          const bar = "█".repeat(Math.min(Math.ceil(count / 10), 20));
          output += `${hour.toString().padStart(2, "0")}:00 ${bar} (${count})\n`;
        }
      }

      return { content: [{ type: "text", text: output }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error getting stats: ${e}` }] };
    }
  }
);

// Main entry point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
