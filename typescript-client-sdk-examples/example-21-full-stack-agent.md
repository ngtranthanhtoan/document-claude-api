# Example 21: Full-Stack Autonomous Agent

> Build a comprehensive agent that combines all of Claude's advanced tools — web search, web fetch, bash, text editor, code execution, tool search, skills, computer use, programmatic tool control, and fine-grained streaming — into a single orchestrated workflow.

## Overview

- **Difficulty**: Expert
- **Features Used**: Bash Tool, Text Editor Tool, Web Search, Web Fetch, Tool Search, Code Execution, Agent Skills, Computer Use, Programmatic Tool Calling, Fine-Grained Tool Streaming
- **SDK Methods**: `client.beta.messages.create()`, `client.messages.stream()`, `client.beta.files.retrieve()`
- **Beta**: `code-execution-2025-08-25`, `skills-2025-10-02`, `web-fetch-2025-09-10`, `advanced-tool-use-2025-11-20`, `computer-use-2025-01-24`
- **Use Cases**:
  - Competitive intelligence report generation
  - Automated research pipelines
  - End-to-end deliverable creation (report + spreadsheet + slides)
  - Multi-tool orchestration with phased execution

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable
- Docker with desktop environment (for computer use phase)
- Understanding of:
  - [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md)
  - [Example 17: Computer Use](example-17-computer-use.md)
  - [Example 19: Agent Skills](example-19-agent-skills.md)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                Full-Stack Autonomous Agent                       │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1: Research     │  web_search + web_fetch                │
│  Phase 2: Analysis     │  bash + code_execution                 │
│  Phase 3: Writing      │  text_editor + bash                    │
│  Phase 4: Discovery    │  tool_search (regex/BM25)              │
│  Phase 5: Deliverables │  skills (xlsx, pptx) + code_execution  │
│  Phase 6: Visual QA    │  computer_use (desktop)                │
├─────────────────────────────────────────────────────────────────┤
│  Cross-Cutting:                                                  │
│  ├── Programmatic Tool Control (tool_choice, parallel control)  │
│  └── Fine-Grained Streaming (eager_input_streaming)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tools Reference

| Tool | Type String | Beta Header | Token Overhead |
|------|-----------|-------------|----------------|
| Bash | `bash_20250124` | None | ~245 |
| Text Editor | `text_editor_20250728` | None | ~700 |
| Web Search | `web_search_20250305` | None | Minimal |
| Web Fetch | `web_fetch_20250910` | `web-fetch-2025-09-10` | Minimal |
| Code Execution | `code_execution_20250825` | `code-execution-2025-08-25` | Variable |
| Tool Search | `tool_search_tool_regex_20251119` | `advanced-tool-use-2025-11-20` | Variable |
| Skills | Container config | `skills-2025-10-02` | Variable |
| Computer Use | `computer_20241022` | `computer-use-2025-01-24` | ~800 |

**Key insight**: Sending all tools in every request adds ~2,500+ tokens of overhead. Use **phase-based tool rotation** to keep costs manageable.

---

## TypeScript Interfaces

```typescript
import Anthropic from "@anthropic-ai/sdk";

// Phase configuration
interface AgentPhase {
  name: string;
  betas: string[];
  tools: Anthropic.Messages.Tool[];
  maxIterations: number;
  toolChoice?: Anthropic.Messages.ToolChoice;
  disableParallelToolUse?: boolean;
  container?: {
    id?: string;
    skills?: Array<{ type: string; skill_id: string; version: string }>;
  };
}

// Result of a completed phase
interface PhaseResult {
  messages: Anthropic.Messages.MessageParam[];
  containerId?: string;
  fileIds: string[];
}

// Computer use action types
interface ComputerAction {
  action: "mouse_move" | "left_click" | "right_click" | "double_click" | "type" | "key" | "screenshot" | "scroll";
  coordinate?: [number, number];
  text?: string;
  key?: string;
  direction?: "up" | "down";
  amount?: number;
}

// Tool search result
interface ToolSearchResult {
  tool_references: Array<{ type: string; tool_name: string }>;
}
```

---

## Combining Multiple Beta Headers

When using tools across multiple betas, pass them as an array to the SDK:

