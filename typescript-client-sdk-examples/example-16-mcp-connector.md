# Example 16: MCP Connector

> Connect Claude to external Model Context Protocol (MCP) servers for dynamic tool access.

## Overview

- **Difficulty**: Expert
- **Features Used**: MCP Connector
- **SDK Methods**: `client.beta.messages.create()`
- **Beta**: `mcp-client-2025-11-20`
- **Use Cases**:
  - Connect to remote databases via MCP
  - Access third-party APIs through MCP servers
  - Dynamic tool discovery from external services
  - Multi-server orchestration
  - Enterprise tool integration

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- MCP server endpoint (URL accessible from Anthropic's servers)

---

## What is MCP?

The Model Context Protocol (MCP) allows Claude to connect to external tool servers at request time. Instead of defining tools inline, you point Claude at an MCP server and it discovers available tools automatically.

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
│                                                              │
│   client.beta.messages.create({                              │
│     mcp_servers: [{ url: "..." }]                           │
│   })                                                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Anthropic API                               │
│                                                              │
│   1. Connects to MCP server(s)                              │
│   2. Discovers available tools                               │
│   3. Claude decides which tools to call                      │
│   4. Executes tool calls via MCP                            │
│   5. Returns final response                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               MCP Server(s)                                  │
│                                                              │
│   - Database access                                          │
│   - API integrations                                         │
│   - File systems                                             │
│   - Custom business logic                                    │
└─────────────────────────────────────────────────────────────┘
```

**Key difference from regular tool use**: With MCP, you do not define tools in the request. The MCP server advertises its own tools, and Claude discovers and calls them automatically.

---

## Basic MCP Connection

Connect Claude to a single MCP server with bearer token authentication.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  mcp_servers: [
    {
      type: "url",
      url: "https://mcp.example.com/database",
      name: "company_database",
      authorization: {
        type: "bearer",
        token: "your-mcp-token",
      },
    },
  ],
  messages: [
    {
      role: "user",
      content: "How many active customers do we have this month?",
    },
  ],
});

console.log(message.content[0]);
```

### Response

```json
{
  "id": "msg_01ABC123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Based on the database query, you have **1,247 active customers** this month. This represents a 12% increase from last month's 1,113 active customers."
    }
  ],
  "stop_reason": "end_turn",
  "mcp_tool_calls": [
    {
      "server_name": "company_database",
      "tool_name": "query_database",
      "input": {
        "sql": "SELECT COUNT(*) FROM customers WHERE status = 'active' AND last_active >= DATE_TRUNC('month', CURRENT_DATE)"
      },
      "output": "{\"count\": 1247}"
    }
  ]
}
```

**Key points:**
- `betas: ["mcp-client-2025-11-20"]` enables the MCP connector beta
- `mcp_servers` replaces the `tools` array for MCP-provided tools
- The response includes `mcp_tool_calls` showing what tools were used
- Claude handles the full tool discovery and execution cycle

---

## MCP Server Configuration

### Bearer Token Authentication

The most common authentication method for MCP servers.

```typescript
{
  type: "url",
  url: "https://mcp.example.com/api",
  name: "my_server",
  authorization: {
    type: "bearer",
    token: "your-bearer-token",
  },
}
```

### OAuth Authentication

For MCP servers that use OAuth 2.0 tokens.

```typescript
{
  type: "url",
  url: "https://mcp.example.com/api",
  name: "oauth_server",
  authorization: {
    type: "oauth",
    token: "your-oauth-access-token",
  },
}
```

### API Key Authentication

For MCP servers that accept API keys.

```typescript
{
  type: "url",
  url: "https://mcp.example.com/api",
  name: "api_key_server",
  authorization: {
    type: "api_key",
    api_key: "your-api-key",
  },
}
```

### No Authentication

For public or internal MCP servers that do not require authentication.

```typescript
{
  type: "url",
  url: "https://mcp.internal.example.com/tools",
  name: "internal_tools",
}
```

---

## Tool Filtering

Use `tool_configuration` to control which MCP tools Claude can access. This is important for security and to keep Claude focused on relevant tools.

### Allow Specific Tools

Only permit Claude to use specific tools from the MCP server.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  mcp_servers: [
    {
      type: "url",
      url: "https://mcp.example.com/database",
      name: "company_database",
      authorization: {
        type: "bearer",
        token: "your-mcp-token",
      },
    },
  ],
  tool_configuration: {
    allowed_tools: [
      { type: "mcp", server_name: "company_database", tool_name: "query_customers" },
      { type: "mcp", server_name: "company_database", tool_name: "get_customer_details" },
    ],
  },
  messages: [
    {
      role: "user",
      content: "Look up the details for customer ID 42.",
    },
  ],
});

console.log(message.content[0]);
```

### Deny Specific Tools

Block certain tools while allowing all others.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  mcp_servers: [
    {
      type: "url",
      url: "https://mcp.example.com/database",
      name: "company_database",
      authorization: {
        type: "bearer",
        token: "your-mcp-token",
      },
    },
  ],
  tool_configuration: {
    denied_tools: [
      { type: "mcp", server_name: "company_database", tool_name: "delete_record" },
      { type: "mcp", server_name: "company_database", tool_name: "drop_table" },
    ],
  },
  messages: [
    {
      role: "user",
      content: "Show me the sales figures for Q4.",
    },
  ],
});

console.log(message.content[0]);
```

---

## Multiple MCP Servers

