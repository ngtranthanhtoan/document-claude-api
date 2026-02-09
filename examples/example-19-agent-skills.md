# Example 19: Agent Skills

> Extend Claude's capabilities with modular skills for document generation (Excel, PowerPoint, Word, PDF).

## Overview

- **Difficulty**: Expert
- **Features Used**: Agent Skills, Code Execution Tool, Files API
- **Beta Headers Required**: `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`
- **Use Cases**:
  - Spreadsheet creation and analysis
  - Presentation building
  - Document generation
  - Financial modeling
  - Report automation

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Understanding of tool use and file handling

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

Anthropic provides these ready-to-use skills:

| Skill ID | Description |
|----------|-------------|
| `pptx` | Create and edit PowerPoint presentations |
| `xlsx` | Create spreadsheets, analyze data, generate charts |
| `docx` | Create and format Word documents |
| `pdf` | Generate formatted PDF documents |

---

## Basic Usage: Create an Excel File

### Request

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
        "content": "Create an Excel file with a monthly budget spreadsheet. Include columns for category, budgeted amount, actual amount, and difference."
      }
    ]
  }'
```

### Response

The response includes a `file_id` for the generated Excel file:

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

```bash
curl https://api.anthropic.com/v1/files/file_01XYZ123 \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14"
```

**Response:**
```json
{
  "id": "file_01XYZ123",
  "filename": "monthly_budget.xlsx",
  "size_bytes": 8432,
  "created_at": "2025-01-15T10:30:00Z"
}
```

### Step 2: Download File Content

```bash
curl https://api.anthropic.com/v1/files/file_01XYZ123/content \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  --output monthly_budget.xlsx
```

---

## Create a PowerPoint Presentation

### Request

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
          "type": "anthropic",
          "skill_id": "pptx",
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
        "content": "Create a 5-slide presentation about renewable energy. Include a title slide, overview, solar power, wind power, and conclusion."
      }
    ]
  }'
```

---

## Using Multiple Skills

Combine skills for complex workflows.

### Request

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
          "type": "anthropic",
          "skill_id": "xlsx",
          "version": "latest"
        },
        {
          "type": "anthropic",
          "skill_id": "pptx",
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
        "content": "Analyze the following sales data and create both an Excel file with charts and a PowerPoint presentation summarizing the key insights:\n\nQ1: $150,000\nQ2: $180,000\nQ3: $165,000\nQ4: $220,000"
      }
    ]
  }'
```

---

## Multi-Turn Conversations

Reuse the same container across messages.

### Turn 1: Create Initial File

```bash
RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "container": {
      "skills": [
        {"type": "anthropic", "skill_id": "xlsx", "version": "latest"}
      ]
    },
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {"role": "user", "content": "Create a sales tracking spreadsheet with sample data"}
    ]
  }')

CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.container.id')
echo "Container ID: $CONTAINER_ID"
```

### Turn 2: Modify File (Reusing Container)

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
      "id": "'$CONTAINER_ID'",
      "skills": [
        {"type": "anthropic", "skill_id": "xlsx", "version": "latest"}
      ]
    },
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {"role": "user", "content": "Create a sales tracking spreadsheet with sample data"},
      {"role": "assistant", "content": "...previous response..."},
      {"role": "user", "content": "Add a chart showing monthly trends"}
    ]
  }'
```

---

## Handling Long Operations (pause_turn)

Skills may return `pause_turn` for long-running operations.

### Request with Loop

```bash
#!/bin/bash

MAX_RETRIES=10
MESSAGES='[{"role": "user", "content": "Create a detailed financial model with 10 scenarios"}]'

for i in $(seq 1 $MAX_RETRIES); do
  RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
    -H "content-type: application/json" \
    -d "$(jq -n \
      --argjson msgs "$MESSAGES" \
      --arg container_id "${CONTAINER_ID:-}" \
      '{
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 4096,
        container: (
          if $container_id == "" then
            {skills: [{type: "anthropic", skill_id: "xlsx", version: "latest"}]}
          else
            {id: $container_id, skills: [{type: "anthropic", skill_id: "xlsx", version: "latest"}]}
          end
        ),
        tools: [{type: "code_execution_20250825", name: "code_execution"}],
        messages: $msgs
      }')")

  STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
  CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.container.id')
  CONTENT=$(echo "$RESPONSE" | jq -c '.content')

  echo "Iteration $i: stop_reason = $STOP_REASON"

  if [ "$STOP_REASON" != "pause_turn" ]; then
    echo "Complete!"
    echo "$RESPONSE" | jq -r '.content[] | select(.type=="text") | .text'
    break
  fi

  # Continue with the assistant's partial response
  MESSAGES=$(echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{role: "assistant", content: $c}]')
done
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
description: Perform financial analysis including DCF valuation, ratio analysis, and forecasting. Use when working with financial statements or valuation tasks.
---

# Financial Analysis Skill

## Quick Start

Use pandas for data analysis:

```python
import pandas as pd

