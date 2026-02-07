# Example 13: Agentic Tool Loop

> Build autonomous agents that execute multiple tools until task completion.

## Overview

- **Difficulty**: Advanced
- **Features Used**: Tool Use, Multi-turn, Autonomous execution
- **SDK Methods**: `client.messages.create()`, `client.beta.messages.toolRunner()`
- **Use Cases**:
  - Autonomous task completion
  - Multi-step research
  - Data processing pipelines
  - Self-correcting workflows
  - Automated report generation

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `zod`: `npm install zod` (for Zod tool helpers with toolRunner)
- `ANTHROPIC_API_KEY` environment variable set
- Understanding of tool use and stop reasons

---

## Agentic Loop Concept

The key insight is the `stop_reason` field:
- `stop_reason: "tool_use"` -- Claude wants to use tools, keep looping
- `stop_reason: "end_turn"` -- Claude is done, exit the loop

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Send to Claude API                              │
│         (with tools and messages)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Check response │
              │  stop_reason   │
              └───────┬───────┘
                      │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
   ┌─────────────┐      ┌─────────────┐
   │ "tool_use"  │      │ "end_turn"  │
   └──────┬──────┘      └──────┬──────┘
          │                    │
          ▼                    ▼
   ┌─────────────┐      ┌─────────────┐
   │Execute tool │      │   Return    │
   │Send result  │      │   final     │
   │back to API  │      │  response   │
   └──────┬──────┘      └─────────────┘
          │
          └──── (loop back) ────┘
```

---

## Step-by-Step API Calls

### Turn 1: Initial Request with Tools

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  system:
    "You are a research assistant. Use the available tools to gather information and complete tasks. Continue using tools until you have enough information to provide a complete answer.",
  tools: [
    {
      name: "web_search",
      description: "Search the web for information",
      input_schema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "read_webpage",
      description: "Read and extract content from a webpage",
      input_schema: {
        type: "object" as const,
        properties: {
          url: {
            type: "string",
            description: "URL to read",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "save_finding",
      description: "Save an important finding to the research notes",
      input_schema: {
        type: "object" as const,
        properties: {
          topic: { type: "string" },
          finding: { type: "string" },
          source: { type: "string" },
        },
        required: ["topic", "finding"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Research the latest developments in fusion energy and summarize the top 3 breakthroughs from 2024.",
    },
  ],
});

console.log("Stop reason:", response.stop_reason);
console.log("Content:", JSON.stringify(response.content, null, 2));
```

### Response 1: Claude Calls web_search

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "I'll research the latest fusion energy developments. Let me start by searching for recent breakthroughs."
    },
    {
      "type": "tool_use",
      "id": "toolu_01A",
      "name": "web_search",
      "input": { "query": "fusion energy breakthroughs 2024" }
    }
  ]
}
```

### Turn 2: Send Tool Result Back

```typescript
// Append the assistant's response and tool result to the messages array
const messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content:
      "Research the latest developments in fusion energy and summarize the top 3 breakthroughs from 2024.",
  },
  {
    role: "assistant",
    content: [
      {
        type: "text",
        text: "I'll research the latest fusion energy developments. Let me start by searching for recent breakthroughs.",
      },
      {
        type: "tool_use",
        id: "toolu_01A",
        name: "web_search",
        input: { query: "fusion energy breakthroughs 2024" },
      },
    ],
  },
  {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "toolu_01A",
        content: JSON.stringify([
          {
            title: "NIF achieves repeated ignition",
            url: "https://example.com/nif",
          },
          {
            title: "ITER construction milestone",
            url: "https://example.com/iter",
          },
          {
            title: "SPARC magnet breakthrough",
            url: "https://example.com/sparc",
          },
        ]),
      },
    ],
  },
];

const response2 = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  tools: [
    /* same tools */
  ],
  messages,
});
```

### Response 2: Claude Reads a Webpage

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "Found some promising results. Let me read the NIF article for details."
    },
    {
      "type": "tool_use",
      "id": "toolu_01B",
      "name": "read_webpage",
      "input": { "url": "https://example.com/nif" }
    }
  ]
}
```

