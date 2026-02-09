# Example 21: Full-Stack Autonomous Agent

> Build a comprehensive agent that combines all of Claude's advanced tools — web search, web fetch, bash, text editor, code execution, tool search, skills, computer use, programmatic tool control, and fine-grained streaming — into a single orchestrated workflow.

## Overview

- **Difficulty**: Expert
- **Features Used**: Bash Tool, Text Editor Tool, Web Search, Web Fetch, Tool Search, Code Execution, Agent Skills, Computer Use, Programmatic Tool Calling, Fine-Grained Tool Streaming
- **Beta Headers Required**: `code-execution-2025-08-25,skills-2025-10-02,web-fetch-2025-09-10,advanced-tool-use-2025-11-20,computer-use-2025-01-24`
- **Use Cases**:
  - Competitive intelligence report generation
  - Automated research pipelines
  - End-to-end deliverable creation (report + spreadsheet + slides)
  - Multi-tool orchestration with phased execution

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- `jq` installed for JSON processing
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

## Combining Multiple Beta Headers

When using tools across multiple betas, combine them as a comma-separated string:

```bash
BETA_HEADERS="code-execution-2025-08-25,skills-2025-10-02,web-fetch-2025-09-10,advanced-tool-use-2025-11-20,computer-use-2025-01-24"

curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: $BETA_HEADERS" \
  -H "content-type: application/json" \
  -d '{...}'
```

Each phase only needs the betas relevant to its tools. The complete script below demonstrates this.

---

## Phase 1: Web Research (web_search + web_fetch)

Search the web for information, then fetch full articles for deep analysis.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: web-fetch-2025-09-10" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "tool_choice": {"type": "tool", "name": "web_search"},
    "tools": [
      {
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": 5
      },
      {
        "type": "web_fetch_20250910",
        "name": "web_fetch",
        "max_uses": 3,
        "max_content_tokens": 50000
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Research the competitive landscape of AI coding assistants. Find recent news, market data, and key players."
      }
    ]
  }'
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
      "input": {"query": "AI coding assistants market share 2025"}
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
  "input": {"url": "https://example.com/ai-coding-report"}
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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "tools": [
      {
        "type": "bash_20250124",
        "name": "bash"
      },
      {
        "type": "code_execution_20250825",
        "name": "code_execution"
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Set up a workspace directory, then analyze this market data and generate a chart:\n\nGitHub Copilot: 45% share, $400M revenue\nCursor: 20% share, $100M revenue\nTabnine: 10% share, $50M revenue\nAmazon CodeWhisperer: 8% share, $35M revenue\nOthers: 17% share, $85M revenue"
      }
    ]
  }'
