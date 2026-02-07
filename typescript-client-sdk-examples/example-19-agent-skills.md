# Example 19: Agent Skills

> Extend Claude's capabilities with modular skills for document generation (Excel, PowerPoint, Word, PDF).

## Overview

- **Difficulty**: Expert
- **Features Used**: Agent Skills, Code Execution Tool, Files API
- **SDK Methods**: `client.beta.messages.create()`, `client.beta.files.retrieve()`
- **Beta**: `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`
- **Use Cases**:
  - Spreadsheet creation and analysis
  - Presentation building
  - Document generation
  - Financial modeling
  - Report automation

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable

---

## What are Agent Skills?

Agent Skills are modular capabilities that extend Claude's functionality. Each skill packages instructions, metadata, and optional resources that Claude uses automatically when relevant.

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Skills                             │
├─────────────────────────────────────────────────────────────┤
│  Pre-built Skills (Anthropic)                                │
│  ├── pptx (PowerPoint)    │  xlsx (Excel)                   │
│  ├── docx (Word)          │  pdf (PDF)                      │
├─────────────────────────────────────────────────────────────┤
│  Custom Skills (Your own)                                    │
│  ├── SKILL.md file with instructions                        │
│  ├── Scripts and resources                                  │
│  └── Uploaded via /v1/skills API                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Pre-built Skills

| Skill ID | Description |
|----------|-------------|
| `pptx` | Create and edit PowerPoint presentations |
| `xlsx` | Create spreadsheets, analyze data, generate charts |
| `docx` | Create and format Word documents |
| `pdf` | Generate formatted PDF documents |

---

## Basic Usage: Create an Excel File

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
  container: {
    skills: [
      {
        type: "anthropic",
        skill_id: "xlsx",
        version: "latest",
      },
    ],
  },
  tools: [
    {
      type: "code_execution_20250825",
      name: "code_execution",
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Create an Excel file with a monthly budget spreadsheet. Include columns for category, budgeted amount, actual amount, and difference.",
    },
  ],
});

console.log(message.content);
console.log("Container ID:", message.container?.id);
```

### Response

```json
{
  "id": "msg_01ABC",
  "content": [
    {
      "type": "text",
      "text": "I've created a monthly budget spreadsheet for you."
    },
    {
      "type": "bash_code_execution_tool_result",
      "content": {
        "type": "bash_code_execution_result",
        "content": [
          {
            "type": "file",
            "file_id": "file_01XYZ123",
            "filename": "monthly_budget.xlsx"
          }
        ]
      }
    }
  ],
  "container": {
    "id": "container_01ABC"
  },
  "stop_reason": "end_turn"
}
```

---

## Downloading Generated Files

Files created by skills must be downloaded via the Files API.

### Step 1: Get File Metadata

```typescript
const fileMetadata = await client.beta.files.retrieve("file_01XYZ123", {
  betas: ["files-api-2025-04-14"],
});

console.log("Filename:", fileMetadata.filename);
console.log("Size:", fileMetadata.size_bytes, "bytes");
```

### Step 2: Download File Content

```typescript
import * as fs from "fs";

const response = await client.beta.files.retrieveContent("file_01XYZ123", {
  betas: ["files-api-2025-04-14"],
});

// Write to local file
const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync("monthly_budget.xlsx", buffer);
console.log("Downloaded: monthly_budget.xlsx");
```

---

## Create a PowerPoint Presentation

```typescript
const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
  container: {
    skills: [
      {
        type: "anthropic",
        skill_id: "pptx",
        version: "latest",
      },
    ],
  },
  tools: [
    {
      type: "code_execution_20250825",
      name: "code_execution",
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Create a 5-slide presentation about renewable energy. Include a title slide, overview, solar power, wind power, and conclusion.",
    },
  ],
});
```

---

## Using Multiple Skills

Combine skills for complex workflows.

```typescript
const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
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
        "Analyze the following sales data and create both an Excel file with charts and a PowerPoint presentation summarizing the key insights:\n\nQ1: $150,000\nQ2: $180,000\nQ3: $165,000\nQ4: $220,000",
    },
  ],
});
```

---

## Multi-Turn Conversations

Reuse the same container across messages.

### Turn 1: Create Initial File

```typescript
const turn1 = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
  container: {
    skills: [{ type: "anthropic", skill_id: "xlsx", version: "latest" }],
  },
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    { role: "user", content: "Create a sales tracking spreadsheet with sample data" },
  ],
});

const containerId = turn1.container?.id;
console.log("Container ID:", containerId);
```

### Turn 2: Modify File (Reusing Container)

```typescript
const turn2 = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
  container: {
    id: containerId,
    skills: [{ type: "anthropic", skill_id: "xlsx", version: "latest" }],
  },
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    { role: "user", content: "Create a sales tracking spreadsheet with sample data" },
    { role: "assistant", content: turn1.content },
    { role: "user", content: "Add a chart showing monthly trends" },
  ],
});
```

---

## Handling Long Operations (pause_turn)

Skills may return `pause_turn` for long-running operations.

```typescript
async function createWithRetry(
  messages: Anthropic.Messages.MessageParam[],
  containerId?: string
) {
  const MAX_RETRIES = 10;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
      container: {
        ...(containerId ? { id: containerId } : {}),
        skills: [{ type: "anthropic", skill_id: "xlsx", version: "latest" }],
      },
      tools: [{ type: "code_execution_20250825", name: "code_execution" }],
      messages,
    });

    containerId = response.container?.id;
    console.log(`Iteration ${i + 1}: stop_reason = ${response.stop_reason}`);

    if (response.stop_reason !== "pause_turn") {
      // Print final text
      for (const block of response.content) {
        if (block.type === "text") console.log(block.text);
      }
      return response;
    }

    // Continue with the assistant's partial response
    messages = [...messages, { role: "assistant", content: response.content }];
  }

  throw new Error("Max retries exceeded");
}

