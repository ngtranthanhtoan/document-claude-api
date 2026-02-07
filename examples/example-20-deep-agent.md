# Example 20: Deep Agent

> Build a multi-layered agent with planning, filesystem memory, and subagent delegation for complex multi-step tasks.

## Overview

- **Difficulty**: Expert
- **Features Used**: Tool Use, Multi-turn, Subagent Delegation, Planning
- **Use Cases**:
  - Complex project scaffolding
  - Multi-file code generation
  - Research reports with multiple sections
  - Data pipeline orchestration
  - Any task requiring decomposition into subtasks

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Understanding of agentic tool loops ([Example 13](example-13-agentic-tool-loop.md))
- `jq` installed for JSON processing

---

## Why Deep Agents?

A standard agentic tool loop (Example 13) runs Claude in a single conversation, calling tools until the task is done. This works for simple tasks but breaks down on complex ones:

- **Context bloat**: Each tool call and result accumulates in the conversation, eventually filling the context window
- **Loss of focus**: With 20+ tool calls, the agent loses track of the overall plan
- **No specialization**: A single system prompt can't be expert at research, writing, and review simultaneously

A **deep agent** solves these problems with four pillars:

1. **Planning Tool** — Decompose tasks into subtasks before executing
2. **Filesystem Backend** — Read/write files as persistent working memory
3. **Subagent Delegation** — Spawn isolated agents for focused subtasks
4. **Orchestrator Prompt** — Guide when to plan, delegate, or work directly

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Planning Tool │  │  Filesystem  │  │ Subagent         │  │
│  │ (Todo List)   │  │  (read/write)│  │ Delegation       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Orchestrator System Prompt                                  │
│  (Guides when to plan, delegate, or work directly)          │
└──────────────┬──────────────┬──────────────┬────────────────┘
               │              │              │
               ▼              ▼              ▼
        ┌───────────┐  ┌───────────┐  ┌───────────┐
        │ Subagent  │  │ Subagent  │  │ Subagent  │
        │ Research  │  │ Writing   │  │ Review    │
        │ (own ctx) │  │ (own ctx) │  │ (own ctx) │
        └───────────┘  └───────────┘  └───────────┘
```

Each subagent runs as a **separate API call** with its own context window, preventing bloat in the orchestrator.

---

## The Deep Agent Toolkit

Five tools give the orchestrator planning, memory, and delegation capabilities.

### Tool 1: todo_list (Planning)

```json
{
  "name": "todo_list",
  "description": "Manage a task list for planning and tracking. ALWAYS use this to decompose complex tasks before starting work. Actions: add (create task), update (change status), get_all (list all tasks).",
  "input_schema": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["add", "update", "get_all"],
        "description": "The action to perform"
      },
      "task_id": {
        "type": "string",
        "description": "Task identifier (for update)"
      },
      "title": {
        "type": "string",
        "description": "Task title (for add)"
      },
      "status": {
        "type": "string",
        "enum": ["pending", "in_progress", "completed", "blocked"],
        "description": "Task status (for update)"
      }
    },
    "required": ["action"]
  }
}
```

### Tool 2: read_file (Memory)

```json
{
  "name": "read_file",
  "description": "Read a file from the workspace. Use to review subagent output or load context.",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {"type": "string", "description": "File path relative to workspace root"}
    },
    "required": ["path"]
  }
}
```

### Tool 3: write_file (Memory)

```json
{
  "name": "write_file",
  "description": "Write content to a file. Use to save intermediate results or final outputs.",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {"type": "string", "description": "File path relative to workspace root"},
      "content": {"type": "string", "description": "Content to write"}
    },
    "required": ["path", "content"]
  }
}
```

### Tool 4: list_files (Memory)

```json
{
  "name": "list_files",
  "description": "List files in a workspace directory.",
  "input_schema": {
    "type": "object",
    "properties": {
      "directory": {"type": "string", "description": "Directory to list (default: root)", "default": "."}
    }
  }
}
```

### Tool 5: delegate_task (Delegation)

```json
{
  "name": "delegate_task",
  "description": "Delegate a task to a specialized subagent. The subagent runs in its own context window with read_file and write_file tools. Use for self-contained subtasks. Returns the subagent's summary when complete.",
  "input_schema": {
    "type": "object",
    "properties": {
      "task_description": {
        "type": "string",
        "description": "Detailed description of what the subagent should do"
      },
      "role": {
        "type": "string",
        "description": "Subagent role, e.g. 'researcher', 'writer', 'reviewer'"
      },
      "input_files": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Files the subagent should read as input"
      },
      "output_file": {
        "type": "string",
        "description": "File path where the subagent writes its output"
      }
    },
    "required": ["task_description", "role", "output_file"]
  }
}
```

---

## Pillar 1: Planning with Todo List

The orchestrator decomposes tasks **before** doing any real work. Here's how it plans a blog post about WebAssembly.

### Request

```bash
# Define orchestrator system prompt
ORCHESTRATOR_PROMPT=$(cat <<'EOF'
You are a deep agent orchestrator. For every complex task:

1. PLAN FIRST: Use todo_list to decompose the task into subtasks before any work
2. DELEGATE: Use delegate_task for self-contained subtasks (research, writing, review)
3. COORDINATE: Pass data between subtasks via files (write output, next task reads it)
4. VERIFY: After delegation, read the output file and check quality
5. TRACK: Update todo_list as tasks complete

Rules:
- Never skip planning. Always create a todo list first.
- Delegate when a subtask can be fully described in 2-3 sentences.
- Do simple tasks (reading, updating todos) directly.
- After all subtasks complete, provide a final summary.
EOF
)

curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$(jq -n \
    --arg system "$ORCHESTRATOR_PROMPT" \
    '{
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      system: $system,
      tools: [
        {
          "name": "todo_list",
          "description": "Manage task list. Actions: add, update, get_all.",
          "input_schema": {
            "type": "object",
            "properties": {
              "action": {"type": "string", "enum": ["add", "update", "get_all"]},
              "task_id": {"type": "string"},
              "title": {"type": "string"},
              "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]}
            },
            "required": ["action"]
          }
        },
        {
          "name": "delegate_task",
          "description": "Delegate to a subagent with its own context.",
          "input_schema": {
            "type": "object",
            "properties": {
              "task_description": {"type": "string"},
              "role": {"type": "string"},
              "input_files": {"type": "array", "items": {"type": "string"}},
              "output_file": {"type": "string"}
            },
            "required": ["task_description", "role", "output_file"]
          }
        },
        {
          "name": "read_file",
          "description": "Read a file from workspace.",
          "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}
        },
        {
          "name": "write_file",
          "description": "Write a file to workspace.",
          "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}
        }
      ],
      messages: [
        {
          role: "user",
          content: "Write a technical blog post about WebAssembly (WASM) covering its history, current use cases, and future outlook. Save it as blog_post.md."
        }
      ]
    }')"
```

### Response: Claude Plans First

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "I'll create a plan for this blog post, then delegate each phase to specialized subagents."
    },
    {
      "type": "tool_use",
      "id": "toolu_01A",
      "name": "todo_list",
      "input": {"action": "add", "task_id": "1", "title": "Research WASM history, use cases, and future trends"}
    },
    {
      "type": "tool_use",
      "id": "toolu_01B",
      "name": "todo_list",
      "input": {"action": "add", "task_id": "2", "title": "Write blog post draft from research"}
    },
    {
      "type": "tool_use",
      "id": "toolu_01C",
      "name": "todo_list",
      "input": {"action": "add", "task_id": "3", "title": "Review and polish the draft"}
    },
    {
      "type": "tool_use",
      "id": "toolu_01D",
      "name": "todo_list",
      "input": {"action": "add", "task_id": "4", "title": "Finalize and save as blog_post.md"}
    }
  ]
}
```

The orchestrator creates all subtasks **before** executing anything.

---

## Pillar 2: Filesystem as Working Memory

Instead of passing all data through conversation history, the agent writes intermediate results to files. Each subagent reads input files and writes output files.

