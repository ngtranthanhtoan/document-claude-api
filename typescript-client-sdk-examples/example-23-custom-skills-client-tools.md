# Example 23: Custom Tools & Client-Side Agents Outside Containers

> Define custom tools and use built-in bash/text_editor to build agents that run entirely on your own machine — no containers needed.

## Overview

- **Difficulty**: Expert
- **Features Used**: Custom Tool Definitions, Local Skills, Bash Tool (client), Text Editor Tool (client)
- **SDK Methods**: `client.messages.create()`
- **Beta Headers Required**: None
- **Use Cases**:
  - Building domain-specific tool agents without containers
  - Local skills — reusable instruction + script packages executed on your machine
  - Local development automation with bash + text_editor
  - Agentic code editing, testing, and deployment
  - CI/CD integration with Claude as a tool-using agent
  - Custom workflow automation on your own infrastructure

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- Understanding of [Example 06: Tool Use Basics](example-06-tool-use-basics.md)
- A local environment where Claude's commands will be executed

---

## Why Outside Containers?

Anthropic provides `code_execution_20250825` which runs code inside sandboxed containers (see [Example 19](example-19-agent-skills.md) and [Example 22](example-22-virtual-file-system-container-sandbox.md)). But containers have limitations:

| Constraint | Container (`code_execution`) | Your Machine (client tools) |
|-----------|------------------------------|----------------------------|
| **Internet access** | None | Full access |
| **Filesystem** | Isolated 5 GiB VFS | Your entire filesystem |
| **Installed packages** | Pre-installed only | Whatever you have |
| **Beta header** | Required | None |
| **Execution** | Auto-executed by Anthropic | You execute and return results |
| **Custom runtimes** | Python 3.11 only | Any language/runtime |
| **Database access** | None | Local or remote databases |
| **Cost** | $0.05/hr (after free tier) | Free (your machine) |

> **When to use client-side tools**: Local file editing, running tests, git operations, project scaffolding, deployment scripts, log analysis, database queries — anything that needs your filesystem, network, or custom runtimes.

---

## Architecture: Client-Side Tool Execution

```
┌───────────────────────────────────────────────────────────────────┐
│                     Your Application                                │
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐   │
│  │ Send Request  │────>│  Claude API   │────>│ Response with    │   │
│  │ with tools    │     │              │     │ stop_reason:     │   │
│  │              │     │              │     │ "tool_use"       │   │
│  └──────────────┘     └──────────────┘     └────────┬─────────┘   │
│                                                      │             │
│                                                      ▼             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  YOUR TOOL EXECUTOR (runs on your machine)                   │  │
│  │                                                              │  │
│  │  if tool == "bash"           → execSync(command)             │  │
│  │  if tool == "text_editor"    → fs read/write/replace         │  │
│  │  if tool == "run_tests"      → pytest / jest / go test       │  │
│  │  if tool == "query_db"       → SQL query on local DB         │  │
│  │  if tool == "deploy"         → your deploy script            │  │
│  │                                                              │  │
│  │  Return tool_result ──────────────────────> next API call    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Loop until stop_reason == "end_turn"                               │
└───────────────────────────────────────────────────────────────────┘
```

> **Critical**: When Claude returns `stop_reason: "tool_use"`, the tool has **NOT** been executed. You must execute it on your machine and return the result via `tool_result`. This is the fundamental difference from container-based `code_execution`.

---

## Built-in Client Tools: Bash

The `bash_20250124` tool requires **no beta header**. Use `client.messages.create()` (not `client.beta`). Claude requests a command, you execute it on your machine, and return the output.

