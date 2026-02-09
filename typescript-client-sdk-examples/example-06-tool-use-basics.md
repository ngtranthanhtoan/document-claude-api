# Example 06: Tool Use Basics

> Enable Claude to call external functions and APIs to perform real-world actions using the TypeScript SDK.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Tool Use (Function Calling)
- **SDK Methods**: `client.messages.create()`, `zodTool()`, `client.beta.messages.create()`
- **Use Cases**:
  - Weather lookup
  - Database queries
  - API integrations
  - Calculator operations
  - Web search and content fetching
  - Desktop automation (computer use)
  - Sandboxed code execution

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `zod`: `npm install zod` (for Zod tool helpers, optional)
- `ANTHROPIC_API_KEY` environment variable set
- Web search enabled in [Anthropic Console](https://console.anthropic.com/settings/privacy) (for web search tool)

---

## How Tool Use Works

```
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  User Request │ ───> │ Claude + Tools│ ───> │ Tool Use      │
│               │      │               │      │ stop_reason   │
└───────────────┘      └───────────────┘      └───────┬───────┘
                                                      │
                                                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ Final Answer  │ <─── │ Claude        │ <─── │ Execute Tool  │
│ to User       │      │ Processes     │      │ Send Result   │
└───────────────┘      └───────────────┘      └───────────────┘
```

---

## Step 1: Define Tools and Send Request

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  tools: [
    {
      name: "get_weather",
      description:
        "Get the current weather for a specific location. Returns temperature, conditions, and humidity.",
      input_schema: {
        type: "object" as const,
        properties: {
          location: {
            type: "string",
            description:
              "City and country, e.g., Tokyo, Japan or New York, USA",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit preference",
          },
        },
        required: ["location"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content: "What is the weather like in Paris right now?",
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
console.log("Content:", JSON.stringify(message.content, null, 2));
```

### Response

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01XYZ789",
      "name": "get_weather",
      "input": {
        "location": "Paris, France",
        "unit": "celsius"
      }
    }
  ]
}
```

**Key indicators:**
- `stop_reason: "tool_use"` - Claude wants to use a tool
- `content` contains a `tool_use` block with tool name and input

---

## Step 2: Execute Tool and Send Result

Execute the tool on your side, then send the result back.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// The full conversation with tool result
const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  tools: [
    {
      name: "get_weather",
      description: "Get the current weather for a specific location",
      input_schema: {
        type: "object" as const,
        properties: {
          location: { type: "string" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
      },
    },
  ],
  messages: [
    // Original user message
    {
      role: "user",
      content: "What is the weather like in Paris right now?",
    },
    // Claude's tool use request
    {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "toolu_01XYZ789",
          name: "get_weather",
          input: { location: "Paris, France", unit: "celsius" },
        },
      ],
    },
    // Your tool result
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_01XYZ789",
          content: JSON.stringify({
            temperature: 18,
            condition: "partly cloudy",
            humidity: 65,
            wind_speed: 12,
          }),
        },
      ],
    },
  ],
});

// Extract the final text response
const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

### Final Response

```
The weather in Paris right now is quite pleasant! It's 18°C (64°F) with partly cloudy skies. The humidity is at 65%, and there's a light breeze with wind speeds of 12 km/h. Great weather for a stroll along the Seine!
```

---

## Tool Schema Structure

```typescript
{
  name: "tool_name",
  description: "Clear description of what this tool does",
  input_schema: {
    type: "object" as const,
    properties: {
      required_param: {
        type: "string",
        description: "What this parameter is for"
      },
      optional_param: {
        type: "integer",
        description: "Optional parameter with default"
      },
      enum_param: {
        type: "string",
        enum: ["option1", "option2", "option3"]
      }
    },
    required: ["required_param"]
  }
}
```

### Supported Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"hello"` |
| `integer` | Whole number | `42` |
| `number` | Any number | `3.14` |
| `boolean` | True/false | `true` |
| `array` | List of items | `["a", "b"]` |
| `object` | Nested object | `{"key": "value"}` |

---

## Multiple Tools

