# Example 20: Deep Agent

> Build a multi-layered agent with planning, filesystem memory, and subagent delegation for complex multi-step tasks.

## Overview

- **Difficulty**: Expert
- **Features Used**: Tool Use, Multi-turn, Subagent Delegation, Planning
- **SDK Methods**: `client.messages.create()`
- **Use Cases**:
  - Complex project scaffolding
  - Multi-file code generation
  - Research reports with multiple sections
  - Data pipeline orchestration
  - Any task requiring decomposition into subtasks

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable
- Understanding of agentic tool loops ([Example 13](example-13-agentic-tool-loop.md))

---

## Why Deep Agents?

A standard agentic tool loop (Example 13) runs Claude in a single conversation, calling tools until the task is done. This works for simple tasks but breaks down on complex ones:

- **Context bloat**: Each tool call and result accumulates in the conversation
- **Loss of focus**: With 20+ tool calls, the agent loses track of the overall plan
- **No specialization**: A single system prompt can't be expert at everything

A **deep agent** solves these problems with four pillars:

1. **Planning Tool** — Decompose tasks into subtasks before executing
2. **Filesystem Backend** — Read/write files as persistent working memory
3. **Subagent Delegation** — Spawn isolated agents for focused subtasks
4. **Orchestrator Prompt** — Guide when to plan, delegate, or work directly

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Planning Tool │  │  Filesystem  │  │ Subagent         │  │
│  │ (Todo List)   │  │  (read/write)│  │ Delegation       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Orchestrator System Prompt                                  │
└──────────────┬──────────────┬──────────────┬────────────────┘
               │              │              │
               ▼              ▼              ▼
        ┌───────────┐  ┌───────────┐  ┌───────────┐
        │ Subagent  │  │ Subagent  │  │ Subagent  │
        │ Research  │  │ Writing   │  │ Review    │
        └───────────┘  └───────────┘  └───────────┘
```

---

## TypeScript Interfaces

```typescript
interface TodoItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
}

interface DelegateTaskInput {
  task_description: string;
  role: string;
  input_files?: string[];
  output_file: string;
}

interface FileInput {
  path: string;
  content?: string;
}

interface TodoInput {
  action: "add" | "update" | "get_all";
  task_id?: string;
  title?: string;
  status?: "pending" | "in_progress" | "completed" | "blocked";
}
```

---

## The Deep Agent Toolkit

Five tools give the orchestrator planning, memory, and delegation capabilities.

### Tool Definitions

```typescript
import Anthropic from "@anthropic-ai/sdk";

const orchestratorTools: Anthropic.Messages.Tool[] = [
  {
    name: "todo_list",
    description:
      "Manage a task list for planning and tracking. ALWAYS use this to decompose complex tasks before starting work. Actions: add (create task), update (change status), get_all (list all tasks).",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["add", "update", "get_all"] },
        task_id: { type: "string", description: "Task identifier (for update)" },
        title: { type: "string", description: "Task title (for add)" },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed", "blocked"],
        },
      },
      required: ["action"],
    },
  },
  {
    name: "read_file",
    description: "Read a file from the workspace. Use to review subagent output or load context.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to workspace root" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file. Use to save intermediate results or final outputs.",
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
    name: "list_files",
    description: "List files in a workspace directory.",
    input_schema: {
      type: "object" as const,
      properties: {
        directory: { type: "string", default: "." },
      },
    },
  },
  {
    name: "delegate_task",
    description:
      "Delegate a task to a specialized subagent. The subagent runs in its own context window with read_file and write_file tools. Returns the subagent's summary when complete.",
    input_schema: {
      type: "object" as const,
      properties: {
        task_description: { type: "string" },
        role: { type: "string", description: "e.g. 'researcher', 'writer', 'reviewer'" },
        input_files: { type: "array", items: { type: "string" } },
        output_file: { type: "string" },
      },
      required: ["task_description", "role", "output_file"],
    },
  },
];
```

---

## Pillar 1: Planning with Todo List

```typescript
import * as fs from "fs";
import * as path from "path";

const WORKSPACE = "/tmp/deep_agent_workspace";
const TODO_FILE = path.join(WORKSPACE, ".todos.json");

