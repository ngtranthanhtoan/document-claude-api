# Example 15: Coding Assistant

> Build an interactive coding assistant with streaming, tool use, and code execution.

## Overview

- **Difficulty**: Advanced
- **Features Used**: Streaming, Tool Use, Multi-turn
- **SDK Methods**: `client.messages.create()`, `client.messages.stream()`
- **Use Cases**:
  - Code generation
  - Debugging assistance
  - Code review
  - Refactoring
  - Test generation

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- Understanding of streaming and tool use

---

## Coding Assistant Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Coding Assistant                          │
├─────────────────────────────────────────────────────────────┤
│  Streaming (real-time code output)                          │
├─────────────────────────────────────────────────────────────┤
│  Tools:                                                      │
│  ├── read_file          │  write_file                       │
│  ├── run_code           │  search_codebase                  │
│  ├── run_tests          │  install_package                  │
│  └── git_operations                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Streaming Code Assistant

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const stream = client.messages.stream({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  system:
    "You are an expert coding assistant. When writing code:\n" +
    "1. Explain your approach first\n" +
    "2. Write clean, well-commented code\n" +
    "3. Use tools to test your code\n" +
    "4. Handle errors gracefully\n\n" +
    "Always prefer to run and verify code before presenting it as final.",
  tools: [
    {
      name: "read_file",
      description: "Read contents of a file in the workspace",
      input_schema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "Path to file relative to workspace root",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "Write or update a file in the workspace",
      input_schema: {
        type: "object" as const,
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "run_code",
      description:
        "Execute Python code in a sandboxed environment and return output",
      input_schema: {
        type: "object" as const,
        properties: {
          code: {
            type: "string",
            description: "Python code to execute",
          },
          timeout: { type: "integer", default: 30 },
        },
        required: ["code"],
      },
    },
    {
      name: "run_tests",
      description: "Run test suite for a file or directory",
      input_schema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "Test file or directory",
          },
          verbose: { type: "boolean", default: false },
        },
        required: ["path"],
      },
    },
    {
      name: "search_codebase",
      description: "Search for code patterns in the workspace",
      input_schema: {
        type: "object" as const,
        properties: {
          pattern: { type: "string" },
          file_type: {
            type: "string",
            description: "File extension filter, e.g., .py, .js",
          },
        },
        required: ["pattern"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Write a Python script that fetches the top 10 Hacker News stories and saves them to a JSON file. Test it to make sure it works.",
    },
  ],
});

// Print each text chunk as it arrives
stream.on("text", (text) => {
  process.stdout.write(text);
});

// Get the complete message when done
const finalMessage = await stream.finalMessage();
console.log("\nStop reason:", finalMessage.stop_reason);
```

### Streaming Response Flow

```
event: content_block_delta
data: {"delta":{"text":"I'll create a Python script"}}

event: content_block_delta
data: {"delta":{"text":" to fetch Hacker News stories. Let me"}}

event: content_block_delta
data: {"delta":{"text":" write and test this code.\n\n"}}

event: content_block_stop
data: {}

event: content_block_start
data: {"content_block":{"type":"tool_use","name":"run_code"}}

event: content_block_delta
data: {"delta":{"partial_json":"{\"code\": \"import requests..."}}
```

---

## Code Execution Flow

### Step 1: Claude Writes Code

```json
{
  "type": "tool_use",
  "name": "run_code",
  "input": {
    "code": "import requests\nimport json\n\ndef fetch_hn_stories(limit=10):\n    # Fetch top story IDs\n    top_url = 'https://hacker-news.firebaseio.com/v0/topstories.json'\n    response = requests.get(top_url)\n    story_ids = response.json()[:limit]\n    \n    stories = []\n    for story_id in story_ids:\n        story_url = f'https://hacker-news.firebaseio.com/v0/item/{story_id}.json'\n        story = requests.get(story_url).json()\n        stories.append({\n            'title': story.get('title'),\n            'url': story.get('url'),\n            'score': story.get('score'),\n            'by': story.get('by')\n        })\n    \n    return stories\n\n# Test the function\nstories = fetch_hn_stories(5)\nfor s in stories:\n    print(f\"- {s['title']} ({s['score']} points)\")"
  }
}
```

### Step 2: Return Execution Result

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01",
  "content": "- Show HN: I built a tool to automate X (245 points)\n- Why Rust is the future of systems programming (189 points)\n- Launch HN: YC Company doing something cool (167 points)\n- The state of AI in 2024 (523 points)\n- Understanding quantum computing basics (98 points)"
}
```

