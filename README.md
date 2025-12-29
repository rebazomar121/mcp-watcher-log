# MCP Log Watcher

An MCP server for watching and searching Expo/React Native logs from Claude Code.

## Installation

```bash
npm install
npm run build
```

## Setup with Claude Code

Add to your Claude Code MCP settings (`~/.claude.json`):

```json
{
  "mcpServers": {
    "log-watcher": {
      "command": "node",
      "args": ["/path/mcp_logger/dist/index.js"]
    }
  }
}
```

## Usage

First, start your Expo app with log capture:

```bash
alias expodev='script -q /tmp/expo.log npx expo start -c --go'
```

Then run your Project with `expodev`
```bash
expodev
```

Then use these tools in Claude Code:

| Tool | Description |
|------|-------------|
| `get_logs` | Get recent logs (default: 100 lines) |
| `get_errors` | Get only errors and warnings |
| `search_logs` | Search logs for a pattern |
| `clear_logs` | Clear the log file |

## Examples

```
# Get last 50 lines of logs
get_logs(lines: 50)

# Find all errors
get_errors()

# Search for specific text
search_logs(pattern: "TypeError")
```
