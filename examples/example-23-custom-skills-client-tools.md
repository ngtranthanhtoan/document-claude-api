# Example 23: Custom Skills & Client-Side Tool Agents

> Build custom skills for container-based execution and use bash/text_editor tools on your own machine.

## Overview

- **Difficulty**: Expert
- **Features Used**: Custom Skills API, Code Execution Tool, Bash Tool (client), Text Editor Tool (client), Files API
- **Beta Headers Required**: `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`
- **Use Cases**:
  - Building domain-specific skills (data validation, report templates, custom analysis)
  - Managing skill versions across environments
  - Local development automation with bash + text_editor
  - Agentic code editing and testing without containers
  - CI/CD integration with Claude as a tool-using agent

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
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

```bash
curl -X POST https://api.anthropic.com/v1/skills \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02" \
  -F "display_title=Data Validator" \
  -F "files[]=@data-validator/SKILL.md;filename=data-validator/SKILL.md" \
  -F "files[]=@data-validator/src/validate.py;filename=data-validator/src/validate.py" \
  -F "files[]=@data-validator/src/report.py;filename=data-validator/src/report.py" \
  -F "files[]=@data-validator/schemas/customer.json;filename=data-validator/schemas/customer.json" \
  -F "files[]=@data-validator/schemas/order.json;filename=data-validator/schemas/order.json"
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

```bash
# List all skills (Anthropic + custom)
curl https://api.anthropic.com/v1/skills \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"

# List only custom skills
curl "https://api.anthropic.com/v1/skills?source=custom" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"
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

```bash
curl https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"
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

### 4. List Skill Versions

```bash
curl https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"
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

Upload updated files to create a new version:

```bash
curl -X POST https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02" \
  -F "files[]=@data-validator/SKILL.md;filename=data-validator/SKILL.md" \
  -F "files[]=@data-validator/src/validate.py;filename=data-validator/src/validate.py" \
  -F "files[]=@data-validator/src/report.py;filename=data-validator/src/report.py"
```

**Response:**

```json
{
  "version": "1759350810641129",
  "created_at": "2025-01-17T10:30:00Z"
}
```

### 6. Delete a Version

```bash
curl -X DELETE https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions/1759178010641129 \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"
```

### 7. Delete Skill

You must delete all versions first, then delete the skill:

```bash
# Delete remaining versions
curl -X DELETE https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions/1759350810641129 \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"

# Then delete the skill itself
curl -X DELETE https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"
```

---

## Using Custom Skills with Code Execution

### Validate Data with a Custom Skill

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
        {
          "type": "custom",
          "skill_id": "skill_01AbCdEfGhIjKlMnOpQrStUv",
          "version": "latest"
        }
      ]
    },
    "tools": [
      {
        "type": "code_execution_20250825",
        "name": "code_execution"
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Validate this customer data against the customer schema:\n\nname,email,age,status\nAlice,alice@example.com,30,active\nBob,invalid-email,25,active\nCharlie,charlie@example.com,-5,unknown"
      }
    ]
  }'
```

**Response:**

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
        {
          "type": "custom",
          "skill_id": "skill_01AbCdEfGhIjKlMnOpQrStUv",
          "version": "latest"
        },
        {
          "type": "anthropic",
          "skill_id": "xlsx",
          "version": "latest"
        }
      ]
    },
    "tools": [
      {
        "type": "code_execution_20250825",
        "name": "code_execution"
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Validate this customer data and create an Excel report of the validation results:\n\nname,email,age\nAlice,alice@example.com,30\nBob,bad-email,-5"
      }
    ]
  }'
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

```bash
# Development: Use latest (auto-updates when you upload new versions)
"skills": [{"type": "custom", "skill_id": "skill_01ABC", "version": "latest"}]

# Production: Pin a specific version for stability
"skills": [{"type": "custom", "skill_id": "skill_01ABC", "version": "1759178010641129"}]
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

The `bash_20250124` tool requires **no beta header**. Claude requests a command, you execute it on your machine, and return the output.

### Step 1: Send Request with Bash Tool

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "tools": [
      {
        "type": "bash_20250124",
        "name": "bash"
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "List the files in /tmp and tell me how much disk space is used."
      }
    ]
  }'