```typescript
const client = new Anthropic();

// Each phase only needs the betas relevant to its tools
const allBetas = [
  "code-execution-2025-08-25",
  "skills-2025-10-02",
  "web-fetch-2025-09-10",
  "advanced-tool-use-2025-11-20",
  "computer-use-2025-01-24",
];

// Phase 1 only needs web-fetch
const phase1Betas = ["web-fetch-2025-09-10"];

// Phase 5 needs code-execution + skills
const phase5Betas = ["code-execution-2025-08-25", "skills-2025-10-02"];
```

---

## Phase 1: Web Research (web_search + web_fetch)

Search the web for information, then fetch full articles for deep analysis.

### Request

```typescript
const client = new Anthropic();

const response = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["web-fetch-2025-09-10"],
  tool_choice: { type: "tool", name: "web_search" },
  tools: [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5,
    },
    {
      type: "web_fetch_20250910",
      name: "web_fetch",
      max_uses: 3,
      max_content_tokens: 50000,
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Research the competitive landscape of AI coding assistants. Find recent news, market data, and key players.",
    },
  ],
});
```

### Response (Web Search)

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "I'll research the AI coding assistant market."
    },
    {
      "type": "tool_use",
      "id": "toolu_01A",
      "name": "web_search",
      "input": { "query": "AI coding assistants market share 2025" }
    }
  ]
}
```

### Web Search Result

The web search tool returns special content blocks:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01A",
  "content": [
    {
      "type": "web_search_tool_result",
      "content": [
        {
          "type": "web_search_result",
          "url": "https://example.com/ai-coding-report",
          "title": "AI Coding Assistants Market Report 2025",
          "page_age": "2 days ago",
          "encrypted_content": "..."
        }
      ]
    }
  ]
}
```

### Web Fetch Follow-Up

After finding relevant URLs, Claude fetches full content:

```json
{
  "type": "tool_use",
  "id": "toolu_01B",
  "name": "web_fetch",
  "input": { "url": "https://example.com/ai-coding-report" }
}
```

### Web Fetch Result

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01B",
  "content": [
    {
      "type": "web_fetch_tool_result",
      "content": {
        "type": "web_fetch_result",
        "url": "https://example.com/ai-coding-report",
        "content": {
          "type": "document",
          "source": {
            "type": "text",
            "media_type": "text/plain",
            "data": "Full article text content..."
          },
          "title": "AI Coding Assistants Market Report 2025"
        },
        "retrieved_at": "2025-06-15T10:30:00Z"
      }
    }
  ]
}
```

---

## Phase 2: Data Analysis (bash + code_execution)

Use bash to set up a workspace, then code execution for analysis.

### Request

```typescript
const response = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25"],
  tools: [
    { type: "bash_20250124", name: "bash" },
    { type: "code_execution_20250825", name: "code_execution" },
  ],
  messages: [
    {
      role: "user",
      content:
        "Set up a workspace directory, then analyze this market data and generate a chart:\n\nGitHub Copilot: 45% share, $400M revenue\nCursor: 20% share, $100M revenue\nTabnine: 10% share, $50M revenue\nAmazon CodeWhisperer: 8% share, $35M revenue\nOthers: 17% share, $85M revenue",
    },
  ],
});
```

### Response (Bash → Code Execution)

Claude first uses bash to set up workspace, then code execution for data analysis:

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_02B",
      "name": "code_execution",
      "input": {
        "code": "import matplotlib.pyplot as plt\nimport json\n\ndata = {\n    'GitHub Copilot': {'share': 45, 'revenue': 400},\n    'Cursor': {'share': 20, 'revenue': 100},\n    'Tabnine': {'share': 10, 'revenue': 50},\n    'CodeWhisperer': {'share': 8, 'revenue': 35},\n    'Others': {'share': 17, 'revenue': 85}\n}\n\nfig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))\nax1.pie([d['share'] for d in data.values()], labels=data.keys(), autopct='%1.0f%%')\nax1.set_title('Market Share')\nax2.bar(data.keys(), [d['revenue'] for d in data.values()])\nax2.set_ylabel('Revenue ($M)')\nax2.set_title('Revenue by Company')\nplt.tight_layout()\nplt.savefig('/tmp/market_chart.png', dpi=150)\nprint('Chart saved')"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

### Code Execution Result

```json
{
  "type": "bash_code_execution_tool_result",
  "content": {
    "type": "bash_code_execution_result",
    "stdout": "Chart saved",
    "stderr": "",
    "return_code": 0,
    "content": [
      {
        "type": "file",
        "file_id": "file_chart_01",
        "filename": "market_chart.png"
      }
    ]
  }
}
```

---

## Phase 3: Report Writing (text_editor)

Create and iteratively refine a report document.

### Create Initial Report

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  tools: [
    { type: "text_editor_20250728", name: "text_editor" },
    { type: "bash_20250124", name: "bash" },
  ],
  messages: [
    {
      role: "user",
      content: "Create a competitive intelligence report at /tmp/agent_workspace/report.md. Include an executive summary, market data table, key findings, and recommendations.",
    },
  ],
});
```

