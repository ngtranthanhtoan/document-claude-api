# Example 02: Streaming

> Receive Claude's response in real-time, token by token, using the TypeScript SDK's streaming helpers.

## Overview

- **Difficulty**: Beginner
- **Features Used**: Streaming, Event callbacks
- **SDK Methods**: `client.messages.stream()`, `.on()`, `finalMessage()`, `finalText()`
- **Use Cases**:
  - Real-time chat UI (typewriter effect)
  - Live coding assistants
  - Progressive content rendering
  - Long-form content generation
  - Reduced perceived latency
  - Voice synthesis integration (TTS pipeline)

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set

---

## Basic Streaming with Event Callbacks

Use `client.messages.stream()` with `.on()` listeners for the simplest approach.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const stream = client.messages.stream({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: "Write a haiku about programming.",
    },
  ],
});

// Print each text chunk as it arrives
stream.on("text", (text) => {
  process.stdout.write(text);
});

// Get the complete message when done
const finalMessage = await stream.finalMessage();
console.log("\n\nDone! Total tokens:", finalMessage.usage.output_tokens);
```

### Output

```
Lines of code cascade
Bugs hide in the shadows, wait
Debugging brings peace

Done! Total tokens: 25
```

---

## Event Types

The stream emits several event types you can listen to:

| Event | Description | Callback Signature |
|-------|-------------|-------------------|
| `text` | Text content delta | `(text: string) => void` |
| `inputJson` | Tool input JSON delta | `(partialJson: string) => void` |
| `message` | Complete message | `(message: Message) => void` |
| `streamEvent` | All raw SSE events | `(event: MessageStreamEvent) => void` |
| `error` | Error occurred | `(error: APIError) => void` |
| `end` | Stream finished | `() => void` |

---

## Streaming with `for await` Iterator

Use the async iterator pattern for more control over each SSE event.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const stream = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  stream: true,
  messages: [
    {
      role: "user",
      content: "Explain how HTTP streaming works in 3 paragraphs.",
    },
  ],
});

let inputTokens = 0;
let outputTokens = 0;

for await (const event of stream) {
  switch (event.type) {
    case "message_start":
      inputTokens = event.message.usage.input_tokens;
      break;
    case "content_block_delta":
      if (event.delta.type === "text_delta") {
        process.stdout.write(event.delta.text);
      }
      break;
    case "message_delta":
      outputTokens = event.usage.output_tokens;
      break;
    case "message_stop":
      console.log("\n\n=== Stream Complete ===");
      console.log(`Input tokens: ${inputTokens}`);
      console.log(`Output tokens: ${outputTokens}`);
      break;
  }
}
```

---

## SSE Event Types

| Event | Description | Key Data |
|-------|-------------|----------|
| `message_start` | Stream begins | `message.id`, `message.model`, initial `usage` |
| `content_block_start` | New content block begins | `index`, `content_block.type` |
| `content_block_delta` | Incremental text chunk | `delta.text` or `delta.partial_json` |
| `content_block_stop` | Content block complete | `index` |
| `message_delta` | Final metadata | `stop_reason`, final `usage` |
| `message_stop` | Stream complete | - |

---

## Streaming with Tool Use

When Claude wants to use a tool during streaming, you'll receive tool use events with `input_json_delta`.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const stream = client.messages.stream({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  tools: [
    {
      name: "get_weather",
      description: "Get weather for a location",
      input_schema: {
        type: "object" as const,
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content: "What is the weather in Tokyo?",
    },
  ],
});

// Track tool use via inputJson event
stream.on("inputJson", (partialJson) => {
  process.stdout.write(`[Tool JSON delta]: ${partialJson}\n`);
});

stream.on("text", (text) => {
  process.stdout.write(text);
});

const finalMessage = await stream.finalMessage();
console.log("\nStop reason:", finalMessage.stop_reason);

