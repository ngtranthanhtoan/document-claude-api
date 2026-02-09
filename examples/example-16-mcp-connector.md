# Example 16: MCP Connector

> Connect Claude to external Model Context Protocol (MCP) servers for dynamic tool access.

## Overview

- **Difficulty**: Expert
- **Features Used**: MCP Connector
- **Beta Header Required**: `anthropic-beta: mcp-client-2025-11-20`
- **Use Cases**:
  - Database integrations
  - External API access
  - Enterprise system connections
  - Dynamic tool discovery
  - Multi-server orchestration

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- MCP server endpoint (self-hosted or third-party)
- Understanding of MCP protocol

---

## What is MCP?

Model Context Protocol (MCP) is a standard for connecting AI models to external tools and data sources. Instead of defining tools in your API request, you point Claude to an MCP server that provides tools dynamically.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │ ──> │ MCP Server  │ ──> │ External    │
│   API       │     │ (tools +    │     │ Systems     │
│             │ <── │  data)      │ <── │ (DB, APIs)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Basic MCP Connection

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: mcp-client-2025-11-20" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "mcp_servers": [
      {
        "type": "url",
        "url": "https://mcp.example.com/database",
        "name": "company_database",
        "authorization": {
          "type": "bearer",
          "token": "your-mcp-token"
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "How many active customers do we have this month?"
      }
    ]
  }'
```

### Response

```json
{
  "id": "msg_01ABC",
  "content": [
    {
      "type": "text",
      "text": "Based on the database query, you have 1,247 active customers this month, which is a 12% increase from last month (1,113 customers)."
    }
  ],
  "mcp_tool_calls": [
    {
      "server": "company_database",
      "tool": "query_customers",
      "input": {"status": "active", "period": "current_month"},
      "result": {"count": 1247, "previous_month": 1113}
    }
  ]
}
```

---

## MCP Server Configuration

### Server Types

```json
{
  "mcp_servers": [
    {
      "type": "url",
      "url": "https://mcp.example.com/v1",
      "name": "my_server",
      "authorization": {
        "type": "bearer",
        "token": "token123"
      }
    }
  ]
}
```

### Authorization Options

**Bearer Token:**
```json
{
  "authorization": {
    "type": "bearer",
    "token": "your-token"
  }
}
```

**OAuth:**
```json
{
  "authorization": {
    "type": "oauth",
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "token_url": "https://auth.example.com/token"
  }
}
```

**API Key:**
```json
{
  "authorization": {
    "type": "api_key",
    "header": "X-API-Key",
    "value": "your-api-key"
  }
}
```

---

## Tool Filtering

Control which tools Claude can access.

### Allow List

Only enable specific tools:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: mcp-client-2025-11-20" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "mcp_servers": [
      {
        "type": "url",
        "url": "https://mcp.example.com/database",
        "name": "database",
        "tool_configuration": {
          "allowed_tools": ["query_customers", "get_order_history"]
        }
      }
    ],
    "messages": [{"role": "user", "content": "Show customer data"}]
  }'
```

### Deny List

Disable specific tools:

```json
{
  "tool_configuration": {
    "denied_tools": ["delete_record", "drop_table", "modify_schema"]
  }
}
```

---

## Multiple MCP Servers

Connect to multiple servers simultaneously.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: mcp-client-2025-11-20" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "mcp_servers": [
      {
        "type": "url",
        "url": "https://mcp.example.com/crm",
        "name": "salesforce_crm",
        "authorization": {"type": "bearer", "token": "crm-token"}
      },
      {
        "type": "url",
        "url": "https://mcp.example.com/support",
        "name": "zendesk_support",
        "authorization": {"type": "bearer", "token": "zendesk-token"}
      },
      {
        "type": "url",
        "url": "https://mcp.example.com/analytics",
        "name": "analytics",
        "authorization": {"type": "api_key", "header": "X-API-Key", "value": "analytics-key"}
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Give me a complete view of customer CUST-123: their CRM record, support tickets, and usage analytics."
      }
    ]
  }'
```

### Response

Claude will call tools from multiple servers to gather comprehensive data.

---

## Database MCP Server Example

### Available Tools (from MCP server)

The MCP server might expose tools like:

```json
{
  "tools": [
    {
      "name": "query_sql",
      "description": "Execute read-only SQL query",
      "parameters": {
        "query": "string",
        "limit": "integer"
      }
    },
    {
      "name": "get_table_schema",
      "description": "Get schema for a table",
      "parameters": {
        "table_name": "string"
      }
    },
    {
      "name": "list_tables",
      "description": "List all available tables",
      "parameters": {}
    }
  ]
}
```

### Usage

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: mcp-client-2025-11-20" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "mcp_servers": [
      {
        "type": "url",
        "url": "https://db-mcp.example.com",
        "name": "analytics_db"
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "What were our top 10 selling products last quarter?"
      }
    ]
  }'
```

Claude will:
1. Call `list_tables` or `get_table_schema` to understand the database
2. Construct an appropriate SQL query
3. Execute via `query_sql`
4. Present the results

---

## GitHub MCP Example

### Configuration

```json
{
  "mcp_servers": [
    {
      "type": "url",
      "url": "https://mcp.github.com/v1",
      "name": "github",
      "authorization": {
        "type": "bearer",
        "token": "ghp_xxxxxxxxxxxx"
      },
      "tool_configuration": {
        "allowed_tools": ["list_repos", "get_issues", "create_issue", "search_code"]
      }
    }
  ]
}
```

### Usage

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: mcp-client-2025-11-20" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "mcp_servers": [{
      "type": "url",
      "url": "https://mcp.github.com/v1",
      "name": "github",
      "authorization": {"type": "bearer", "token": "ghp_xxx"}
    }],
    "messages": [
      {
        "role": "user",
        "content": "Find all open bugs labeled as high-priority in my repo myorg/myapp"
      }
    ]
  }'
```

---

## Combining MCP with Local Tools

Use both MCP servers and locally-defined tools.

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: mcp-client-2025-11-20" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "mcp_servers": [
      {
        "type": "url",
        "url": "https://mcp.example.com/database",
        "name": "database"
      }
    ],
    "tools": [
      {
        "name": "send_notification",
        "description": "Send a notification to the ops team",
        "input_schema": {
          "type": "object",
          "properties": {
            "message": {"type": "string"},
            "priority": {"type": "string", "enum": ["low", "medium", "high"]}
          },
          "required": ["message"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Check if we have any customers with overdue payments and notify the ops team if there are more than 10"
      }
    ]
  }'
```

---

## Error Handling

### MCP Server Errors

```json
{
  "id": "msg_01ABC",
  "content": [
    {
      "type": "text",
      "text": "I attempted to query the database but encountered an error. The database server returned: Connection timeout. Please try again or contact your administrator."
    }
  ],
  "mcp_errors": [
    {
      "server": "company_database",
      "error": "CONNECTION_TIMEOUT",
      "message": "Failed to connect to database server within 30 seconds"
    }
  ]
}
```

---

## Best Practices

1. **Use Allow Lists**: Restrict tools to only what's needed.

2. **Secure Tokens**: Never expose MCP tokens in client-side code.

3. **Handle Errors**: MCP servers can fail - handle gracefully.

4. **Monitor Usage**: Track which tools are being called.

5. **Version Your Servers**: Use versioned MCP endpoints for stability.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool fundamentals
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Multi-tool workflows
- [Example 17: Computer Use](example-17-computer-use.md) - Another advanced integration