### Text Editor Actions

Claude will use the text editor with `create`, `str_replace`, and `view` commands:

```json
{
  "type": "tool_use",
  "name": "text_editor",
  "input": {
    "command": "create",
    "path": "/tmp/agent_workspace/report.md",
    "file_text": "# AI Coding Assistants: Competitive Intelligence Report\n\n## Executive Summary\n..."
  }
}
```

Then iteratively refine:

```json
{
  "type": "tool_use",
  "name": "text_editor",
  "input": {
    "command": "str_replace",
    "path": "/tmp/agent_workspace/report.md",
    "old_str": "## Key Findings\n\nTBD",
    "new_str": "## Key Findings\n\n1. **Market concentration**: GitHub Copilot dominates with 45% share\n2. **Rapid growth**: Total market grew 85% YoY"
  }
}
```

---

## Phase 4: Tool Discovery (tool_search)

When the agent encounters a subtask requiring specialized tools, it can search a large catalog dynamically.

### Setup: Large Tool Catalog with Deferred Loading

```typescript
const response = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["advanced-tool-use-2025-11-20"],
  tools: [
    {
      type: "tool_search_tool_regex_20251119",
      name: "tool_search",
    },
    {
      name: "convert_currency",
      description: "Convert between currencies using live exchange rates",
      input_schema: {
        type: "object" as const,
        properties: {
          amount: { type: "number" },
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["amount", "from", "to"],
      },
      defer_loading: true,
    },
    {
      name: "get_stock_price",
      description: "Get current stock price by ticker symbol",
      input_schema: {
        type: "object" as const,
        properties: { ticker: { type: "string" } },
        required: ["ticker"],
      },
      defer_loading: true,
    },
    {
      name: "calculate_cagr",
      description: "Calculate compound annual growth rate",
      input_schema: {
        type: "object" as const,
        properties: {
          start_value: { type: "number" },
          end_value: { type: "number" },
          years: { type: "number" },
        },
        required: ["start_value", "end_value", "years"],
      },
      defer_loading: true,
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "I need to convert the revenue figures to EUR and calculate the 3-year CAGR. Search for the right tools.",
    },
  ],
});
```

### Tool Search Result

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_04A",
  "content": [
    {
      "type": "tool_search_tool_result",
      "content": {
        "type": "tool_search_tool_search_result",
        "tool_references": [
          { "type": "tool_reference", "tool_name": "convert_currency" },
          { "type": "tool_reference", "tool_name": "calculate_cagr" }
        ]
      }
    }
  ]
}
```

After discovering tools, Claude can use them in subsequent turns.

---

## Phase 5: Deliverable Generation (skills + code_execution)

Generate polished Excel and PowerPoint files using container skills.

### Request

```typescript
const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 8192,
  betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
  container: {
    skills: [
      { type: "anthropic", skill_id: "xlsx", version: "latest" },
      { type: "anthropic", skill_id: "pptx", version: "latest" },
    ],
  },
  tools: [
    { type: "code_execution_20250825", name: "code_execution" },
  ],
  messages: [
    {
      role: "user",
      content:
        "Based on this research data, create:\n1) An Excel financial model with market size projections and charts\n2) A 5-slide executive summary PowerPoint\n\nData: Total market $670M, leader GitHub Copilot at 45%, growth rate 85% YoY.",
    },
  ],
});
```

### Handling pause_turn

Skills may need multiple turns for complex generation:

```typescript
async function runWithPauseTurn(
  messages: Anthropic.Messages.MessageParam[],
  skills: Array<{ type: string; skill_id: string; version: string }>,
  containerId?: string
): Promise<Anthropic.Messages.Message> {
  const MAX_RETRIES = 10;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 8192,
      betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
      container: {
        ...(containerId ? { id: containerId } : {}),
        skills,
      },
      tools: [
        { type: "code_execution_20250825", name: "code_execution" },
      ],
      messages,
    });

    containerId = response.container?.id;
    console.log(`Turn ${i + 1}: stop_reason = ${response.stop_reason}`);

    if (response.stop_reason !== "pause_turn") {
      return response;
    }

    // Continue with the partial response
    messages = [
      ...messages,
      { role: "assistant", content: response.content },
    ];
  }

  throw new Error("Max retries exceeded for pause_turn");
}
```

### Downloading Generated Files

```typescript
import * as fs from "fs";

