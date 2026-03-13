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
| `time_report` | Get time report for a member for a date or date range |
| `set_custom_field` | Set a custom field value on an issue (requires config) |

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

## Custom fields

Huly stores custom fields as mixins with auto-generated IDs. To use `set_custom_field`, you need to find the field ID and map it to a friendly name.

### Finding custom field IDs

Create a temporary script `dump-fields.ts`:

```typescript
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '.env') })

import { ConnectOptions, NodeWebSocketFactory, connect } from '@hcengineering/api-client'
import tracker from '@hcengineering/tracker'

async function main() {
  const client = await connect(process.env.HULY_URL ?? 'https://huly.app', {
    email: process.env.HULY_EMAIL!,
    password: process.env.HULY_PASSWORD!,
    workspace: process.env.HULY_WORKSPACE!,
    socketFactory: NodeWebSocketFactory,
    connectionTimeout: 30000
  })

  try {
    // Pick any issue that has your custom fields filled in
    const issue = await client.findOne(tracker.class.Issue, { identifier: 'DEV-1' })
    if (!issue) throw new Error('Issue not found')

    const mixinData = (issue as any)['tracker:mixin:IssueTypeData']
    if (mixinData) {
      console.log('Custom fields on this issue:')
      for (const [key, value] of Object.entries(mixinData)) {
        console.log(`  ${key} = "${value}"`)
      }
    } else {
      console.log('No custom fields found on this issue')
    }
  } finally {
    await client.close()
  }
}

main().catch(console.error)
```

Run it:

```bash
npx tsx dump-fields.ts
```

Output example:

```
Custom fields on this issue:
  custom696fc1e93e1982f72ab4b92f = "main"
```

### Configuring custom fields

Add the mapping to your env (in `.env` or `.mcp.json`):

```env
# Format: friendlyName=hulyFieldId,anotherName=anotherId
HULY_CUSTOM_FIELDS=gitlabBranch=custom696fc1e93e1982f72ab4b92f
```

The `set_custom_field` tool will only appear if `HULY_CUSTOM_FIELDS` is configured. Custom field values also appear in `get_issue` output automatically.

## Usage examples

Once connected, you can ask your AI assistant things like:

- "Show my Todo tasks in the DEV project"
- "What's the description of DEV-592?"
- "Set DEV-592 to In Progress"
- "Log 2 hours on DEV-599"
- "Assign DEV-597 to Arsenii"
- "Add a comment to DEV-592: Started working on the bonus system"
- "Set gitlabBranch on DEV-592 to @user/feat/my-feature"
- "Show my time report for yesterday"

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
