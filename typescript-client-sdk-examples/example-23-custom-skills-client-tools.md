# Example 23: Custom Skills & Client-Side Tool Agents

> Build custom skills for container-based execution and use bash/text_editor tools on your own machine.

## Overview

- **Difficulty**: Expert
- **Features Used**: Custom Skills API, Code Execution Tool, Bash Tool (client), Text Editor Tool (client), Files API
- **SDK Methods**: `client.beta.messages.create()`, `client.messages.create()`, `client.beta.files.retrieve()`
- **Beta**: `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`
- **Use Cases**:
  - Building domain-specific skills (data validation, report templates, custom analysis)
  - Managing skill versions across environments
  - Local development automation with bash + text_editor
  - Agentic code editing and testing without containers
  - CI/CD integration with Claude as a tool-using agent

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- Understanding of [Example 06: Tool Use Basics](example-06-tool-use-basics.md) and [Example 19: Agent Skills](example-19-agent-skills.md)
- For Part B (client tools): A local development environment where Claude's commands will be executed

---

## Architecture: Server-Side vs Client-Side Execution

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Messages API Request                              │
│                    POST /v1/messages { tools: [...] }                     │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  SERVER-SIDE EXECUTION       │  │  CLIENT-SIDE EXECUTION       │
│  (Runs on Anthropic)         │  │  (Runs on YOUR machine)      │
│                              │  │                              │
│  Tool: code_execution        │  │  Tools: bash, text_editor    │
│  ┌────────────────────────┐  │  │                              │
│  │  Anthropic Container   │  │  │  stop_reason: "tool_use"     │
│  │  ┌──────────────────┐  │  │  │  ┌────────────────────────┐  │
│  │  │ /skills/          │  │  │  │  │ Your Filesystem        │  │
│  │  │   SKILL.md        │  │  │  │  │ Your Shell             │  │
│  │  │   scripts/        │  │  │  │  │ Your Network           │  │
│  │  │ /tmp/ workspace   │  │  │  │  └────────────────────────┘  │
│  │  └──────────────────┘  │  │  │                              │
│  │  ✗ No internet         │  │  │  ✓ Full system access        │
│  │  ✓ Pre-installed libs  │  │  │  ✓ Internet access           │
│  │  ✓ Auto-executed       │  │  │  ✗ YOU must execute          │
│  └────────────────────────┘  │  │  ✗ YOU must sandbox          │
│                              │  │                              │
│  Beta: code-execution,      │  │  Beta: None required          │
│        skills (for skills)   │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

# Part A: Custom Skills Deep Dive

## SKILL.md Format In Depth

Every custom skill requires a `SKILL.md` file. This file is loaded into Claude's context when the skill is activated, so it directly controls how Claude uses your skill.

### Frontmatter Specification

```markdown
---
name: my-skill-name
description: A clear description of what this skill does and when to use it.
---
```

| Field | Constraints | Notes |
|-------|-------------|-------|
| `name` | Max 64 chars, lowercase, hyphens only | Must match pattern `[a-z0-9-]+` |
| `description` | Max 1024 chars | Claude uses this to decide when to activate the skill |

### How Claude Uses SKILL.md

1. The SKILL.md content is injected into Claude's context alongside the `code_execution` tool
2. Claude reads the instructions and follows them when the skill is relevant to the user's request
3. Claude can access all files in the skill package via `/skills/{skill-name}/`
4. The description field is critical — Claude uses it to decide **when** to invoke the skill

### Complete SKILL.md Example: Data Validator

```markdown
---
name: data-validator
description: Validate CSV, JSON, and Excel data files against schemas. Use when the user wants to check data quality, find invalid records, or enforce data contracts.
---

# Data Validator Skill

## When to Use
- User asks to validate, check, or audit a data file
- User wants to enforce a schema on CSV/JSON/Excel data
- User needs a data quality report

## Validation Workflow

1. Load the data file using pandas
2. Load or infer the schema from `/skills/data-validator/schemas/`
3. Run validation checks (types, ranges, required fields, unique constraints)
4. Generate a validation report

## Available Scripts

- `src/validate.py` — Main validation engine
- `src/report.py` — Generate formatted validation reports

## Schema Format

Schemas are JSON files in `/skills/data-validator/schemas/`:

```json
{
  "columns": {
    "email": {"type": "string", "pattern": "^[^@]+@[^@]+$", "required": true},
    "age": {"type": "integer", "min": 0, "max": 150, "required": true},
    "status": {"type": "string", "enum": ["active", "inactive"], "required": false}
  }
}
```

## Example Usage

```python
import sys
sys.path.insert(0, "/skills/data-validator/src")
from validate import validate_dataframe
from report import generate_report

import pandas as pd

