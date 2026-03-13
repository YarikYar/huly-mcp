import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ConnectOptions, NodeWebSocketFactory, connect, type PlatformClient } from '@hcengineering/api-client'
import { SortingOrder, type Ref, type Doc, type Space } from '@hcengineering/core'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import chunter from '@hcengineering/chunter'
import contact from '@hcengineering/contact'
import { z } from 'zod'

let client: PlatformClient | null = null

function getConnectOptions(): { url: string, options: ConnectOptions } {
  return {
    url: process.env.HULY_URL ?? 'https://huly.app',
    options: {
      email: process.env.HULY_EMAIL!,
      password: process.env.HULY_PASSWORD!,
      workspace: process.env.HULY_WORKSPACE!,
      socketFactory: NodeWebSocketFactory,
      connectionTimeout: 30000
    }
  }
}

async function getClient(): Promise<PlatformClient> {
  if (client !== null) {
    // Check if connection is alive with a lightweight query
    try {
      await client.findAll(tracker.class.Project, {}, { limit: 1 })
      return client
    } catch {
      console.error('Huly connection lost, reconnecting...')
      try { await client.close() } catch {}
      client = null
    }
  }

  const { url, options } = getConnectOptions()
  client = await connect(url, options)
  return client
}

const server = new McpServer({
  name: 'huly',
  version: '1.0.0'
})

