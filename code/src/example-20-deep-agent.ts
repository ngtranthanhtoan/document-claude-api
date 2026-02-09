import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { printHeader } from "./utils.js";

const client = new Anthropic();

// Workspace and state files
const WORKSPACE = path.join(import.meta.dirname, "..", "tmp", "deep-agent-workspace");
const TODO_FILE = path.join(WORKSPACE, ".todos.json");
if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });
if (!fs.existsSync(TODO_FILE)) fs.writeFileSync(TODO_FILE, "[]");

const MODEL = "claude-sonnet-4-5-20250514";
const MAX_ITERATIONS = 15;
const SUBAGENT_MAX_ITERATIONS = 5;

interface TodoItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
}

// ─── Orchestrator Tools ───
const orchestratorTools: Anthropic.Tool[] = [
  {
    name: "todo_list",
    description: "Manage task list. Actions: add, update, get_all.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["add", "update", "get_all"] },
        task_id: { type: "string" },
        title: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed", "blocked"] },
      },
      required: ["action"],
    },
  },
  {
    name: "read_file",
    description: "Read a file from the workspace",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file in the workspace",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "List files in a workspace directory",
    input_schema: {
      type: "object" as const,
      properties: { directory: { type: "string" } },
    },
  },
  {
    name: "delegate_task",
    description:
      "Delegate a task to a specialized subagent. The subagent runs in its own context with read_file and write_file tools.",
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

// ─── Tool Implementations ───

function executeTodoList(input: Record<string, unknown>): string {
  let todos: TodoItem[] = JSON.parse(fs.readFileSync(TODO_FILE, "utf-8"));

  switch (input.action) {
    case "add": {
      const id = (input.task_id as string) || String(todos.length + 1);
      todos.push({ id, title: input.title as string, status: "pending" });
      fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));
      console.log(`    [Todo] Added: ${id} - ${input.title}`);
      return `Added task ${id}: ${input.title}`;
    }
    case "update": {
      todos = todos.map((t) =>
        t.id === input.task_id ? { ...t, status: input.status as TodoItem["status"] } : t
      );
      fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));
      console.log(`    [Todo] Updated: ${input.task_id} -> ${input.status}`);
      return `Updated task ${input.task_id}: ${input.status}`;
    }
    case "get_all":
      return JSON.stringify(todos, null, 2);
    default:
      return "Unknown action";
  }
}

function executeReadFile(input: Record<string, unknown>): string {
  const filePath = path.join(WORKSPACE, input.path as string);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : `Error: File not found: ${input.path}`;
}

function executeWriteFile(input: Record<string, unknown>): string {
  const filePath = path.join(WORKSPACE, input.path as string);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, input.content as string);
  console.log(`    [File] Written: ${input.path}`);
  return `Written: ${input.path} (${(input.content as string).split("\n").length} lines)`;
}

function executeListFiles(input: Record<string, unknown>): string {
  const dir = path.join(WORKSPACE, (input.directory as string) || ".");
  if (!fs.existsSync(dir)) return "Directory not found";
  return fs.readdirSync(dir).filter((f) => !f.startsWith(".")).join("\n") || "(empty)";
}

// ─── Subagent ───
async function runSubagent(input: Record<string, unknown>): Promise<string> {
  const taskDesc = input.task_description as string;
  const role = input.role as string;
  const inputFiles = (input.input_files as string[]) || [];
  const outputFile = input.output_file as string;

  console.log(`\n  >>> Spawning subagent: ${role}`);

  let fileContext = "";
  for (const f of inputFiles) {
    const filePath = path.join(WORKSPACE, f);
    if (fs.existsSync(filePath)) {
      fileContext += `--- ${f} ---\n${fs.readFileSync(filePath, "utf-8")}\n--- End ---\n\n`;
    }
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: fileContext ? `${taskDesc}\n\nReference materials:\n${fileContext}` : taskDesc,
    },
  ];

  const subTools: Anthropic.Tool[] = [
    {
      name: "write_file",
      description: "Write output to a file",
      input_schema: {
        type: "object" as const,
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  ];

  for (let i = 0; i < SUBAGENT_MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `You are a ${role}. Complete your task and write your output to ${outputFile} using the write_file tool.`,
      tools: subTools,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      console.log(`  >>> Subagent (${role}) completed in ${i + 1} turns`);
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return text || `Output written to ${outputFile}`;
    }

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const r = executeWriteFile(block.input as Record<string, unknown>);
        results.push({ type: "tool_result", tool_use_id: block.id, content: r });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return `Subagent (${role}) hit max iterations`;
}

// ─── Main Orchestrator ───
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "todo_list": return executeTodoList(input);
    case "read_file": return executeReadFile(input);
    case "write_file": return executeWriteFile(input);
    case "list_files": return executeListFiles(input);
    case "delegate_task": return await runSubagent(input);
    default: return `Unknown tool: ${name}`;
  }
}

async function main() {
  printHeader("Deep Agent: Orchestrator + Subagents");

  // Reset workspace
  fs.writeFileSync(TODO_FILE, "[]");

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Write a short technical blog post about 'Getting Started with TypeScript'. The post should have: 1) An introduction, 2) A 'Why TypeScript' section, 3) A code example section, 4) A conclusion. Use subagents to research and write each section, then combine them into a final post.",
    },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n=== Orchestrator Turn ${i + 1} ===`);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `You are a deep agent orchestrator. For every complex task:
1. PLAN FIRST: Use todo_list to decompose the task into subtasks
2. DELEGATE: Use delegate_task for writing tasks (research, writing, review)
3. COORDINATE: Pass data between subtasks via files
4. VERIFY: After delegation, read the output file and check quality
5. TRACK: Update todo_list as tasks complete

Rules:
- Always create a todo list first
- Delegate writing subtasks to subagents
- Do simple tasks (reading, updating todos) directly
- After all subtasks complete, provide a final summary`,
      tools: orchestratorTools,
      messages,
    });

    // Print text output
    for (const block of response.content) {
      if (block.type === "text") console.log(block.text);
    }

    if (response.stop_reason === "end_turn") {
      console.log("\n=== Orchestrator Complete ===");
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`  Tool: ${block.name}`);
        const result = await executeTool(block.name, block.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Show generated files
  printHeader("Generated Files");
  const allFiles = fs.readdirSync(WORKSPACE).filter((f) => !f.startsWith("."));
  for (const f of allFiles) {
    const content = fs.readFileSync(path.join(WORKSPACE, f), "utf-8");
    console.log(`\n--- ${f} ---`);
    console.log(content.slice(0, 500) + (content.length > 500 ? "\n...(truncated)" : ""));
  }

  // Cleanup
  fs.rmSync(WORKSPACE, { recursive: true, force: true });

  console.log("\nDeep agent example completed!");
}

main().catch(console.error);