df = pd.read_csv("/tmp/data.csv")
results = validate_dataframe(df, schema_path="/skills/data-validator/schemas/customer.json")
report = generate_report(results)
print(report)
```
```

### SKILL.md Best Practices

1. **Be specific about triggers**: Tell Claude exactly when to use the skill in the `description`
2. **Include code patterns**: Show the exact Python imports and function calls Claude should use
3. **Reference file paths**: Use absolute paths like `/skills/{name}/src/...`
4. **Document available scripts**: List every file Claude can use
5. **Provide examples**: Show complete usage patterns Claude can follow

---

## Multi-File Skill Structure

Real-world skills often contain multiple files:

```
data-validator/
├── SKILL.md                    # Required: Instructions for Claude
├── src/
│   ├── validate.py             # Validation engine
│   ├── report.py               # Report generation
│   └── transforms.py           # Data transformations
├── schemas/
│   ├── customer.json           # Customer data schema
│   ├── order.json              # Order data schema
│   └── product.json            # Product data schema
└── templates/
    └── report_template.md      # Report output template
```

**Inside the container**, these files appear at:

```
/skills/data-validator/
├── SKILL.md
├── src/validate.py
├── src/report.py
├── src/transforms.py
├── schemas/customer.json
├── schemas/order.json
├── schemas/product.json
└── templates/report_template.md
```

**Constraints:**

| Limit | Value |
|-------|-------|
| Total upload size | 8MB across all files |
| Skills per request | 8 maximum |
| File paths | Must include the skill directory prefix |

---

## Skills API — Complete CRUD Lifecycle

### 1. Upload Custom Skill

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

// Note: Custom skill upload currently requires direct API calls
// The SDK may not have a dedicated method yet
const formData = new FormData();
formData.append("display_title", "Data Validator");
formData.append(
  "files[]",
  new Blob([fs.readFileSync("data-validator/SKILL.md")]),
  "data-validator/SKILL.md"
);
formData.append(
  "files[]",
  new Blob([fs.readFileSync("data-validator/src/validate.py")]),
  "data-validator/src/validate.py"
);
formData.append(
  "files[]",
  new Blob([fs.readFileSync("data-validator/src/report.py")]),
  "data-validator/src/report.py"
);
formData.append(
  "files[]",
  new Blob([fs.readFileSync("data-validator/schemas/customer.json")]),
  "data-validator/schemas/customer.json"
);
formData.append(
  "files[]",
  new Blob([fs.readFileSync("data-validator/schemas/order.json")]),
  "data-validator/schemas/order.json"
);

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
console.log("Version:", skill.latest_version);
```

**Response:**

```json
{
  "id": "skill_01AbCdEfGhIjKlMnOpQrStUv",
  "display_title": "Data Validator",
  "source": "custom",
  "latest_version": "1759178010641129",
  "created_at": "2025-01-15T10:30:00Z"
}
```

### 2. List Skills

```typescript
// List all skills
const allSkills = await fetch("https://api.anthropic.com/v1/skills", {
  headers: {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "skills-2025-10-02",
  },
});
const skillsList = await allSkills.json();

// List only custom skills
const customSkills = await fetch(
  "https://api.anthropic.com/v1/skills?source=custom",
  {
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "skills-2025-10-02",
    },
  }
);
const customList = await customSkills.json();
console.log("Custom skills:", customList.data);
```

**Response:**

```json
{
  "data": [
    {
      "id": "skill_01AbCdEfGhIjKlMnOpQrStUv",
      "display_title": "Data Validator",
      "source": "custom",
      "latest_version": "1759178010641129",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "has_more": false
}
```

### 3. Get Skill Details

```typescript
const skillDetails = await fetch(
  "https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv",
  {
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "skills-2025-10-02",
    },
  }
);
const details = await skillDetails.json();
console.log("Skill:", details);
```

### 4. List Skill Versions

```typescript
const versions = await fetch(
  "https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions",
  {
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "skills-2025-10-02",
    },
  }
);
const versionList = await versions.json();
console.log("Versions:", versionList.data);
```

**Response:**

```json
{
  "data": [
    {
      "version": "1759178010641129",
      "created_at": "2025-01-15T10:30:00Z"
    },
    {
      "version": "1759264410641129",
      "created_at": "2025-01-16T10:30:00Z"
    }
  ],
  "has_more": false
}
```

### 5. Create New Version

```typescript
const updateForm = new FormData();
updateForm.append(
  "files[]",
  new Blob([fs.readFileSync("data-validator/SKILL.md")]),
  "data-validator/SKILL.md"
);
updateForm.append(
  "files[]",
  new Blob([fs.readFileSync("data-validator/src/validate.py")]),
  "data-validator/src/validate.py"
);