### Turns 3-N: Continue Loop

The loop continues with Claude:
1. Reading more webpages
2. Calling `save_finding` to store important facts
3. Eventually synthesizing a final response

### Final Response: stop_reason is "end_turn"

```json
{
  "stop_reason": "end_turn",
  "content": [
    {
      "type": "text",
      "text": "Based on my research, here are the top 3 fusion energy breakthroughs from 2024:\n\n## 1. NIF Achieves Repeated Ignition\nThe National Ignition Facility successfully demonstrated repeatable fusion ignition, achieving net energy gain in multiple experiments.\n\n## 2. ITER Magnet Assembly Complete\nThe international ITER project completed assembly of its massive superconducting magnet system.\n\n## 3. Commonwealth Fusion's SPARC Progress\nPrivate fusion company Commonwealth Fusion Systems completed critical testing of its high-temperature superconducting magnets."
    }
  ]
}
```

---

## Manual Agentic Loop

The core implementation pattern: loop until `stop_reason` is no longer `"tool_use"`.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MAX_ITERATIONS = 10;

// Tool definitions
const tools: Anthropic.Tool[] = [
  {
    name: "get_crypto_price",
    description: "Get current cryptocurrency price",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string",
          description: "Crypto symbol like BTC, ETH",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "search_news",
    description: "Search for recent news articles",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        limit: { type: "integer" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_article",
    description: "Read full content of a news article",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
];

// Mock tool executor
function executeTool(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "get_crypto_price":
      return JSON.stringify({
        symbol: input.symbol,
        price: 67234.5,
        change_24h: "+2.3%",
        volume: "28.5B",
      });
    case "search_news":
      return JSON.stringify([
        {
          title: "Bitcoin ETF sees record inflows",
          url: "https://example.com/btc-etf",
          source: "Reuters",
        },
        {
          title: "BTC breaks resistance level",
          url: "https://example.com/btc-price",
          source: "CoinDesk",
        },
        {
          title: "Institutional adoption accelerates",
          url: "https://example.com/btc-institutional",
          source: "Bloomberg",
        },
      ]);
    case "read_article":
      return JSON.stringify({
        content: "Full article content here with detailed analysis...",
        author: "John Smith",
        date: "2024-01-15",
      });
    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

// Agentic loop
let messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content:
      "Find the current Bitcoin price and the top 3 news stories about it today.",
  },
];

for (let i = 0; i < MAX_ITERATIONS; i++) {
  console.log(`\n=== Iteration ${i + 1} ===`);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    system:
      "You are a helpful research assistant. Use tools to gather information. Continue until you have a complete answer.",
    tools,
    messages,
  });

  console.log("Stop reason:", response.stop_reason);

  // Check if Claude is done
  if (response.stop_reason === "end_turn") {
    // Extract and print final text
    const textBlock = response.content.find(
      (block) => block.type === "text"
    );
    if (textBlock && textBlock.type === "text") {
      console.log("\n=== FINAL RESPONSE ===");
      console.log(textBlock.text);
    }
    break;
  }

  // Add assistant response to conversation
  messages.push({ role: "assistant", content: response.content });

  // Execute each tool call and collect results
  const toolResults: Anthropic.ToolResultBlockParam[] = [];
  for (const block of response.content) {
    if (block.type === "tool_use") {
      console.log(`Executing: ${block.name}`);
      const result = executeTool(
        block.name,
        block.input as Record<string, unknown>
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }
  }

  // Add tool results as a user message
  messages.push({ role: "user", content: toolResults });
}
```

---

## Automatic Tool Loop with toolRunner

The TypeScript SDK provides `client.beta.messages.toolRunner()` which automates the entire agentic loop. Combined with `zodTool()`, you get full type safety and automatic tool execution.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodTool } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();

// Define tools with Zod schemas and execute functions
const cryptoTool = zodTool({
  name: "get_crypto_price",
  description: "Get current cryptocurrency price",
  schema: z.object({
    symbol: z.string().describe("Crypto symbol like BTC, ETH"),
  }),
  execute: async (input) => {
    // In production, call a real API here
    return JSON.stringify({
      symbol: input.symbol,
      price: 67234.5,
      change_24h: "+2.3%",
      volume: "28.5B",
    });
  },
});

const newsTool = zodTool({
  name: "search_news",
  description: "Search for recent news articles",
  schema: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Max results"),
  }),
  execute: async (input) => {
    return JSON.stringify([
      {
        title: "Bitcoin ETF sees record inflows",
        url: "https://example.com/btc-etf",
        source: "Reuters",
      },
      {
        title: "BTC breaks resistance level",
        url: "https://example.com/btc-price",
        source: "CoinDesk",
      },
    ]);
  },
});

const articleTool = zodTool({
  name: "read_article",
  description: "Read full content of a news article",
  schema: z.object({
    url: z.string().describe("URL to read"),
  }),
  execute: async (input) => {
    return JSON.stringify({
      content: "Full article content here...",
      author: "John Smith",
      date: "2024-01-15",
    });
  },
});

// The toolRunner handles the entire agentic loop automatically
const runner = client.beta.messages.toolRunner({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  tools: [cryptoTool, newsTool, articleTool],
  messages: [
    {
      role: "user",
      content: "Find the current Bitcoin price and summarize the top news.",
    },
  ],
});

// Wait for the final message (all tool calls handled automatically)
const finalMessage = await runner.finalMessage();

// Extract the final text response
const textBlock = finalMessage.content.find(
  (block) => block.type === "text"
);
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

**Key advantages of `toolRunner`:**
- Automatic loop management (no manual `while` loop needed)
- Type-safe tool inputs via Zod schemas
- Built-in `execute` function per tool
- Returns the final message directly

---

## Handling Parallel Tool Calls

Claude may request multiple tools at once. Execute all and return all results together.

### Response with Multiple Tool Uses

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01AAA",
      "name": "get_crypto_price",
      "input": { "symbol": "BTC" }
    },
    {
      "type": "tool_use",
      "id": "toolu_01BBB",
      "name": "get_crypto_price",
      "input": { "symbol": "ETH" }
    }
  ],
  "stop_reason": "tool_use"
}
```