// Initialize workspace
function initWorkspace() {
  fs.mkdirSync(WORKSPACE, { recursive: true });
  fs.writeFileSync(TODO_FILE, JSON.stringify([]));
  console.log(`Workspace initialized: ${WORKSPACE}`);
}

// Todo list operations
function executeTodoList(input: TodoInput): string {
  let todos: TodoItem[] = JSON.parse(fs.readFileSync(TODO_FILE, "utf-8"));

  switch (input.action) {
    case "add": {
      const id = input.task_id ?? String(todos.length + 1);
      todos.push({ id, title: input.title!, status: "pending" });
      fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));
      return `Added task ${id}: ${input.title}`;
    }
    case "update": {
      todos = todos.map((t) =>
        t.id === input.task_id ? { ...t, status: input.status! } : t
      );
      fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));
      return `Updated task ${input.task_id}: ${input.status}`;
    }
    case "get_all":
      return JSON.stringify(todos, null, 2);
    default:
      return "Unknown action";
  }
}
```

---

## Pillar 2: Filesystem as Working Memory

```typescript
function executeReadFile(input: FileInput): string {
  const filePath = path.join(WORKSPACE, input.path);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  return `Error: File not found: ${input.path}`;
}

function executeWriteFile(input: FileInput): string {
  const filePath = path.join(WORKSPACE, input.path);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, input.content!);
  const lines = input.content!.split("\n").length;
  return `Written: ${input.path} (${lines} lines)`;
}

function executeListFiles(input: { directory?: string }): string {
  const dir = path.join(WORKSPACE, input.directory ?? ".");
  if (fs.existsSync(dir)) {
    return fs.readdirSync(dir).join("\n");
  }
  return `Directory not found: ${input.directory}`;
}
```

```
Workspace files during execution:

  workspace/
  ├── research.md        ← Subagent 1 writes research notes
  ├── draft.md           ← Subagent 2 reads research, writes draft
  ├── review.md          ← Subagent 3 reads draft, writes review
  └── blog_post.md       ← Orchestrator writes final version
```

---

## Pillar 3: Subagent Delegation

When the orchestrator calls `delegate_task`, the host system spawns a **separate Claude API call**:

```
Orchestrator ──> delegate_task ──> Host System ──> New API call ──> Subagent
                                                                      │
                                          writes output file <────────┘
```

### Subagent Implementation

```typescript
const client = new Anthropic();

const SUBAGENT_MODEL = "claude-sonnet-4-5-20250929";
const SUBAGENT_MAX_ITERATIONS = 10;