// Extract file IDs from response content
function extractFileIds(content: Anthropic.Messages.ContentBlock[]): string[] {
  const fileIds: string[] = [];
  for (const block of content) {
    if (block.type === "bash_code_execution_tool_result") {
      const items = (block as any).content?.content;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.file_id) fileIds.push(item.file_id);
        }
      }
    }
  }
  return fileIds;
}

// Download a generated file
async function downloadFile(fileId: string, outputPath: string) {
  const fileResponse = await client.beta.files.retrieveContent(fileId, {
    betas: ["files-api-2025-04-14"],
  });
  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`Downloaded: ${outputPath} (${buffer.length} bytes)`);
}
```

---

## Phase 6: Visual QA (computer_use)

Open generated files in a desktop application to verify they look correct.

### Request

```typescript
import { execSync } from "child_process";

// Take a screenshot (in Docker/VM with xdotool + scrot)
function takeScreenshot(): string {
  execSync("scrot -o /tmp/screenshot.png");
  return execSync("base64 -i /tmp/screenshot.png").toString().replace(/\n/g, "");
}

const screenshot = takeScreenshot();

const response = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["computer-use-2025-01-24"],
  tools: [
    {
      type: "computer_20241022",
      name: "computer",
      display_width_px: 1920,
      display_height_px: 1080,
      display_number: 0,
    },
  ],
  disable_parallel_tool_use: true,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Open the generated report.xlsx file in LibreOffice to verify the charts rendered correctly. Take a screenshot and report any issues.",
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: screenshot,
          },
        },
      ],
    },
  ],
});
```

### Executing Computer Actions

```typescript
function executeComputerAction(input: ComputerAction): void {
  switch (input.action) {
    case "mouse_move":
      execSync(`xdotool mousemove ${input.coordinate![0]} ${input.coordinate![1]}`);
      break;
    case "left_click":
      execSync("xdotool click 1");
      break;
    case "right_click":
      execSync("xdotool click 3");
      break;
    case "double_click":
      execSync("xdotool click --repeat 2 --delay 100 1");
      break;
    case "type":
      execSync(`xdotool type --delay 50 "${input.text}"`);
      break;
    case "key":
      execSync(`xdotool key "${input.key}"`);
      break;
    case "scroll": {
      const button = input.direction === "down" ? 5 : 4;
      execSync(`xdotool click --repeat ${input.amount ?? 3} ${button}`);
      break;
    }
    case "screenshot":
      break; // Screenshot taken automatically after each action
  }
}
```

---

## Programmatic Tool Control

### tool_choice: Force a Specific Tool

Force the agent to start with web search before doing anything else:

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  tool_choice: { type: "tool", name: "web_search" },
  tools: [
    { type: "web_search_20250305", name: "web_search" },
    { type: "web_fetch_20250910", name: "web_fetch" },
  ],
  messages: [{ role: "user", content: "Research AI market trends" }],
});
```

### tool_choice Modes

| Mode | Behavior |
|------|----------|
| `{ type: "auto" }` | Claude decides (default when tools present) |
| `{ type: "any" }` | Must use at least one tool |
| `{ type: "tool", name: "X" }` | Must use the specified tool |
| `{ type: "none" }` | Cannot use any tools |

### disable_parallel_tool_use