Define multiple tools for Claude to choose from.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  tools: [
    {
      name: "get_weather",
      description: "Get current weather for a location",
      input_schema: {
        type: "object" as const,
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
      },
    },
    {
      name: "search_restaurants",
      description: "Search for restaurants in a location",
      input_schema: {
        type: "object" as const,
        properties: {
          location: { type: "string" },
          cuisine: { type: "string" },
          price_range: {
            type: "string",
            enum: ["$", "$$", "$$$", "$$$$"],
          },
        },
        required: ["location"],
      },
    },
    {
      name: "book_reservation",
      description: "Book a restaurant reservation",
      input_schema: {
        type: "object" as const,
        properties: {
          restaurant_id: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          party_size: { type: "integer" },
        },
        required: ["restaurant_id", "date", "time", "party_size"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content: "Find me a nice Italian restaurant in San Francisco",
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
for (const block of message.content) {
  if (block.type === "tool_use") {
    console.log(`Tool: ${block.name}, Input:`, block.input);
  }
}
```

---

## Tool Errors

Send error information when a tool fails.

```typescript
// When sending a tool error result
{
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: "toolu_01ABC",
      is_error: true,
      content: "Error: Location not found. Please provide a valid city name."
    }
  ]
}
```

Claude will handle the error gracefully and may retry or ask for clarification.

---

## Tool Choice Options

Control how Claude uses tools.

```typescript
// Auto (Default) — Claude decides whether to use tools
tool_choice: { type: "auto" }

// Any Tool — Claude must use one of the available tools
tool_choice: { type: "any" }

// Specific Tool — Force Claude to use a specific tool
tool_choice: { type: "tool", name: "get_weather" }

// No Tools — Disable tool use for this request
tool_choice: { type: "none" }
```

---

## Type-Safe Tools with Zod

Use `zodTool()` for type-safe tool definitions with automatic TypeScript type inference.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodTool } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();

// Define tool with Zod schema — input is automatically typed
const weatherTool = zodTool({
  name: "get_weather",
  description: "Get current weather for a location",
  schema: z.object({
    location: z.string().describe("City and country, e.g., Paris, France"),
    unit: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
});

const calculatorTool = zodTool({
  name: "calculator",
  description: "Perform basic arithmetic operations",
  schema: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number(),
  }),
});

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  tools: [weatherTool, calculatorTool],
  messages: [
    {
      role: "user",
      content: "What is 15% of 847?",
    },
  ],
});

// Extract tool use
for (const block of message.content) {
  if (block.type === "tool_use") {
    console.log(`Tool: ${block.name}`);
    console.log(`Input:`, block.input);
  }
}
```

---

## Parallel Tool Calls

Claude can request multiple tools at once. Send all results back together.

### Response with Multiple Tool Uses

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01AAA",
      "name": "get_weather",
      "input": { "location": "New York" }
    },
    {
      "type": "tool_use",
      "id": "toolu_01BBB",
      "name": "get_weather",
      "input": { "location": "Los Angeles" }
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
      content: JSON.stringify({ temperature: 22, condition: "sunny" })
    },
    {
      type: "tool_result",
      tool_use_id: "toolu_01BBB",
      content: JSON.stringify({ temperature: 28, condition: "clear" })
    }
  ]
}
```

---

## Complete Example: Calculator with Tool Loop

A complete example that handles the full tool use cycle.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Simulated tool execution
function executeCalculator(input: {
  expression: string;
}): string {
  try {
    // In production, use a proper math parser
    const result = Function(`"use strict"; return (${input.expression})`)();
    return JSON.stringify({ result, expression: input.expression });
  } catch {
    return JSON.stringify({ error: "Invalid expression" });
  }
}

// Step 1: Send request with tools
const tools: Anthropic.Tool[] = [
  {
    name: "calculate",
    description:
      "Perform mathematical calculations. Supports basic arithmetic.",
    input_schema: {
      type: "object" as const,
      properties: {
        expression: {
          type: "string",
          description: "Mathematical expression, e.g., 2 + 2, 15 * 27",
        },
      },
      required: ["expression"],
    },
  },
];

let messages: Anthropic.MessageParam[] = [
  { role: "user", content: "What is 15% of 847?" },
];

const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  tools,
  messages,
});

// Step 2: Check if tool use is needed
if (response.stop_reason === "tool_use") {
  // Add assistant response to conversation
  messages.push({ role: "assistant", content: response.content });

  // Execute each tool and collect results
  const toolResults: Anthropic.ToolResultBlockParam[] = [];
  for (const block of response.content) {
    if (block.type === "tool_use") {
      const result = executeCalculator(
        block.input as { expression: string }
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }
  }

  // Add tool results to conversation
  messages.push({ role: "user", content: toolResults });

  // Step 3: Get final response
  const finalResponse = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    tools,
    messages,
  });

  const textBlock = finalResponse.content.find(
    (block) => block.type === "text"
  );
  if (textBlock && textBlock.type === "text") {
    console.log(textBlock.text);
  }
}
```