```
Workspace files during execution:

  workspace/
  ├── research.md        ← Subagent 1 writes research notes
  ├── draft.md           ← Subagent 2 reads research, writes draft
  ├── review.md          ← Subagent 3 reads draft, writes review
  └── blog_post.md       ← Orchestrator writes final version
```

This keeps each agent's context clean — the researcher doesn't need the writer's context, and vice versa.

---

## Pillar 3: Subagent Delegation

When the orchestrator calls `delegate_task`, the host system spawns a **separate Claude API call**:

```
Orchestrator                    Host System                    Subagent
    │                               │                              │
    │── delegate_task ──────────>   │                              │
    │   {role: "researcher",        │                              │
    │    task: "Research WASM...",   │── New API call ────────────> │
    │    output: "research.md"}     │   (fresh context,            │
    │                               │    role-specific prompt,     │
    │                               │    read/write tools only)    │
    │                               │                              │
    │                               │   <── write_file ─────────── │
    │                               │   ── tool_result ──────────> │
    │                               │   <── end_turn ──────────── │
    │                               │                              │
    │<── tool_result ──────────────│                              │
    │   "Research complete.         │                              │
    │    Output: research.md"       │                              │
```

### Delegation Request (Turn 2)

After planning, the orchestrator delegates the research task:

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_02A",
      "name": "todo_list",
      "input": {"action": "update", "task_id": "1", "status": "in_progress"}
    },
    {
      "type": "tool_use",
      "id": "toolu_02B",
      "name": "delegate_task",
      "input": {
        "task_description": "Research WebAssembly (WASM) thoroughly. Cover: 1) History and origins (asm.js, W3C standardization), 2) Current use cases (browsers, serverless, edge computing, plugins), 3) Future outlook (WASI, component model, GC proposal). Write detailed research notes.",
        "role": "researcher",
        "output_file": "research.md"
      }
    }
  ]
}
```

### Delegation Result

The host system runs the subagent (its own agentic loop), then returns:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_02B",
  "content": "Subagent completed. Research notes written to research.md (3 sections, ~1500 words covering history, current use cases, and future outlook)."
}
```

### Verify and Continue (Turn 3)

The orchestrator reads the output to verify quality, then delegates the next task:

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_03A",
      "name": "read_file",
      "input": {"path": "research.md"}
    }
  ]
}
```

After verifying the research is good:

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "Research looks comprehensive. Now delegating the writing task."
    },
    {
      "type": "tool_use",
      "id": "toolu_04A",
      "name": "todo_list",
      "input": {"action": "update", "task_id": "1", "status": "completed"}
    },
    {
      "type": "tool_use",
      "id": "toolu_04B",
      "name": "todo_list",
      "input": {"action": "update", "task_id": "2", "status": "in_progress"}
    },
    {
      "type": "tool_use",
      "id": "toolu_04C",
      "name": "delegate_task",
      "input": {
        "task_description": "Write a technical blog post about WebAssembly based on the research notes. Use a clear, engaging style with code examples where appropriate. Target audience: web developers.",
        "role": "writer",
        "input_files": ["research.md"],
        "output_file": "draft.md"
      }
    }
  ]
}
```

### Final Turn: All Tasks Complete

```json
{
  "stop_reason": "end_turn",
  "content": [
    {
      "type": "text",
      "text": "Blog post complete! Here's a summary of what was produced:\n\n- **research.md**: Detailed research notes on WASM history, use cases, and future\n- **draft.md**: Initial blog post draft\n- **review.md**: Review feedback and suggestions\n- **blog_post.md**: Final polished blog post\n\nAll 4 tasks completed successfully. The final blog post is saved as blog_post.md."
    }
  ]
}
```

---

## Complete Bash Implementation

