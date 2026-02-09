# Example 22: Virtual File System, Container & Sandbox

> Understanding how containers, sandboxes, and virtual file systems work together in Claude's code execution environment.

## Overview

- **Difficulty**: Expert
- **Features Used**: Code Execution Tool, Files API, Container Management, Agent Skills
- **SDK Methods**: `client.beta.messages.create()`, `client.beta.files.upload()`, `client.beta.files.retrieve()`, `client.beta.files.retrieveContent()`
- **Beta**: `code-execution-2025-08-25`, `files-api-2025-04-14`, `skills-2025-10-02`
- **Use Cases**:
  - Stateful multi-turn file processing workflows
  - Understanding the execution environment architecture
  - Data pipeline processing with file persistence
  - Secure sandboxed code execution

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable

---

## The Big Picture

When Claude executes code, three layers work together:

```
┌──────────────────────────────────────────────────────────────────┐
│                        Messages API Request                      │
│  client.beta.messages.create({ container, tools: [code_exec] })  │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  CONTAINER (Anthropic-managed Linux environment)                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  SANDBOX (OS-level isolation)                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  VIRTUAL FILE SYSTEM (5 GiB ephemeral disk)          │  │  │
│  │  │                                                      │  │  │
│  │  │  /tmp/                    ← writable workspace       │  │  │
│  │  │  /skills/{directory}/     ← loaded skill files       │  │  │
│  │  │  /uploads/                ← container_upload files   │  │  │
│  │  │                                                      │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  Constraints:                                              │  │
│  │  ✗ No internet access                                     │  │
│  │  ✗ No access outside workspace                            │  │
│  │  ✓ Pre-installed Python 3.11 + libraries                  │  │
│  │  ✓ bash, text_editor sub-tools                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Container ID: container_01ABC  |  Expires: 30 days              │
└──────────────────────────────────────────────────────────────────┘
         ▲                                      │
         │  Upload (container_upload)            │  Download (file_id)
         │                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│  FILES API  (bridge between your system and the container)       │
│  client.beta.files.upload()          ← upload files             │
│  client.beta.files.retrieveContent() ← download files           │
│  client.beta.files.delete()          ← cleanup                  │
└──────────────────────────────────────────────────────────────────┘
```

### How the Layers Relate

| Layer | What It Is | Scope |
|-------|-----------|-------|
| **Container** | An Anthropic-managed Linux (x86_64) environment created automatically when code execution runs | One per workflow; reusable across turns |
| **Sandbox** | OS-level security isolation enforced inside the container | Restricts filesystem and network access |
| **Virtual File System** | The 5 GiB ephemeral disk inside the sandbox where all file operations happen | Persists for the container's lifetime (up to 30 days) |
| **Files API** | SDK methods that move files between your system and the container | Independent of container lifecycle |

---

## TypeScript Interfaces

```typescript
// Container configuration for requests
interface ContainerConfig {
  id?: string;                  // Reuse existing container
  skills?: SkillConfig[];       // Skills to load
}

interface SkillConfig {
  type: "anthropic" | "custom";
  skill_id: string;
  version: string;
}

// Container info returned in responses
interface ContainerResponse {
  id: string;
  expires_at: string;
}

// Code execution result types
interface BashCodeExecutionResult {
  type: "bash_code_execution_result";
  stdout: string;
  stderr: string;
  return_code: number;
  content?: FileReference[];    // Generated files
}

interface TextEditorResult {
  type: "text_editor_code_execution_result";
  file_type?: string;
  content?: string;             // File content (view command)
  is_file_update?: boolean;     // Create command
  oldStart?: number;            // Str_replace diff
  newStart?: number;
  lines?: string[];
}

interface FileReference {
  type: "file";
  file_id: string;
  filename: string;
}

// File metadata from Files API
interface FileMetadata {
  id: string;
  type: "file";
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  downloadable: boolean;
}
```

---

## Section 1: Container Basics

