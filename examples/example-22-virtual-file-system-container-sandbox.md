# Example 22: Virtual File System, Container & Sandbox

> Understanding how containers, sandboxes, and virtual file systems work together in Claude's code execution environment.

## Overview

- **Difficulty**: Expert
- **Features Used**: Code Execution Tool, Files API, Container Management, Agent Skills
- **Beta Headers Required**: `code-execution-2025-08-25`, `files-api-2025-04-14`, `skills-2025-10-02`
- **Use Cases**:
  - Stateful multi-turn file processing workflows
  - Understanding the execution environment architecture
  - Data pipeline processing with file persistence
  - Secure sandboxed code execution

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Understanding of [Example 05: Files API](example-05-files-api.md) and [Example 19: Agent Skills](example-19-agent-skills.md)

---

## The Big Picture

When Claude executes code, three layers work together:

```
┌──────────────────────────────────────────────────────────────────┐
│                        Messages API Request                      │
│  POST /v1/messages  { container: ..., tools: [code_execution] }  │
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
│  POST   /v1/files              ← upload files                   │
│  GET    /v1/files/{id}/content ← download files                 │
│  DELETE /v1/files/{id}         ← cleanup                        │
└──────────────────────────────────────────────────────────────────┘
```

### How the Layers Relate

| Layer | What It Is | Scope |
|-------|-----------|-------|
| **Container** | An Anthropic-managed Linux (x86_64) environment created automatically when code execution runs | One per workflow; reusable across turns |
| **Sandbox** | OS-level security isolation enforced inside the container | Restricts filesystem and network access |
| **Virtual File System** | The 5 GiB ephemeral disk inside the sandbox where all file operations happen | Persists for the container's lifetime (up to 30 days) |
| **Files API** | REST endpoints that move files between your system and the container | Independent of container lifecycle |

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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [
      {
        "type": "code_execution_20250825",
        "name": "code_execution"
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Run: echo Hello from the container"
      }
    ]
  }'
```

### Response: Container ID Returned

```json
{
  "id": "msg_01ABC",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "server_tool_use",
      "id": "srvtoolu_01ABC",
      "name": "bash_code_execution",
      "input": {
        "command": "echo Hello from the container"
      }
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

**Key**: The `container` object at the top level of the response contains the `id` you'll reuse in subsequent requests.

---

## Section 2: Sandbox Isolation

The sandbox is the security boundary enforced inside the container. It provides two types of isolation:

### Filesystem Isolation

Claude can only access the workspace directory — no host system files, no other containers.

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {
        "role": "user",
        "content": "Run these commands and show the output:\n1. pwd\n2. ls /\n3. whoami\n4. python3 --version\n5. Try to access /etc/passwd"
      }
    ]
  }'
```

**Response (bash_code_execution_result):**

```json
{
  "type": "bash_code_execution_result",
  "stdout": "/home/user\nbin  etc  home  lib  tmp  usr\nuser\nPython 3.11.12\ncat: /etc/passwd: Permission denied\n",
  "stderr": "",
  "return_code": 1
}
```

### Network Isolation

No internet access of any kind — outbound requests will fail.

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {
        "role": "user",
        "content": "Try to make a network request: curl https://example.com"
      }
    ]
  }'
```

**Response:**

```json
{
  "type": "bash_code_execution_result",
  "stdout": "",
  "stderr": "curl: (6) Could not resolve host: example.com\n",
  "return_code": 6
}
```

### Pre-installed Libraries

The sandbox comes with these packages ready to use:

| Category | Packages |
|----------|----------|
| **Data Science** | pandas, numpy, scipy, scikit-learn, statsmodels |
| **Visualization** | matplotlib, seaborn |
| **File Processing** | openpyxl, xlsxwriter, xlrd, python-pptx, python-docx, pypdf, reportlab, pillow |
| **Math** | sympy, mpmath |
| **Utilities** | tqdm, python-dateutil, pytz, ripgrep (rg), fd, sqlite3, bc |

---

## Section 3: Virtual File System

The VFS is the 5 GiB ephemeral disk inside the sandbox. All file operations — creating, reading, modifying, and deleting files — happen here.