Prevent Claude from calling multiple tools simultaneously. Critical for computer use (actions must be sequential):

```typescript
const response = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["computer-use-2025-01-24"],
  disable_parallel_tool_use: true,
  tools: [
    {
      type: "computer_20241022",
      name: "computer",
      display_width_px: 1920,
      display_height_px: 1080,
    },
  ],
  messages: [{ role: "user", content: "Click the submit button" }],
});
```

### allowed_callers

Control which tools can be invoked programmatically by code execution vs. directly by Claude:

```typescript
const response = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "advanced-tool-use-2025-11-20"],
  tools: [
    { type: "code_execution_20250825", name: "code_execution" },
    {
      name: "query_database",
      description: "Execute a SQL query",
      input_schema: {
        type: "object" as const,
        properties: { query: { type: "string" } },
        required: ["query"],
      },
      // Only code execution can call this tool
      allowed_callers: ["code_execution_20250825"],
    },
    {
      name: "send_alert",
      description: "Send an alert notification",
      input_schema: {
        type: "object" as const,
        properties: { message: { type: "string" } },
        required: ["message"],
      },
      // Only Claude can call this directly
      allowed_callers: ["direct"],
    },
  ],
  messages: [
    {
      role: "user",
      content: "Query the database for user counts and alert me if there are anomalies",
    },
  ],
});
```

### Tool Use Response with Caller Info

```json
{
  "type": "tool_use",
  "id": "toolu_07A",
  "name": "query_database",
  "input": { "query": "SELECT COUNT(*) FROM users" },
  "caller": {
    "type": "code_execution_20250825",
    "tool_id": "srvtoolu_01ABC"
  }
}
```

---

## Fine-Grained Tool Streaming

Enable real-time streaming of tool inputs as they are generated, before the complete JSON is available.

### Enable eager_input_streaming

```typescript
const stream = client.messages.stream({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  tools: [
    {
      type: "bash_20250124",
      name: "bash",
      eager_input_streaming: true,
    },
    {
      type: "text_editor_20250728",
      name: "text_editor",
      eager_input_streaming: true,
    },
  ],
  messages: [
    {
      role: "user",
      content: "Create a Python script that generates a market analysis report",
    },
  ],
});
```

### Streaming Event Handlers

```typescript
// Track which tool is currently being used
let currentTool = "";

stream.on("contentBlockStart", (event) => {
  if (event.content_block.type === "tool_use") {
    currentTool = event.content_block.name;
    console.log(`\n[Tool: ${currentTool}]`);
  }
});

stream.on("inputJson", (event, snapshot) => {
  // event.partial_json contains the delta
  // snapshot contains the accumulated JSON so far
  process.stdout.write(event.partial_json);
});

stream.on("text", (text) => {
  process.stdout.write(text);
});

stream.on("contentBlockStop", () => {
  console.log("\n");
});

const finalMessage = await stream.finalMessage();
```

### Streaming with Tool Execution Loop

```typescript
async function streamWithTools(
  messages: Anthropic.Messages.MessageParam[]
): Promise<Anthropic.Messages.Message> {
  while (true) {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      tools: [
        {
          type: "text_editor_20250728",
          name: "text_editor",
          eager_input_streaming: true,
        },
        {
          type: "bash_20250124",
          name: "bash",
          eager_input_streaming: true,
        },
      ],
      messages,
    });

    // Show real-time streaming output
    stream.on("text", (text) => process.stdout.write(text));
    stream.on("inputJson", (event) =>
      process.stdout.write(event.partial_json)
    );

    const response = await stream.finalMessage();

    if (response.stop_reason === "end_turn") {
      return response;
    }

    // Execute tools and continue
    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = executeLocalTool(block.name, block.input);
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
```

---

## Complete Implementation

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import { execSync } from "child_process";

const client = new Anthropic();

// Configuration
const MODEL = "claude-sonnet-4-5-20250514";
const WORKSPACE = "/tmp/fullstack_agent_workspace";
const MAX_ITERATIONS = 10;

// --- Interfaces ---

interface AgentPhase {
  name: string;
  betas: string[];
  tools: any[];
  maxIterations: number;
  toolChoice?: any;
  disableParallelToolUse?: boolean;
  container?: any;
}