const subagentTools: Anthropic.Messages.Tool[] = [
  {
    name: "read_file",
    description: "Read a file",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
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
];

async function runSubagent(input: DelegateTaskInput): Promise<string> {
  console.log(`>>> Spawning subagent: ${input.role}`);

  // Build context from input files
  let fileContext = "";
  if (input.input_files) {
    for (const f of input.input_files) {
      const filePath = path.join(WORKSPACE, f);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        fileContext += `--- Contents of ${f} ---\n${content}\n--- End of ${f} ---\n\n`;
      }
    }
  }

  const systemPrompt = `You are a ${input.role}. Complete your task and write the output to ${input.output_file} using write_file. Be thorough and detailed.`;
  const userMessage = fileContext
    ? `${input.task_description}\n\nReference materials:\n${fileContext}`
    : input.task_description;

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // Subagent agentic loop
  for (let i = 0; i < SUBAGENT_MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: SUBAGENT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: subagentTools,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      console.log(`>>> Subagent (${input.role}) completed in ${i + 1} iterations`);
      const text = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return text || `Subagent completed. Output written to ${input.output_file}`;
    }

    // Handle tool calls
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const toolInput = block.input as FileInput;
        let result: string;
        switch (block.name) {
          case "read_file":
            result = executeReadFile(toolInput);
            break;
          case "write_file":
            result = executeWriteFile(toolInput);
            break;
          default:
            result = `Unknown tool: ${block.name}`;
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return `Subagent (${input.role}) hit max iterations`;
}
```

---

## Pillar 4: Orchestrator Prompt

```typescript
const ORCHESTRATOR_PROMPT = `You are a deep agent orchestrator. For every complex task:

1. PLAN FIRST: Use todo_list to decompose the task into subtasks before any work
2. DELEGATE: Use delegate_task for self-contained subtasks (research, writing, review)
3. COORDINATE: Pass data between subtasks via files (write output, next task reads it)
4. VERIFY: After delegation, read the output file and check quality
5. TRACK: Update todo_list as tasks complete

Rules:
- Never skip planning. Always create a todo list first.
- Delegate when a subtask can be fully described in 2-3 sentences.
- Do simple tasks (reading, updating todos) directly.
- After all subtasks complete, provide a final summary.`;
```

---

## Complete Deep Agent Implementation

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic();

// Configuration
const MODEL = "claude-sonnet-4-5-20250929";
const SUBAGENT_MODEL = "claude-sonnet-4-5-20250929";
const MAX_ITERATIONS = 20;
const SUBAGENT_MAX_ITERATIONS = 10;
const WORKSPACE = "/tmp/deep_agent_workspace";
const TODO_FILE = path.join(WORKSPACE, ".todos.json");

// --- Interfaces ---

interface TodoItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
}

interface DelegateTaskInput {
  task_description: string;
  role: string;
  input_files?: string[];
  output_file: string;
}

// --- Workspace & Tool Functions ---

function initWorkspace() {
  fs.mkdirSync(WORKSPACE, { recursive: true });
  fs.writeFileSync(TODO_FILE, JSON.stringify([]));
  console.log(`Workspace initialized: ${WORKSPACE}`);
}

function executeTodoList(input: any): string {
  let todos: TodoItem[] = JSON.parse(fs.readFileSync(TODO_FILE, "utf-8"));
  switch (input.action) {
    case "add": {
      const id = input.task_id ?? String(todos.length + 1);
      todos.push({ id, title: input.title, status: "pending" });
      fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));
      return `Added task ${id}: ${input.title}`;
    }
    case "update": {
      todos = todos.map((t) =>
        t.id === input.task_id ? { ...t, status: input.status } : t
      );
      fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));
      return `Updated task ${input.task_id}: ${input.status}`;
    }
    case "get_all":
      return JSON.stringify(todos, null, 2);
    default:
      return "Unknown action";
  }
}

function executeReadFile(input: any): string {
  const filePath = path.join(WORKSPACE, input.path);
  return fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf-8")
    : `Error: File not found: ${input.path}`;
}

function executeWriteFile(input: any): string {
  const filePath = path.join(WORKSPACE, input.path);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, input.content);
  return `Written: ${input.path} (${input.content.split("\n").length} lines)`;
}

function executeListFiles(input: any): string {
  const dir = path.join(WORKSPACE, input.directory ?? ".");
  return fs.existsSync(dir) ? fs.readdirSync(dir).join("\n") : `Directory not found`;
}

// --- Subagent ---

async function runSubagent(input: DelegateTaskInput): Promise<string> {
  console.log(`\n>>> Spawning subagent: ${input.role}`);

  let fileContext = "";
  for (const f of input.input_files ?? []) {
    const filePath = path.join(WORKSPACE, f);
    if (fs.existsSync(filePath)) {
      fileContext += `--- ${f} ---\n${fs.readFileSync(filePath, "utf-8")}\n--- End ---\n\n`;
    }
  }

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: fileContext
        ? `${input.task_description}\n\nReference materials:\n${fileContext}`
        : input.task_description,
    },
  ];

  const subTools: Anthropic.Messages.Tool[] = [
    {
      name: "read_file",
      description: "Read a file",
      input_schema: {
        type: "object" as const,
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "Write a file",
      input_schema: {
        type: "object" as const,
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  ];

  for (let i = 0; i < SUBAGENT_MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: SUBAGENT_MODEL,
      max_tokens: 4096,
      system: `You are a ${input.role}. Complete your task and write output to ${input.output_file} using write_file.`,
      tools: subTools,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      console.log(`>>> Subagent (${input.role}) completed in ${i + 1} iterations`);
      return response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n") || `Output written to ${input.output_file}`;
    }

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const r =
          block.name === "read_file"
            ? executeReadFile(block.input)
            : block.name === "write_file"
              ? executeWriteFile(block.input)
              : "Unknown tool";
        results.push({ type: "tool_result", tool_use_id: block.id, content: r });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return `Subagent (${input.role}) hit max iterations`;
}

// --- Tool Router ---

async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "todo_list":
      return executeTodoList(input);
    case "read_file":
      return executeReadFile(input);
    case "write_file":
      return executeWriteFile(input);
    case "list_files":
      return executeListFiles(input);
    case "delegate_task":
      return await runSubagent(input as DelegateTaskInput);
    default:
      return `Unknown tool: ${name}`;
  }
}

// --- Orchestrator Tools ---

const orchestratorTools: Anthropic.Messages.Tool[] = [
  {
    name: "todo_list",
    description: "Manage task list. Actions: add, update, get_all.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["add", "update", "get_all"] },
        task_id: { type: "string" },
        title: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed"] },
      },
      required: ["action"],
    },
  },
  {
    name: "delegate_task",
    description: "Delegate to a subagent with its own context.",
    input_schema: {
      type: "object" as const,
      properties: {
        task_description: { type: "string" },
        role: { type: "string" },
        input_files: { type: "array", items: { type: "string" } },
        output_file: { type: "string" },
      },
      required: ["task_description", "role", "output_file"],
    },
  },
  {
    name: "read_file",
    description: "Read a file from workspace.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write a file to workspace.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "List workspace files.",
    input_schema: {
      type: "object" as const,
      properties: { directory: { type: "string" } },
    },
  },
];

// --- Main Orchestrator Loop ---

const ORCHESTRATOR_PROMPT = `You are a deep agent orchestrator. For every complex task:

1. PLAN FIRST: Use todo_list to decompose the task into subtasks
2. DELEGATE: Use delegate_task for self-contained subtasks
3. COORDINATE: Pass data between subtasks via files
4. VERIFY: After delegation, read the output file and check quality
5. TRACK: Update todo_list as tasks complete

Rules:
- Never skip planning. Always create a todo list first.
- Delegate when a subtask can be fully described in 2-3 sentences.
- Do simple tasks (reading, updating todos) directly.
- After all subtasks complete, provide a final summary.`;

async function runOrchestrator(task: string) {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: task },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n=== Orchestrator Turn ${i + 1} ===`);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: ORCHESTRATOR_PROMPT,
      tools: orchestratorTools,
      messages,
    });

    // Print text output
    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }

    if (response.stop_reason === "end_turn") {
      console.log("\n=== Orchestrator Complete ===");
      return;
    }

    // Handle tool calls
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`  Tool: ${block.name}`);
        const result = await executeTool(block.name, block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  console.log(`Hit max iterations (${MAX_ITERATIONS})`);
}