### Exploring the VFS

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {
        "role": "user",
        "content": "Show me the filesystem layout: run df -h, ls -la /tmp, and check total available disk space"
      }
    ]
  }'
```

### Creating Files via bash_code_execution

Claude's code execution provides two sub-tools for file operations:

**Sub-tool 1: `bash_code_execution`** — Run shell commands

```bash
# Claude executes this inside the container:
# mkdir -p /tmp/project && echo "Hello World" > /tmp/project/hello.txt
```

**Response:**

```json
{
  "type": "server_tool_use",
  "id": "srvtoolu_01DEF",
  "name": "bash_code_execution",
  "input": {
    "command": "mkdir -p /tmp/project && echo 'Hello World' > /tmp/project/hello.txt && cat /tmp/project/hello.txt"
  }
},
{
  "type": "bash_code_execution_tool_result",
  "tool_use_id": "srvtoolu_01DEF",
  "content": {
    "type": "bash_code_execution_result",
    "stdout": "Hello World\n",
    "stderr": "",
    "return_code": 0
  }
}
```

**Sub-tool 2: `text_editor_code_execution`** — View, create, and edit files

```json
{
  "type": "server_tool_use",
  "id": "srvtoolu_01GHI",
  "name": "text_editor_code_execution",
  "input": {
    "command": "create",
    "path": "/tmp/project/config.json",
    "file_text": "{\n  \"name\": \"my-project\",\n  \"version\": \"1.0.0\"\n}"
  }
},
{
  "type": "text_editor_code_execution_tool_result",
  "tool_use_id": "srvtoolu_01GHI",
  "content": {
    "type": "text_editor_code_execution_result",
    "is_file_update": false
  }
}
```

### Text Editor Operations

| Command | Purpose | Key Fields |
|---------|---------|------------|
| `create` | Create a new file | `path`, `file_text` |
| `view` | Read file contents | `path`, optional `view_range` |
| `str_replace` | Replace text in a file | `path`, `old_str`, `new_str` |
| `insert` | Insert text at a line | `path`, `insert_line`, `new_str` |

### View File Response

```json
{
  "type": "text_editor_code_execution_result",
  "file_type": "text",
  "content": "{\n  \"name\": \"my-project\",\n  \"version\": \"1.0.0\"\n}",
  "numLines": 4,
  "startLine": 1,
  "totalLines": 4
}
```

### Str_replace Response (Diff Format)

```json
{
  "type": "text_editor_code_execution_result",
  "oldStart": 3,
  "oldLines": 1,
  "newStart": 3,
  "newLines": 1,
  "lines": [
    "-  \"version\": \"1.0.0\"",
    "+  \"version\": \"2.0.0\""
  ]
}
```

### Files Generated by Code Execution

When code execution creates downloadable files (charts, spreadsheets, etc.), the response includes `file_id` references:

```json
{
  "type": "bash_code_execution_result",
  "content": [
    {
      "type": "file",
      "file_id": "file_01ABC123",
      "filename": "chart.png"
    }
  ]
}
```

---

## Section 4: Container Reuse & File Persistence

This is the critical mechanism for stateful multi-turn workflows. Files created in one turn persist in the container and are available in the next turn.

### Turn 1: Create Files

```bash
RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {
        "role": "user",
        "content": "Create a Python script at /tmp/analyze.py that reads a CSV file, calculates statistics, and saves results. Also create a sample CSV at /tmp/data.csv with 10 rows of sales data."
      }
    ]
  }')

# Extract the container ID for reuse
CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.container.id')
echo "Container ID: $CONTAINER_ID"
```

### Turn 2: Read and Modify Files (Same Container)

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "container": "'$CONTAINER_ID'",
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {
        "role": "user",
        "content": "Run the analyze.py script on the data.csv file. Then show me the results."
      }
    ]
  }'
```

### Turn 3: Build on Previous Results

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "container": "'$CONTAINER_ID'",
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {
        "role": "user",
        "content": "Use the results from the previous analysis to generate a matplotlib chart and save it as /tmp/chart.png"
      }
    ]
  }'
