# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm start            # Run the MCP server
```

## Architecture

This is an MCP (Model Context Protocol) server that watches development logs for Expo, Node.js, and Next.js. It uses stdio transport for communication with Claude Code.

**Single-file implementation**: `src/index.ts` contains the entire server with six registered tools:
- `get_logs` - Reads recent lines from a log file using `tail`
- `get_errors` - Greps for error/warning patterns
- `search_logs` - Searches logs for a given pattern
- `clear_logs` - Truncates the log file
- `setup_capture` - Returns shell commands to capture logs for a project type
- `list_sources` - Lists all available log sources and their status

**Supported Log Sources**:
| Source | File Path |
|--------|-----------|
| expo | `/tmp/expo.log` |
| nodejs | `/tmp/node.log` |
| nextjs | `/tmp/nextjs.log` |

**Key dependencies**:
- `@modelcontextprotocol/sdk` - MCP server framework
- `zod` - Input schema validation

## Log File Setup

The server expects logs at specific paths. Use the `script` command to capture output:

```bash
# Expo
script -q /tmp/expo.log npx expo start -c --go

# Node.js
script -q /tmp/node.log npm start
script -q /tmp/node.log npm run dev

# Next.js
script -q /tmp/nextjs.log npm run dev
```

Use the `setup_capture` tool to get the exact command for each source.

## MCP Server Registration

Add to `~/.claude.json`:
```json
{
  "mcpServers": {
    "log-watcher": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```