const newVersion = await fetch(
  "https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions",
  {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "skills-2025-10-02",
    },
    body: updateForm,
  }
);
const versionResult = await newVersion.json();
console.log("New version:", versionResult.version);
```

### 6. Delete a Version

```typescript
await fetch(
  "https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions/1759178010641129",
  {
    method: "DELETE",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "skills-2025-10-02",
    },
  }
);
```

### 7. Delete Skill

You must delete all versions first, then delete the skill:

```typescript
// Delete remaining versions
await fetch(
  "https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions/1759350810641129",
  {
    method: "DELETE",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "skills-2025-10-02",
    },
  }
);

// Then delete the skill itself
await fetch(
  "https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv",
  {
    method: "DELETE",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "skills-2025-10-02",
    },
  }
);
```

---

## Using Custom Skills with Code Execution

### Validate Data with a Custom Skill

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
        type: "custom",
        skill_id: "skill_01AbCdEfGhIjKlMnOpQrStUv",
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
      content: `Validate this customer data against the customer schema:

name,email,age,status
Alice,alice@example.com,30,active
Bob,invalid-email,25,active
Charlie,charlie@example.com,-5,unknown`,
    },
  ],
});

for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
console.log("Container ID:", message.container?.id);
```

### Response

```json
{
  "id": "msg_01ABC",
  "content": [
    {
      "type": "server_tool_use",
      "id": "srvtoolu_01XYZ",
      "name": "code_execution",
      "input": {
        "code": "import sys\nsys.path.insert(0, '/skills/data-validator/src')\nfrom validate import validate_dataframe\nimport pandas as pd\nimport io\n\ncsv_data = \"\"\"name,email,age,status\nAlice,alice@example.com,30,active\nBob,invalid-email,25,active\nCharlie,charlie@example.com,-5,unknown\"\"\"\n\ndf = pd.read_csv(io.StringIO(csv_data))\nresults = validate_dataframe(df, schema_path='/skills/data-validator/schemas/customer.json')\nprint(results)"
      }
    },
    {
      "type": "code_execution_tool_result",
      "tool_use_id": "srvtoolu_01XYZ",
      "content": {
        "type": "code_execution_result",
        "stdout": "Row 2: email 'invalid-email' does not match pattern\nRow 3: age '-5' is below minimum (0)\nRow 3: status 'unknown' not in allowed values\n\n3 errors found in 3 rows"
      }
    },
    {
      "type": "text",
      "text": "I found 3 validation errors in your data:\n\n1. **Row 2 (Bob)**: Invalid email format — `invalid-email` doesn't match the required email pattern\n2. **Row 3 (Charlie)**: Age `-5` is below the minimum of 0\n3. **Row 3 (Charlie)**: Status `unknown` is not in the allowed values (`active`, `inactive`)\n\nRows 1 (Alice) passed all validation checks."
    }
  ],
  "container": {
    "id": "container_01DEF"
  },
  "stop_reason": "end_turn"
}
```

### Combining Custom + Anthropic Skills

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
        "Validate this customer data and create an Excel report of the validation results:\n\nname,email,age\nAlice,alice@example.com,30\nBob,bad-email,-5",
    },
  ],
});
```

---

## Template-Based Skills

Skills can include template files that Claude fills via code execution.

### Skill Structure

```
report-generator/
├── SKILL.md
├── src/
│   └── render.py               # Template rendering engine
└── templates/
    ├── weekly_report.md         # Markdown report template
    └── executive_summary.md     # Summary template
```

### Template Example (`templates/weekly_report.md`)

```markdown
# Weekly Report: {{ title }}

**Period:** {{ start_date }} — {{ end_date }}
**Author:** {{ author }}

## Summary
{{ summary }}

## Key Metrics
{% for metric in metrics %}
- **{{ metric.name }}**: {{ metric.value }} ({{ metric.change }})
{% endfor %}

## Action Items
{% for item in action_items %}
- [ ] {{ item }}
{% endfor %}
```

Claude reads the SKILL.md, uses the template with Jinja2, and generates the final output via code execution — all inside the container.

---

## Version Management

### Development vs Production

```typescript
// Development: Use latest (auto-updates when you upload new versions)
container: {
  skills: [{ type: "custom", skill_id: "skill_01ABC", version: "latest" }]
}

// Production: Pin a specific version for stability
container: {
  skills: [{ type: "custom", skill_id: "skill_01ABC", version: "1759178010641129" }]
}
```

### Version Workflow

```
Upload v1 ──→ Test ──→ Upload v2 ──→ Test ──→ Pin v2 in production
                                              │
                                              └──→ Delete v1 (cleanup)