```

### Container Reuse: Two Formats

The `container` parameter at the top level of the request accepts two formats:

```bash
# Format 1: String — just reuse the container (no skills)
"container": "container_01JKX8WR3QHS1MNEAYS73NNFZD"

# Format 2: Object — reuse container AND configure skills
"container": {
  "id": "container_01JKX8WR3QHS1MNEAYS73NNFZD",
  "skills": [
    {"type": "anthropic", "skill_id": "xlsx", "version": "latest"}
  ]
}
```

**Important**: `container` is a **top-level request field**, not inside `messages` or `tools`.

### Passing Environment Variables to the Container

The `container` parameter currently only supports `id` and `skills` — there is **no** `environment`, `env`, or `secrets` field. However, there are three workarounds to get configuration data into the sandbox:

**Approach 1: Via `container_upload` (Recommended)**

Upload a config file via the Files API and load it into the container:

```bash
# Upload a .env or config file
FILE_ID=$(curl -s https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  -F "file=@config.env" | jq -r '.id')

# Load into container and use it
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25,files-api-2025-04-14" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [{
      "role": "user",
      "content": [
        {"type": "container_upload", "file_id": "'$FILE_ID'"},
        {"type": "text", "text": "Source the uploaded config.env file, then run analysis.py using those environment variables."}
      ]
    }]
  }'
```

**Approach 2: Via message text**

Pass key-value pairs directly in the prompt and ask Claude to set them:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [{
      "role": "user",
      "content": "Set these environment variables before running the script:\nexport DB_HOST=localhost\nexport DB_PORT=5432\nexport MODE=production\n\nThen run: python3 /tmp/app.py"
    }]
  }'
```

**Approach 3: Via container reuse (setup turn)**

Use a first turn to configure the environment, then reuse the container:

```bash
# Turn 1: Set up environment
RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [{
      "role": "user",
      "content": "Write a file /tmp/.env with these values:\nAPI_KEY=abc123\nMODE=production\nMAX_RETRIES=3"
    }]
  }')

CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.container.id')

# Turn 2: Use the pre-configured container
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "container": "'$CONTAINER_ID'",
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [{
      "role": "user",
      "content": "Source /tmp/.env and run the analysis pipeline"
    }]
  }'
```

**Important caveats:**
- All three approaches pass data through the message body, so values are **visible to the model** in its context window.
- Since the sandbox has **no internet access**, API keys for external services won't be usable anyway.
- There is no way to inject secrets that are opaque to the model.

---

## Section 5: Files API Bridge

The Files API is the bridge for moving files between your local system and the container.

### Direction 1: Your System → Container (`container_upload`)

Upload a file via the Files API, then load it into the container using the `container_upload` content block:

**Step 1: Upload to Files API**

```bash
FILE_ID=$(curl -s https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  -F "file=@sales_data.csv" | jq -r '.id')

echo "Uploaded file: $FILE_ID"
```

**Step 2: Load into Container with `container_upload`**

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25,files-api-2025-04-14" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "container_upload",
            "file_id": "'$FILE_ID'"
          },
          {
            "type": "text",
            "text": "Analyze this CSV file using pandas. Show summary statistics and create a chart."
          }
        ]
      }
    ]
  }'