def calculate_ratios(data):
    return {
        'current_ratio': data['current_assets'] / data['current_liabilities'],
        'debt_to_equity': data['total_debt'] / data['total_equity']
    }
```

## DCF Valuation

For DCF models, see [DCF.md](DCF.md).

## Available Scripts

- `analyze.py` - Financial ratio calculations
- `forecast.py` - Revenue forecasting
```

### Upload Custom Skill

```bash
curl -X POST https://api.anthropic.com/v1/skills \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02" \
  -F "display_title=Financial Analysis" \
  -F "files[]=@my-skill/SKILL.md;filename=my-skill/SKILL.md" \
  -F "files[]=@my-skill/analyze.py;filename=my-skill/analyze.py"
```

**Response:**
```json
{
  "id": "skill_01AbCdEfGhIjKlMnOpQrStUv",
  "display_title": "Financial Analysis",
  "source": "custom",
  "latest_version": "1759178010641129",
  "created_at": "2025-01-15T10:30:00Z"
}
```

### Use Custom Skill

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
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {"role": "user", "content": "Perform a DCF valuation for a company with $10M revenue growing at 15% annually"}
    ]
  }'
```

---

## Skills API Operations

### List All Skills

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

### Get Skill Details

```bash
curl https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"
```

### Create New Version

```bash
curl -X POST https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02" \
  -F "files[]=@updated-skill/SKILL.md;filename=updated-skill/SKILL.md"
```

### Delete Skill

```bash
# Must delete all versions first
curl -X DELETE https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv/versions/1759178010641129 \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"

# Then delete the skill
curl -X DELETE https://api.anthropic.com/v1/skills/skill_01AbCdEfGhIjKlMnOpQrStUv \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02"
```

---

## Complete Workflow Script

```bash
#!/bin/bash

# Complete Agent Skills Workflow

# Step 1: Create Excel file with skills
echo "Creating spreadsheet..."
RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "container": {
      "skills": [
        {"type": "anthropic", "skill_id": "xlsx", "version": "latest"}
      ]
    },
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [
      {"role": "user", "content": "Create a quarterly sales report with sample data and a chart"}
    ]
  }')

# Step 2: Extract file ID from response
FILE_ID=$(echo "$RESPONSE" | jq -r '
  .content[] |
  select(.type == "bash_code_execution_tool_result") |
  .content.content[] |
  select(.file_id) |
  .file_id
')

if [ -z "$FILE_ID" ] || [ "$FILE_ID" = "null" ]; then
  echo "No file was created"
  echo "$RESPONSE" | jq -r '.content[] | select(.type=="text") | .text'
  exit 1
fi

echo "File created: $FILE_ID"

# Step 3: Get file metadata
METADATA=$(curl -s "https://api.anthropic.com/v1/files/$FILE_ID" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14")

FILENAME=$(echo "$METADATA" | jq -r '.filename')
echo "Filename: $FILENAME"

# Step 4: Download the file
curl -s "https://api.anthropic.com/v1/files/$FILE_ID/content" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  --output "$FILENAME"

echo "Downloaded: $FILENAME"
ls -la "$FILENAME"
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

```bash
# Production: Pin specific version
"skills": [{"type": "custom", "skill_id": "skill_01ABC", "version": "1759178010641129"}]

# Development: Use latest
"skills": [{"type": "custom", "skill_id": "skill_01ABC", "version": "latest"}]
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
- [Example 23: Custom Skills & Client-Side Tool Agents](example-23-custom-skills-client-tools.md) - Custom skills deep dive + bash/text_editor outside containers
