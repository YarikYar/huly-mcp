# huly-mcp

MCP server for [Huly](https://huly.io) project management platform. Lets AI assistants (Claude, etc.) manage issues, track time, update statuses, and more — directly from your IDE.

## Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects in the workspace |
| `list_issues` | List issues with filters (project, status, assignee, priority) |
| `get_issue` | Get issue details with full markdown description |
| `update_status` | Change issue status |
| `update_assignee` | Change issue assignee |
| `add_time` | Log time spent on an issue |
| `add_comment` | Add a comment to an issue |
| `list_statuses` | List available issue statuses for a project |
| `list_members` | List workspace members |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YarikYar/huly-mcp.git
cd huly-mcp
npm install
```

### 2. Configure credentials

Copy the example env file and fill in your Huly credentials:

```bash
cp .env.example .env
```

```env
HULY_URL=https://huly.app
HULY_EMAIL=your@email.com
HULY_PASSWORD=your_password
HULY_WORKSPACE=your-workspace-id
```

To find your workspace ID, go to Huly settings or check the URL when logged in.

### 3. Add to Claude Code

Add to your `.mcp.json` (project-level or `~/.claude/.mcp.json` for global):

```json
{
  "mcpServers": {
    "huly": {
      "command": "npx",
      "args": ["tsx", "/path/to/huly-mcp/src/server.ts"],
      "env": {
        "HULY_URL": "https://huly.app",
        "HULY_EMAIL": "your@email.com",
        "HULY_PASSWORD": "your_password",
        "HULY_WORKSPACE": "your-workspace-id"
      }
    }
  }
}
```

Or use `.env` file and omit the `env` block:

```json
{
  "mcpServers": {
    "huly": {
      "command": "npx",
      "args": ["tsx", "/path/to/huly-mcp/src/server.ts"]
    }
  }
}
```

### 4. Add to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "huly": {
      "command": "npx",
      "args": ["tsx", "/path/to/huly-mcp/src/server.ts"],
      "env": {
        "HULY_URL": "https://huly.app",
        "HULY_EMAIL": "your@email.com",
        "HULY_PASSWORD": "your_password",
        "HULY_WORKSPACE": "your-workspace-id"
      }
    }
  }
}
```

## Usage examples

Once connected, you can ask your AI assistant things like:

- "Show my Todo tasks in the DEV project"
- "What's the description of DEV-592?"
- "Set DEV-592 to In Progress"
- "Log 2 hours on DEV-599"
- "Assign DEV-597 to Arsenii"
- "Add a comment to DEV-592: Started working on the bonus system"

## How it works

The server connects to Huly via their official `@hcengineering/api-client` WebSocket API. Connection is established lazily on first tool call and automatically reconnects if dropped.

## Priority values

| Value | Meaning |
|-------|---------|
| 0 | No priority |
| 1 | Urgent |
| 2 | High |
| 3 | Medium |
| 4 | Low |

## License

MIT