```

### `container_upload` vs `document` vs `image`

| Content Block | Where File Goes | Use Case |
|--------------|----------------|----------|
| `container_upload` | Container's filesystem (VFS) | Data files for code execution (CSV, JSON, Excel) |
| `document` | Model's context window | Text/PDF for Claude to read directly |
| `image` | Model's context window | Images for vision analysis |

**Key difference**: `container_upload` puts the file on disk inside the container so code can process it. `document` and `image` put the content into Claude's context for direct understanding.

### Direction 2: Container → Your System (`file_id` + Files API)

When code execution generates files, they get `file_id` references. Download them via the Files API:

**Step 1: Extract file IDs from response**

```bash
# From the response content array:
FILE_IDS=$(echo "$RESPONSE" | jq -r '
  .content[] |
  select(.type == "bash_code_execution_tool_result") |
  .content.content[]? |
  select(.file_id) |
  .file_id
')
```

**Step 2: Get metadata**

```bash
for FILE_ID in $FILE_IDS; do
  curl -s "https://api.anthropic.com/v1/files/$FILE_ID" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: files-api-2025-04-14"
done
```

**Step 3: Download content**

```bash
for FILE_ID in $FILE_IDS; do
  FILENAME=$(curl -s "https://api.anthropic.com/v1/files/$FILE_ID" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: files-api-2025-04-14" | jq -r '.filename')

  curl -s "https://api.anthropic.com/v1/files/$FILE_ID/content" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: files-api-2025-04-14" \
    --output "$FILENAME"

  echo "Downloaded: $FILENAME"
done
```

### Complete File Lifecycle

```
┌─────────┐   Upload    ┌──────────┐  container_upload  ┌───────────┐
│ Local   │ ──────────> │ Files API│ ─────────────────> │ Container │
│ System  │             │ file_xxx │                    │ VFS       │
└─────────┘             └──────────┘                    └───────────┘
     ▲                       ▲                               │
     │    Download           │   file_id in response         │
     │   /content            │                               │
     └───────────────────────┴───────────────── Code creates files
```

---

## Section 6: Skills and the VFS

When you configure skills, their files are automatically loaded into the container's VFS at `/skills/{directory}/`.

### How Skills Use the VFS

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "container": {
      "skills": [
        {"type": "anthropic", "skill_id": "xlsx", "version": "latest"},
        {"type": "anthropic", "skill_id": "pptx", "version": "latest"}
      ]
    },
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {
        "role": "user",
        "content": "List the contents of /skills/ to see what got loaded, then create an Excel file with quarterly sales data."
      }
    ]
  }'
```

### What Gets Loaded

When skills are configured:

1. **Skill metadata** (name, description) is injected into the system prompt
2. **Skill files** (SKILL.md, scripts, templates) are copied to `/skills/{skill_name}/`
3. **Claude reads the SKILL.md** to understand how to use the skill
4. **Generated files** appear on the VFS and get `file_id` references for download

### Skills + Container Reuse

Skills must be re-specified when reusing a container (they're loaded fresh each turn):

```bash
# Turn 1: Create with xlsx skill
RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "container": {
      "skills": [{"type": "anthropic", "skill_id": "xlsx", "version": "latest"}]
    },
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {"role": "user", "content": "Create a sales spreadsheet and save the raw data as /tmp/sales.csv too"}
    ]
  }')

CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.container.id')

# Turn 2: Reuse container, add pptx skill — the /tmp/sales.csv from Turn 1 still exists
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "container": {
      "id": "'$CONTAINER_ID'",
      "skills": [{"type": "anthropic", "skill_id": "pptx", "version": "latest"}]
    },
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {"role": "user", "content": "Read the /tmp/sales.csv file and create a PowerPoint presentation with those numbers"}
    ]
  }'
```

---

## Section 7: Error Handling

### Error Codes

| Error | Description | Recovery |
|-------|-------------|----------|
| `container_expired` | Container no longer available (30-day or inactivity timeout) | Start new container; files are lost |
| `file_not_found` | Text editor: file doesn't exist at path | Check path; create file first |
| `string_not_found` | Text editor: `old_str` not found in file | Read file to verify current content |
| `execution_time_exceeded` | Code took too long | Optimize code or break into smaller steps |
| `unavailable` | Code execution temporarily unavailable | Retry after brief wait |
| `too_many_requests` | Rate limit exceeded | Back off and retry |
| `invalid_tool_input` | Invalid parameters sent to sub-tool | Fix input format |

### Handling `pause_turn`

Long-running operations (especially with skills) may return `stop_reason: "pause_turn"`. This means Claude paused mid-operation and needs to continue:

```bash
#!/bin/bash

MAX_RETRIES=10
MESSAGES='[{"role": "user", "content": "Create a complex financial model with 10 scenarios in Excel"}]'

for i in $(seq 1 $MAX_RETRIES); do
  RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
    -H "content-type: application/json" \
    -d "$(jq -n \
      --argjson msgs "$MESSAGES" \
      --arg cid "${CONTAINER_ID:-}" \
      '{
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 4096,
        container: (if $cid == "" then {skills: [{type:"anthropic",skill_id:"xlsx",version:"latest"}]} else {id: $cid, skills: [{type:"anthropic",skill_id:"xlsx",version:"latest"}]} end),
        tools: [{type: "code_execution_20250825", name: "code_execution"}],
        messages: $msgs
      }')")

  STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
  CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.container.id')
  CONTENT=$(echo "$RESPONSE" | jq -c '.content')

  echo "Turn $i: stop_reason=$STOP_REASON"

  if [ "$STOP_REASON" != "pause_turn" ]; then
    echo "Complete!"
    break
  fi

  # Feed the partial response back to continue
  MESSAGES=$(echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{role: "assistant", content: $c}]')
done
```

### Container Expiration Check

```bash
# Check if a container is still alive before reusing it
RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "container": "'$CONTAINER_ID'",
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {"role": "user", "content": "Run: echo alive"}
    ]
  }')

# If container_expired, the response will contain an error
ERROR=$(echo "$RESPONSE" | jq -r '.error.type // empty')
if [ "$ERROR" = "container_expired" ]; then
  echo "Container expired — starting fresh"
  unset CONTAINER_ID
fi
```

---

## Section 8: Complete Multi-Turn Workflow

A full end-to-end example: upload a CSV, analyze it, generate a chart, create an Excel report, and download everything.

```bash
#!/bin/bash
set -e

# ── Configuration ──
API_URL="https://api.anthropic.com/v1"
HEADERS=(
  -H "x-api-key: $ANTHROPIC_API_KEY"
  -H "anthropic-version: 2023-06-01"
)
BETA_CODE="-H anthropic-beta: code-execution-2025-08-25"
BETA_FILES="-H anthropic-beta: files-api-2025-04-14"
BETA_SKILLS="-H anthropic-beta: skills-2025-10-02"

# ── Helper: extract file IDs from response ──
extract_file_ids() {
  echo "$1" | jq -r '
    .content[]? |
    select(.type == "bash_code_execution_tool_result") |
    .content.content[]? |
    select(.file_id) |
    "\(.file_id)|\(.filename)"
  '
}

# ── Helper: download files ──
download_files() {
  local response="$1"
  extract_file_ids "$response" | while IFS='|' read -r fid fname; do
    if [ -n "$fid" ] && [ "$fid" != "null" ]; then
      curl -s "$API_URL/files/$fid/content" \
        "${HEADERS[@]}" \
        -H "anthropic-beta: files-api-2025-04-14" \
        --output "$fname"
      echo "  Downloaded: $fname ($(wc -c < "$fname") bytes)"
    fi
  done
}

# ── Step 1: Create sample CSV locally ──
echo "=== Step 1: Creating sample data ==="
cat > /tmp/sales_input.csv << 'EOF'
month,product,revenue,units,region
Jan,Widget A,15000,120,North
Feb,Widget A,18000,145,North
Mar,Widget A,22000,178,North
Jan,Widget B,9000,60,South
Feb,Widget B,11000,73,South
Mar,Widget B,14000,95,South
Jan,Widget C,7500,200,East
Feb,Widget C,8200,220,East
Mar,Widget C,9800,265,East
EOF
echo "  Created /tmp/sales_input.csv"

# ── Step 2: Upload CSV to Files API ──
echo ""
echo "=== Step 2: Uploading to Files API ==="
UPLOAD=$(curl -s "$API_URL/files" \
  "${HEADERS[@]}" \
  -H "anthropic-beta: files-api-2025-04-14" \
  -F "file=@/tmp/sales_input.csv")

FILE_ID=$(echo "$UPLOAD" | jq -r '.id')
echo "  File ID: $FILE_ID"

# ── Step 3: Load into container + analyze ──
echo ""
echo "=== Step 3: Analyzing data in container ==="
RESPONSE=$(curl -s "$API_URL/messages" \
  "${HEADERS[@]}" \
  -H "anthropic-beta: code-execution-2025-08-25,files-api-2025-04-14" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 8192,
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [{
      "role": "user",
      "content": [
        {"type": "container_upload", "file_id": "'$FILE_ID'"},
        {"type": "text", "text": "1. Read the uploaded CSV file.\n2. Calculate summary statistics per product.\n3. Create a bar chart comparing revenue by product and save as /tmp/revenue_chart.png.\n4. Save the summary statistics to /tmp/summary.csv"}
      ]
    }]
  }')

CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.container.id')
echo "  Container ID: $CONTAINER_ID"
echo "  Downloading generated files..."
download_files "$RESPONSE"

# ── Step 4: Reuse container + generate Excel report with skills ──
echo ""
echo "=== Step 4: Generating Excel report (reusing container) ==="

# Handle pause_turn for skills
MESSAGES='[{"role": "user", "content": "Using the /tmp/summary.csv file already in the container, create a polished Excel report with formatted tables and a chart sheet."}]'
MAX_RETRIES=5

for i in $(seq 1 $MAX_RETRIES); do
  RESPONSE=$(curl -s "$API_URL/messages" \
    "${HEADERS[@]}" \
    -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
    -H "content-type: application/json" \
    -d "$(jq -n \
      --argjson msgs "$MESSAGES" \
      --arg cid "$CONTAINER_ID" \
      '{
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 8192,
        container: {id: $cid, skills: [{type:"anthropic",skill_id:"xlsx",version:"latest"}]},
        tools: [{type:"code_execution_20250825",name:"code_execution"}],
        messages: $msgs
      }')")

  STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
  CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.container.id')
  echo "  Turn $i: stop_reason=$STOP_REASON"

  if [ "$STOP_REASON" != "pause_turn" ]; then
    break
  fi

  CONTENT=$(echo "$RESPONSE" | jq -c '.content')
  MESSAGES=$(echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{role:"assistant",content:$c}]')
done

echo "  Downloading Excel report..."
download_files "$RESPONSE"

# ── Step 5: Verify files in container still exist ──
echo ""
echo "=== Step 5: Verifying file persistence ==="
VERIFY=$(curl -s "$API_URL/messages" \
  "${HEADERS[@]}" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "container": "'$CONTAINER_ID'",
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {"role": "user", "content": "List all files in /tmp/ to verify everything is still there"}
    ]
  }')

echo "  Files in container:"
echo "$VERIFY" | jq -r '.content[] | select(.type=="bash_code_execution_tool_result") | .content.stdout' | sed 's/^/    /'

# ── Step 6: Cleanup ──
echo ""
echo "=== Step 6: Cleanup ==="
curl -s -X DELETE "$API_URL/files/$FILE_ID" \
  "${HEADERS[@]}" \
  -H "anthropic-beta: files-api-2025-04-14" > /dev/null
echo "  Deleted uploaded file: $FILE_ID"

echo ""
echo "=== Workflow complete ==="
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

1. **Reuse containers** for multi-turn workflows. Extract `container.id` from the first response and pass it in subsequent requests.

2. **Use `container_upload` for data files**. Don't use `document` for CSVs or Excel files that need code processing — use `container_upload` to load them onto the VFS.

3. **Handle `pause_turn`** in a loop. Skills and complex code execution may need multiple turns to complete.

4. **Download files promptly**. Files are tied to the container lifetime (30 days max). Download important outputs immediately.

5. **Respect sandbox constraints**. No internet access means you can't `pip install` or fetch external data from within the container. Upload everything the code needs beforehand.

6. **Monitor disk usage**. The 5 GiB VFS is shared across all turns. Clean up large intermediate files if needed.

7. **Combine container reuse with different skills per turn**. The container preserves files across turns, but skills can be swapped. Use xlsx in one turn, pptx in the next, while accessing the same data files.

8. **Check for container expiration** before assuming a container is still alive, especially in long-running pipelines.

---

## Related Examples

- [Example 05: Files API](example-05-files-api.md) — File upload, download, and reuse
- [Example 19: Agent Skills](example-19-agent-skills.md) — Skills with container configuration
- [Example 21: Full-Stack Autonomous Agent](example-21-full-stack-agent.md) — All tools combined including code execution
- [Example 23: Custom Tools & Client-Side Agents Outside Containers](example-23-custom-skills-client-tools.md) — Custom tool definitions + bash/text_editor outside containers
