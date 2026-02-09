import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── MCP Connector Overview ───
  printHeader("MCP Connector: Connecting Claude to External Tool Servers");

  console.log(`
MCP (Model Context Protocol) allows Claude to connect to external tool servers
at request time. Instead of defining tools inline, you point Claude at an MCP
server and it discovers available tools automatically.

Architecture:
  Your App  →  Anthropic API  →  MCP Server(s)
                                  ├── Database access
                                  ├── API integrations
                                  └── Custom business logic
`);

  // ─── Method 1: Basic MCP Request (demo with error handling) ───
  printHeader("Method 1: Basic MCP Request Structure");

  console.log("The MCP API call structure looks like this:\n");
  console.log(`client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  betas: ["mcp-client-2025-11-20"],
  mcp_servers: [
    {
      type: "url",
      url: "https://your-mcp-server.example.com/mcp",
      name: "my_mcp_server",
    },
  ],
  messages: [{ role: "user", content: "Query the database..." }],
});`);

  console.log("\nAttempting an MCP call (will fail gracefully without a real MCP server)...\n");

  try {
    const response = await (client.beta.messages as any).create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      betas: ["mcp-client-2025-11-20"],
      mcp_servers: [
        {
          type: "url",
          url: "https://example.com/mcp-demo-server",
          name: "demo_server",
        },
      ],
      messages: [
        {
          role: "user",
          content: "List all available tools from the MCP server.",
        },
      ],
    });

    console.log("Response received!");
    for (const block of response.content) {
      if (block.type === "text") console.log(block.text);
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.log(`Expected error (no real MCP server): ${error.status} - ${error.message}`);
      console.log("\nThis is expected! To use MCP, you need a running MCP server accessible from Anthropic's servers.");
    } else {
      console.log(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // ─── Method 2: Multi-Server Configuration ───
  printHeader("Method 2: Multi-Server MCP Configuration");

  console.log("You can connect to multiple MCP servers simultaneously:\n");
  console.log(`client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  mcp_servers: [
    {
      type: "url",
      url: "https://db-server.example.com/mcp",
      name: "database",
    },
    {
      type: "url",
      url: "https://api-server.example.com/mcp",
      name: "external_apis",
      authorization_token: "Bearer sk-xxx",
    },
  ],
  messages: [{ role: "user", content: "Look up user 42 and check their API usage" }],
});`);

  // ─── Method 3: Allowed vs Exposed Tools ───
  printHeader("Method 3: Tool Filtering (allowed_tools)");

  console.log(`You can limit which MCP tools Claude can use:

mcp_servers: [
  {
    type: "url",
    url: "https://db-server.example.com/mcp",
    name: "database",
    // Only allow read operations — block writes
    allowed_tools: ["read_query", "list_tables", "describe_table"],
  },
]

And specify tools to expose to the model:

mcp_servers: [
  {
    type: "url",
    url: "https://server.example.com/mcp",
    name: "my_server",
    // Only expose specific tools (hides the rest)
    tool_configuration: {
      allowed_tools: ["safe_tool_1", "safe_tool_2"],
    },
  },
]
`);

  // ─── MCP Use Cases ───
  printHeader("MCP Use Cases");

  console.log(`Key MCP use cases:

1. Database Access: Connect Claude to your database for natural language queries
2. Internal APIs: Expose internal microservices as MCP tools
3. File Systems: Give Claude access to document stores
4. Third-Party Services: Connect to Slack, GitHub, Jira via MCP adapters
5. Multi-Agent Coordination: Chain multiple specialized MCP servers

To get started with MCP:
  - Anthropic MCP SDK: https://github.com/modelcontextprotocol/sdk
  - MCP Server Registry: Browse community-built servers
  - Build your own: Implement the MCP protocol in any language
`);

  console.log("MCP connector example completed!");
}

main().catch(console.error);