```bash
#!/bin/bash

# Deep Agent: Orchestrator with Planning, Filesystem, and Subagent Delegation

ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
MODEL="claude-sonnet-4-5-20250514"
SUBAGENT_MODEL="claude-sonnet-4-5-20250514"  # Use haiku for cost savings
MAX_ITERATIONS=20
SUBAGENT_MAX_ITERATIONS=10
WORKSPACE="/tmp/deep_agent_workspace"
TODO_FILE="$WORKSPACE/.todos.json"

# Initialize workspace
init_workspace() {
  mkdir -p "$WORKSPACE"
  echo '[]' > "$TODO_FILE"
  echo "Workspace initialized: $WORKSPACE"
}

# Tool: todo_list
execute_todo_list() {
  local input="$1"
  local action=$(echo "$input" | jq -r '.action')

  case "$action" in
    "add")
      local task_id=$(echo "$input" | jq -r '.task_id // empty')
      local title=$(echo "$input" | jq -r '.title')
      # Auto-generate ID if not provided
      if [ -z "$task_id" ]; then
        task_id=$(jq 'length + 1 | tostring' "$TODO_FILE")
      fi
      jq --arg id "$task_id" --arg t "$title" \
        '. + [{"id": $id, "title": $t, "status": "pending"}]' \
        "$TODO_FILE" > "$TODO_FILE.tmp" && mv "$TODO_FILE.tmp" "$TODO_FILE"
      echo "Added task $task_id: $title"
      ;;
    "update")
      local task_id=$(echo "$input" | jq -r '.task_id')
      local status=$(echo "$input" | jq -r '.status')
      jq --arg id "$task_id" --arg s "$status" \
        'map(if .id == $id then .status = $s else . end)' \
        "$TODO_FILE" > "$TODO_FILE.tmp" && mv "$TODO_FILE.tmp" "$TODO_FILE"
      echo "Updated task $task_id: $status"
      ;;
    "get_all")
      cat "$TODO_FILE"
      ;;
  esac
}

# Tool: read_file
execute_read_file() {
  local path=$(echo "$1" | jq -r '.path')
  if [ -f "$WORKSPACE/$path" ]; then
    cat "$WORKSPACE/$path"
  else
    echo "Error: File not found: $path"
  fi
}

# Tool: write_file
execute_write_file() {
  local path=$(echo "$1" | jq -r '.path')
  local content=$(echo "$1" | jq -r '.content')
  mkdir -p "$(dirname "$WORKSPACE/$path")"
  echo "$content" > "$WORKSPACE/$path"
  echo "Written: $path ($(wc -l < "$WORKSPACE/$path") lines)"
}

# Tool: list_files
execute_list_files() {
  local dir=$(echo "$1" | jq -r '.directory // "."')
  ls -la "$WORKSPACE/$dir" 2>/dev/null || echo "Directory not found: $dir"
}

# Tool: delegate_task (spawns a subagent)
execute_delegate_task() {
  local input="$1"
  local task_desc=$(echo "$input" | jq -r '.task_description')
  local role=$(echo "$input" | jq -r '.role')
  local output_file=$(echo "$input" | jq -r '.output_file')
  local input_files=$(echo "$input" | jq -r '.input_files // [] | .[]' 2>/dev/null)

  echo ">>> Spawning subagent: $role"

  # Build context from input files
  local file_context=""
  for f in $input_files; do
    if [ -f "$WORKSPACE/$f" ]; then
      file_context+="--- Contents of $f ---\n$(cat "$WORKSPACE/$f")\n--- End of $f ---\n\n"
    fi
  done

  # Subagent system prompt
  local sub_system="You are a $role. Complete your task and write the output to $output_file using write_file. Be thorough and detailed."

  # Build subagent user message
  local sub_message="$task_desc"
  if [ -n "$file_context" ]; then
    sub_message="$task_desc\n\nReference materials:\n$file_context"
  fi

  # Subagent tools (only filesystem access)
  local SUB_TOOLS='[
    {"name": "read_file", "description": "Read a file", "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
    {"name": "write_file", "description": "Write a file", "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}
  ]'

  # Initialize subagent messages
  local SUB_MESSAGES
  SUB_MESSAGES=$(jq -n --arg msg "$sub_message" '[{"role": "user", "content": $msg}]')

  # Subagent agentic loop
  for i in $(seq 1 $SUBAGENT_MAX_ITERATIONS); do
    local SUB_RESPONSE
    SUB_RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d "$(jq -n \
        --arg system "$sub_system" \
        --arg model "$SUBAGENT_MODEL" \
        --argjson tools "$SUB_TOOLS" \
        --argjson msgs "$SUB_MESSAGES" \
        '{model: $model, max_tokens: 4096, system: $system, tools: $tools, messages: $msgs}')")

    local SUB_STOP=$(echo "$SUB_RESPONSE" | jq -r '.stop_reason')
    local SUB_CONTENT=$(echo "$SUB_RESPONSE" | jq -c '.content')

    if [ "$SUB_STOP" = "end_turn" ]; then
      echo ">>> Subagent ($role) completed in $i iterations"
      echo "$SUB_RESPONSE" | jq -r '.content[] | select(.type=="text") | .text'
      return
    fi

    # Handle subagent tool calls
    SUB_MESSAGES=$(echo "$SUB_MESSAGES" | jq --argjson c "$SUB_CONTENT" '. + [{"role": "assistant", "content": $c}]')

    local SUB_TOOL_RESULTS="[]"
    for tool in $(echo "$SUB_CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
      local t_name=$(echo "$tool" | jq -r '.name')
      local t_id=$(echo "$tool" | jq -r '.id')
      local t_input=$(echo "$tool" | jq -c '.input')

      local t_result=""
      case "$t_name" in
        "read_file") t_result=$(execute_read_file "$t_input") ;;
        "write_file") t_result=$(execute_write_file "$t_input") ;;
      esac

      SUB_TOOL_RESULTS=$(echo "$SUB_TOOL_RESULTS" | jq --arg id "$t_id" --arg r "$t_result" \
        '. + [{"type": "tool_result", "tool_use_id": $id, "content": $r}]')
    done

    SUB_MESSAGES=$(echo "$SUB_MESSAGES" | jq --argjson r "$SUB_TOOL_RESULTS" '. + [{"role": "user", "content": $r}]')
  done

  echo ">>> Subagent ($role) hit max iterations"
}

# Route tool calls
execute_tool() {
  local tool_name="$1"
  local tool_input="$2"

  case "$tool_name" in
    "todo_list")      execute_todo_list "$tool_input" ;;
    "read_file")      execute_read_file "$tool_input" ;;
    "write_file")     execute_write_file "$tool_input" ;;
    "list_files")     execute_list_files "$tool_input" ;;
    "delegate_task")  execute_delegate_task "$tool_input" ;;
    *)                echo "Unknown tool: $tool_name" ;;
  esac
}

# Orchestrator system prompt
ORCHESTRATOR_PROMPT=$(cat <<'EOF'
You are a deep agent orchestrator. For every complex task:

1. PLAN FIRST: Use todo_list to decompose the task into subtasks
2. DELEGATE: Use delegate_task for self-contained subtasks
3. COORDINATE: Pass data between subtasks via files
4. VERIFY: After delegation, read the output file and check quality
5. TRACK: Update todo_list as tasks complete

Rules:
- Never skip planning. Always create a todo list first.
- Delegate when a subtask can be fully described in 2-3 sentences.
- Do simple tasks (reading, updating todos) directly.
- After all subtasks complete, provide a final summary.
EOF
)

# Orchestrator tools
TOOLS='[
  {"name": "todo_list", "description": "Manage task list. Actions: add, update, get_all.", "input_schema": {"type": "object", "properties": {"action": {"type": "string", "enum": ["add", "update", "get_all"]}, "task_id": {"type": "string"}, "title": {"type": "string"}, "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]}}, "required": ["action"]}},
  {"name": "delegate_task", "description": "Delegate to a subagent with its own context.", "input_schema": {"type": "object", "properties": {"task_description": {"type": "string"}, "role": {"type": "string"}, "input_files": {"type": "array", "items": {"type": "string"}}, "output_file": {"type": "string"}}, "required": ["task_description", "role", "output_file"]}},
  {"name": "read_file", "description": "Read a file from workspace.", "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
  {"name": "write_file", "description": "Write a file to workspace.", "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}},
  {"name": "list_files", "description": "List workspace files.", "input_schema": {"type": "object", "properties": {"directory": {"type": "string"}}}}
]'

# Main orchestrator loop
run_orchestrator() {
  local user_task="$1"
  local MESSAGES
  MESSAGES=$(jq -n --arg msg "$user_task" '[{"role": "user", "content": $msg}]')

  for i in $(seq 1 $MAX_ITERATIONS); do
    echo ""
    echo "=== Orchestrator Turn $i ==="

    RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d "$(jq -n \
        --arg system "$ORCHESTRATOR_PROMPT" \
        --arg model "$MODEL" \
        --argjson tools "$TOOLS" \
        --argjson msgs "$MESSAGES" \
        '{model: $model, max_tokens: 4096, system: $system, tools: $tools, messages: $msgs}')")

    STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
    CONTENT=$(echo "$RESPONSE" | jq -c '.content')

    # Print text output
    echo "$CONTENT" | jq -r '.[] | select(.type=="text") | .text' 2>/dev/null

    if [ "$STOP_REASON" = "end_turn" ]; then
      echo ""
      echo "=== Orchestrator Complete ==="
      return
    fi

    # Handle tool calls
    MESSAGES=$(echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{"role": "assistant", "content": $c}]')

    TOOL_RESULTS="[]"
    for tool in $(echo "$CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
      TOOL_NAME=$(echo "$tool" | jq -r '.name')
      TOOL_ID=$(echo "$tool" | jq -r '.id')
      TOOL_INPUT=$(echo "$tool" | jq -c '.input')

      echo "  Tool: $TOOL_NAME"
      RESULT=$(execute_tool "$TOOL_NAME" "$TOOL_INPUT")

      TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq --arg id "$TOOL_ID" --arg r "$RESULT" \
        '. + [{"type": "tool_result", "tool_use_id": $id, "content": $r}]')
    done

    MESSAGES=$(echo "$MESSAGES" | jq --argjson r "$TOOL_RESULTS" '. + [{"role": "user", "content": $r}]')
  done

  echo "Hit max iterations ($MAX_ITERATIONS)"
}

# Run it
init_workspace
run_orchestrator "Write a technical blog post about WebAssembly covering its history, current use cases, and future outlook. Save it as blog_post.md."
```