// If Claude requested a tool, extract it
if (finalMessage.stop_reason === "tool_use") {
  const toolUse = finalMessage.content.find(
    (block) => block.type === "tool_use"
  );
  if (toolUse && toolUse.type === "tool_use") {
    console.log("Tool requested:", toolUse.name);
    console.log("Input:", JSON.stringify(toolUse.input));
  }
}
```

### Streamed Tool Use Response

```
[Tool JSON delta]: {"location":
[Tool JSON delta]:  "Tokyo, Japan"}
Stop reason: tool_use
Tool requested: get_weather
Input: {"location":"Tokyo, Japan"}
```

---

## Complete Streaming Script

A complete script that handles all event types, including text, tool use, and errors.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function streamResponse(userMessage: string) {
  console.log("=== Streaming Response ===\n");

  const stream = client.messages
    .stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [{ role: "user", content: userMessage }],
    })
    .on("text", (text) => {
      process.stdout.write(text);
    })
    .on("error", (error) => {
      console.error("\nStream error:", error.message);
    })
    .on("end", () => {
      console.log("\n");
    });

  const finalMessage = await stream.finalMessage();

  console.log("=== Stream Complete ===");
  console.log("Stop reason:", finalMessage.stop_reason);
  console.log("Input tokens:", finalMessage.usage.input_tokens);
  console.log("Output tokens:", finalMessage.usage.output_tokens);

  return finalMessage;
}

// Usage
await streamResponse("Explain how HTTP streaming works in 3 paragraphs.");
```

---

## Error Handling in Streams

Handle errors both at the stream level and with try/catch.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

try {
  const stream = client.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello" }],
  });

  // Handle stream-level errors
  stream.on("error", (error) => {
    console.error("Stream error:", error.message);
  });

  stream.on("text", (text) => {
    process.stdout.write(text);
  });

  await stream.finalMessage();
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    console.error(`API Error ${error.status}: ${error.message}`);
    if (error.status === 429) {
      console.error("Rate limited - implement retry with backoff");
    }
  } else {
    throw error;
  }
}
```

---

## Streaming with Extended Thinking

When using extended thinking, you'll receive thinking blocks in the stream.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const stream = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 8000,
  stream: true,
  thinking: { type: "enabled", budget_tokens: 5000 },
  messages: [{ role: "user", content: "What is 15 * 27?" }],
});

let currentBlockType = "";

for await (const event of stream) {
  if (event.type === "content_block_start") {
    currentBlockType = event.content_block.type;
    if (currentBlockType === "thinking") {
      process.stdout.write("[Thinking]: ");
    } else if (currentBlockType === "text") {
      process.stdout.write("\n[Response]: ");
    }
  } else if (event.type === "content_block_delta") {
    if (event.delta.type === "thinking_delta") {
      process.stdout.write(event.delta.thinking);
    } else if (event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  }
}

console.log("\n");
```

### Output

```
[Thinking]: Let me calculate 15 * 27. I can break this down: 15 * 27 = 15 * (30 - 3) = 450 - 45 = 405.

[Response]: 15 * 27 = 405
```

---

## Convenience Methods

The stream object provides helper methods to simplify common patterns:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const stream = client.messages.stream({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Say hello!" }],
});

// Get just the final text (waits for stream to complete)
const text = await stream.finalText();
console.log("Text:", text);

// Or get the full message object
// const message = await stream.finalMessage();

// Abort a stream early
// stream.abort();
```

---

## Best Practices

1. **Use `.on("text")` for Simple Cases**: The callback API is the easiest way to display streaming text.

2. **Use `for await` for Fine Control**: When you need to handle every event type (thinking, tool use, etc.).

3. **Handle Errors at Both Levels**: Use `.on("error")` for stream errors and `try/catch` for connection errors.

4. **Track Token Usage**: `finalMessage()` provides complete usage stats after streaming completes.

5. **Use `finalText()` for Simple Text**: When you just need the text content, skip the event handling.

---

## Related Examples

- [Example 15: Coding Assistant](example-15-coding-assistant.md) - Streaming with tools
- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Understanding tool flow