interface PhaseResult {
  messages: Anthropic.Messages.MessageParam[];
  containerId?: string;
  fileIds: string[];
}

// --- Local Tool Execution ---

function executeLocalTool(name: string, input: any): string {
  switch (name) {
    case "bash": {
      try {
        return execSync(input.command, {
          encoding: "utf-8",
          timeout: 30000,
          cwd: WORKSPACE,
        });
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    }
    case "text_editor": {
      const filePath = input.path;
      switch (input.command) {
        case "create":
          fs.mkdirSync(
            filePath.substring(0, filePath.lastIndexOf("/")),
            { recursive: true }
          );
          fs.writeFileSync(filePath, input.file_text);
          return `File created: ${filePath}`;
        case "view":
          return fs.existsSync(filePath)
            ? fs.readFileSync(filePath, "utf-8")
            : `Error: File not found: ${filePath}`;
        case "str_replace": {
          const content = fs.readFileSync(filePath, "utf-8");
          fs.writeFileSync(
            filePath,
            content.replace(input.old_str, input.new_str)
          );
          return `Replaced in ${filePath}`;
        }
        case "insert": {
          const lines = fs.readFileSync(filePath, "utf-8").split("\n");
          lines.splice(input.insert_line, 0, input.new_str);
          fs.writeFileSync(filePath, lines.join("\n"));
          return `Inserted at line ${input.insert_line} in ${filePath}`;
        }
        default:
          return `Unknown editor command: ${input.command}`;
      }
    }
    default:
      return `Tool ${name} executed (mock)`;
  }
}

function executeComputerAction(input: any): void {
  switch (input.action) {
    case "mouse_move":
      execSync(
        `xdotool mousemove ${input.coordinate[0]} ${input.coordinate[1]}`
      );
      break;
    case "left_click":
      execSync("xdotool click 1");
      break;
    case "right_click":
      execSync("xdotool click 3");
      break;
    case "double_click":
      execSync("xdotool click --repeat 2 --delay 100 1");
      break;
    case "type":
      execSync(`xdotool type --delay 50 "${input.text}"`);
      break;
    case "key":
      execSync(`xdotool key "${input.key}"`);
      break;
    case "scroll": {
      const btn = input.direction === "down" ? 5 : 4;
      execSync(`xdotool click --repeat ${input.amount ?? 3} ${btn}`);
      break;
    }
    case "screenshot":
      break;
  }
}

function takeScreenshot(): string {
  execSync("scrot -o /tmp/screenshot.png");
  return execSync("base64 -i /tmp/screenshot.png")
    .toString()
    .replace(/\n/g, "");
}

function extractFileIds(
  content: Anthropic.Messages.ContentBlock[]
): string[] {
  const ids: string[] = [];
  for (const block of content) {
    if (block.type === "bash_code_execution_tool_result") {
      const items = (block as any).content?.content;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.file_id) ids.push(item.file_id);
        }
      }
    }
  }
  return ids;
}

// --- Phase Runner ---

async function runPhase(
  phase: AgentPhase,
  systemPrompt: string,
  messages: Anthropic.Messages.MessageParam[]
): Promise<PhaseResult> {
  console.log(`\n=== Phase: ${phase.name} ===`);
  const fileIds: string[] = [];
  let containerId = phase.container?.id;

  for (let i = 0; i < phase.maxIterations; i++) {
    const requestParams: any = {
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      tools: phase.tools,
      messages,
    };

    if (phase.toolChoice) requestParams.tool_choice = phase.toolChoice;
    if (phase.disableParallelToolUse)
      requestParams.disable_parallel_tool_use = true;
    if (phase.container) {
      requestParams.container = {
        ...(containerId ? { id: containerId } : {}),
        ...phase.container,
      };
      // Remove id from container if we already set it
      if (containerId) requestParams.container.id = containerId;
    }

    const response =
      phase.betas.length > 0
        ? await client.beta.messages.create({
            ...requestParams,
            betas: phase.betas,
          })
        : await client.messages.create(requestParams);

    // Track container ID
    if ((response as any).container?.id) {
      containerId = (response as any).container.id;
    }

    // Collect file IDs
    fileIds.push(...extractFileIds(response.content));

    // Print text output
    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }

    if (response.stop_reason === "end_turn") {
      console.log(`  Phase "${phase.name}" complete (turn ${i + 1})`);
      messages.push({ role: "assistant", content: response.content });
      return { messages, containerId, fileIds };
    }

    // Handle tool calls
    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`  -> ${block.name}`);

        if (block.name === "computer") {
          // Computer use: execute action and return screenshot
          executeComputerAction(block.input);
          await new Promise((r) => setTimeout(r, 500));
          const img = takeScreenshot();
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: img,
                },
              },
            ],
          });
        } else if (
          block.name === "web_search" ||
          block.name === "web_fetch" ||
          block.name === "code_execution" ||
          block.name === "tool_search"
        ) {
          // Server-side tools: result comes from the API (handled automatically)
          // In a real implementation, server-side tool results are included
          // in the response. This branch is a placeholder.
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: "Server-side tool result handled by API",
          });
        } else {
          // Local tools: bash, text_editor, custom tools
          const result = executeLocalTool(block.name, block.input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }
    }

    messages.push({ role: "user", content: toolResults });

    // Handle pause_turn (skills)
    if (response.stop_reason === "pause_turn") {
      console.log("  (pause_turn - continuing...)");
    }
  }

  console.log(`  Phase "${phase.name}" hit max iterations`);
  return { messages, containerId, fileIds };
}

