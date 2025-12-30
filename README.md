# MCP Log Watcher

An MCP server for watching and searching development logs (Expo, Node.js, Next.js) from Claude Code.

## Installation

```bash
npm install
npm run build
```

## Setup with Claude Code

### Step 1: Build the project

```bash
cd /path/to/mcp_logger
npm install
npm run build
```

### Step 2: Add to Claude Code MCP settings

Open your Claude Code config file:

```bash
# macOS/Linux
nano ~/.claude.json

# Or use any text editor
code ~/.claude.json
```

Add the `log-watcher` server to your `mcpServers` configuration:

```json
{
  "mcpServers": {
    "log-watcher": {
      "command": "node",
      "args": ["/absolute/path/to/mcp_logger/dist/index.js"]
    }
  }
}
```

**Important:** Replace `/absolute/path/to/mcp_logger` with the actual path where you cloned this repository.

### Step 3: Restart Claude Code

After saving the config, restart Claude Code to load the new MCP server.

### Step 4: Verify

In Claude Code, you can now use commands like:
- `list_sources()` - Check available log sources
- `setup_capture(source: "nodejs")` - Get the command to start capturing logs

## Supported Log Sources

| Source | Log File | Description |
|--------|----------|-------------|
| `expo` | `/tmp/expo.log` | Expo/React Native development server |
| `nodejs` | `/tmp/node.log` | Node.js application |
| `nextjs` | `/tmp/nextjs.log` | Next.js development server |

## Usage

### Start with Log Capture

Use the `setup_capture` tool to get the exact command, or use these aliases:

```bash
# Expo
alias expodev='script -q /tmp/expo.log npx expo start -c --go'

# Node.js
alias nodestart='script -q /tmp/node.log npm start'
# or for dev mode:
alias nodedev='script -q /tmp/node.log npm run dev'

# Next.js
alias nextdev='script -q /tmp/nextjs.log npm run dev'
```

Then run your project with the alias (e.g., `expodev`, `nodedev`, `nextdev`).

### Available Tools

| Tool | Description |
|------|-------------|
| `get_logs` | Get recent logs (default: 100 lines) |
| `get_errors` | Get only errors and warnings |
| `search_logs` | Search logs for a pattern |
| `clear_logs` | Clear the log file |
| `setup_capture` | Get shell command to capture logs |
| `list_sources` | List all log sources and their status |

### Source Parameter

All tools accept an optional `source` parameter:
- `"expo"` (default) - Expo/React Native logs
- `"nodejs"` - Node.js logs
- `"nextjs"` - Next.js logs

## Examples

```
# Get last 50 lines of Expo logs (default)
get_logs(lines: 50)

# Get Node.js errors
get_errors(source: "nodejs")

# Search Next.js logs
search_logs(pattern: "TypeError", source: "nextjs")

# Get setup command for Node.js
setup_capture(source: "nodejs")

# List all available sources
list_sources()
```