```

### Step 2: Claude Responds with Tool Use

```json
{
  "id": "msg_01ABC",
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

Execute the command on your machine, then send the output back:

```bash
# Execute the command Claude requested
OUTPUT=$(ls -la /tmp && df -h /tmp 2>&1)

# Send the result back to Claude
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$(jq -n \
    --arg output "$OUTPUT" \
    '{
      "model": "claude-sonnet-4-5-20250514",
      "max_tokens": 1024,
      "tools": [{"type": "bash_20250124", "name": "bash"}],
      "messages": [
        {"role": "user", "content": "List the files in /tmp and tell me how much disk space is used."},
        {"role": "assistant", "content": [
          {"type": "text", "text": "I'\''ll check the files in /tmp and the disk usage."},
          {"type": "tool_use", "id": "toolu_01XYZ", "name": "bash", "input": {"command": "ls -la /tmp && df -h /tmp"}}
        ]},
        {"role": "user", "content": [
          {"type": "tool_result", "tool_use_id": "toolu_01XYZ", "content": $output}
        ]}
      ]
    }')"
```

### Handling Errors

If a command fails, return an error result:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01XYZ",
  "is_error": true,
  "content": "bash: command not found: unknown_command\nExit code: 127"
}
```

---

## Text Editor Tool Standalone

The `text_editor_20250728` tool also requires **no beta header**. Claude requests file operations, and you execute them locally.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "tools": [
      {
        "type": "text_editor_20250728",
        "name": "str_replace_based_edit_tool"
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Create a file at /tmp/hello.py with a simple hello world script."
      }
    ]
  }'
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

### Returning Results

After executing the operation, return the outcome:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01ABC",
  "content": "File created successfully at /tmp/hello.py"
}
```

For `view`, return the file content:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01ABC",
  "content": "1\t#!/usr/bin/env python3\n2\t\n3\tdef main():\n4\t    print(\"Hello, World!\")\n5\t\n6\tif __name__ == \"__main__\":\n7\t    main()\n"
}
```

---

## Complete Agentic Loop: Bash + Text Editor

A full script that loops until Claude finishes the task.

```bash
#!/bin/bash

# Agentic loop with bash + text_editor tools
# Claude creates a Node.js project, writes files, and runs commands on your machine

TOOLS='[
  {"type": "bash_20250124", "name": "bash"},
  {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"}
]'

MESSAGES='[
  {"role": "user", "content": "Create a new Node.js project in /tmp/my-app with a package.json, an index.ts that prints hello world, and run npm init -y."}
]'

MAX_ITERATIONS=15

execute_bash() {
  local cmd="$1"
  echo "[BASH] Executing: $cmd"
  OUTPUT=$(eval "$cmd" 2>&1)
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo "$OUTPUT\nExit code: $EXIT_CODE"
  else
    echo "$OUTPUT"
  fi
}

execute_text_editor() {
  local command="$1"
  local path="$2"
  local file_text="$3"
  local old_str="$4"
  local new_str="$5"
  local insert_line="$6"

  case "$command" in
    create)
      echo "[EDITOR] Creating: $path"
      mkdir -p "$(dirname "$path")"
      echo "$file_text" > "$path"
      echo "File created successfully at $path"
      ;;
    view)
      echo "[EDITOR] Viewing: $path"
      cat -n "$path"
      ;;
    str_replace)
      echo "[EDITOR] Replacing in: $path"
      # Use Python for reliable string replacement
      python3 -c "
import sys
with open('$path', 'r') as f:
    content = f.read()
old = '''$old_str'''
new = '''$new_str'''
if old not in content:
    print('Error: old_str not found in file', file=sys.stderr)
    sys.exit(1)
content = content.replace(old, new, 1)
with open('$path', 'w') as f:
    f.write(content)
print('Replacement successful')
"
      ;;
    insert)
      echo "[EDITOR] Inserting at line $insert_line in: $path"
      sed -i '' "${insert_line}i\\