```

### Response (Bash)

```json
{
  "content": [
    {
      "type": "text",
      "text": "Let me set up the workspace first."
    },
    {
      "type": "tool_use",
      "id": "toolu_02A",
      "name": "bash",
      "input": {
        "command": "mkdir -p /tmp/agent_workspace && echo 'Workspace ready'"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

### Response (Code Execution)

After bash setup, Claude uses code execution for analysis:

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_02B",
      "name": "code_execution",
      "input": {
        "code": "import matplotlib.pyplot as plt\nimport json\n\ndata = {\n    'GitHub Copilot': {'share': 45, 'revenue': 400},\n    'Cursor': {'share': 20, 'revenue': 100},\n    'Tabnine': {'share': 10, 'revenue': 50},\n    'CodeWhisperer': {'share': 8, 'revenue': 35},\n    'Others': {'share': 17, 'revenue': 85}\n}\n\nfig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))\n\n# Market share pie chart\nax1.pie(list(d['share'] for d in data.values()), labels=data.keys(), autopct='%1.0f%%')\nax1.set_title('Market Share')\n\n# Revenue bar chart\nax2.bar(data.keys(), [d['revenue'] for d in data.values()])\nax2.set_ylabel('Revenue ($M)')\nax2.set_title('Revenue by Company')\n\nplt.tight_layout()\nplt.savefig('/tmp/agent_workspace/market_chart.png', dpi=150)\nprint('Chart saved')\n\n# Save analysis as JSON\nanalysis = {'total_market': sum(d['revenue'] for d in data.values()), 'leader': 'GitHub Copilot', 'leader_share': 45}\nwith open('/tmp/agent_workspace/analysis.json', 'w') as f:\n    json.dump(analysis, f)\nprint(json.dumps(analysis, indent=2))"
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
    "stdout": "Chart saved\n{\"total_market\": 670, \"leader\": \"GitHub Copilot\", \"leader_share\": 45}",
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

```json
{
  "type": "tool_use",
  "name": "text_editor",
  "input": {
    "command": "create",
    "path": "/tmp/agent_workspace/report.md",
    "file_text": "# AI Coding Assistants: Competitive Intelligence Report\n\n## Executive Summary\n\nThe AI coding assistant market is valued at $670M with strong growth...\n\n## Market Data\n\n| Company | Market Share | Revenue |\n|---|---|---|\n| GitHub Copilot | 45% | $400M |\n| Cursor | 20% | $100M |\n| Tabnine | 10% | $50M |\n| CodeWhisperer | 8% | $35M |\n| Others | 17% | $85M |\n\n## Key Findings\n\nTBD\n\n## Recommendations\n\nTBD"
  }
}
```

### Edit Report Section

```json
{
  "type": "tool_use",
  "name": "text_editor",
  "input": {
    "command": "str_replace",
    "path": "/tmp/agent_workspace/report.md",
    "old_str": "## Key Findings\n\nTBD",
    "new_str": "## Key Findings\n\n1. **Market concentration**: GitHub Copilot dominates with 45% share\n2. **Rapid growth**: Total market grew 85% YoY\n3. **Enterprise adoption**: 67% of Fortune 500 now use AI coding tools\n4. **Revenue per user**: Average $15/month across all platforms"
  }
}
```

### Review Final Output

```json
{
  "type": "tool_use",
  "name": "text_editor",
  "input": {
    "command": "view",
    "path": "/tmp/agent_workspace/report.md"
  }
}
```

---

## Phase 4: Tool Discovery (tool_search)

When the agent encounters a subtask requiring specialized tools, it can search a large catalog dynamically.

### Setup: Large Tool Catalog with Deferred Loading

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: advanced-tool-use-2025-11-20" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "tools": [
      {
        "type": "tool_search_tool_regex_20251119",
        "name": "tool_search"
      },
      {
        "name": "convert_currency",
        "description": "Convert between currencies using live exchange rates",
        "input_schema": {"type": "object", "properties": {"amount": {"type": "number"}, "from": {"type": "string"}, "to": {"type": "string"}}, "required": ["amount", "from", "to"]},
        "defer_loading": true
      },
      {
        "name": "get_stock_price",
        "description": "Get current stock price by ticker symbol",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
        "defer_loading": true
      },
      {
        "name": "calculate_cagr",
        "description": "Calculate compound annual growth rate",
        "input_schema": {"type": "object", "properties": {"start_value": {"type": "number"}, "end_value": {"type": "number"}, "years": {"type": "number"}}, "required": ["start_value", "end_value", "years"]},
        "defer_loading": true
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "I need to convert the revenue figures to EUR and calculate the 3-year CAGR. Search for the right tools."
      }
    ]
  }'
```

### Response (Tool Search)

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_04A",
      "name": "tool_search",
      "input": {"query": "currency.*convert|exchange.*rate"}
    }
  ],
  "stop_reason": "tool_use"
}
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
          {"type": "tool_reference", "tool_name": "convert_currency"},
          {"type": "tool_reference", "tool_name": "calculate_cagr"}
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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 8192,
    "container": {
      "skills": [
        {"type": "anthropic", "skill_id": "xlsx", "version": "latest"},
        {"type": "anthropic", "skill_id": "pptx", "version": "latest"}
      ]
    },
    "tools": [
      {"type": "code_execution_20250825", "name": "code_execution"}
    ],
    "messages": [
      {
        "role": "user",
        "content": "Based on this research data, create:\n1) An Excel financial model with market size projections and charts\n2) A 5-slide executive summary PowerPoint\n\nData: Total market $670M, leader GitHub Copilot at 45%, growth rate 85% YoY."
      }
    ]
  }'
```

### Handling pause_turn

Skills may need multiple turns for complex generation:

```bash
#!/bin/bash

MESSAGES='[{"role": "user", "content": "Create Excel and PowerPoint..."}]'
CONTAINER_ID=""

for i in $(seq 1 10); do
  RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: code-execution-2025-08-25,skills-2025-10-02" \
    -H "content-type: application/json" \
    -d "$(jq -n \
      --argjson msgs "$MESSAGES" \
      --arg cid "$CONTAINER_ID" \
      '{
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        container: (
          if $cid == "" then {skills: [{type: "anthropic", skill_id: "xlsx", version: "latest"}, {type: "anthropic", skill_id: "pptx", version: "latest"}]}
          else {id: $cid, skills: [{type: "anthropic", skill_id: "xlsx", version: "latest"}, {type: "anthropic", skill_id: "pptx", version: "latest"}]}
          end
        ),
        tools: [{type: "code_execution_20250825", name: "code_execution"}],
        messages: $msgs
      }')")

  STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
  CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.container.id')
  CONTENT=$(echo "$RESPONSE" | jq -c '.content')

  echo "Turn $i: stop_reason=$STOP_REASON"

  if [ "$STOP_REASON" != "pause_turn" ]; then
    echo "Complete!"
    echo "$RESPONSE" | jq -r '.content[] | select(.type=="text") | .text'
    break
  fi

  # Continue with partial response
  MESSAGES=$(echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{role: "assistant", content: $c}]')
done
```

### Downloading Generated Files

```bash
# Extract file IDs from response
FILE_ID=$(echo "$RESPONSE" | jq -r '
  .content[] |
  select(.type == "bash_code_execution_tool_result") |
  .content.content[] |
  select(.file_id) |
  .file_id
')

# Download via Files API
curl "https://api.anthropic.com/v1/files/$FILE_ID/content" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  --output "report.xlsx"
```

---

## Phase 6: Visual QA (computer_use)

Open generated files in a desktop application to verify they look correct.

### Request

```bash
SCREENSHOT=$(scrot -o /tmp/screenshot.png && base64 -i /tmp/screenshot.png | tr -d '\n')

curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: computer-use-2025-01-24" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg img "$SCREENSHOT" '{
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    tools: [{
      type: "computer_20241022",
      name: "computer",
      display_width_px: 1920,
      display_height_px: 1080,
      display_number: 0
    }],
    disable_parallel_tool_use: true,
    messages: [{
      role: "user",
      content: [
        {type: "text", text: "Open the generated report.xlsx file in LibreOffice to verify the charts rendered correctly. Take a screenshot and report any issues."},
        {type: "image", source: {type: "base64", media_type: "image/png", data: $img}}
      ]
    }]
  }')"
```

### Response (Computer Action)

```json
{
  "content": [
    {
      "type": "text",
      "text": "I can see the desktop. Let me open the report file."
    },
    {
      "type": "tool_use",
      "id": "toolu_06A",
      "name": "computer",
      "input": {
        "action": "key",
        "key": "ctrl+l"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

Claude will execute a sequence: open file manager → navigate to file → open with application → take screenshot → verify.

---

## Programmatic Tool Control

### tool_choice: Force a Specific Tool

Force the agent to start with web search before doing anything else:

```json
{
  "tool_choice": {
    "type": "tool",
    "name": "web_search"
  }
}
```

### tool_choice Modes

| Mode | Behavior |
|------|----------|
| `{"type": "auto"}` | Claude decides (default when tools present) |
| `{"type": "any"}` | Must use at least one tool |
| `{"type": "tool", "name": "X"}` | Must use the specified tool |
| `{"type": "none"}` | Cannot use any tools |

### disable_parallel_tool_use

Prevent Claude from calling multiple tools simultaneously. Critical for computer use (actions must be sequential):

```json
{
  "disable_parallel_tool_use": true,
  "tools": [
    {"type": "computer_20241022", "name": "computer", "display_width_px": 1920, "display_height_px": 1080}
  ]
}
```

### allowed_callers

Control which tools can be invoked programmatically by code execution vs. directly by Claude:

```json
{
  "tools": [
    {"type": "code_execution_20250825", "name": "code_execution"},
    {
      "name": "query_database",
      "description": "Execute a SQL query",
      "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
      "allowed_callers": ["code_execution_20250825"]
    },
    {
      "name": "send_alert",
      "description": "Send an alert notification",
      "input_schema": {"type": "object", "properties": {"message": {"type": "string"}}, "required": ["message"]},
      "allowed_callers": ["direct"]
    }
  ]
}
```

- `"direct"`: Only Claude can call this tool directly
- `"code_execution_20250825"`: Only code execution can invoke this tool
- Both: Either can invoke it

### Tool Use Response with Caller Info

```json
{
  "type": "tool_use",
  "id": "toolu_07A",
  "name": "query_database",
  "input": {"query": "SELECT COUNT(*) FROM users"},
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

```bash
curl -N https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "stream": true,
    "tools": [
      {
        "type": "bash_20250124",
        "name": "bash",
        "eager_input_streaming": true
      },
      {
        "type": "text_editor_20250728",
        "name": "text_editor",
        "eager_input_streaming": true
      }
    ],
    "messages": [
      {"role": "user", "content": "Create a Python script that generates a market analysis report"}
    ]
  }'
```

### Streaming Events

Without `eager_input_streaming`, tool inputs are buffered and sent all at once. With it, you receive `input_json_delta` events as the input is generated:

```
event: content_block_start
data: {"index":1,"content_block":{"type":"tool_use","id":"toolu_01","name":"text_editor"}}

event: content_block_delta
data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"{\"command\":"}}

event: content_block_delta
data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"\"create\","}}

event: content_block_delta
data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"\"path\":\"/tmp"}}

event: content_block_delta
data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"/report.py\","}}

event: content_block_delta
data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"\"file_text\":\"import"}}

... (more deltas with the file content streaming in real-time)

event: content_block_stop
data: {"index":1}
```

This enables real-time UX showing what the agent is writing before the tool call completes.

### Parsing Streaming Events (Bash)

```bash
curl -N https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{...}' | while IFS= read -r line; do
    # Skip empty lines and "event:" lines
    [[ -z "$line" || "$line" == event:* ]] && continue

    # Parse data lines
    DATA="${line#data: }"

    TYPE=$(echo "$DATA" | jq -r '.delta.type // .type // empty' 2>/dev/null)

    case "$TYPE" in
      "text_delta")
        echo -n "$(echo "$DATA" | jq -r '.delta.text')"
        ;;
      "input_json_delta")
        echo -n "$(echo "$DATA" | jq -r '.delta.partial_json')"
        ;;
      "content_block_start")
        BLOCK_TYPE=$(echo "$DATA" | jq -r '.content_block.type')
        if [ "$BLOCK_TYPE" = "tool_use" ]; then
          TOOL_NAME=$(echo "$DATA" | jq -r '.content_block.name')
          echo -e "\n[Tool: $TOOL_NAME] "
        fi
        ;;
    esac
  done
```

---

## Complete Script

```bash
#!/bin/bash

# Full-Stack Autonomous Agent
# Combines all advanced Claude tools in a phased pipeline

ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
MODEL="claude-sonnet-4-5-20250929"
WORKSPACE="/tmp/fullstack_agent_workspace"
MAX_ITERATIONS=10

# Initialize workspace
mkdir -p "$WORKSPACE"
echo "Workspace: $WORKSPACE"

# Phase runner: agentic loop for a specific phase
run_phase() {
  local phase_name="$1"
  local beta_headers="$2"
  local tools="$3"
  local system_prompt="$4"
  local messages="$5"
  local extra_params="${6:-}"  # Optional: tool_choice, disable_parallel_tool_use, container

  echo ""
  echo "=== Phase: $phase_name ==="

  for i in $(seq 1 $MAX_ITERATIONS); do
    local REQUEST_BODY
    REQUEST_BODY=$(jq -n \
      --arg model "$MODEL" \
      --arg system "$system_prompt" \
      --argjson tools "$tools" \
      --argjson msgs "$messages" \
      '{model: $model, max_tokens: 8192, system: $system, tools: $tools, messages: $msgs}')

    # Merge extra params if provided
    if [ -n "$extra_params" ]; then
      REQUEST_BODY=$(echo "$REQUEST_BODY" | jq --argjson extra "$extra_params" '. + $extra')
    fi

    local RESPONSE
    RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "anthropic-beta: $beta_headers" \
      -H "content-type: application/json" \
      -d "$REQUEST_BODY")

    local STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
    local CONTENT=$(echo "$RESPONSE" | jq -c '.content')

    # Print text output
    echo "$CONTENT" | jq -r '.[] | select(.type=="text") | .text' 2>/dev/null

    # Update container ID if present
    local NEW_CONTAINER=$(echo "$RESPONSE" | jq -r '.container.id // empty')
    if [ -n "$NEW_CONTAINER" ]; then
      CONTAINER_ID="$NEW_CONTAINER"
    fi

    if [ "$STOP_REASON" = "end_turn" ]; then
      echo "  Phase $phase_name complete (turn $i)"
      # Return updated messages
      echo "$messages" | jq --argjson c "$CONTENT" '. + [{role: "assistant", content: $c}]'
      return 0
    fi

    # Handle tool calls
    messages=$(echo "$messages" | jq --argjson c "$CONTENT" '. + [{role: "assistant", content: $c}]')

    local TOOL_RESULTS="[]"
    for tool in $(echo "$CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
      local TOOL_NAME=$(echo "$tool" | jq -r '.name')
      local TOOL_ID=$(echo "$tool" | jq -r '.id')
      local TOOL_INPUT=$(echo "$tool" | jq -c '.input')

      echo "  -> $TOOL_NAME"

      # Route tool execution
      local RESULT=""
      case "$TOOL_NAME" in
        "bash")
          CMD=$(echo "$TOOL_INPUT" | jq -r '.command')
          RESULT=$(eval "$CMD" 2>&1 || true)
          ;;
        "text_editor")
          local CMD_TYPE=$(echo "$TOOL_INPUT" | jq -r '.command')
          local FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.path')
          case "$CMD_TYPE" in
            "create")
              local FILE_TEXT=$(echo "$TOOL_INPUT" | jq -r '.file_text')
              echo "$FILE_TEXT" > "$FILE_PATH"
              RESULT="File created: $FILE_PATH"
              ;;
            "view")
              RESULT=$(cat "$FILE_PATH" 2>&1 || echo "File not found")
              ;;
            "str_replace")
              local OLD_STR=$(echo "$TOOL_INPUT" | jq -r '.old_str')
              local NEW_STR=$(echo "$TOOL_INPUT" | jq -r '.new_str')
              # Use Python for reliable string replacement
              python3 -c "
import sys
with open('$FILE_PATH', 'r') as f:
    content = f.read()
content = content.replace('''$OLD_STR''', '''$NEW_STR''', 1)
with open('$FILE_PATH', 'w') as f:
    f.write(content)
print('Replaced in $FILE_PATH')
" 2>&1
              RESULT=$?
              ;;
          esac
          ;;
        "computer")
          local ACTION=$(echo "$TOOL_INPUT" | jq -r '.action')
          case "$ACTION" in
            "mouse_move")
              X=$(echo "$TOOL_INPUT" | jq -r '.coordinate[0]')
              Y=$(echo "$TOOL_INPUT" | jq -r '.coordinate[1]')
              xdotool mousemove $X $Y
              ;;
            "left_click") xdotool click 1 ;;
            "type")
              TEXT=$(echo "$TOOL_INPUT" | jq -r '.text')
              xdotool type --delay 50 "$TEXT"
              ;;
            "key")
              KEY=$(echo "$TOOL_INPUT" | jq -r '.key')
              xdotool key "$KEY"
              ;;
            "screenshot") ;; # Screenshot taken below
          esac
          sleep 0.5
          # Return screenshot as tool result
          scrot -o /tmp/screenshot.png
          local IMG=$(base64 -i /tmp/screenshot.png | tr -d '\n')
          TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq --arg id "$TOOL_ID" --arg img "$IMG" \
            '. + [{"type": "tool_result", "tool_use_id": $id, "content": [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": $img}}]}]')
          continue  # Skip normal result append
          ;;
        *)
          RESULT="Tool $TOOL_NAME executed (mock)"
          ;;
      esac

      TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq --arg id "$TOOL_ID" --arg r "$RESULT" \
        '. + [{"type": "tool_result", "tool_use_id": $id, "content": $r}]')
    done

    messages=$(echo "$messages" | jq --argjson r "$TOOL_RESULTS" '. + [{role: "user", content: $r}]')

    # Handle pause_turn (skills)
    if [ "$STOP_REASON" = "pause_turn" ]; then
      echo "  (pause_turn - continuing...)"
    fi
  done

  echo "  Phase $phase_name hit max iterations"
  echo "$messages"
}

# System prompt
SYSTEM_PROMPT="You are a competitive intelligence analyst. Use the provided tools to research, analyze, and generate a comprehensive report with deliverables."

# Initial message
TASK="Research the competitive landscape of AI coding assistants. Produce: 1) A markdown report with market data, 2) An Excel financial model, 3) A PowerPoint executive summary."
MESSAGES=$(jq -n --arg task "$TASK" '[{role: "user", content: $task}]')

# Phase 1: Web Research
RESEARCH_TOOLS='[
  {"type": "web_search_20250305", "name": "web_search", "max_uses": 5},
  {"type": "web_fetch_20250910", "name": "web_fetch", "max_uses": 3}
]'
MESSAGES=$(run_phase "Web Research" "web-fetch-2025-09-10" "$RESEARCH_TOOLS" "$SYSTEM_PROMPT" "$MESSAGES")

# Phase 2: Data Analysis
ANALYSIS_TOOLS='[
  {"type": "bash_20250124", "name": "bash"},
  {"type": "code_execution_20250825", "name": "code_execution"}
]'
MESSAGES=$(run_phase "Data Analysis" "code-execution-2025-08-25" "$ANALYSIS_TOOLS" "$SYSTEM_PROMPT" "$MESSAGES")

# Phase 3: Report Writing
WRITING_TOOLS='[
  {"type": "text_editor_20250728", "name": "text_editor"},
  {"type": "bash_20250124", "name": "bash"}
]'
MESSAGES=$(run_phase "Report Writing" "" "$WRITING_TOOLS" "$SYSTEM_PROMPT" "$MESSAGES")

# Phase 4: Tool Discovery (optional -- for specialized tasks)
DISCOVERY_TOOLS='[
  {"type": "tool_search_tool_regex_20251119", "name": "tool_search"},
  {"name": "convert_currency", "description": "Convert between currencies", "input_schema": {"type": "object", "properties": {"amount": {"type": "number"}, "from": {"type": "string"}, "to": {"type": "string"}}, "required": ["amount", "from", "to"]}, "defer_loading": true}
]'
MESSAGES=$(run_phase "Tool Discovery" "advanced-tool-use-2025-11-20" "$DISCOVERY_TOOLS" "$SYSTEM_PROMPT" "$MESSAGES")

# Phase 5: Deliverables (skills)
SKILLS_TOOLS='[{"type": "code_execution_20250825", "name": "code_execution"}]'
SKILLS_EXTRA='{"container": {"skills": [{"type": "anthropic", "skill_id": "xlsx", "version": "latest"}, {"type": "anthropic", "skill_id": "pptx", "version": "latest"}]}}'
MESSAGES=$(run_phase "Deliverables" "code-execution-2025-08-25,skills-2025-10-02" "$SKILLS_TOOLS" "$SYSTEM_PROMPT" "$MESSAGES" "$SKILLS_EXTRA")

# Phase 6: Visual QA (in Docker/VM only)
if [ "${ENABLE_COMPUTER_USE:-false}" = "true" ]; then
  QA_TOOLS='[{"type": "computer_20241022", "name": "computer", "display_width_px": 1920, "display_height_px": 1080, "display_number": 0}]'
  QA_EXTRA='{"disable_parallel_tool_use": true}'
  MESSAGES=$(run_phase "Visual QA" "computer-use-2025-01-24" "$QA_TOOLS" "$SYSTEM_PROMPT" "$MESSAGES" "$QA_EXTRA")
fi

echo ""
echo "=== Agent Complete ==="
echo "Workspace: $WORKSPACE"
ls -la "$WORKSPACE"
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

2. **Combine Beta Headers Carefully**: List all required betas as a comma-separated string. An invalid beta name causes an error.

3. **Use `disable_parallel_tool_use` for Computer Use**: Desktop actions must execute sequentially.

4. **Handle `pause_turn` for Skills**: Code execution and skills may require multiple turns — keep looping.

5. **Stream Tool Inputs with `eager_input_streaming`**: For long tool inputs (large file edits), enable streaming to show real-time progress.

6. **Set Iteration Limits Per Phase**: Research might need 10 iterations, but computer-use QA might need only 5.

7. **Use `tool_choice` to Bootstrap Phases**: Force the agent to start with `web_search` in the research phase.

8. **Isolate Computer Use**: Always run in Docker/VM. Never on a production machine.

9. **Log Token Usage Per Phase**: Track `usage.input_tokens` and `usage.output_tokens` from each response.

10. **Pin Skill Versions in Production**: Use specific version strings instead of `"latest"`.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Foundation: basic autonomous agents
- [Example 14: Research Agent](example-14-research-agent.md) - Web search and research patterns
- [Example 15: Coding Assistant](example-15-coding-assistant.md) - Streaming + tool use + code execution
- [Example 17: Computer Use](example-17-computer-use.md) - Desktop automation
- [Example 19: Agent Skills](example-19-agent-skills.md) - Document generation with skills
- [Example 20: Deep Agent](example-20-deep-agent.md) - Multi-agent orchestration and planning