// --- Run It ---

initWorkspace();
runOrchestrator(
  "Write a technical blog post about WebAssembly covering its history, current use cases, and future outlook. Save it as blog_post.md."
);
```

---

## Cost and Performance

| Strategy | Orchestrator | Subagents | Trade-off |
|----------|-------------|-----------|-----------|
| **All Sonnet** | claude-sonnet-4-5-20250929 | claude-sonnet-4-5-20250929 | Best quality, higher cost |
| **Mixed models** | claude-sonnet-4-5-20250929 | claude-haiku-4-5-20251001 | Good balance for simple subtasks |
| **Budget** | claude-haiku-4-5-20251001 | claude-haiku-4-5-20251001 | Lowest cost, simpler tasks only |

---

## Best Practices

1. **Plan Before Executing**: Always have the orchestrator create a todo list before taking action.
2. **Delegate Self-Contained Tasks**: Only delegate tasks that can be fully described in the task description.
3. **Use Files for Data Transfer**: Pass data between orchestrator and subagents via files, not conversation.
4. **Verify Subagent Output**: After delegation, always read the output file and check quality.
5. **Set Iteration Limits**: Both orchestrator and subagents should have max iteration caps.
6. **Use Cheaper Models for Subagents**: Route simple subtasks to Haiku for cost savings.
7. **Log Tool Calls**: Track which subagents were spawned and what they produced.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Foundation: basic autonomous agents
- [Example 14: Research Agent](example-14-research-agent.md) - Multi-tool planning with extended thinking
- [Example 15: Coding Assistant](example-15-coding-assistant.md) - File read/write patterns
- [Example 18: Memory Tool](example-18-memory-tool.md) - Persistent state management
