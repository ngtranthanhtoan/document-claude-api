import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { printHeader } from "./utils.js";

const client = new Anthropic();

// Create a workspace directory for the demo
const WORKSPACE = path.join(import.meta.dirname, "..", "tmp", "coding-workspace");
if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });

const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read contents of a file from the workspace",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Path relative to workspace root" },
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
    name: "list_files",
    description: "List files in the workspace directory",
    input_schema: {
      type: "object" as const,
      properties: {
        directory: { type: "string", description: "Subdirectory to list (default: root)" },
      },
    },
  },
  {
    name: "run_code",
    description: "Execute a code snippet and return the output. Supports Node.js.",
    input_schema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Code to execute" },
        language: { type: "string", enum: ["javascript", "typescript"] },
      },
      required: ["code"],
    },
  },
];

function executeTool(name: string, input: Record<string, unknown>): string {
  console.log(`  >>> ${name}(${JSON.stringify(input).slice(0, 80)}...)`);

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
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, input.content as string);
      const lineCount = (input.content as string).split("\n").length;
      return `File written: ${input.path} (${lineCount} lines)`;
    }
    case "list_files": {
      const dir = path.join(WORKSPACE, (input.directory as string) || ".");
      if (!fs.existsSync(dir)) return "Directory not found";
      const files = fs.readdirSync(dir, { withFileTypes: true });
      return files.map((f) => `${f.isDirectory() ? "[dir]" : "[file]"} ${f.name}`).join("\n");
    }
    case "run_code": {
      // Mock code execution for demo
      const code = input.code as string;
      if (code.includes("fibonacci")) {
        return "fibonacci(10) = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\nAll tests passed!";
      }
      if (code.includes("test") || code.includes("assert")) {
        return "Running tests...\n✓ Test 1 passed\n✓ Test 2 passed\n✓ Test 3 passed\nAll 3 tests passed!";
      }
      return `Code executed successfully.\nOutput: (simulated execution of ${code.split("\n").length} lines)`;
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function main() {
  printHeader("Coding Assistant with Streaming + Tools");

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Write a TypeScript function that generates the Fibonacci sequence up to n terms. Include proper types, error handling, and a test. Save the code to fibonacci.ts and run the tests.",
    },
  ];

  for (let i = 0; i < 10; i++) {
    console.log(`\n--- Turn ${i + 1} ---`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system:
        "You are an expert coding assistant. Write clean, well-typed TypeScript code. Use tools to write files and run code to verify your solutions work.",
      tools,
      messages,
    });

    // Print text content
    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      break;
    }

    // Execute tools
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = executeTool(block.name, block.input as Record<string, unknown>);
        console.log(`  Result: ${result.slice(0, 150)}${result.length > 150 ? "..." : ""}`);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }
  }

  // Show workspace contents
  printHeader("Workspace Contents");
  const files = fs.readdirSync(WORKSPACE, { recursive: true }) as string[];
  for (const f of files) {
    const fullPath = path.join(WORKSPACE, f);
    if (fs.statSync(fullPath).isFile()) {
      console.log(`\n--- ${f} ---`);
      console.log(fs.readFileSync(fullPath, "utf-8"));
    }
  }

  // Cleanup
  fs.rmSync(WORKSPACE, { recursive: true, force: true });

  console.log("\nCoding assistant example completed!");
}

main().catch(console.error);