${new_str}" "$path"
      echo "Insert successful"
      ;;
  esac
}

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "=== Iteration $i ==="

  RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "$(jq -n \
      --argjson tools "$TOOLS" \
      --argjson msgs "$MESSAGES" \
      '{
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 4096,
        tools: $tools,
        messages: $msgs
      }')")

  STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
  CONTENT=$(echo "$RESPONSE" | jq -c '.content')

  echo "Stop reason: $STOP_REASON"

  # Print any text blocks
  echo "$RESPONSE" | jq -r '.content[] | select(.type=="text") | .text'

  # If done, exit the loop
  if [ "$STOP_REASON" != "tool_use" ]; then
    echo ""
    echo "=== Task Complete ==="
    break
  fi

  # Add assistant response to conversation
  MESSAGES=$(echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{"role": "assistant", "content": $c}]')

  # Execute each tool call and collect results
  TOOL_RESULTS="[]"
  for tool_call in $(echo "$CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
    TOOL_ID=$(echo "$tool_call" | jq -r '.id')
    TOOL_NAME=$(echo "$tool_call" | jq -r '.name')
    TOOL_INPUT=$(echo "$tool_call" | jq -c '.input')

    if [ "$TOOL_NAME" = "bash" ]; then
      CMD=$(echo "$TOOL_INPUT" | jq -r '.command')
      RESULT=$(execute_bash "$CMD")
    elif [ "$TOOL_NAME" = "str_replace_based_edit_tool" ]; then
      ED_CMD=$(echo "$TOOL_INPUT" | jq -r '.command')
      ED_PATH=$(echo "$TOOL_INPUT" | jq -r '.path')
      ED_FILE_TEXT=$(echo "$TOOL_INPUT" | jq -r '.file_text // empty')
      ED_OLD=$(echo "$TOOL_INPUT" | jq -r '.old_str // empty')
      ED_NEW=$(echo "$TOOL_INPUT" | jq -r '.new_str // empty')
      ED_LINE=$(echo "$TOOL_INPUT" | jq -r '.insert_line // empty')
      RESULT=$(execute_text_editor "$ED_CMD" "$ED_PATH" "$ED_FILE_TEXT" "$ED_OLD" "$ED_NEW" "$ED_LINE")
    fi

    TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq \
      --arg id "$TOOL_ID" \
      --arg result "$RESULT" \
      '. + [{"type": "tool_result", "tool_use_id": $id, "content": $result}]')
  done

  # Add tool results to conversation
  MESSAGES=$(echo "$MESSAGES" | jq --argjson r "$TOOL_RESULTS" '. + [{"role": "user", "content": $r}]')
done
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

```bash
execute_bash_safe() {
  local cmd="$1"

  # Block dangerous patterns
  if echo "$cmd" | grep -qE '(rm -rf|sudo|chmod 777|mkfs|dd if=)'; then
    echo "BLOCKED: Potentially dangerous command: $cmd"
    echo "Error: Command blocked by safety filter"
    return 1
  fi

  # Require approval for certain operations
  if echo "$cmd" | grep -qE '(rm |mv |cp -r|pip install|npm install)'; then
    echo "APPROVAL NEEDED: $cmd"
    read -p "Execute? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
      echo "Error: Command rejected by user"
      return 1
    fi
  fi

  execute_bash "$cmd"
}
```

See [Example 12: Human in the Loop](example-12-human-in-the-loop.md) for more approval patterns.

---

## Practical Use Cases

### Local Test Runner

Ask Claude to read test failures, fix the code, and re-run tests — all using bash + text_editor on your local machine:

```json
{
  "role": "user",
  "content": "Run the tests in /home/user/project with pytest. If any fail, read the failing test and source file, fix the issue, and re-run until all tests pass."
}
```

### Project Scaffolding

Ask Claude to create a full project structure:

```json
{
  "role": "user",
  "content": "Create a new Express.js API project in /tmp/my-api with TypeScript, ESLint, and a health check endpoint. Initialize git and create an initial commit."
}
```

### Code Review Automation

Give Claude a diff and have it apply fixes:

```json
{
  "role": "user",
  "content": "Review the changes in the current git diff of /home/user/project. Fix any issues you find (type errors, missing error handling, style violations)."
}
```

### Log Analysis

Ask Claude to read and summarize log files:

```json
{
  "role": "user",
  "content": "Read the last 500 lines of /var/log/app/error.log, identify the most common error patterns, and suggest fixes."
}
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
