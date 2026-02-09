# Example 23: Custom Tools & Client-Side Agents Outside Containers

> Define custom tools and use built-in bash/text_editor to build agents that run entirely on your own machine — no containers needed.

## Overview

- **Difficulty**: Expert
- **Features Used**: Custom Tool Definitions, Local Skills, Bash Tool (client), Text Editor Tool (client)
- **Beta Headers Required**: None
- **Use Cases**:
  - Building domain-specific tool agents without containers
  - Local skills — reusable instruction + script packages executed on your machine
  - Local development automation with bash + text_editor
  - Agentic code editing, testing, and deployment
  - CI/CD integration with Claude as a tool-using agent
  - Custom workflow automation on your own infrastructure

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Understanding of [Example 06: Tool Use Basics](example-06-tool-use-basics.md)
- A local environment where Claude's commands will be executed
- `jq` installed for the bash scripts

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

The `bash_20250124` tool requires **no beta header**. Claude requests a command, you execute it on your machine, and return the output.

### Step 1: Send Request

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

## Built-in Client Tools: Text Editor

The `text_editor_20250728` tool also requires **no beta header**. Claude requests file operations, you execute them locally.

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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "tools": [
      {
        "type": "bash_20250124",
        "name": "bash"
      },
      {
        "type": "text_editor_20250728",
        "name": "str_replace_based_edit_tool"
      },
      {
        "name": "run_tests",
        "description": "Run the test suite for the project. Returns test output including pass/fail results and error messages.",
        "input_schema": {
          "type": "object",
          "properties": {
            "test_path": {
              "type": "string",
              "description": "Path to test file or directory"
            },
            "framework": {
              "type": "string",
              "enum": ["pytest", "jest", "go_test", "cargo_test"],
              "description": "Test framework to use"
            },
            "verbose": {
              "type": "boolean",
              "description": "Enable verbose output"
            }
          },
          "required": ["test_path", "framework"]
        }
      },
      {
        "name": "query_database",
        "description": "Execute a read-only SQL query against the project database. Returns results as JSON.",
        "input_schema": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "SQL SELECT query to execute"
            },
            "database": {
              "type": "string",
              "description": "Database name",
              "enum": ["app_db", "analytics_db"]
            }
          },
          "required": ["query", "database"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Check if any tests are failing in /home/user/project/tests, then look at the database to see how many users signed up today."
      }
    ]
  }'
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

```bash
# When Claude calls "run_tests":
if [ "$TOOL_NAME" = "run_tests" ]; then
  TEST_PATH=$(echo "$TOOL_INPUT" | jq -r '.test_path')
  FRAMEWORK=$(echo "$TOOL_INPUT" | jq -r '.framework')
  VERBOSE=$(echo "$TOOL_INPUT" | jq -r '.verbose // false')

  case "$FRAMEWORK" in
    pytest)
      FLAGS=""
      [ "$VERBOSE" = "true" ] && FLAGS="-v"
      RESULT=$(cd "$(dirname "$TEST_PATH")" && python -m pytest "$TEST_PATH" $FLAGS 2>&1)
      ;;
    jest)
      RESULT=$(npx jest "$TEST_PATH" 2>&1)
      ;;
  esac
fi

# When Claude calls "query_database":
if [ "$TOOL_NAME" = "query_database" ]; then
  QUERY=$(echo "$TOOL_INPUT" | jq -r '.query')
  DB=$(echo "$TOOL_INPUT" | jq -r '.database')

  # Only allow SELECT queries for safety
  if echo "$QUERY" | grep -iqE '^(insert|update|delete|drop|alter|create)'; then
    RESULT="Error: Only SELECT queries are allowed"
  else
    RESULT=$(psql -d "$DB" -c "$QUERY" --csv 2>&1)
  fi
fi
```

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

### Skill Loader Script

The skill loader reads SKILL.md files and injects them into the `system` prompt.

```bash
#!/bin/bash

# Load one or more local skills into a system prompt
SKILLS_DIR="/home/user/skills"

load_skill() {
  local skill_name="$1"
  local skill_path="$SKILLS_DIR/$skill_name/SKILL.md"

  if [ ! -f "$skill_path" ]; then
    echo "Error: Skill not found: $skill_path" >&2
    return 1
  fi

  cat "$skill_path"
}

# Build system prompt from multiple skills
build_system_prompt() {
  local prompt="You have access to the following local skills. Use bash to execute their scripts.\n\n"

  for skill_name in "$@"; do
    prompt+="---\n\n"
    prompt+="$(load_skill "$skill_name")\n\n"
  done

  echo "$prompt"
}

# Build the system prompt
SYSTEM_PROMPT=$(build_system_prompt "data-validator" "test-runner")

# Make the API call with skills injected
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$(jq -n \
    --arg system "$SYSTEM_PROMPT" \
    '{
      "model": "claude-sonnet-4-5-20250514",
      "max_tokens": 4096,
      "system": $system,
      "tools": [
        {"type": "bash_20250124", "name": "bash"}
      ],
      "messages": [
        {
          "role": "user",
          "content": "Validate the data in /tmp/customers.csv against the customer schema and generate a report."
        }
      ]
    }')"
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

```bash
# Load data-validator + test-runner skills
SYSTEM_PROMPT=$(build_system_prompt "data-validator" "test-runner")