Connect Claude to multiple MCP servers simultaneously. Each server is identified by its `name` field.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  mcp_servers: [
    {
      type: "url",
      url: "https://mcp.example.com/database",
      name: "company_database",
      authorization: {
        type: "bearer",
        token: "db-token-123",
      },
    },
    {
      type: "url",
      url: "https://mcp.example.com/analytics",
      name: "analytics_engine",
      authorization: {
        type: "bearer",
        token: "analytics-token-456",
      },
    },
    {
      type: "url",
      url: "https://mcp.example.com/notifications",
      name: "notification_service",
      authorization: {
        type: "api_key",
        api_key: "notif-key-789",
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Check our database for customers who churned last month, run an analysis on why they left, and send me a summary notification.",
    },
  ],
});

// Claude will automatically discover tools from all three servers
// and orchestrate calls across them to fulfill the request
for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
```

Claude discovers tools from all connected servers and can orchestrate calls across them in a single conversation turn.

---

## Combining MCP with Local Tools

You can use MCP servers alongside locally defined tools. This is useful when you want Claude to have access to both remote MCP tools and custom tools you execute on your side.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  // Remote MCP tools (executed by the MCP server)
  mcp_servers: [
    {
      type: "url",
      url: "https://mcp.example.com/database",
      name: "company_database",
      authorization: {
        type: "bearer",
        token: "your-mcp-token",
      },
    },
  ],
  // Local tools (you execute these yourself)
  tools: [
    {
      name: "send_email",
      description: "Send an email to a specified recipient",
      input_schema: {
        type: "object" as const,
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body content" },
        },
        required: ["to", "subject", "body"],
      },
    },
    {
      name: "create_ticket",
      description: "Create a support ticket in the internal system",
      input_schema: {
        type: "object" as const,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
          },
        },
        required: ["title", "description", "priority"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Find all customers with overdue invoices, then create a high-priority ticket and send me an email summary.",
    },
  ],
});

// MCP tools are executed automatically by the MCP server
// Local tools require you to handle tool_use blocks as usual
for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
  if (block.type === "tool_use") {
    console.log(`Local tool requested: ${block.name}`);
    console.log("Input:", JSON.stringify(block.input, null, 2));
    // Execute the local tool and send the result back
  }
}
```

**How it works:**
- MCP tools are discovered and executed by the MCP server -- you do not handle them
- Local tools (defined in `tools`) require you to execute them and send results back, as with standard tool use
- Claude seamlessly combines both types in its responses
- If `stop_reason` is `"tool_use"`, it means Claude needs you to execute a local tool

---

## Error Handling

MCP connections can fail for various reasons: server downtime, authentication errors, network issues, or tool execution failures. Handle these cases gracefully.

### Catching API Errors

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

try {
  const message = await client.beta.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    betas: ["mcp-client-2025-11-20"],
    mcp_servers: [
      {
        type: "url",
        url: "https://mcp.example.com/database",
        name: "company_database",
        authorization: {
          type: "bearer",
          token: "your-mcp-token",
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: "How many active customers do we have?",
      },
    ],
  });

  // Check for MCP-specific errors in the response
  if ("mcp_errors" in message) {
    const mcpErrors = (message as any).mcp_errors;
    for (const error of mcpErrors) {
      console.error(`MCP Error [${error.server_name}]: ${error.message}`);
    }
  }

  // Process the response
  for (const block of message.content) {
    if (block.type === "text") {
      console.log(block.text);
    }
  }
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    console.error(`API Error: ${error.status} - ${error.message}`);

    switch (error.status) {
      case 400:
        console.error("Bad request -- check MCP server configuration");
        break;
      case 401:
        console.error("Authentication failed -- check your API key");
        break;
      case 422:
        console.error(
          "Invalid MCP server URL or configuration"
        );
        break;
      case 502:
        console.error(
          "MCP server is unreachable -- verify the URL and server status"
        );
        break;
      case 529:
        console.error("Anthropic API is overloaded -- retry with backoff");
        break;
      default:
        console.error("Unexpected error");
    }
  } else {
    console.error("Unexpected error:", error);
  }
}
```

### Retry with Exponential Backoff

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function callWithRetry(
  params: Parameters<typeof client.beta.messages.create>[0],
  maxRetries: number = 3
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.beta.messages.create(params);
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        // Only retry on transient errors
        if ([429, 502, 503, 529].includes(error.status)) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(
            `Attempt ${attempt + 1} failed (${error.status}). Retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error; // Non-retryable error
    }
  }
  throw new Error(`Failed after ${maxRetries} attempts`);
}

const message = await callWithRetry({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  mcp_servers: [
    {
      type: "url",
      url: "https://mcp.example.com/database",
      name: "company_database",
      authorization: {
        type: "bearer",
        token: "your-mcp-token",
      },
    },
  ],
  messages: [
    {
      role: "user",
      content: "How many active customers do we have?",
    },
  ],
});

console.log(message.content[0]);
```

---

## Best Practices

1. **Use Tool Filtering in Production**: Always restrict which MCP tools Claude can use via `allowed_tools` or `denied_tools`. Do not give Claude unrestricted access to destructive operations like `delete_record` or `drop_table`.

2. **Name Servers Descriptively**: Use clear `name` values like `"company_database"` or `"analytics_engine"` rather than generic names. Claude uses these names to understand what each server provides.

3. **Secure Your Tokens**: Never hardcode MCP authentication tokens in source code. Use environment variables or a secrets manager.

4. **Monitor MCP Tool Calls**: Log the `mcp_tool_calls` from responses for auditing and debugging. This tells you exactly what tools Claude invoked and what data it accessed.

5. **Handle Partial Failures**: When using multiple MCP servers, one server may fail while others succeed. Check for `mcp_errors` in the response and handle gracefully -- Claude will typically still provide a partial answer using the servers that responded.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Standard tool use fundamentals
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Multi-step autonomous agents
- [Example 14: Research Agent](example-14-research-agent.md) - Advanced research with tools
- [Example 08: RAG Knowledge Base](example-08-rag-knowledge-base.md) - External data integration