---

## Cost and Performance

| Strategy | Orchestrator | Subagents | Trade-off |
|----------|-------------|-----------|-----------|
| **All Sonnet** | claude-sonnet-4-5-20250514 | claude-sonnet-4-5-20250514 | Best quality, higher cost |
| **Mixed models** | claude-sonnet-4-5-20250514 | claude-haiku-4-5-20250514 | Good balance for simple subtasks |
| **Budget** | claude-haiku-4-5-20250514 | claude-haiku-4-5-20250514 | Lowest cost, simpler tasks only |

Key considerations:

- Each subagent is a **separate API call** with its own token usage
- Subagents typically need fewer tokens (focused task, smaller context)
- Set `max_tokens` appropriately per subagent (e.g., 2048 for simple tasks)
- Total tokens may be **higher** than a single-agent approach, but quality improves because each agent stays focused

---

## Best Practices

1. **Plan Before Executing**: Always have the orchestrator create a todo list before taking action. Planning prevents aimless tool-calling.

2. **Delegate Self-Contained Tasks**: Only delegate tasks that can be fully described in the task description. If a subtask needs heavy back-and-forth, keep it in the orchestrator.

3. **Use Files for Data Transfer**: Pass data between orchestrator and subagents via files, not conversation. This keeps contexts clean.

4. **Verify Subagent Output**: After delegation, always read the output file and check quality before marking the task complete.

5. **Set Iteration Limits**: Both orchestrator and subagents should have max iteration caps to prevent runaway loops.

6. **Use Cheaper Models for Subagents**: Route simple subtasks (formatting, data extraction) to Haiku for cost savings.

7. **Log Tool Calls**: Track which subagents were spawned, what they produced, and how many iterations they took.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Foundation: basic autonomous agents
- [Example 14: Research Agent](example-14-research-agent.md) - Multi-tool planning with extended thinking
- [Example 15: Coding Assistant](example-15-coding-assistant.md) - File read/write patterns
- [Example 18: Memory Tool](example-18-memory-tool.md) - Persistent state management