// --- list_projects ---
server.tool('list_projects', 'List all projects in the workspace', {}, async () => {
  const c = await getClient()
  const projects = await c.findAll(tracker.class.Project, {}, {
    lookup: { type: task.class.ProjectType }
  })

  const result = projects.map(p => ({
    identifier: p.identifier,
    name: p.name,
    description: p.description ?? '',
    id: p._id
  }))

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

// --- list_statuses ---
server.tool('list_statuses', 'List available issue statuses', {
  project: z.string().optional().describe('Project identifier (e.g. DEV). If omitted, lists all statuses')
}, async ({ project: projectId }) => {
  const c = await getClient()
  const statuses = await c.findAll(tracker.class.IssueStatus, {})

  let result = statuses.map(s => ({
    id: s._id,
    name: s.name,
    category: s.category
  }))

  if (projectId) {
    const proj = await c.findOne(tracker.class.Project, { identifier: projectId }, {
      lookup: { type: task.class.ProjectType }
    })
    if (proj?.$lookup?.type) {
      const projStatusIds = new Set((proj.$lookup.type as any).statuses?.map((s: any) => s._id ?? s) ?? [])
      if (projStatusIds.size > 0) {
        result = result.filter(s => projStatusIds.has(s.id))
      }
    }
  }

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

// --- list_members ---
server.tool('list_members', 'List workspace members', {}, async () => {
  const c = await getClient()
  const members = await c.findAll(contact.mixin.Employee, { active: true } as any)

  const result = members.map(m => ({
    id: m._id,
    name: (m as any).name ?? '',
  }))

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

// --- list_issues ---
server.tool('list_issues', 'List issues with optional filters', {
  project: z.string().optional().describe('Project identifier (e.g. DEV)'),
  status: z.string().optional().describe('Status ID to filter by'),
  assignee: z.string().optional().describe('Assignee person ID to filter by'),
  priority: z.number().optional().describe('Priority: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low'),
  limit: z.number().optional().describe('Max results (default 50)'),
}, async ({ project: projectId, status, assignee, priority, limit }) => {
  const c = await getClient()

  const query: Record<string, any> = {}

  if (projectId) {
    const proj = await c.findOne(tracker.class.Project, { identifier: projectId })
    if (proj) query.space = proj._id
  }
  if (status) query.status = status
  if (assignee) query.assignee = assignee
  if (priority !== undefined) query.priority = priority

  const issues = await c.findAll(
    tracker.class.Issue,
    query,
    {
      limit: limit ?? 50,
      sort: { modifiedOn: SortingOrder.Descending }
    }
  )

  const result = issues.map(issue => ({
    id: issue._id,
    identifier: issue.identifier,
    title: issue.title,
    priority: issue.priority,
    status: (issue as any).status,
    assignee: (issue as any).assignee,
    estimation: (issue as any).estimation,
    reportedTime: (issue as any).reportedTime,
    dueDate: (issue as any).dueDate,
    modifiedOn: issue.modifiedOn,
  }))

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

// --- get_issue ---
server.tool('get_issue', 'Get issue details with full markdown description', {
  identifier: z.string().describe('Issue identifier (e.g. DEV-123)')
}, async ({ identifier }) => {
  const c = await getClient()
  const issue = await c.findOne(tracker.class.Issue, { identifier })

  if (!issue) {
    return { content: [{ type: 'text', text: `Issue ${identifier} not found` }] }
  }

  let description = ''
  if (issue.description) {
    try {
      description = await c.fetchMarkup(issue._class, issue._id, 'description', issue.description, 'markdown')
    } catch {
      description = '(failed to fetch description)'
    }
  }

  const result = {
    id: issue._id,
    identifier: issue.identifier,
    title: issue.title,
    description,
    priority: issue.priority,
    status: (issue as any).status,
    assignee: (issue as any).assignee,
    estimation: (issue as any).estimation,
    reportedTime: (issue as any).reportedTime,
    dueDate: (issue as any).dueDate,
    createdOn: issue.createdOn,
    modifiedOn: issue.modifiedOn,
    space: issue.space,
  }

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

// --- update_status ---
server.tool('update_status', 'Change issue status', {
  identifier: z.string().describe('Issue identifier (e.g. DEV-123)'),
  status: z.string().describe('New status ID (use list_statuses to get available IDs)')
}, async ({ identifier, status }) => {
  const c = await getClient()
  const issue = await c.findOne(tracker.class.Issue, { identifier })

  if (!issue) {
    return { content: [{ type: 'text', text: `Issue ${identifier} not found` }] }
  }

  await c.updateDoc(tracker.class.Issue, issue.space, issue._id, { status: status as any })

  return { content: [{ type: 'text', text: `Status of ${identifier} updated to ${status}` }] }
})

// --- update_assignee ---
server.tool('update_assignee', 'Change issue assignee', {
  identifier: z.string().describe('Issue identifier (e.g. DEV-123)'),
  assignee: z.string().nullable().describe('Person ID of new assignee (use list_members to find). Pass null to unassign.')
}, async ({ identifier, assignee }) => {
  const c = await getClient()
  const issue = await c.findOne(tracker.class.Issue, { identifier })

  if (!issue) {
    return { content: [{ type: 'text', text: `Issue ${identifier} not found` }] }
  }

  await c.updateDoc(tracker.class.Issue, issue.space, issue._id, {
    assignee: assignee ? assignee as any : null
  })

  return { content: [{ type: 'text', text: `Assignee of ${identifier} updated` }] }
})

// --- add_time ---
server.tool('add_time', 'Log time spent on an issue', {
  identifier: z.string().describe('Issue identifier (e.g. DEV-123)'),
  hours: z.number().describe('Time spent in hours (e.g. 1.5 for 1h30m)'),
  description: z.string().optional().describe('Description of work done'),
  employee: z.string().optional().describe('Employee ID (defaults to issue assignee)')
}, async ({ identifier, hours, description, employee }) => {
  const c = await getClient()
  const issue = await c.findOne(tracker.class.Issue, { identifier })

  if (!issue) {
    return { content: [{ type: 'text', text: `Issue ${identifier} not found` }] }
  }

  const employeeId = employee ?? (issue as any).assignee ?? null

  await c.addCollection(
    tracker.class.TimeSpendReport,
    issue.space,
    issue._id,
    tracker.class.Issue,
    'reports',
    {
      employee: employeeId as any,
      date: Date.now() as any,
      value: hours,
      description: description ?? ''
    }
  )

  return { content: [{ type: 'text', text: `Logged ${hours}h on ${identifier}` }] }
})

// --- add_comment ---
server.tool('add_comment', 'Add a comment to an issue', {
  identifier: z.string().describe('Issue identifier (e.g. DEV-123)'),
  message: z.string().describe('Comment text (supports basic HTML: <p>, <b>, <i>, <code>, <ul>, <li>)')
}, async ({ identifier, message }) => {
  const c = await getClient()
  const issue = await c.findOne(tracker.class.Issue, { identifier })

  if (!issue) {
    return { content: [{ type: 'text', text: `Issue ${identifier} not found` }] }
  }

  await c.addCollection(
    chunter.class.ChatMessage,
    issue.space,
    issue._id,
    tracker.class.Issue,
    'comments',
    { message }
  )

  return { content: [{ type: 'text', text: `Comment added to ${identifier}` }] }
})

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Huly MCP server started')
}

main().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
