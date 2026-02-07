# Example 18: Memory Tool

> Enable persistent memory across conversations for long-running agents.

## Overview

- **Difficulty**: Expert
- **Features Used**: Memory Tool
- **SDK Methods**: `client.beta.messages.create()`
- **Beta**: `context-management-2025-06-27`
- **Use Cases**:
  - Long-running agents
  - Personalized assistants
  - Cross-session context
  - Knowledge accumulation
  - User preference tracking

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- Understanding of multi-turn conversations

---

## What is the Memory Tool?

The Memory Tool enables Claude to store and retrieve information across conversations. This allows:
- Remembering user preferences
- Accumulating knowledge over time
- Maintaining context across sessions
- Building persistent agents

```
┌─────────────────────────────────────────────────────────────┐
│                    Session 1                                 │
│  User: "My favorite color is blue"                          │
│  Claude: store_memory("user_preference", "favorite_color",  │
│          "blue")                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Session 2                                 │
│  User: "What's my favorite color?"                          │
│  Claude: retrieve_memory("user_preference") →               │
│          "Your favorite color is blue"                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Enabling Memory Tool

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["context-management-2025-06-27"],
  system:
    "You are a personal assistant with persistent memory. Use the memory tools to remember important information about the user across conversations. Store preferences, facts, and context that will be useful in future sessions.",
  tools: [
    {
      type: "memory_20250627",
      name: "memory",
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Hi! I am starting a new project called ProjectX. It is a web application using React and Node.js. The deadline is March 15th.",
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
console.log("Content:", JSON.stringify(message.content, null, 2));
```

### Response (Storing Memory)

```json
{
  "content": [
    {
      "type": "text",
      "text": "Great to hear about ProjectX! I will remember the details about your project."
    },
    {
      "type": "tool_use",
      "id": "toolu_mem_01",
      "name": "memory",
      "input": {
        "action": "store",
        "key": "project_projectx",
        "value": {
          "name": "ProjectX",
          "type": "web application",
          "tech_stack": ["React", "Node.js"],
          "deadline": "2024-03-15",
          "created_at": "2024-01-15"
        },
        "category": "projects"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## Memory Actions

### Store Memory

```typescript
{
  action: "store",
  key: "unique_key",
  value: "any JSON value",
  category: "optional_category",
  ttl: 86400
}
```

### Retrieve Memory

```typescript
{
  action: "retrieve",
  key: "unique_key"
}
```

### Search Memory

```typescript
{
  action: "search",
  query: "search terms",
  category: "optional_category",
  limit: 10
}
```

### Delete Memory

```typescript
{
  action: "delete",
  key: "unique_key"
}
```

### List All Memories

```typescript
{
  action: "list",
  category: "optional_category"
}
```

---

## Multi-Session Example

### Session 1: Store Information

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// First session - user provides information
const session1 = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["context-management-2025-06-27"],
  tools: [{ type: "memory_20250627", name: "memory" }],
  messages: [
    {
      role: "user",
      content:
        "Some things about me: I work as a software engineer at TechCorp. I prefer dark mode. My timezone is PST. I like concise answers.",
    },
  ],
});

console.log("Session 1:", JSON.stringify(session1.content, null, 2));
```

Claude stores:

```json
{"action": "store", "key": "user_profile", "value": {"job": "software engineer", "company": "TechCorp"}}
{"action": "store", "key": "user_preferences", "value": {"theme": "dark", "timezone": "PST", "response_style": "concise"}}
```

### Session 2: Retrieve Information

```typescript
// Later session - Claude remembers
const session2 = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["context-management-2025-06-27"],
  tools: [{ type: "memory_20250627", name: "memory" }],
  messages: [
    {
      role: "user",
      content: "What time is our 2pm meeting in my timezone?",
    },
  ],
});

console.log("Session 2:", JSON.stringify(session2.content, null, 2));
```

Claude retrieves timezone and responds appropriately.

---

## Conversation Search Tool

Search through past conversations.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["context-management-2025-06-27"],
  tools: [
    { type: "memory_20250627", name: "memory" },
    {
      type: "conversation_search_20250627",
      name: "conversation_search",
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "What did we discuss about the API integration last week?",
    },
  ],
});

console.log(JSON.stringify(message.content, null, 2));
```

### Conversation Search Action

```json
{
  "action": "search",
  "query": "API integration",
  "date_range": {
    "start": "2024-01-08",
    "end": "2024-01-15"
  },
  "limit": 5
}
```

---

## Recent Chats Tool

Access recent conversation history.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["context-management-2025-06-27"],
  tools: [
    { type: "recent_chats_20250627", name: "recent_chats" },
  ],
  messages: [
    {
      role: "user",
      content: "Summarize my recent conversations.",
    },
  ],
});

console.log(JSON.stringify(message.content, null, 2));
```

### Usage

```json
{
  "action": "get_recent",
  "limit": 10,
  "include_messages": true
}
```

---

## File-Based Memory Storage

For self-managed memory, use file-based storage with regular tools.

### System Prompt

```
You have access to a memory file at /data/memory.json. Use the file tools to:
- Read the file at the start of each conversation
- Update it when you learn new important information
- Keep it organized by category

Always check memory before answering questions about the user or past conversations.
```

### Implementation

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const MEMORY_FILE = "/tmp/agent_memory.json";

// Initialize memory file if it doesn't exist
if (!fs.existsSync(MEMORY_FILE)) {
  fs.writeFileSync(
    MEMORY_FILE,
    JSON.stringify({ memories: {}, updated_at: null })
  );
}