A container is automatically created the first time Claude uses the code execution tool. You don't explicitly create one — it appears in the response.

### Container Specifications

| Resource | Value |
|----------|-------|
| OS | Linux x86_64 (AMD64) |
| Python | 3.11.12 |
| CPU | 1 vCPU |
| Memory | 5 GiB RAM |
| Disk | 5 GiB workspace |
| Internet | Disabled |
| Expiration | 30 days (long-lived) or ~4.5 min inactivity (PTC) |

### Request: Trigger Container Creation

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25"],
  tools: [
    {
      type: "code_execution_20250825",
      name: "code_execution",
    },
  ],
  messages: [
    {
      role: "user",
      content: "Run: echo Hello from the container",
    },
  ],
});

// Container is automatically created — extract its ID
const containerId = message.container?.id;
const expiresAt = message.container?.expires_at;
console.log("Container ID:", containerId);
console.log("Expires at:", expiresAt);
```

### Response

```json
{
  "id": "msg_01ABC",
  "content": [
    {
      "type": "server_tool_use",
      "id": "srvtoolu_01ABC",
      "name": "bash_code_execution",
      "input": { "command": "echo Hello from the container" }
    },
    {
      "type": "bash_code_execution_tool_result",
      "tool_use_id": "srvtoolu_01ABC",
      "content": {
        "type": "bash_code_execution_result",
        "stdout": "Hello from the container\n",
        "stderr": "",
        "return_code": 0
      }
    },
    {
      "type": "text",
      "text": "The command ran successfully inside the container."
    }
  ],
  "container": {
    "id": "container_01JKX8WR3QHS1MNEAYS73NNFZD",
    "expires_at": "2025-03-15T10:30:00Z"
  },
  "stop_reason": "end_turn"
}
```

---

## Section 2: Sandbox Isolation

The sandbox is the security boundary inside the container, providing filesystem and network isolation.

### Demonstrating Sandbox Constraints

```typescript
const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25"],
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content: [
        "Run these commands and show the output:",
        "1. pwd",
        "2. ls /",
        "3. whoami",
        "4. python3 --version",
        "5. Try to access /etc/passwd",
        "6. Try to curl https://example.com",
      ].join("\n"),
    },
  ],
});

// Parse results
for (const block of message.content) {
  if (block.type === "bash_code_execution_tool_result") {
    const result = (block as any).content;
    console.log("stdout:", result.stdout);
    console.log("stderr:", result.stderr);
    console.log("return_code:", result.return_code);
  }
}
```

### What You'll See

| Command | Result | Why |
|---------|--------|-----|
| `pwd` | `/home/user` | Default workspace |
| `ls /` | `bin etc home lib tmp usr` | Minimal root filesystem |
| `whoami` | `user` | Non-root user |
| `/etc/passwd` | `Permission denied` | Filesystem isolation |
| `curl example.com` | `Could not resolve host` | Network isolation |

### Pre-installed Libraries

| Category | Packages |
|----------|----------|
| **Data Science** | pandas, numpy, scipy, scikit-learn, statsmodels |
| **Visualization** | matplotlib, seaborn |
| **File Processing** | openpyxl, xlsxwriter, xlrd, python-pptx, python-docx, pypdf, reportlab, pillow |
| **Math** | sympy, mpmath |
| **Utilities** | tqdm, python-dateutil, pytz, ripgrep (rg), fd, sqlite3, bc |

---

## Section 3: Virtual File System

The VFS is the 5 GiB ephemeral disk inside the sandbox. Claude's code execution provides two sub-tools for file operations.

### Sub-tool 1: `bash_code_execution`

```typescript
// Claude uses this internally to run shell commands
// You see the results in the response content blocks:

// server_tool_use:
{
  type: "server_tool_use",
  name: "bash_code_execution",
  input: { command: "mkdir -p /tmp/project && echo 'Hello' > /tmp/project/hello.txt" }
}