### Step 3: Claude Writes to File

```json
{
  "type": "tool_use",
  "name": "write_file",
  "input": {
    "path": "hn_stories.py",
    "content": "#!/usr/bin/env python3\n\"\"\"Fetch top Hacker News stories.\"\"\"\n\nimport requests\nimport json\nfrom datetime import datetime\n\ndef fetch_hn_stories(limit=10):\n    \"\"\"Fetch top N stories from Hacker News.\"\"\"\n    top_url = 'https://hacker-news.firebaseio.com/v0/topstories.json'\n    response = requests.get(top_url)\n    story_ids = response.json()[:limit]\n    \n    stories = []\n    for story_id in story_ids:\n        story_url = f'https://hacker-news.firebaseio.com/v0/item/{story_id}.json'\n        story = requests.get(story_url).json()\n        stories.append({\n            'id': story_id,\n            'title': story.get('title'),\n            'url': story.get('url'),\n            'score': story.get('score'),\n            'by': story.get('by'),\n            'time': story.get('time')\n        })\n    \n    return stories\n\ndef save_to_json(stories, filename='hn_top_stories.json'):\n    \"\"\"Save stories to JSON file.\"\"\"\n    output = {\n        'fetched_at': datetime.now().isoformat(),\n        'count': len(stories),\n        'stories': stories\n    }\n    with open(filename, 'w') as f:\n        json.dump(output, f, indent=2)\n    return filename\n\nif __name__ == '__main__':\n    stories = fetch_hn_stories(10)\n    filename = save_to_json(stories)\n    print(f'Saved {len(stories)} stories to {filename}')"
  }
}
```

---