### Step 1: Send Request with Bash Tool

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// No beta required — use client.messages.create() directly
const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  tools: [
    {
      type: "bash_20250124",
      name: "bash",
    },
  ],
  messages: [
    {
      role: "user",
      content: "List the files in /tmp and tell me how much disk space is used.",
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
// → "tool_use" — Claude wants you to execute a command
```

### Step 2: Claude Responds with Tool Use

```json
{
  "content": [
    {
      "type": "text",
      "text": "I'll check the files in /tmp and the disk usage."
    },
    {
      "type": "tool_use",
      "id": "toolu_01XYZ",
      "name": "bash",
      "input": {
        "command": "ls -la /tmp && df -h /tmp"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

### Step 3: Execute Locally and Return Result

```typescript
import { execSync } from "child_process";

// Extract the tool use block
const toolUse = message.content.find((block) => block.type === "tool_use");
if (toolUse && toolUse.type === "tool_use") {
  const command = (toolUse.input as { command: string }).command;

  // Execute on your machine
  let output: string;
  try {
    output = execSync(command, { encoding: "utf-8", timeout: 30000 });
  } catch (error: any) {
    output = `${error.stderr || error.message}\nExit code: ${error.status}`;
  }

  // Send the result back to Claude
  const finalResponse = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    tools: [{ type: "bash_20250124", name: "bash" }],
    messages: [
      {
        role: "user",
        content:
          "List the files in /tmp and tell me how much disk space is used.",
      },
      { role: "assistant", content: message.content },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: output,
          },
        ],
      },
    ],
  });

  // Print Claude's final answer
  for (const block of finalResponse.content) {
    if (block.type === "text") {
      console.log(block.text);
    }
  }
}
```

### Handling Errors

If a command fails, return an error result so Claude can adjust its approach:

```typescript
{
  type: "tool_result",
  tool_use_id: toolUse.id,
  is_error: true,
  content: "bash: command not found: unknown_command\nExit code: 127"
}
```

---

## Built-in Client Tools: Text Editor

The `text_editor_20250728` tool also requires **no beta header**. Claude requests file operations, and you execute them locally.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  tools: [
    {
      type: "text_editor_20250728",
      name: "str_replace_based_edit_tool",
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Create a file at /tmp/hello.py with a simple hello world script.",
    },
  ],
});
```

### Response (Create Operation)

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01ABC",
      "name": "str_replace_based_edit_tool",
      "input": {
        "command": "create",
        "path": "/tmp/hello.py",
        "file_text": "#!/usr/bin/env python3\n\ndef main():\n    print(\"Hello, World!\")\n\nif __name__ == \"__main__\":\n    main()\n"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

### Text Editor Operations

You must implement these operations on your machine:

| Command | Input Fields | Action |
|---------|-------------|--------|
| `create` | `path`, `file_text` | Write `file_text` to `path` |
| `view` | `path`, `view_range` (optional) | Read file content, return it |
| `str_replace` | `path`, `old_str`, `new_str` | Find and replace exact string |
| `insert` | `path`, `insert_line`, `new_str` | Insert text at line number |

### Implementing Text Editor Operations

```typescript
import * as fs from "fs";
import * as path from "path";

interface TextEditorInput {
  command: "create" | "view" | "str_replace" | "insert";
  path: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
  view_range?: [number, number];
}

function executeTextEditor(input: TextEditorInput): string {
  switch (input.command) {
    case "create": {
      const dir = path.dirname(input.path);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(input.path, input.file_text || "");
      return `File created successfully at ${input.path}`;
    }

    case "view": {
      const content = fs.readFileSync(input.path, "utf-8");
      const lines = content.split("\n");
      const [start, end] = input.view_range || [1, lines.length];
      return lines
        .slice(start - 1, end)
        .map((line, i) => `${start + i}\t${line}`)
        .join("\n");
    }

    case "str_replace": {
      let content = fs.readFileSync(input.path, "utf-8");
      if (!content.includes(input.old_str!)) {
        return `Error: old_str not found in ${input.path}`;
      }
      content = content.replace(input.old_str!, input.new_str!);
      fs.writeFileSync(input.path, content);
      return "Replacement successful";
    }

    case "insert": {
      const lines = fs.readFileSync(input.path, "utf-8").split("\n");
      lines.splice(input.insert_line! - 1, 0, input.new_str!);
      fs.writeFileSync(input.path, lines.join("\n"));
      return "Insert successful";
    }
  }
}
```

### Returning Results

For `create`, `str_replace`, and `insert`:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01ABC",
  "content": "File created successfully at /tmp/hello.py"
}
```

For `view`, return the file content with line numbers:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01ABC",
  "content": "1\t#!/usr/bin/env python3\n2\t\n3\tdef main():\n4\t    print(\"Hello, World!\")\n5\t\n6\tif __name__ == \"__main__\":\n7\t    main()\n"
}
```

---

## Custom Tool Definitions

Beyond built-in tools, you can define **your own custom tools** that Claude can call. You execute them on your machine — giving you full control over what happens.

### Defining Custom Tools

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  tools: [
    {
      type: "bash_20250124",
      name: "bash",
    } as any,
    {
      type: "text_editor_20250728",
      name: "str_replace_based_edit_tool",
    } as any,
    {
      name: "run_tests",
      description:
        "Run the test suite for the project. Returns test output including pass/fail results and error messages.",
      input_schema: {
        type: "object" as const,
        properties: {
          test_path: {
            type: "string",
            description: "Path to test file or directory",
          },
          framework: {
            type: "string",
            enum: ["pytest", "jest", "go_test", "cargo_test"],
            description: "Test framework to use",
          },
          verbose: {
            type: "boolean",
            description: "Enable verbose output",
          },
        },
        required: ["test_path", "framework"],
      },
    },
    {
      name: "query_database",
      description:
        "Execute a read-only SQL query against the project database. Returns results as JSON.",
      input_schema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "SQL SELECT query to execute",
          },
          database: {
            type: "string",
            description: "Database name",
            enum: ["app_db", "analytics_db"],
          },
        },
        required: ["query", "database"],
      },
    },
    {
      name: "web_fetch",
      description:
        "Fetch content from a URL. Returns the response body as text. Use for reading web pages, APIs, or downloading data.",
      input_schema: {
        type: "object" as const,
        properties: {
          url: {
            type: "string",
            description: "The URL to fetch",
          },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE"],
            description: "HTTP method (default: GET)",
          },
          headers: {
            type: "object",
            description: "Optional HTTP headers as key-value pairs",
          },
          body: {
            type: "string",
            description: "Optional request body (for POST/PUT)",
          },
        },
        required: ["url"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Check if any tests are failing in /home/user/project/tests, then look at the database to see how many users signed up today.",
    },
  ],
});
```

### Claude Chooses the Right Tool

Claude decides which tool to use based on the task:

```json
{
  "content": [
    {
      "type": "text",
      "text": "I'll first run the tests, then check the database for today's signups."
    },
    {
      "type": "tool_use",
      "id": "toolu_01AAA",
      "name": "run_tests",
      "input": {
        "test_path": "/home/user/project/tests",
        "framework": "pytest",
        "verbose": true
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

### Executing Custom Tools on Your Machine

You dispatch each tool call to your own implementation:

```typescript
import { execSync } from "child_process";

function executeRunTests(input: {
  test_path: string;
  framework: string;
  verbose?: boolean;
}): string {
  const { test_path, framework, verbose } = input;

  try {
    switch (framework) {
      case "pytest": {
        const flags = verbose ? "-v" : "";
        return execSync(`python -m pytest ${test_path} ${flags}`, {
          encoding: "utf-8",
          timeout: 60000,
        });
      }
      case "jest":
        return execSync(`npx jest ${test_path}`, {
          encoding: "utf-8",
          timeout: 60000,
        });
      case "go_test":
        return execSync(`go test ${test_path} -v`, {
          encoding: "utf-8",
          timeout: 60000,
        });
      case "cargo_test":
        return execSync(`cargo test ${test_path}`, {
          encoding: "utf-8",
          timeout: 60000,
        });
      default:
        return `Error: Unknown framework: ${framework}`;
    }
  } catch (error: any) {
    return `${error.stdout || ""}${error.stderr || error.message}\nExit code: ${error.status}`;
  }
}

function executeQueryDatabase(input: {
  query: string;
  database: string;
}): string {
  const { query, database } = input;

  // Only allow SELECT queries for safety
  if (/^(insert|update|delete|drop|alter|create)/i.test(query.trim())) {
    return "Error: Only SELECT queries are allowed";
  }

  try {
    return execSync(`psql -d ${database} -c "${query}" --csv`, {
      encoding: "utf-8",
      timeout: 30000,
    });
  } catch (error: any) {
    return `Error: ${error.stderr || error.message}`;
  }
}

async function executeWebFetch(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<string> {
  const { url, method = "GET", headers = {}, body } = input;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      signal: AbortSignal.timeout(30000),
    });

    const text = await response.text();

    // Truncate large responses to avoid token overflow
    if (text.length > 50000) {
      return text.slice(0, 50000) + `... [truncated, ${text.length} bytes total]`;
    }

    return text;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
```

---

## Web Fetch Tool

One of the biggest advantages of running outside containers is **full network access**. A `web_fetch` tool lets Claude read web pages, call APIs, and download data — impossible inside Anthropic's sandboxed containers.

### Standalone Web Fetch Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  tools: [
    {
      name: "web_fetch",
      description:
        "Fetch content from a URL. Returns the response body as text. Use for reading web pages, calling REST APIs, or downloading data.",
      input_schema: {
        type: "object" as const,
        properties: {
          url: {
            type: "string",
            description: "The URL to fetch",
          },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE"],
            description: "HTTP method (default: GET)",
          },
          headers: {
            type: "object",
            description: "Optional HTTP headers as key-value pairs",
          },
          body: {
            type: "string",
            description: "Optional request body (for POST/PUT)",
          },
        },
        required: ["url"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Fetch the latest exchange rates from https://api.exchangerate-api.com/v4/latest/USD and tell me the EUR and GBP rates.",
    },
  ],
});
```

### Claude's Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "I'll fetch the latest exchange rates for you."
    },
    {
      "type": "tool_use",
      "id": "toolu_01BBB",
      "name": "web_fetch",
      "input": {
        "url": "https://api.exchangerate-api.com/v4/latest/USD",
        "method": "GET"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

### Implementing Web Fetch

```typescript
async function executeWebFetch(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<string> {
  const { url, method = "GET", headers = {}, body } = input;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      signal: AbortSignal.timeout(30000),
    });

    const text = await response.text();

    // Truncate large responses to avoid token overflow
    if (text.length > 50000) {
      return text.slice(0, 50000) + `... [truncated, ${text.length} bytes total]`;
    }

    return text;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
```

### URL Allow-List (Security)

Restrict which URLs Claude can fetch to prevent SSRF attacks:

```typescript
const ALLOWED_DOMAINS = new Set([
  "api.exchangerate-api.com",
  "api.github.com",
  "jsonplaceholder.typicode.com",
]);

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_DOMAINS.has(parsed.hostname)) {
      throw new Error(`Domain '${parsed.hostname}' is not in the allow-list`);
    }
    return true;
  } catch (error: any) {
    throw new Error(`Invalid URL: ${error.message}`);
  }
}

// Use in your executor:
async function executeWebFetchSafe(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<string> {
  try {
    validateUrl(input.url);
  } catch (error: any) {
    return error.message;
  }
  return executeWebFetch(input);
}
```

### Practical Example: API-Driven Workflows

```typescript
const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  tools: [
    { type: "bash_20250124", name: "bash" } as any,
    { type: "text_editor_20250728", name: "str_replace_based_edit_tool" } as any,
    {
      name: "web_fetch",
      description: "Fetch content from a URL. Returns response body as text.",
      input_schema: {
        type: "object" as const,
        properties: {
          url: { type: "string", description: "URL to fetch" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          headers: { type: "object", description: "HTTP headers" },
          body: { type: "string", description: "Request body" },
        },
        required: ["url"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Fetch the open issues from the GitHub API for the repo octocat/Hello-World, then create a summary report at /tmp/issues-report.md",
    },
  ],
});
```

Claude will:
1. Use `web_fetch` to call `https://api.github.com/repos/octocat/Hello-World/issues`
2. Parse the JSON response
3. Use `text_editor` to create a summary report at `/tmp/issues-report.md`

---

## Local Skills

Local Skills bundle instructions, scripts, and resources into a reusable package — similar to Anthropic's container-based skills (see [Example 19](example-19-agent-skills.md)), but executed entirely on your machine. Instead of uploading to the Skills API, you inject the skill's instructions into the `system` prompt and Claude uses `bash`/`text_editor` to run the scripts locally.

### Anthropic Skills vs Local Skills

| Aspect | Anthropic Skills (Example 19) | Local Skills (this pattern) |
|--------|-------------------------------|----------------------------|
| **Where skills run** | Anthropic container | Your machine |
| **How skills load** | Upload via `/v1/skills` API | Read files, inject into `system` prompt |
| **Execution tool** | `code_execution_20250825` | `bash_20250124` + `text_editor_20250728` |
| **Beta required** | `skills-2025-10-02` | None |
| **Runtime** | Python 3.11 only | Any language/runtime you have |
| **Network access** | None | Full access |
| **Script paths** | `/skills/{name}/src/...` | Absolute local paths |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. SKILL LOADER (your code)                                      │
│     Read SKILL.md → inject into system prompt                     │
│     Read skill scripts → they stay on disk                        │
│                                                                   │
│  2. API CALL                                                      │
│     system: "You have access to the data-validator skill..."      │
│     tools: [bash]                                                 │
│     messages: [{ user: "Validate this CSV" }]                     │
│                                                                   │
│  3. CLAUDE RESPONDS                                               │
│     Uses bash to run: python /path/to/skills/data-validator/...   │
│                                                                   │
│  4. YOU EXECUTE on your machine → return tool_result              │
└─────────────────────────────────────────────────────────────────┘
```

### Local Skill Directory Structure

```
skills/
├── data-validator/
│   ├── SKILL.md              # Instructions for Claude
│   ├── src/
│   │   ├── validate.py       # Validation engine
│   │   └── report.py         # Report generator
│   └── schemas/
│       ├── customer.json     # Customer data schema
│       └── order.json        # Order data schema
│
└── test-runner/
    ├── SKILL.md              # Instructions for Claude
    └── src/
        └── run.sh            # Test runner script
```

### SKILL.md Format for Local Execution

The SKILL.md format is the same as Anthropic's container-based skills, but instructions reference **local paths** and tell Claude to use **bash** instead of `code_execution`.

````markdown
---
name: data-validator
description: Validate CSV, JSON, and Excel data against schemas. Use when the user wants to check data quality or enforce data contracts.
---

# Data Validator Skill

## When to Use
- User asks to validate, check, or audit a data file
- User wants to enforce a schema on data
- User needs a data quality report

## How to Execute
Run the validation script using bash:

```bash
python /home/user/skills/data-validator/src/validate.py \
  --input <data_file> \
  --schema /home/user/skills/data-validator/schemas/<schema>.json
```

## Available Scripts
- `src/validate.py` — Main validation engine. Args: `--input`, `--schema`, `--format` (csv|json|xlsx)
- `src/report.py` — Generate formatted report. Args: `--results` (JSON from validate.py)

## Schema Format
Schemas are JSON files in `schemas/`:

```json
{
  "columns": {
    "email": {"type": "string", "pattern": "^[^@]+@[^@]+$", "required": true},
    "age": {"type": "integer", "min": 0, "max": 150},
    "status": {"type": "string", "enum": ["active", "inactive"]}
  }
}
```

## Example Workflow
1. Run validation: `python .../validate.py --input /tmp/data.csv --schema .../schemas/customer.json`
2. If errors found, generate report: `python .../report.py --results <validation_output>`
3. Re-run validation to confirm fixes
````

### Skill Loader

The skill loader reads SKILL.md files and injects them into the `system` prompt.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic();
const SKILLS_DIR = "/home/user/skills";

// Load a single skill's SKILL.md content
function loadSkill(skillName: string): string {
  const skillPath = path.join(SKILLS_DIR, skillName, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill not found: ${skillPath}`);
  }
  return fs.readFileSync(skillPath, "utf-8");
}

// Build a system prompt from multiple skills
function buildSystemPrompt(skillNames: string[]): string {
  let prompt =
    "You have access to the following local skills. " +
    "Use bash to execute their scripts.\n\n";

  for (const name of skillNames) {
    prompt += "---\n\n";
    prompt += loadSkill(name) + "\n\n";
  }

  return prompt;
}

// Use the skill loader with the API
const systemPrompt = buildSystemPrompt(["data-validator", "test-runner"]);

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  system: systemPrompt,
  tools: [
    { type: "bash_20250124", name: "bash" } as any,
  ],
  messages: [
    {
      role: "user",
      content:
        "Validate the data in /tmp/customers.csv against the customer schema and generate a report.",
    },
  ],
});
```

### Claude Uses the Skill

Claude reads the injected SKILL.md instructions and calls bash to execute the scripts:

```json
{
  "content": [
    {
      "type": "text",
      "text": "I'll validate your customer data using the data-validator skill."
    },
    {
      "type": "tool_use",
      "id": "toolu_01AAA",
      "name": "bash",
      "input": {
        "command": "python /home/user/skills/data-validator/src/validate.py --input /tmp/customers.csv --schema /home/user/skills/data-validator/schemas/customer.json"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

You execute the command on your machine, return the output, and Claude continues — generating a report, fixing data, or whatever the task requires.

### Multi-Skill Loading

Load multiple skills into one system prompt for complex workflows:

```typescript
// Load data-validator + test-runner skills
const systemPrompt = buildSystemPrompt(["data-validator", "test-runner"]);

// Claude can now use both skills in one conversation
const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  system: systemPrompt,
  tools: [
    { type: "bash_20250124", name: "bash" } as any,
  ],
  messages: [
    {
      role: "user",
      content:
        "Validate /tmp/customers.csv, then run the test suite to make sure nothing is broken.",
    },
  ],
});
```

---

## Mixing Built-in + Custom Tools

You can combine Anthropic's built-in client tools with your own custom tools in a single request. Claude uses built-in tools for general operations and your custom tools for domain-specific tasks.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  tools: [
    { type: "bash_20250124", name: "bash" } as any,
    { type: "text_editor_20250728", name: "str_replace_based_edit_tool" } as any,
    {
      name: "deploy",
      description:
        "Deploy the application to the specified environment. Returns deployment status and URL.",
      input_schema: {
        type: "object" as const,
        properties: {
          environment: {
            type: "string",
            enum: ["staging", "production"],
          },
          version: {
            type: "string",
            description: "Git tag or commit hash to deploy",
          },
        },
        required: ["environment", "version"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Fix the bug in src/auth.py where the token validation is failing, run the tests, and if they pass, deploy to staging.",
    },
  ],
});
```

Claude will:
1. Use `text_editor` to read and fix `src/auth.py`
2. Use `bash` to run `pytest`
3. Use `deploy` (your custom tool) to deploy to staging

All executed on your machine, with your permissions, on your network.

---

## Complete Agentic Loop: Built-in + Custom Tools

A full working script that loops until Claude finishes the task, dispatching to built-in and custom tool executors.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic();

// Define all tools — built-in + custom
const tools: Anthropic.Tool[] = [
  { type: "bash_20250124", name: "bash" } as any,
  { type: "text_editor_20250728", name: "str_replace_based_edit_tool" } as any,
  {
    name: "run_tests",
    description: "Run tests for the project. Returns pass/fail results.",
    input_schema: {
      type: "object" as const,
      properties: {
        test_path: {
          type: "string",
          description: "Path to test file or directory",
        },
        framework: {
          type: "string",
          enum: ["pytest", "jest", "go_test"],
        },
      },
      required: ["test_path", "framework"],
    },
  },
];

// Execute a bash command locally
function executeBash(command: string): string {
  console.log(`[BASH] ${command}`);
  try {
    return execSync(command, {
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error: any) {
    return `${error.stderr || error.message}\nExit code: ${error.status}`;
  }
}

// Execute a text editor operation locally
function executeTextEditor(input: any): string {
  console.log(`[EDITOR] ${input.command}: ${input.path}`);
  switch (input.command) {
    case "create": {
      const dir = path.dirname(input.path);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(input.path, input.file_text || "");
      return `File created successfully at ${input.path}`;
    }
    case "view": {
      const content = fs.readFileSync(input.path, "utf-8");
      const lines = content.split("\n");
      const [start, end] = input.view_range || [1, lines.length];
      return lines
        .slice(start - 1, end)
        .map((line: string, i: number) => `${start + i}\t${line}`)
        .join("\n");
    }
    case "str_replace": {
      let content = fs.readFileSync(input.path, "utf-8");
      if (!content.includes(input.old_str)) {
        return `Error: old_str not found in ${input.path}`;
      }
      content = content.replace(input.old_str, input.new_str);
      fs.writeFileSync(input.path, content);
      return "Replacement successful";
    }
    case "insert": {
      const lines = fs.readFileSync(input.path, "utf-8").split("\n");
      lines.splice(input.insert_line - 1, 0, input.new_str);
      fs.writeFileSync(input.path, lines.join("\n"));
      return "Insert successful";
    }
    default:
      return `Unknown command: ${input.command}`;
  }
}

// Execute custom run_tests tool
function executeRunTests(input: any): string {
  console.log(`[TESTS] Running ${input.framework} on ${input.test_path}`);
  try {
    switch (input.framework) {
      case "pytest":
        return execSync(`python -m pytest ${input.test_path} -v`, {
          encoding: "utf-8",
          timeout: 60000,
        });
      case "jest":
        return execSync(`npx jest ${input.test_path}`, {
          encoding: "utf-8",
          timeout: 60000,
        });
      case "go_test":
        return execSync(`go test ${input.test_path} -v`, {
          encoding: "utf-8",
          timeout: 60000,
        });
      default:
        return `Unknown framework: ${input.framework}`;
    }
  } catch (error: any) {
    return `${error.stdout || ""}${error.stderr || error.message}\nExit code: ${error.status}`;
  }
}

// Dispatch tool calls to the right executor
function executeTool(name: string, input: any): string {
  switch (name) {
    case "bash":
      return executeBash(input.command);
    case "str_replace_based_edit_tool":
      return executeTextEditor(input);
    case "run_tests":
      return executeRunTests(input);
    default:
      return `Unknown tool: ${name}`;
  }
}

// Main agentic loop
async function runAgent(task: string) {
  const MAX_ITERATIONS = 15;
  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: task },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n=== Iteration ${i + 1} ===`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      tools,
      messages,
    });

    console.log("Stop reason:", response.stop_reason);

    // Print any text blocks
    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }

    // If done, exit the loop
    if (response.stop_reason !== "tool_use") {
      console.log("\n=== Task Complete ===");
      return;
    }

    // Add assistant response to conversation
    messages.push({ role: "assistant", content: response.content });

    // Execute each tool call and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = executeTool(block.name, block.input);

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    // Add tool results to conversation
    messages.push({ role: "user", content: toolResults });
  }

  console.log("Max iterations reached");
}