// bash_code_execution_tool_result:
{
  type: "bash_code_execution_tool_result",
  content: {
    type: "bash_code_execution_result",
    stdout: "",
    stderr: "",
    return_code: 0
  }
}
```

### Sub-tool 2: `text_editor_code_execution`

| Command | Purpose | Key Fields |
|---------|---------|------------|
| `create` | Create a new file | `path`, `file_text` |
| `view` | Read file contents | `path`, optional `view_range` |
| `str_replace` | Replace text in a file | `path`, `old_str`, `new_str` |
| `insert` | Insert text at a line | `path`, `insert_line`, `new_str` |

**Create file:**

```typescript
// server_tool_use:
{
  name: "text_editor_code_execution",
  input: {
    command: "create",
    path: "/tmp/config.json",
    file_text: '{\n  "name": "my-project"\n}'
  }
}

// text_editor_code_execution_tool_result:
{
  content: {
    type: "text_editor_code_execution_result",
    is_file_update: false
  }
}
```

**View file:**

```typescript
// Result:
{
  content: {
    type: "text_editor_code_execution_result",
    file_type: "text",
    content: '{\n  "name": "my-project"\n}',
    numLines: 3,
    startLine: 1,
    totalLines: 3
  }
}
```

**Str_replace (diff):**

```typescript
// Result:
{
  content: {
    type: "text_editor_code_execution_result",
    oldStart: 2,
    oldLines: 1,
    newStart: 2,
    newLines: 1,
    lines: ['-  "name": "my-project"', '+  "name": "updated-project"']
  }
}
```

### Parsing Generated Files

```typescript
function extractFileIds(message: any): FileReference[] {
  const files: FileReference[] = [];

  for (const block of message.content) {
    if (block.type === "bash_code_execution_tool_result") {
      const content = (block as any).content?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.file_id) {
            files.push({
              type: "file",
              file_id: item.file_id,
              filename: item.filename,
            });
          }
        }
      }
    }
  }

  return files;
}
```

---

## Section 4: Container Reuse & File Persistence

Files created in one turn persist in the container and are available in subsequent turns — as long as you pass the same `container` ID.

### Multi-Turn File Processing

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ── Turn 1: Create files in the container ──
const turn1 = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25"],
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content:
        "Create a Python script at /tmp/analyze.py that reads a CSV and calculates statistics. Also create /tmp/data.csv with 10 rows of sample sales data.",
    },
  ],
});

const containerId = turn1.container?.id;
console.log("Container ID:", containerId);

// ── Turn 2: Run the script (files persist!) ──
const turn2 = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25"],
  container: containerId, // <-- reuse container
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content: "Run the analyze.py script on the data.csv file. Show the results.",
    },
  ],
});

console.log("Same container:", turn2.container?.id === containerId); // true

// ── Turn 3: Build on previous results ──
const turn3 = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25"],
  container: containerId, // <-- same container, files still there
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content:
        "Use the analysis results to generate a matplotlib chart. Save as /tmp/chart.png",
    },
  ],
});
```

### Container Reuse: Two Formats

```typescript
// Format 1: String — just reuse the container (no skills)
const msg = await client.beta.messages.create({
  container: "container_01JKX8WR3QHS1MNEAYS73NNFZD",
  // ...
});

// Format 2: Object — reuse container AND configure skills
const msg2 = await client.beta.messages.create({
  container: {
    id: "container_01JKX8WR3QHS1MNEAYS73NNFZD",
    skills: [{ type: "anthropic", skill_id: "xlsx", version: "latest" }],
  },
  // ...
});
```

**Important**: `container` is a **top-level request parameter**, not inside `messages` or `tools`.

### Passing Environment Variables to the Container

The `container` parameter only supports `id` and `skills` — there is **no** `environment`, `env`, or `secrets` field. Here are three workarounds:

**Approach 1: Via `container_upload` (Recommended)**

