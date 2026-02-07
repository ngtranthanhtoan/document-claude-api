# Example 06: Tool Use Basics

> Enable Claude to call external functions and APIs to perform real-world actions using the TypeScript SDK.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Tool Use (Function Calling)
- **SDK Methods**: `client.messages.create()`, `zodTool()`, `client.beta.messages.toolRunner()`
- **Use Cases**:
  - Weather lookup
  - Database queries
  - API integrations
  - Calculator operations
  - Calendar scheduling
  - Email sending

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `zod`: `npm install zod` (for Zod tool helpers)
- `ANTHROPIC_API_KEY` environment variable set

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