```

---

# Bridge: Server vs Client Tool Execution

This is the most important distinction in Claude's tool ecosystem:

| Aspect | Container Tools (`code_execution`) | Client Tools (`bash`, `text_editor`) |
|--------|--------------------------------------|--------------------------------------|
| **Execution** | Anthropic's servers | Your machine |
| **SDK method** | `client.beta.messages.create()` | `client.messages.create()` |
| **stop_reason** | `end_turn` (auto-executed) | `tool_use` (you must execute) |
| **Filesystem** | Container VFS only (5 GiB) | Your local filesystem |
| **Internet** | None | Whatever your machine has |
| **Beta header** | `code-execution-2025-08-25` | None required |
| **Skills support** | Yes (skills load into container) | No |
| **Security** | Sandboxed by Anthropic | You control the sandbox |
| **Package installs** | Pre-installed only | Whatever you have locally |

> **Critical**: When Claude returns `stop_reason: "tool_use"` with `name: "bash"`, the command has **NOT** been executed. You must execute it on your machine and return the result via `tool_result`. This is fundamentally different from `code_execution_20250825` where Anthropic's servers run the code automatically.

### When to Use Which

- **Container + code_execution + skills**: Data analysis, file generation (xlsx/pptx), sandboxed Python, anything that should be isolated
- **Client bash + text_editor**: Local file editing, running tests, project setup, CI integration, anything needing your filesystem or network

---

# Part B: Client-Side Tool Agents

## Bash Tool Standalone

The `bash_20250124` tool requires **no beta header**. Use `client.messages.create()` (not `client.beta`). Claude requests a command, you execute it on your machine, and return the output.

### Step 1: Send Request with Bash Tool

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// No beta required — use client.messages.create() directly
const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
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
    model: "claude-sonnet-4-5-20250514",
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

If a command fails, return an error result:

```typescript
{
  type: "tool_result",
  tool_use_id: toolUse.id,
  is_error: true,
  content: "bash: command not found: unknown_command\nExit code: 127"
}
```

---

## Text Editor Tool Standalone

The `text_editor_20250728` tool also requires **no beta header**. Claude requests file operations, and you execute them locally.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
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

---

## Complete Agentic Loop: Bash + Text Editor

A full working script that loops until Claude finishes the task.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  { type: "bash_20250124", name: "bash" } as any,
  { type: "text_editor_20250728", name: "str_replace_based_edit_tool" } as any,
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

// Main agentic loop
async function runAgent(task: string) {
  const MAX_ITERATIONS = 15;
  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: task },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n=== Iteration ${i + 1} ===`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
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
        let result: string;

        if (block.name === "bash") {
          result = executeBash((block.input as any).command);
        } else if (block.name === "str_replace_based_edit_tool") {
          result = executeTextEditor(block.input);
        } else {
          result = `Unknown tool: ${block.name}`;
        }

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

### Log Analysis

```typescript
await runAgent(
  "Read the last 500 lines of /var/log/app/error.log, identify the " +
  "most common error patterns, and suggest fixes."
);
```

---

## Constraints and Limits

| Constraint | Custom Skills | Client Tools |
|-----------|--------------|-------------|
| Skills per request | 8 max | N/A |
| Skill upload size | 8MB total | N/A |
| SKILL.md name | 64 chars, lowercase, hyphens | N/A |
| SKILL.md description | 1024 chars max | N/A |
| Network in container | None | Your machine's network |
| Beta required | `skills-2025-10-02` + `code-execution-2025-08-25` | None |
| Execution timeout | Anthropic-managed | You control |
| Filesystem | Container VFS (5 GiB) | Your local disk |

---

## Best Practices

1. **Write descriptive SKILL.md files**: The more specific your instructions, the better Claude uses your skill.

2. **Pin skill versions in production**: Use `latest` only during development.

3. **Test skills iteratively**: Upload, test, version, repeat.

4. **Scope client-tool permissions**: Never give Claude unrestricted bash access on production machines.

5. **Validate client-tool inputs**: Check commands before executing them.

6. **Use the right tool for the job**: Container tools for isolated analysis; client tools for local development.

7. **Handle errors in both directions**: Skills can return `pause_turn`; client tools can return `is_error: true`.

8. **Combine both patterns**: Use skills to generate files in containers, then use client tools to integrate outputs locally.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool fundamentals and all tool types
- [Example 12: Human in the Loop](example-12-human-in-the-loop.md) - Approval patterns for sensitive tools
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Multi-turn loop patterns
- [Example 17: Computer Use](example-17-computer-use.md) - Full computer use with bash + text_editor + computer
- [Example 19: Agent Skills](example-19-agent-skills.md) - Pre-built skills and basic custom skills
- [Example 22: VFS, Container & Sandbox](example-22-virtual-file-system-container-sandbox.md) - Container architecture