Upload a config file via the Files API and load it into the container:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

// Create a config file
fs.writeFileSync("/tmp/config.env", "DB_HOST=localhost\nDB_PORT=5432\nMODE=production\n");

// Upload to Files API
const configFile = await client.beta.files.upload({
  file: fs.createReadStream("/tmp/config.env"),
  betas: ["files-api-2025-04-14"],
});

// Load into container and use it
const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "files-api-2025-04-14"],
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content: [
        { type: "container_upload", file_id: configFile.id },
        {
          type: "text",
          text: "Source the uploaded config.env file, then run analysis.py using those environment variables.",
        },
      ],
    },
  ],
});
```

**Approach 2: Via message text**

Pass key-value pairs directly in the prompt:

```typescript
const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25"],
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content: [
        "Set these environment variables before running the script:",
        "export DB_HOST=localhost",
        "export DB_PORT=5432",
        "export MODE=production",
        "",
        "Then run: python3 /tmp/app.py",
      ].join("\n"),
    },
  ],
});
```

**Approach 3: Via container reuse (setup turn)**

Use a first turn to configure the environment, then reuse the container:

```typescript
// Turn 1: Set up environment
const setup = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25"],
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content:
        "Write a file /tmp/.env with:\nAPI_KEY=abc123\nMODE=production\nMAX_RETRIES=3",
    },
  ],
});

const containerId = setup.container?.id;

// Turn 2: Use the pre-configured container
const result = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25"],
  container: containerId,
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content: "Source /tmp/.env and run the analysis pipeline",
    },
  ],
});
```

**Important caveats:**
- All three approaches pass data through the message body, so values are **visible to the model** in its context window.
- Since the sandbox has **no internet access**, API keys for external services won't be usable anyway.
- There is no way to inject secrets that are opaque to the model.

---

## Section 5: Files API Bridge

The Files API moves files between your local system and the container.

### Direction 1: Your System → Container (`container_upload`)

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

// Step 1: Upload to Files API
const file = await client.beta.files.upload({
  file: fs.createReadStream("sales_data.csv"),
  betas: ["files-api-2025-04-14"],
});
console.log("Uploaded:", file.id);

// Step 2: Load into container with container_upload
const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "files-api-2025-04-14"],
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "container_upload",
          file_id: file.id,
        },
        {
          type: "text",
          text: "Analyze this CSV using pandas. Show summary statistics and create a chart.",
        },
      ],
    },
  ],
});
```

### `container_upload` vs `document` vs `image`

| Content Block | Where File Goes | Use Case |
|--------------|----------------|----------|
| `container_upload` | Container's filesystem (VFS) | Data files for code execution (CSV, JSON, Excel) |
| `document` | Model's context window | Text/PDF for Claude to read directly |
| `image` | Model's context window | Images for vision analysis |

**Key difference**: `container_upload` puts the file on disk so code can process it. `document` and `image` put content into Claude's context for direct understanding.

### Direction 2: Container → Your System (`file_id` → Files API)

```typescript
import * as fs from "fs";

// Step 1: Extract file IDs from the response
const files = extractFileIds(message); // Helper from Section 3

// Step 2: Download each file
for (const fileRef of files) {
  // Get metadata
  const metadata = await client.beta.files.retrieve(fileRef.file_id, {
    betas: ["files-api-2025-04-14"],
  });
  console.log(`File: ${metadata.filename} (${metadata.size_bytes} bytes)`);

  // Download content
  const content = await client.beta.files.retrieveContent(fileRef.file_id, {
    betas: ["files-api-2025-04-14"],
  });
  const buffer = Buffer.from(await content.arrayBuffer());
  fs.writeFileSync(metadata.filename, buffer);
  console.log(`Downloaded: ${metadata.filename}`);
}
```

### Complete File Lifecycle