## Debugging Workflow

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  tools: [
    {
      name: "run_code",
      description: "Execute Python code and return output",
      input_schema: {
        type: "object" as const,
        properties: {
          code: { type: "string" },
        },
        required: ["code"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        'This code throws an IndexError, can you fix it?\n\n```python\ndef get_average(numbers):\n    total = sum(numbers)\n    return total / len(numbers)\n\nresult = get_average([])\nprint(result)\n```',
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
```

### Response

Claude will:
1. Identify the issue (division by zero when list is empty)
2. Propose a fix
3. Test the fix using `run_code`
4. Present the corrected code

---

## Code Review Tool

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  system:
    "You are a senior code reviewer. For each code submission:\n" +
    "1. Check for bugs and edge cases\n" +
    "2. Evaluate code style and best practices\n" +
    "3. Assess security vulnerabilities\n" +
    "4. Suggest performance improvements\n" +
    "5. Rate the overall quality (1-10)\n\n" +
    "Provide specific, actionable feedback.",
  messages: [
    {
      role: "user",
      content:
        'Review this Python code:\n\n```python\nimport os\nimport sqlite3\n\ndef get_user(username):\n    conn = sqlite3.connect("users.db")\n    cursor = conn.cursor()\n    query = f\'SELECT * FROM users WHERE username = "{username}"\'\n    cursor.execute(query)\n    result = cursor.fetchone()\n    return result\n\ndef delete_file(filename):\n    os.system(f"rm {filename}")\n```',
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

---

## Test Generation

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  tools: [
    {
      name: "read_file",
      description: "Read a file",
      input_schema: {
        type: "object" as const,
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "Write a file",
      input_schema: {
        type: "object" as const,
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "run_tests",
      description: "Run pytest",
      input_schema: {
        type: "object" as const,
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Read calculator.py and write comprehensive tests for it",
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  } else if (block.type === "tool_use") {
    console.log(`Tool: ${block.name}`, block.input);
  }
}
```

---

## Complete Coding Assistant Script

A full end-to-end interactive coding assistant with tool execution, agentic loop, and a readline-based interactive prompt.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as readline from "readline/promises";

const client = new Anthropic();
const WORKSPACE = "/tmp/code_workspace";

// Ensure workspace exists
if (!fs.existsSync(WORKSPACE)) {
  fs.mkdirSync(WORKSPACE, { recursive: true });
}

// Tool execution
function executeTool(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "read_file": {
      const filePath = path.join(WORKSPACE, input.path as string);
      if (!fs.existsSync(filePath)) {
        return `Error: File not found: ${input.path}`;
      }
      return fs.readFileSync(filePath, "utf-8");
    }
    case "write_file": {
      const filePath = path.join(WORKSPACE, input.path as string);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, input.content as string);
      const lineCount = (input.content as string).split("\n").length;
      return `File written: ${input.path} (${lineCount} lines)`;
    }
    case "run_code": {
      try {
        const tempFile = path.join(WORKSPACE, "_temp.py");
        fs.writeFileSync(tempFile, input.code as string);
        const output = execSync(
          `python3 ${tempFile}`,
          { timeout: 30000, cwd: WORKSPACE }
        ).toString();
        return output;
      } catch (error: unknown) {
        const execError = error as { stderr?: Buffer; message?: string };
        return `Error: ${execError.stderr?.toString() || execError.message}`;
      }
    }
    case "run_tests": {
      try {
        const testPath = input.path as string;
        const output = execSync(
          `python3 -m pytest ${testPath} -v`,
          { timeout: 60000, cwd: WORKSPACE }
        ).toString();
        return output;
      } catch (error: unknown) {
        const execError = error as { stdout?: Buffer; stderr?: Buffer };
        return (
          execError.stdout?.toString() ||
          execError.stderr?.toString() ||
          "Test execution failed"
        );
      }
    }
    case "search_codebase": {
      try {
        const pattern = input.pattern as string;
        const fileType = (input.file_type as string) || "*";
        const output = execSync(
          `grep -r "${pattern}" ${WORKSPACE} --include="${fileType}" -n`,
          { timeout: 10000 }
        ).toString();
        return output || "No matches found";
      } catch {
        return "No matches found";
      }
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// Define tools once
const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read contents of a file in the workspace",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to file relative to workspace root",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write or update a file in the workspace",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_code",
    description: "Execute Python code and return output",
    input_schema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Python code to execute" },
      },
      required: ["code"],
    },
  },
  {
    name: "run_tests",
    description: "Run pytest on a test file or directory",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Test file or directory" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_codebase",
    description: "Search for code patterns in the workspace",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string" },
        file_type: { type: "string" },
      },
      required: ["pattern"],
    },
  },
];

// Chat function with agentic tool loop
async function chat(
  messages: Anthropic.MessageParam[]
): Promise<Anthropic.MessageParam[]> {
  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system:
        "You are a coding assistant. Write clean code, test it, and explain your approach.",
      tools,
      messages,
    });

    // Print text content
    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }

    // Add assistant response to messages
    messages.push({ role: "assistant", content: response.content });

    // If no more tool calls, return the updated messages
    if (response.stop_reason === "end_turn") {
      return messages;
    }

    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const toolInput = block.input as Record<string, unknown>;
        console.log(`\n>>> Executing: ${block.name}`);

        const result = executeTool(block.name, toolInput);
        console.log(result.slice(0, 200));
        if (result.length > 200) {
          console.log(`... (${result.length} chars total)`);
        }
        console.log();

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    // Add tool results and continue the loop
    messages.push({ role: "user", content: toolResults });
  }
}

// Interactive mode with readline
async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`Coding Assistant (workspace: ${WORKSPACE})`);
  console.log('Type "quit" to exit\n');

  let messages: Anthropic.MessageParam[] = [];

  while (true) {
    const input = await rl.question("You: ");
    if (input.trim().toLowerCase() === "quit") {
      break;
    }

    messages.push({ role: "user", content: input });

    console.log("\nAssistant:");
    try {
      messages = await chat(messages);
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        console.error(`API Error ${error.status}: ${error.message}`);
      } else {
        throw error;
      }
    }
    console.log();
  }

  rl.close();
  console.log("Goodbye!");
}

main().catch(console.error);
```

---

## Best Practices

1. **Test Before Presenting**: Always run code before showing final version.

2. **Handle Errors Gracefully**: Show helpful error messages.

3. **Stream Long Outputs**: Use streaming for better UX.

4. **Sandbox Code Execution**: Run untrusted code in isolation.

5. **Maintain Context**: Keep conversation history for follow-ups.

---

## Related Examples

- [Example 02: Streaming](example-02-streaming.md) - Real-time responses
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Autonomous execution
- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool fundamentals
