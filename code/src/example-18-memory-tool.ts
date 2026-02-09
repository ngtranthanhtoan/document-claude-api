import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

// File-based memory implementation
const MEMORY_FILE = path.join(import.meta.dirname, "..", "tmp", "memory-store.json");
const tmpDir = path.dirname(MEMORY_FILE);
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
if (!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, JSON.stringify({ memories: {} }));

const tools: Anthropic.Tool[] = [
  {
    name: "memory",
    description:
      "Persistent memory tool. Actions: store (save data with key), retrieve (get by key), search (find by query), list (show all keys), delete (remove by key).",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["store", "retrieve", "search", "list", "delete"] },
        key: { type: "string", description: "Unique key for the memory entry" },
        value: { description: "Data to store (any JSON-serializable value)" },
        category: { type: "string", description: "Category for organizing memories" },
        query: { type: "string", description: "Search query (for search action)" },
      },
      required: ["action"],
    },
  },
];

function executeMemory(input: Record<string, unknown>): string {
  const store = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  const action = input.action as string;

  console.log(`  [Memory] ${action}${input.key ? ` key="${input.key}"` : ""}${input.query ? ` query="${input.query}"` : ""}`);

  switch (action) {
    case "store":
      store.memories[input.key as string] = {
        value: input.value,
        category: input.category || "general",
        stored_at: new Date().toISOString(),
      };
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2));
      return JSON.stringify({ status: "stored", key: input.key });

    case "retrieve": {
      const entry = store.memories[input.key as string];
      return entry
        ? JSON.stringify(entry)
        : JSON.stringify({ error: `No memory found for key: ${input.key}` });
    }

    case "search": {
      const query = (input.query as string).toLowerCase();
      const results = Object.entries(store.memories)
        .filter(
          ([k, v]) =>
            k.toLowerCase().includes(query) ||
            JSON.stringify(v).toLowerCase().includes(query)
        )
        .map(([k, v]) => ({ key: k, ...(v as Record<string, unknown>) }));
      return JSON.stringify({ results, count: results.length });
    }

    case "list":
      return JSON.stringify({
        keys: Object.keys(store.memories),
        count: Object.keys(store.memories).length,
      });

    case "delete":
      if (store.memories[input.key as string]) {
        delete store.memories[input.key as string];
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2));
        return JSON.stringify({ status: "deleted", key: input.key });
      }
      return JSON.stringify({ error: `No memory found for key: ${input.key}` });

    default:
      return JSON.stringify({ error: `Unknown action: ${action}` });
  }
}

async function chat(
  messages: Anthropic.MessageParam[],
  userMessage: string
): Promise<Anthropic.MessageParam[]> {
  console.log(`\nUser: ${userMessage}`);
  messages.push({ role: "user", content: userMessage });

  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system:
        "You are a personal assistant with persistent memory. Use the memory tool to:\n- Store important information the user shares\n- Retrieve previously stored information\n- Remember preferences, projects, and context across conversations\n\nAlways proactively store key information and check memory when relevant.",
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      for (const block of response.content) {
        if (block.type === "text") console.log(`Assistant: ${block.text}`);
      }
      return messages;
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = executeMemory(block.input as Record<string, unknown>);
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

  return messages;
}

async function main() {
  // Reset memory store
  fs.writeFileSync(MEMORY_FILE, JSON.stringify({ memories: {} }));

  // ─── Conversation 1: Store Information ───
  printHeader("Conversation 1: Storing User Preferences");
  let messages: Anthropic.MessageParam[] = [];

  messages = await chat(
    messages,
    "Hi! I'm working on a project called ProjectX. It uses React, Node.js, and PostgreSQL. The deadline is March 15, 2025. Please remember this."
  );

  messages = await chat(
    messages,
    "Also, my preferred programming language is TypeScript and I like using Tailwind CSS for styling. Remember that too."
  );

  // ─── Conversation 2: Retrieve Information ───
  printHeader("Conversation 2: Retrieving Stored Info");
  // Simulate a new conversation by resetting messages but keeping memory
  messages = [];

  messages = await chat(
    messages,
    "What do you remember about my project? What technologies am I using?"
  );

  messages = await chat(
    messages,
    "What are my preferences for CSS?"
  );

  // ─── Show Final Memory State ───
  printHeader("Final Memory State");
  const store = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  printJSON(store);

  // Cleanup
  fs.unlinkSync(MEMORY_FILE);
  fs.rmdirSync(tmpDir, { recursive: true });

  console.log("\nMemory tool example completed!");
}

main().catch(console.error);