```
┌─────────┐  files.upload()  ┌──────────┐  container_upload  ┌───────────┐
│ Local   │ ───────────────> │ Files API│ ─────────────────> │ Container │
│ System  │                  │ file_xxx │                    │ VFS       │
└─────────┘                  └──────────┘                    └───────────┘
     ▲                            ▲                               │
     │  retrieveContent()         │   file_id in response         │
     │                            │                               │
     └────────────────────────────┴──────────────── Code creates files
```

---

## Section 6: Skills and the VFS

When you configure skills, their files are loaded into `/skills/{directory}/` on the VFS.

### How Skills Use the VFS

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
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content:
        "List /skills/ contents, then create an Excel file with quarterly sales data.",
    },
  ],
});
```

### What Gets Loaded

1. **Skill metadata** (name, description) → injected into system prompt
2. **Skill files** (SKILL.md, scripts, templates) → copied to `/skills/{skill_name}/`
3. **Claude reads SKILL.md** → understands how to use the skill
4. **Generated files** → appear on VFS, get `file_id` references

### Skills + Container Reuse

```typescript
// Turn 1: Use xlsx skill
const turn1 = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
  container: {
    skills: [{ type: "anthropic", skill_id: "xlsx", version: "latest" }],
  },
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content:
        "Create a sales spreadsheet and save raw data to /tmp/sales.csv",
    },
  ],
});

const containerId = turn1.container?.id;