// Usage
await createWithRetry([
  { role: "user", content: "Create a detailed financial model with 10 scenarios" },
]);
```

---

## Custom Skills

Create your own skills with domain-specific expertise.

### Skill Structure

```
my-skill/
├── SKILL.md        # Required: Instructions and metadata
├── analyze.py      # Optional: Helper scripts
├── templates/      # Optional: Templates and resources
│   └── report.md
└── data/           # Optional: Reference data
    └── schema.json
```

### SKILL.md Format

```markdown
---
name: financial-analysis
description: Perform financial analysis including DCF valuation, ratio analysis, and forecasting.
---

# Financial Analysis Skill

## Quick Start
Use pandas for data analysis...
```

### Upload Custom Skill

```typescript
// Note: Custom skill upload currently requires direct API calls
// The SDK may not have a dedicated method yet

const formData = new FormData();
formData.append("display_title", "Financial Analysis");
formData.append("files[]", new Blob([skillMdContent]), "my-skill/SKILL.md");
formData.append("files[]", new Blob([analyzePyContent]), "my-skill/analyze.py");

const response = await fetch("https://api.anthropic.com/v1/skills", {
  method: "POST",
  headers: {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "skills-2025-10-02",
  },
  body: formData,
});

const skill = await response.json();
console.log("Skill ID:", skill.id);
```

### Use Custom Skill

```typescript
const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
  container: {
    skills: [
      {
        type: "custom",
        skill_id: "skill_01AbCdEfGhIjKlMnOpQrStUv",
        version: "latest",
      },
    ],
  },
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content: "Perform a DCF valuation for a company with $10M revenue growing at 15% annually",
    },
  ],
});
```

---

## Complete Workflow Script

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

async function createAndDownload(prompt: string, skillId: string, outputPath: string) {
  // Step 1: Create file with skill
  console.log("Creating file...");
  const message = await client.beta.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
    container: {
      skills: [{ type: "anthropic", skill_id: skillId, version: "latest" }],
    },
    tools: [{ type: "code_execution_20250825", name: "code_execution" }],
    messages: [{ role: "user", content: prompt }],
  });

  // Step 2: Extract file ID from response
  let fileId: string | null = null;
  for (const block of message.content) {
    if (block.type === "bash_code_execution_tool_result") {
      const content = (block as any).content?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.file_id) {
            fileId = item.file_id;
            break;
          }
        }
      }
    }
  }

  if (!fileId) {
    console.log("No file was created");
    for (const block of message.content) {
      if (block.type === "text") console.log(block.text);
    }
    return;
  }

  console.log("File created:", fileId);

  // Step 3: Get file metadata
  const metadata = await client.beta.files.retrieve(fileId, {
    betas: ["files-api-2025-04-14"],
  });
  console.log("Filename:", metadata.filename);

  // Step 4: Download the file
  const fileResponse = await client.beta.files.retrieveContent(fileId, {
    betas: ["files-api-2025-04-14"],
  });
  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`Downloaded: ${outputPath} (${buffer.length} bytes)`);
}

// Run it
createAndDownload(
  "Create a quarterly sales report with sample data and a chart",
  "xlsx",
  "quarterly_report.xlsx"
);
```

---

## Constraints and Limits

| Constraint | Limit |
|------------|-------|
| Skills per request | 8 maximum |
| Custom skill upload size | 8MB total |
| Network access | None (isolated container) |
| Runtime package installation | Not available |
| SKILL.md name field | 64 chars, lowercase, hyphens only |
| SKILL.md description field | 1024 chars max |

---

## Version Management

### Anthropic Skills
- Versions use date format: `20251013`
- Use `latest` for most recent

### Custom Skills
- Versions use epoch timestamp: `1759178010641129`
- Use `latest` for active development
- Pin specific versions in production

```typescript
// Production: Pin specific version
skills: [{ type: "custom", skill_id: "skill_01ABC", version: "1759178010641129" }]

// Development: Use latest
skills: [{ type: "custom", skill_id: "skill_01ABC", version: "latest" }]
```

---

## Best Practices

1. **Use Appropriate Skills**: Only include skills relevant to the task.
2. **Download Files Promptly**: Files are temporary; download them after creation.
3. **Handle pause_turn**: Long operations may require multiple turns.
4. **Pin Versions in Production**: Use specific versions for stability.
5. **Combine with Files API**: Upload input files and download outputs.
6. **Test Custom Skills**: Validate skill behavior before production.

---

## Related Examples

- [Example 05: Files API](example-05-files-api.md) - File upload and download
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Multi-turn tool execution
- [Example 15: Coding Assistant](example-15-coding-assistant.md) - Code execution patterns