// --- Main Orchestration ---

async function main() {
  // Initialize workspace
  fs.mkdirSync(WORKSPACE, { recursive: true });
  console.log(`Workspace: ${WORKSPACE}`);

  const systemPrompt =
    "You are a competitive intelligence analyst. Use the provided tools to research, analyze, and generate a comprehensive report with deliverables.";

  const task =
    "Research the competitive landscape of AI coding assistants. Produce: 1) A markdown report with market data, 2) An Excel financial model, 3) A PowerPoint executive summary.";

  let messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: task },
  ];

  const allFileIds: string[] = [];

  // Phase 1: Web Research
  const phase1Result = await runPhase(
    {
      name: "Web Research",
      betas: ["web-fetch-2025-09-10"],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
        {
          type: "web_fetch_20250910",
          name: "web_fetch",
          max_uses: 3,
        },
      ],
      maxIterations: MAX_ITERATIONS,
      toolChoice: { type: "tool", name: "web_search" },
    },
    systemPrompt,
    messages
  );
  messages = phase1Result.messages;

  // Phase 2: Data Analysis
  const phase2Result = await runPhase(
    {
      name: "Data Analysis",
      betas: ["code-execution-2025-08-25"],
      tools: [
        { type: "bash_20250124", name: "bash" },
        { type: "code_execution_20250825", name: "code_execution" },
      ],
      maxIterations: MAX_ITERATIONS,
    },
    systemPrompt,
    messages
  );
  messages = phase2Result.messages;
  allFileIds.push(...phase2Result.fileIds);

  // Phase 3: Report Writing
  const phase3Result = await runPhase(
    {
      name: "Report Writing",
      betas: [],
      tools: [
        { type: "text_editor_20250728", name: "text_editor" },
        { type: "bash_20250124", name: "bash" },
      ],
      maxIterations: MAX_ITERATIONS,
    },
    systemPrompt,
    messages
  );
  messages = phase3Result.messages;

  // Phase 4: Tool Discovery
  const phase4Result = await runPhase(
    {
      name: "Tool Discovery",
      betas: ["advanced-tool-use-2025-11-20"],
      tools: [
        {
          type: "tool_search_tool_regex_20251119",
          name: "tool_search",
        },
        {
          name: "convert_currency",
          description: "Convert between currencies",
          input_schema: {
            type: "object" as const,
            properties: {
              amount: { type: "number" },
              from: { type: "string" },
              to: { type: "string" },
            },
            required: ["amount", "from", "to"],
          },
          defer_loading: true,
        },
      ],
      maxIterations: MAX_ITERATIONS,
    },
    systemPrompt,
    messages
  );
  messages = phase4Result.messages;

  // Phase 5: Deliverables (Skills)
  const phase5Result = await runPhase(
    {
      name: "Deliverables",
      betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
      tools: [
        { type: "code_execution_20250825", name: "code_execution" },
      ],
      maxIterations: MAX_ITERATIONS,
      container: {
        skills: [
          { type: "anthropic", skill_id: "xlsx", version: "latest" },
          { type: "anthropic", skill_id: "pptx", version: "latest" },
        ],
      },
    },
    systemPrompt,
    messages
  );
  messages = phase5Result.messages;
  allFileIds.push(...phase5Result.fileIds);

  // Phase 6: Visual QA (Docker/VM only)
  if (process.env.ENABLE_COMPUTER_USE === "true") {
    const screenshot = takeScreenshot();
    // Add screenshot to the last user message for context
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: "Open and verify the generated files visually.",
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: screenshot,
          },
        },
      ],
    });

    await runPhase(
      {
        name: "Visual QA",
        betas: ["computer-use-2025-01-24"],
        tools: [
          {
            type: "computer_20241022",
            name: "computer",
            display_width_px: 1920,
            display_height_px: 1080,
            display_number: 0,
          },
        ],
        maxIterations: 5,
        disableParallelToolUse: true,
      },
      systemPrompt,
      messages
    );
  }

  // Download generated files
  console.log("\n=== Downloading Files ===");
  for (const fileId of allFileIds) {
    try {
      const metadata = await client.beta.files.retrieve(fileId, {
        betas: ["files-api-2025-04-14"],
      });
      const fileResponse = await client.beta.files.retrieveContent(
        fileId,
        { betas: ["files-api-2025-04-14"] }
      );
      const buffer = Buffer.from(await fileResponse.arrayBuffer());
      const outputPath = `${WORKSPACE}/${metadata.filename}`;
      fs.writeFileSync(outputPath, buffer);
      console.log(
        `Downloaded: ${metadata.filename} (${buffer.length} bytes)`
      );
    } catch (err) {
      console.error(`Failed to download file ${fileId}:`, err);
    }
  }

  console.log("\n=== Agent Complete ===");
  console.log(`Workspace: ${WORKSPACE}`);
  console.log("Files:", fs.readdirSync(WORKSPACE).join(", "));
}