// Turn 2: Different skill, same container — /tmp/sales.csv still exists
const turn2 = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
  container: {
    id: containerId,
    skills: [{ type: "anthropic", skill_id: "pptx", version: "latest" }],
  },
  tools: [{ type: "code_execution_20250825", name: "code_execution" }],
  messages: [
    {
      role: "user",
      content:
        "Read /tmp/sales.csv and create a PowerPoint presentation with those numbers",
    },
  ],
});
```

---

## Section 7: Error Handling

### Error Codes

| Error | Description | Recovery |
|-------|-------------|----------|
| `container_expired` | Container timed out (30-day or inactivity) | Start new container; files are lost |
| `file_not_found` | Text editor: file doesn't exist | Check path; create file first |
| `string_not_found` | Text editor: `old_str` not found | Read file to verify content |
| `execution_time_exceeded` | Code took too long | Optimize code or break into steps |
| `unavailable` | Code execution temporarily down | Retry after brief wait |
| `too_many_requests` | Rate limit exceeded | Back off and retry |

### Handling `pause_turn`

```typescript
async function runWithPauseTurn(
  messages: Anthropic.Messages.MessageParam[],
  containerId?: string,
  skills?: SkillConfig[]
): Promise<{ message: any; containerId: string }> {
  const MAX_RETRIES = 10;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 8192,
      betas: ["code-execution-2025-08-25", "skills-2025-10-02"],
      container: skills
        ? {
            ...(containerId ? { id: containerId } : {}),
            skills,
          }
        : containerId,
      tools: [{ type: "code_execution_20250825", name: "code_execution" }],
      messages,
    });

    containerId = response.container?.id;
    console.log(`Turn ${i + 1}: stop_reason=${response.stop_reason}`);

    if (response.stop_reason !== "pause_turn") {
      return { message: response, containerId: containerId! };
    }

    // Feed partial response back to continue
    messages = [
      ...messages,
      { role: "assistant" as const, content: response.content },
    ];
  }

  throw new Error("Max pause_turn retries exceeded");
}
```

### Container Expiration Check

```typescript
async function isContainerAlive(containerId: string): Promise<boolean> {
  try {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      betas: ["code-execution-2025-08-25"],
      container: containerId,
      tools: [{ type: "code_execution_20250825", name: "code_execution" }],
      messages: [{ role: "user", content: "Run: echo alive" }],
    });
    return response.stop_reason === "end_turn";
  } catch (error: any) {
    if (error.status === 400 || error.message?.includes("container_expired")) {
      return false;
    }
    throw error;
  }
}
```

---

## Section 8: Complete Multi-Turn Workflow

End-to-end example: upload CSV → analyze → chart → Excel report → download.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

// ── Helper: extract file references from response ──
function extractFileIds(message: any): Array<{ file_id: string; filename: string }> {
  const files: Array<{ file_id: string; filename: string }> = [];
  for (const block of message.content) {
    if (block.type === "bash_code_execution_tool_result") {
      const content = (block as any).content?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.file_id) {
            files.push({ file_id: item.file_id, filename: item.filename });
          }
        }
      }
    }
  }
  return files;
}

// ── Helper: download files from response ──
async function downloadFiles(message: any): Promise<string[]> {
  const files = extractFileIds(message);
  const downloaded: string[] = [];

  for (const f of files) {
    const metadata = await client.beta.files.retrieve(f.file_id, {
      betas: ["files-api-2025-04-14"],
    });

    const content = await client.beta.files.retrieveContent(f.file_id, {
      betas: ["files-api-2025-04-14"],
    });
    const buffer = Buffer.from(await content.arrayBuffer());
    fs.writeFileSync(metadata.filename, buffer);
    console.log(`  Downloaded: ${metadata.filename} (${buffer.length} bytes)`);
    downloaded.push(metadata.filename);
  }

  return downloaded;
}

// ── Helper: handle pause_turn loop ──
async function sendWithRetry(
  params: {
    messages: Anthropic.Messages.MessageParam[];
    containerId?: string;
    skills?: Array<{ type: "anthropic" | "custom"; skill_id: string; version: string }>;
  },
  maxRetries = 5
): Promise<{ response: any; containerId: string }> {
  let { messages, containerId, skills } = params;

  for (let i = 0; i < maxRetries; i++) {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 8192,
      betas: skills
        ? ["code-execution-2025-08-25", "skills-2025-10-02"]
        : ["code-execution-2025-08-25"],
      container: skills
        ? { ...(containerId ? { id: containerId } : {}), skills }
        : containerId || undefined,
      tools: [{ type: "code_execution_20250825", name: "code_execution" }],
      messages,
    });

    containerId = response.container?.id;
    console.log(`  Turn ${i + 1}: stop_reason=${response.stop_reason}`);

    if (response.stop_reason !== "pause_turn") {
      return { response, containerId: containerId! };
    }

    messages = [...messages, { role: "assistant" as const, content: response.content }];
  }

  throw new Error("Max retries exceeded");
}

// ═══════════════════════════════════════════
//  MAIN WORKFLOW
// ═══════════════════════════════════════════
async function main() {
  // ── Step 1: Create sample CSV locally ──
  console.log("=== Step 1: Creating sample data ===");
  const csvData = [
    "month,product,revenue,units,region",
    "Jan,Widget A,15000,120,North",
    "Feb,Widget A,18000,145,North",
    "Mar,Widget A,22000,178,North",
    "Jan,Widget B,9000,60,South",
    "Feb,Widget B,11000,73,South",
    "Mar,Widget B,14000,95,South",
    "Jan,Widget C,7500,200,East",
    "Feb,Widget C,8200,220,East",
    "Mar,Widget C,9800,265,East",
  ].join("\n");

  fs.writeFileSync("/tmp/sales_input.csv", csvData);
  console.log("  Created /tmp/sales_input.csv");

  // ── Step 2: Upload CSV to Files API ──
  console.log("\n=== Step 2: Uploading to Files API ===");
  const uploadedFile = await client.beta.files.upload({
    file: fs.createReadStream("/tmp/sales_input.csv"),
    betas: ["files-api-2025-04-14"],
  });
  console.log("  File ID:", uploadedFile.id);

  // ── Step 3: Load into container + analyze ──
  console.log("\n=== Step 3: Analyzing data in container ===");
  const { response: analysisResponse, containerId } = await sendWithRetry({
    messages: [
      {
        role: "user",
        content: [
          { type: "container_upload", file_id: uploadedFile.id },
          {
            type: "text",
            text: [
              "1. Read the uploaded CSV file.",
              "2. Calculate summary statistics per product.",
              "3. Create a bar chart comparing revenue by product — save as /tmp/revenue_chart.png.",
              "4. Save summary statistics to /tmp/summary.csv.",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  console.log("  Container ID:", containerId);
  console.log("  Downloading generated files...");
  await downloadFiles(analysisResponse);

  // ── Step 4: Reuse container + generate Excel report with skills ──
  console.log("\n=== Step 4: Generating Excel report (reusing container) ===");
  const { response: excelResponse } = await sendWithRetry({
    messages: [
      {
        role: "user",
        content:
          "Using /tmp/summary.csv already in the container, create a polished Excel report with formatted tables and a chart sheet.",
      },
    ],
    containerId,
    skills: [{ type: "anthropic", skill_id: "xlsx", version: "latest" }],
  });

  console.log("  Downloading Excel report...");
  await downloadFiles(excelResponse);

  // ── Step 5: Verify file persistence ──
  console.log("\n=== Step 5: Verifying file persistence ===");
  const verifyResponse = await client.beta.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    betas: ["code-execution-2025-08-25"],
    container: containerId,
    tools: [{ type: "code_execution_20250825", name: "code_execution" }],
    messages: [
      {
        role: "user",
        content: "List all files in /tmp/ to verify everything is still there",
      },
    ],
  });

  console.log("  Files in container:");
  for (const block of verifyResponse.content) {
    if (block.type === "bash_code_execution_tool_result") {
      const stdout = (block as any).content?.stdout;
      if (stdout) console.log("   ", stdout.trim().split("\n").join("\n    "));
    }
  }

  // ── Step 6: Cleanup ──
  console.log("\n=== Step 6: Cleanup ===");
  await client.beta.files.delete(uploadedFile.id, {
    betas: ["files-api-2025-04-14"],
  });
  console.log("  Deleted uploaded file:", uploadedFile.id);

  console.log("\n=== Workflow complete ===");
}

main().catch(console.error);
```