# Claude can now use both skills in one conversation
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$(jq -n \
    --arg system "$SYSTEM_PROMPT" \
    '{
      "model": "claude-sonnet-4-5-20250514",
      "max_tokens": 4096,
      "system": $system,
      "tools": [
        {"type": "bash_20250124", "name": "bash"}
      ],
      "messages": [
        {
          "role": "user",
          "content": "Validate /tmp/customers.csv, then run the test suite to make sure nothing is broken."
        }
      ]
    }')"
```

---

## Mixing Built-in + Custom Tools

You can combine Anthropic's built-in client tools with your own custom tools in a single request. Claude uses built-in tools for general operations and your custom tools for domain-specific tasks.

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [
      {"type": "bash_20250124", "name": "bash"},
      {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
      {
        "name": "deploy",
        "description": "Deploy the application to the specified environment. Returns deployment status and URL.",
        "input_schema": {
          "type": "object",
          "properties": {
            "environment": {"type": "string", "enum": ["staging", "production"]},
            "version": {"type": "string", "description": "Git tag or commit hash to deploy"}
          },
          "required": ["environment", "version"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Fix the bug in src/auth.py where the token validation is failing, run the tests, and if they pass, deploy to staging."
      }
    ]
  }'
```

Claude will:
1. Use `text_editor` to read and fix `src/auth.py`
2. Use `bash` to run `pytest`
3. Use `deploy` (your custom tool) to deploy to staging

All executed on your machine, with your permissions, on your network.

---

## Complete Agentic Loop

A full script that loops until Claude finishes the task.

```bash
#!/bin/bash

# Agentic loop with built-in + custom tools
# All execution happens on your machine — no containers

TOOLS='[
  {"type": "bash_20250124", "name": "bash"},
  {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
  {
    "name": "run_tests",
    "description": "Run tests for the project. Returns pass/fail results.",
    "input_schema": {
      "type": "object",
      "properties": {
        "test_path": {"type": "string", "description": "Path to test file or directory"},
        "framework": {"type": "string", "enum": ["pytest", "jest", "go_test"]}
      },
      "required": ["test_path", "framework"]
    }
  }
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
      printf '%s' "$file_text" > "$path"
      echo "File created successfully at $path"
      ;;
    view)
      echo "[EDITOR] Viewing: $path"
      cat -n "$path"
      ;;
    str_replace)
      echo "[EDITOR] Replacing in: $path"
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

execute_run_tests() {
  local test_path="$1"
  local framework="$2"
  echo "[TESTS] Running $framework on $test_path"
  case "$framework" in
    pytest)   python -m pytest "$test_path" -v 2>&1 ;;
    jest)     npx jest "$test_path" 2>&1 ;;
    go_test)  go test "$test_path" -v 2>&1 ;;
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

    case "$TOOL_NAME" in
      bash)
        CMD=$(echo "$TOOL_INPUT" | jq -r '.command')
        RESULT=$(execute_bash "$CMD")
        ;;
      str_replace_based_edit_tool)
        ED_CMD=$(echo "$TOOL_INPUT" | jq -r '.command')
        ED_PATH=$(echo "$TOOL_INPUT" | jq -r '.path')
        ED_FILE_TEXT=$(echo "$TOOL_INPUT" | jq -r '.file_text // empty')
        ED_OLD=$(echo "$TOOL_INPUT" | jq -r '.old_str // empty')
        ED_NEW=$(echo "$TOOL_INPUT" | jq -r '.new_str // empty')
        ED_LINE=$(echo "$TOOL_INPUT" | jq -r '.insert_line // empty')
        RESULT=$(execute_text_editor "$ED_CMD" "$ED_PATH" "$ED_FILE_TEXT" "$ED_OLD" "$ED_NEW" "$ED_LINE")
        ;;
      run_tests)
        TEST_PATH=$(echo "$TOOL_INPUT" | jq -r '.test_path')
        FRAMEWORK=$(echo "$TOOL_INPUT" | jq -r '.framework')
        RESULT=$(execute_run_tests "$TEST_PATH" "$FRAMEWORK")
        ;;
      *)
        RESULT="Error: Unknown tool $TOOL_NAME"
        ;;
    esac

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

> **WARNING**: Client-side tools execute commands on YOUR machine with YOUR permissions. Unlike `code_execution_20250825`, there is no Anthropic-managed sandbox.

### Recommendations

1. **Run in Docker**: Execute the agentic loop inside a container to isolate filesystem access
2. **Use a restricted user**: Run the script as a non-root user with limited permissions
3. **Whitelist commands**: Validate bash commands before executing them
4. **Add approval prompts**: For destructive operations, ask for human confirmation
5. **Restrict custom tools**: Only allow read-only database queries, limit deploy targets

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

Ask Claude to read test failures, fix the code, and re-run tests:

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

### Database-Driven Bug Investigation

Combine bash, text_editor, and custom database tool:

```json
{
  "role": "user",
  "content": "Users are reporting 500 errors on the /api/orders endpoint. Check the last 100 lines of the error log, query the database for recent failed orders, find the bug in the code, and fix it."
}
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