// Tool definitions for file-based memory
const tools: Anthropic.Messages.Tool[] = [
  {
    name: "read_file",
    description: "Read a file from the filesystem",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file to read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file on the filesystem",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file to write",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
];

// Execute file tools
function executeTool(
  name: string,
  input: Record<string, string>
): string {
  switch (name) {
    case "read_file":
      try {
        return fs.readFileSync(input.path, "utf-8");
      } catch {
        return JSON.stringify({ error: `File not found: ${input.path}` });
      }
    case "write_file":
      fs.writeFileSync(input.path, input.content);
      return `Successfully written to ${input.path}`;
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// Ask Claude about stored information
const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  system:
    "You are an assistant with persistent memory. At the start of each conversation, read /tmp/agent_memory.json to recall previous information. Update the file when you learn important new facts.",
  tools,
  messages: [
    {
      role: "user",
      content: "What projects am I currently working on?",
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
console.log("Content:", JSON.stringify(message.content, null, 2));
```

---

## Complete Memory Agent

A fully functional interactive memory agent using file-based storage.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as readline from "readline/promises";

const client = new Anthropic();
const MEMORY_FILE = "/tmp/agent_memory.json";

// Initialize memory file
if (!fs.existsSync(MEMORY_FILE)) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify({ memories: {} }));
}

interface MemoryStore {
  memories: Record<string, unknown>;
}

// Execute memory operations against the file store
function executeMemoryTool(input: Record<string, unknown>): string {
  const store: MemoryStore = JSON.parse(
    fs.readFileSync(MEMORY_FILE, "utf-8")
  );

  switch (input.action) {
    case "store":
      store.memories[input.key as string] = input.value;
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2));
      return JSON.stringify({ status: "stored", key: input.key });

    case "retrieve":
      return JSON.stringify(
        store.memories[input.key as string] ?? null
      );

    case "search": {
      const query = input.query as string;
      const results = Object.entries(store.memories).filter(
        ([k, v]) =>
          k.includes(query) ||
          JSON.stringify(v).includes(query)
      );
      return JSON.stringify(results);
    }

    case "list":
      return JSON.stringify(Object.keys(store.memories));

    case "delete":
      delete store.memories[input.key as string];
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2));
      return JSON.stringify({ status: "deleted", key: input.key });

    default:
      return JSON.stringify({ error: "Unknown action" });
  }
}

// Chat function with agentic tool loop
async function chat(userInput: string): Promise<void> {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userInput },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      system:
        "You are an assistant with persistent memory. Use the memory tool to store and retrieve important information across conversations. Store user preferences, facts, and context.",
      tools: [
        {
          name: "memory",
          description:
            "Store and retrieve memories. Actions: store (key, value), retrieve (key), search (query), list (), delete (key)",
          input_schema: {
            type: "object" as const,
            properties: {
              action: {
                type: "string",
                enum: [
                  "store",
                  "retrieve",
                  "search",
                  "list",
                  "delete",
                ],
                description: "The memory operation to perform",
              },
              key: {
                type: "string",
                description:
                  "Unique key for storing or retrieving a memory",
              },
              value: {
                description: "Value to store (any JSON-serializable data)",
              },
              query: {
                type: "string",
                description: "Search query for finding memories",
              },
            },
            required: ["action"],
          },
        },
      ],
      messages,
    });

    // Print any text blocks
    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }

    // If Claude is done, exit the loop
    if (response.stop_reason === "end_turn") {
      break;
    }

    // Handle tool use - add assistant response and execute tools
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`  [Memory: ${(block.input as Record<string, unknown>).action}]`);
        const result = executeMemoryTool(
          block.input as Record<string, unknown>
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }
}

// Interactive REPL loop
async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`Memory Agent (memories saved to ${MEMORY_FILE})`);
  console.log(
    'Type "quit" to exit, "show memory" to see stored memories\n'
  );

  while (true) {
    const input = await rl.question("You: ");

    if (input === "quit") {
      break;
    }

    if (input === "show memory") {
      const store = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
      console.log("=== Stored Memories ===");
      console.log(JSON.stringify(store.memories, null, 2));
      continue;
    }

    console.log("\nAssistant:");
    await chat(input);
    console.log();
  }

  rl.close();
}

main();
```

---

## Combining Memory with Conversation Search

Use all three context-management tools together for maximum context awareness.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["context-management-2025-06-27"],
  system:
    "You are an assistant with full context management capabilities. Use memory to store and retrieve persistent facts. Use conversation search to find relevant past discussions. Use recent chats to understand current context.",
  tools: [
    { type: "memory_20250627", name: "memory" },
    {
      type: "conversation_search_20250627",
      name: "conversation_search",
    },
    { type: "recent_chats_20250627", name: "recent_chats" },
  ],
  messages: [
    {
      role: "user",
      content:
        "Based on our previous discussions and what you know about me, suggest the best approach for the new authentication feature.",
    },
  ],
});

// Process the response - Claude may use multiple tools
for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
  if (block.type === "tool_use") {
    console.log(`Tool called: ${block.name}`);
    console.log(`Input:`, JSON.stringify(block.input, null, 2));
  }
}
```

---

## Best Practices

1. **Organize by Category**: Use categories for different types of memories (preferences, projects, contacts).

2. **Set TTL for Temporary Data**: Expire memories that are only relevant for a limited time.

3. **Validate Before Storing**: Don't store trivial or duplicate information.

4. **Search Before Storing**: Check if information already exists to avoid duplicates.

5. **Prune Regularly**: Remove outdated or irrelevant memories to keep the store clean.

6. **Use Structured Values**: Store objects with typed fields rather than raw strings for easier retrieval.

7. **Descriptive Keys**: Use namespaced keys like `project_projectx` or `user_preferences` for clarity.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Multi-turn agents
- [Example 08: RAG Knowledge Base](example-08-rag-knowledge-base.md) - Document-based memory
- [Example 11: Customer Support Bot](example-11-customer-support-bot.md) - Contextual conversations