### Sending Multiple Results

```typescript
// Send all tool results in a single message
{
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: "toolu_01AAA",
      content: JSON.stringify({ symbol: "BTC", price: 67234.50 })
    },
    {
      type: "tool_result",
      tool_use_id: "toolu_01BBB",
      content: JSON.stringify({ symbol: "ETH", price: 3456.78 })
    }
  ]
}
```

---

## Error Recovery

When tools fail, use `is_error: true` so Claude can adapt its approach.

```typescript
// When a tool execution fails, return an error result
const toolResults: Anthropic.ToolResultBlockParam[] = [];

for (const block of response.content) {
  if (block.type === "tool_use") {
    try {
      const result = executeTool(
        block.name,
        block.input as Record<string, unknown>
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    } catch (error) {
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        is_error: true,
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
}

messages.push({ role: "user", content: toolResults });
```

Claude will typically try an alternative approach or inform the user when it encounters errors.

---

## Best Practices

1. **Set Max Iterations**: Prevent infinite loops with a reasonable limit.

2. **Log Tool Calls**: Track what tools were called for debugging.

3. **Handle Errors Gracefully**: Return structured error messages with `is_error: true`.

4. **Provide Clear Tool Descriptions**: Help Claude understand when to use each tool.

5. **Preserve Full Conversation**: Always send the complete message history.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool fundamentals
- [Example 14: Research Agent](example-14-research-agent.md) - Advanced research with thinking
- [Example 12: Human in the Loop](example-12-human-in-the-loop.md) - Add approval checkpoints