---

## Anthropic Built-in Tools

Beyond user-defined custom tools, Anthropic provides **built-in tools** that Claude already knows how to use. These tools use a `type` field instead of `name`/`description`/`input_schema` — the schema is built into Claude's model.

### Two Categories of Built-in Tools

```
┌─────────────────────────────────────────────────────────────────┐
│                   Anthropic Built-in Tools                      │
├───────────────────────────┬─────────────────────────────────────┤
│     Server Tools          │         Client Tools                │
│  (Run on Anthropic's      │  (Anthropic-defined, but YOU        │
│   servers automatically)  │   execute them on your side)        │
│                           │                                     │
│  • web_search_20250305    │  • text_editor_20250728             │
│  • web_fetch_20250910     │  • bash_20250124                    │
│  • code_execution_20250825│  • computer_20250124 / _20251124    │
└───────────────────────────┴─────────────────────────────────────┘
```

### Key Difference: User-Defined vs Built-in Tools

```typescript
// ❌ User-defined tool — you provide name, description, input_schema
{
  name: "get_weather",
  description: "Get current weather for a location",
  input_schema: {
    type: "object" as const,
    properties: {
      location: { type: "string" },
    },
    required: ["location"],
  },
}

// ✅ Anthropic built-in tool — just specify the type
{
  type: "web_search_20250305",
  name: "web_search",
}
```

---

### Server Tool: Web Search

Web search runs entirely on Anthropic's servers. Claude decides when to search, executes the search, and incorporates results — no client-side implementation needed.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  tools: [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5,
    },
  ],
  messages: [
    {
      role: "user",
      content: "What are the latest developments in quantum computing?",
    },
  ],
});

// Response includes search results and citations automatically
for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
```

#### Web Search with Domain Filtering and Localization

```typescript
const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  tools: [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 3,
      // Only search these domains
      allowed_domains: ["arxiv.org", "nature.com", "science.org"],
      // Localize search results
      user_location: {
        type: "approximate",
        city: "San Francisco",
        region: "California",
        country: "US",
        timezone: "America/Los_Angeles",
      },
    },
  ],
  messages: [
    {
      role: "user",
      content: "Find recent AI research papers about reasoning",
    },
  ],
});
```

#### Web Search Response Structure

```json
{
  "content": [
    {
      "type": "text",
      "text": "I'll search for that information."
    },
    {
      "type": "server_tool_use",
      "id": "srvtoolu_01WYG...",
      "name": "web_search",
      "input": { "query": "quantum computing developments 2025" }
    },
    {
      "type": "web_search_tool_result",
      "tool_use_id": "srvtoolu_01WYG...",
      "content": [
        {
          "type": "web_search_result",
          "url": "https://example.com/article",
          "title": "Quantum Computing Breakthroughs",
          "encrypted_content": "EqgfCio...",
          "page_age": "January 15, 2025"
        }
      ]
    },
    {
      "type": "text",
      "text": "Based on recent search results, ...",
      "citations": [
        {
          "type": "web_search_result_location",
          "url": "https://example.com/article",
          "title": "Quantum Computing Breakthroughs",
          "cited_text": "Researchers announced..."
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 6039,
    "output_tokens": 931,
    "server_tool_use": {
      "web_search_requests": 1
    }
  }
}
```

---

### Server Tool: Web Fetch (Beta)

Web fetch retrieves full page content from URLs. Requires the beta header `web-fetch-2025-09-10`.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  tools: [
    {
      type: "web_fetch_20250910",
      name: "web_fetch",
      max_uses: 5,
      citations: { enabled: true },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Analyze the content at https://example.com/research-paper",
    },
  ],
  betas: ["web-fetch-2025-09-10"],
});
```

---

### Server Tool: Code Execution (Beta)

Code execution runs code in a secure, sandboxed environment on Anthropic's servers. Requires the beta header `code-execution-2025-08-25`.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  tools: [
    {
      type: "code_execution_20250825",
      name: "code_execution",
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Calculate the mean and standard deviation of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
    },
  ],
  betas: ["code-execution-2025-08-25"],
});
```

---

### Client Tools: Text Editor + Bash (Computer Use)

These are Anthropic-defined but **you must execute them** on your side and return results. They are commonly used together for computer use workflows.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Text editor and bash can be used without the computer use beta header
const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  tools: [
    {
      type: "text_editor_20250728",
      name: "str_replace_based_edit_tool",
    },
    {
      type: "bash_20250124",
      name: "bash",
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "There's a syntax error in my primes.py file. Can you fix it?",
    },
  ],
});

// You must execute the tool and return results back to Claude
for (const block of message.content) {
  if (block.type === "tool_use") {
    console.log(`Tool: ${block.name}`);
    console.log(`Command:`, block.input);
    // Execute on your side, then send tool_result back
  }
}
```