// Run it
runAgent(
  "Create a new Node.js project in /tmp/my-app with a package.json, " +
    "an index.ts that prints hello world, and run npm init -y."
);
```

---

## Safety and Sandboxing

> **WARNING**: The `bash_20250124` tool executes commands on YOUR machine with YOUR permissions. Unlike `code_execution_20250825`, there is no Anthropic-managed sandbox.

### Recommendations

1. **Run in a container**: Execute the agentic loop inside Docker to isolate filesystem access
2. **Use a restricted user**: Run the script as a non-root user with limited permissions
3. **Whitelist commands**: Validate commands before executing them
4. **Add approval prompts**: For destructive operations, ask for human confirmation

### Command Approval Example

```typescript
import * as readline from "readline/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const DANGEROUS_PATTERNS = /rm -rf|sudo|chmod 777|mkfs|dd if=/;
const APPROVAL_PATTERNS = /rm |mv |cp -r|pip install|npm install/;

async function executeBashSafe(command: string): Promise<string> {
  // Block dangerous patterns
  if (DANGEROUS_PATTERNS.test(command)) {
    return `Error: Command blocked by safety filter: ${command}`;
  }

  // Require approval for certain operations
  if (APPROVAL_PATTERNS.test(command)) {
    const answer = await rl.question(
      `\nAPPROVAL NEEDED: ${command}\nExecute? (y/n): `
    );
    if (answer.toLowerCase() !== "y") {
      return "Error: Command rejected by user";
    }
  }

  return executeBash(command);
}
```

See [Example 12: Human in the Loop](example-12-human-in-the-loop.md) for more approval patterns.

---

## Practical Use Cases

### Local Test Runner

Ask Claude to read test failures, fix the code, and re-run tests — all using bash + text_editor on your local machine:

```typescript
await runAgent(
  "Run the tests in /home/user/project with pytest. If any fail, " +
    "read the failing test and source file, fix the issue, and re-run " +
    "until all tests pass."
);
```

### Project Scaffolding

```typescript
await runAgent(
  "Create a new Express.js API project in /tmp/my-api with TypeScript, " +
    "ESLint, and a health check endpoint. Initialize git and create " +
    "an initial commit."
);
```

### Code Review Automation

```typescript
await runAgent(
  "Review the changes in the current git diff of /home/user/project. " +
    "Fix any issues you find (type errors, missing error handling, " +
    "style violations)."
);
```

### Database-Driven Bug Investigation

Combine bash, text_editor, and custom database tool:

```typescript
// Add query_database to your tools array, then:
await runAgent(
  "Users are reporting 500 errors on the /api/orders endpoint. " +
    "Check the last 100 lines of the error log, query the database " +
    "for recent failed orders, find the bug in the code, and fix it."
);
```

---

## Built-in Client Tools Reference

| Tool | Type Identifier | Beta Required | Token Overhead |
|------|----------------|---------------|----------------|
| Bash | `bash_20250124` | No | ~245 tokens |
| Text Editor | `text_editor_20250728` | No | ~700 tokens |

> **Note**: `text_editor_20250728` is for Claude 4.x models. Claude 3.7 uses `text_editor_20250124`.

---

## Best Practices

1. **Combine built-in + custom tools**: Use bash/text_editor for general operations and custom tools for domain-specific workflows.

2. **Keep custom tool descriptions clear**: Claude uses the `description` field to decide which tool to use. Be specific about what the tool does and when to use it.

3. **Validate all inputs**: Check bash commands and custom tool inputs before executing.

4. **Scope permissions tightly**: Custom tools should do one thing well. A `query_database` tool should only allow SELECT queries.

5. **Return helpful error messages**: Use `is_error: true` with descriptive messages so Claude can adjust its approach.

6. **Set execution timeouts**: Prevent runaway commands with timeouts on bash execution.

7. **Log all tool executions**: Keep an audit trail of what Claude requested and what was executed.

8. **Use the right tool for the job**: If you need isolated, sandboxed execution, use containers instead (see [Example 19](example-19-agent-skills.md) and [Example 22](example-22-virtual-file-system-container-sandbox.md)).

9. **Keep SKILL.md instructions focused**: Tell Claude exactly when to use the skill, what scripts are available, and what arguments they accept. The more specific, the better.

10. **Version local skills with git**: Track your skill directories in version control so you can share, roll back, and collaborate on skills across teams.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool fundamentals and all tool types
- [Example 12: Human in the Loop](example-12-human-in-the-loop.md) - Approval patterns for sensitive tools
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Multi-turn loop patterns
- [Example 17: Computer Use](example-17-computer-use.md) - Full computer use with bash + text_editor + computer
- [Example 19: Agent Skills](example-19-agent-skills.md) - Skills and code execution inside containers
- [Example 22: VFS, Container & Sandbox](example-22-virtual-file-system-container-sandbox.md) - Container architecture