main().catch(console.error);
```

---

## Cost and Performance

| Tool | Token Overhead | Per-Use Cost |
|------|---------------|--------------|
| Bash | ~245 tokens | Standard token pricing |
| Text Editor | ~700 tokens | Standard token pricing |
| Web Search | Minimal | $10 per 1,000 searches |
| Web Fetch | Minimal | Standard token pricing |
| Code Execution | Variable | $0.05/hr container time |
| Tool Search | Variable | Standard token pricing |
| Computer Use | ~800 tokens | Standard + image tokens |
| Skills | Variable | Container time |

**Tip**: By phasing tools instead of sending all at once, you avoid ~2,500 tokens of overhead on every request.

---

## Best Practices

1. **Phase Your Tool Availability**: Rotate tools by phase to reduce token overhead and improve agent focus.

2. **Combine Beta Headers Carefully**: Pass all required betas as an array. An invalid beta name causes an error.

3. **Use `disable_parallel_tool_use` for Computer Use**: Desktop actions must execute sequentially.

4. **Handle `pause_turn` for Skills**: Code execution and skills may require multiple turns — keep looping.

5. **Stream Tool Inputs with `eager_input_streaming`**: For long tool inputs (large file edits), enable streaming to show real-time progress.

6. **Set Iteration Limits Per Phase**: Research might need 10 iterations, but computer-use QA might need only 5.

7. **Use `tool_choice` to Bootstrap Phases**: Force the agent to start with `web_search` in the research phase.

8. **Isolate Computer Use**: Always run in Docker/VM. Never on a production machine.

9. **Log Token Usage Per Phase**: Track `response.usage.input_tokens` and `response.usage.output_tokens` from each response.

10. **Pin Skill Versions in Production**: Use specific version strings instead of `"latest"`.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Foundation: basic autonomous agents
- [Example 14: Research Agent](example-14-research-agent.md) - Web search and research patterns
- [Example 15: Coding Assistant](example-15-coding-assistant.md) - Streaming + tool use + code execution
- [Example 17: Computer Use](example-17-computer-use.md) - Desktop automation
- [Example 19: Agent Skills](example-19-agent-skills.md) - Document generation with skills
- [Example 20: Deep Agent](example-20-deep-agent.md) - Multi-agent orchestration and planning