### Full Computer Use (Beta)

Combining all three client tools for desktop automation. Requires the computer use beta header.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  tools: [
    {
      type: "computer_20250124",
      name: "computer",
      display_width_px: 1024,
      display_height_px: 768,
      display_number: 1,
    },
    {
      type: "text_editor_20250728",
      name: "str_replace_based_edit_tool",
    },
    {
      type: "bash_20250124",
      name: "bash",
    },
  ],
  messages: [
    {
      role: "user",
      content: "Save a picture of a cat to my desktop.",
    },
  ],
  betas: ["computer-use-2025-01-24"],
});
```

---

### Mixing Built-in and Custom Tools

You can combine Anthropic built-in tools with your own custom tools in a single request.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  tools: [
    // Built-in server tool — no schema needed
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 3,
    },
    // Your custom tool — full schema required
    {
      name: "save_to_database",
      description: "Save research findings to the database",
      input_schema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Title of the finding" },
          summary: { type: "string", description: "Summary of the research" },
          source_url: { type: "string", description: "Source URL" },
        },
        required: ["title", "summary"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Search for recent breakthroughs in fusion energy and save the top finding to our database.",
    },
  ],
});
```

---

### Built-in Tools Reference

| Tool | Type Identifier | Category | Beta Required | Pricing |
|------|----------------|----------|---------------|---------|
| Web Search | `web_search_20250305` | Server | No | $10 / 1,000 searches + tokens |
| Web Fetch | `web_fetch_20250910` | Server | `web-fetch-2025-09-10` | Token costs only |
| Code Execution | `code_execution_20250825` | Server | `code-execution-2025-08-25` | $0.05/hr (1,550 free hrs/mo) |
| Text Editor | `text_editor_20250728` | Client | No | 700 extra input tokens |
| Bash | `bash_20250124` | Client | No | 245 extra input tokens |
| Computer Use | `computer_20250124` | Client | `computer-use-2025-01-24` | 735 extra input tokens |
| Computer Use | `computer_20251124` | Client | `computer-use-2025-11-24` | 735 extra input tokens |

> **Note**: Computer use tool version `computer_20251124` is for Claude Opus 4.5+ (with zoom action). All other models use `computer_20250124`. Text editor `text_editor_20250728` is for Claude 4.x models; Claude 3.7 uses `text_editor_20250124`.

---

## Best Practices

1. **Clear Descriptions**: Write detailed tool descriptions so Claude understands when to use each tool.

2. **Validate Inputs**: Always validate tool inputs before executing.

3. **Handle Errors Gracefully**: Return helpful error messages via `is_error: true` that Claude can work with.

4. **Match Tool IDs**: Always use the exact `tool_use_id` from the response when sending results.

5. **Keep Tools Focused**: Each tool should do one thing well.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Multi-step autonomous agents
- [Example 12: Human in the Loop](example-12-human-in-the-loop.md) - Add approval for sensitive tools
- [Example 01: Structured Output](example-01-structured-output.md) - Use tools for structured responses
- [Example 23: Custom Skills & Client-Side Tool Agents](example-23-custom-skills-client-tools.md) - Custom skills deep dive + bash/text_editor outside containers