---

## Cost & Limits

| Resource | Limit |
|----------|-------|
| Code execution time | 1,550 free hours/org/month, then $0.05/hour |
| Minimum billing | 5 minutes per execution |
| Container disk | 5 GiB |
| Container RAM | 5 GiB |
| Container CPU | 1 vCPU |
| Container lifetime | 30 days |
| Skills per request | 8 maximum |
| Custom skill upload size | 8 MB total |
| Files API: max file size | 500 MB per file |
| Files API: org storage | 100 GB |
| Files API operations | Free (upload, download, list, delete) |

---

## Best Practices

1. **Reuse containers** for multi-turn workflows. Extract `message.container?.id` from the first response and pass it in subsequent requests.

2. **Use `container_upload` for data files**. Don't use `document` for CSVs or Excel files that need code processing — use `container_upload` to load them onto the VFS.

3. **Handle `pause_turn`** in a loop. Skills and complex code execution may need multiple turns to complete.

4. **Download files promptly**. Files are tied to the container lifetime (30 days max). Download important outputs immediately.

5. **Respect sandbox constraints**. No internet means no `pip install` or external data fetches from within the container. Upload everything beforehand.

6. **Monitor disk usage**. The 5 GiB VFS is shared across all turns. Clean up large intermediate files if needed.

7. **Swap skills across turns**. The container preserves files, but skills can change per turn. Use xlsx in one turn, pptx in the next, accessing the same data.

8. **Check for container expiration** before assuming a container is alive, especially in long-running pipelines.

---

## Related Examples

- [Example 05: Files API](example-05-files-api.md) — File upload, download, and reuse
- [Example 19: Agent Skills](example-19-agent-skills.md) — Skills with container configuration
- [Example 21: Full-Stack Autonomous Agent](example-21-full-stack-agent.md) — All tools combined
