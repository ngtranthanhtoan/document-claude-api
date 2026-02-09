# Example 15: Coding Assistant

> Build an interactive coding assistant with streaming, tool use, and code execution.

## Overview

- **Difficulty**: Advanced
- **Features Used**: Streaming, Tool Use, Multi-turn
- **Use Cases**:
  - Code generation
  - Debugging assistance
  - Code review
  - Refactoring
  - Test generation

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Understanding of streaming and tool use

---

## Coding Assistant Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Coding Assistant                          │
├─────────────────────────────────────────────────────────────┤
│  Streaming (real-time code output)                          │
├─────────────────────────────────────────────────────────────┤
│  Tools:                                                      │
│  ├── read_file          │  write_file                       │
│  ├── run_code           │  search_codebase                  │
│  ├── run_tests          │  install_package                  │
│  └── git_operations                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Streaming Code Assistant

### Request

```bash
# Define system prompt for better readability
SYSTEM_PROMPT=$(cat <<'EOF'
You are an expert coding assistant. When writing code:
1. Explain your approach first
2. Write clean, well-commented code
3. Use tools to test your code
4. Handle errors gracefully

Always prefer to run and verify code before presenting it as final.
EOF
)

curl -N https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$(jq -n \
    --arg system "$SYSTEM_PROMPT" \
    '{
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      stream: true,
      system: $system,
      tools: [
      {
        "name": "read_file",
        "description": "Read contents of a file in the workspace",
        "input_schema": {
          "type": "object",
          "properties": {
            "path": {"type": "string", "description": "Path to file relative to workspace root"}
          },
          "required": ["path"]
        }
      },
      {
        "name": "write_file",
        "description": "Write or update a file in the workspace",
        "input_schema": {
          "type": "object",
          "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"}
          },
          "required": ["path", "content"]
        }
      },
      {
        "name": "run_code",
        "description": "Execute Python code in a sandboxed environment and return output",
        "input_schema": {
          "type": "object",
          "properties": {
            "code": {"type": "string", "description": "Python code to execute"},
            "timeout": {"type": "integer", "default": 30}
          },
          "required": ["code"]
        }
      },
      {
        "name": "run_tests",
        "description": "Run test suite for a file or directory",
        "input_schema": {
          "type": "object",
          "properties": {
            "path": {"type": "string", "description": "Test file or directory"},
            "verbose": {"type": "boolean", "default": false}
          },
          "required": ["path"]
        }
      },
      {
        "name": "search_codebase",
        "description": "Search for code patterns in the workspace",
        "input_schema": {
          "type": "object",
          "properties": {
            "pattern": {"type": "string"},
            "file_type": {"type": "string", "description": "File extension filter, e.g., .py, .js"}
          },
          "required": ["pattern"]
        }
      }
    ],
    messages: [
      {
        role: "user",
        content: "Write a Python script that fetches the top 10 Hacker News stories and saves them to a JSON file. Test it to make sure it works."
      }
    ]
  }')"
```

### Streaming Response Flow

```
event: content_block_delta
data: {"delta":{"text":"I'll create a Python script"}}

event: content_block_delta
data: {"delta":{"text":" to fetch Hacker News stories. Let me"}}

event: content_block_delta
data: {"delta":{"text":" write and test this code.\n\n"}}

event: content_block_stop
data: {}

event: content_block_start
data: {"content_block":{"type":"tool_use","name":"run_code"}}

event: content_block_delta
data: {"delta":{"partial_json":"{\"code\": \"import requests..."}}
```

---

## Code Execution Flow

### Step 1: Claude Writes Code

```json
{
  "type": "tool_use",
  "name": "run_code",
  "input": {
    "code": "import requests\nimport json\n\ndef fetch_hn_stories(limit=10):\n    # Fetch top story IDs\n    top_url = 'https://hacker-news.firebaseio.com/v0/topstories.json'\n    response = requests.get(top_url)\n    story_ids = response.json()[:limit]\n    \n    stories = []\n    for story_id in story_ids:\n        story_url = f'https://hacker-news.firebaseio.com/v0/item/{story_id}.json'\n        story = requests.get(story_url).json()\n        stories.append({\n            'title': story.get('title'),\n            'url': story.get('url'),\n            'score': story.get('score'),\n            'by': story.get('by')\n        })\n    \n    return stories\n\n# Test the function\nstories = fetch_hn_stories(5)\nfor s in stories:\n    print(f\"- {s['title']} ({s['score']} points)\")"
  }
}
```

### Step 2: Return Execution Result

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01",
  "content": "- Show HN: I built a tool to automate X (245 points)\n- Why Rust is the future of systems programming (189 points)\n- Launch HN: YC Company doing something cool (167 points)\n- The state of AI in 2024 (523 points)\n- Understanding quantum computing basics (98 points)"
}
```

### Step 3: Claude Writes to File

```json
{
  "type": "tool_use",
  "name": "write_file",
  "input": {
    "path": "hn_stories.py",
    "content": "#!/usr/bin/env python3\n\"\"\"Fetch top Hacker News stories.\"\"\"\n\nimport requests\nimport json\nfrom datetime import datetime\n\ndef fetch_hn_stories(limit=10):\n    \"\"\"Fetch top N stories from Hacker News.\"\"\"\n    top_url = 'https://hacker-news.firebaseio.com/v0/topstories.json'\n    response = requests.get(top_url)\n    story_ids = response.json()[:limit]\n    \n    stories = []\n    for story_id in story_ids:\n        story_url = f'https://hacker-news.firebaseio.com/v0/item/{story_id}.json'\n        story = requests.get(story_url).json()\n        stories.append({\n            'id': story_id,\n            'title': story.get('title'),\n            'url': story.get('url'),\n            'score': story.get('score'),\n            'by': story.get('by'),\n            'time': story.get('time')\n        })\n    \n    return stories\n\ndef save_to_json(stories, filename='hn_top_stories.json'):\n    \"\"\"Save stories to JSON file.\"\"\"\n    output = {\n        'fetched_at': datetime.now().isoformat(),\n        'count': len(stories),\n        'stories': stories\n    }\n    with open(filename, 'w') as f:\n        json.dump(output, f, indent=2)\n    return filename\n\nif __name__ == '__main__':\n    stories = fetch_hn_stories(10)\n    filename = save_to_json(stories)\n    print(f'Saved {len(stories)} stories to {filename}')"
  }
}
```

---

## Debugging Workflow

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "tools": [...],
    "messages": [
      {
        "role": "user",
        "content": "This code throws an IndexError, can you fix it?\n\n```python\ndef get_average(numbers):\n    total = sum(numbers)\n    return total / len(numbers)\n\nresult = get_average([])\nprint(result)\n```"
      }
    ]
  }'
```

### Response

Claude will:
1. Identify the issue (division by zero when list is empty)
2. Propose a fix
3. Test the fix using `run_code`
4. Present the corrected code

---

## Code Review Tool

### Request

```bash
# Define system prompt for better readability
REVIEW_PROMPT=$(cat <<'EOF'
You are a senior code reviewer. For each code submission:
1. Check for bugs and edge cases
2. Evaluate code style and best practices
3. Assess security vulnerabilities
4. Suggest performance improvements
5. Rate the overall quality (1-10)

Provide specific, actionable feedback.
EOF
)

curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$(jq -n \
    --arg system "$REVIEW_PROMPT" \
    '{
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: $system,
      messages: [
      {
        role: "user",
        content: "Review this Python code:\n\n```python\nimport os\nimport sqlite3\n\ndef get_user(username):\n    conn = sqlite3.connect(\"users.db\")\n    cursor = conn.cursor()\n    query = f\"SELECT * FROM users WHERE username = \"{username}\"\"\n    cursor.execute(query)\n    result = cursor.fetchone()\n    return result\n\ndef delete_file(filename):\n    os.system(f\"rm {filename}\")\n```"
      }
    ]
  }')"
```

---

## Test Generation

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "tools": [
      {
        "name": "read_file",
        "description": "Read a file",
        "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}
      },
      {
        "name": "write_file",
        "description": "Write a file",
        "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}
      },
      {
        "name": "run_tests",
        "description": "Run pytest",
        "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Read calculator.py and write comprehensive tests for it"
      }
    ]
  }'
```

---

## Complete Coding Assistant Script

```bash
#!/bin/bash

# Interactive Coding Assistant

WORKSPACE="/tmp/code_workspace"
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

# Tool execution
execute_tool() {
  local tool_name="$1"
  local tool_input="$2"

  case "$tool_name" in
    "read_file")
      path=$(echo "$tool_input" | jq -r '.path')
      if [[ -f "$WORKSPACE/$path" ]]; then
        cat "$WORKSPACE/$path"
      else
        echo "Error: File not found: $path"
      fi
      ;;
    "write_file")
      path=$(echo "$tool_input" | jq -r '.path')
      content=$(echo "$tool_input" | jq -r '.content')
      mkdir -p "$(dirname "$WORKSPACE/$path")"
      echo "$content" > "$WORKSPACE/$path"
      echo "File written: $path ($(wc -l < "$WORKSPACE/$path") lines)"
      ;;
    "run_code")
      code=$(echo "$tool_input" | jq -r '.code')
      timeout=${timeout:-30}
      echo "$code" > "$WORKSPACE/_temp_code.py"
      timeout $timeout python3 "$WORKSPACE/_temp_code.py" 2>&1
      ;;
    "run_tests")
      path=$(echo "$tool_input" | jq -r '.path')
      cd "$WORKSPACE" && python3 -m pytest "$path" -v 2>&1
      ;;
    "search_codebase")
      pattern=$(echo "$tool_input" | jq -r '.pattern')
      file_type=$(echo "$tool_input" | jq -r '.file_type // "*"')
      grep -r "$pattern" "$WORKSPACE" --include="$file_type" 2>/dev/null || echo "No matches found"
      ;;
    *)
      echo '{"error": "Unknown tool"}'
      ;;
  esac
}

# Chat function with streaming
chat() {
  local MESSAGES="$1"

  while true; do
    RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d "$(jq -n --argjson msgs "$MESSAGES" '{
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: "You are a coding assistant. Write clean code, test it, and explain your approach.",
        tools: [
          {name: "read_file", description: "Read file", input_schema: {type: "object", properties: {path: {type: "string"}}, required: ["path"]}},
          {name: "write_file", description: "Write file", input_schema: {type: "object", properties: {path: {type: "string"}, content: {type: "string"}}, required: ["path", "content"]}},
          {name: "run_code", description: "Run Python code", input_schema: {type: "object", properties: {code: {type: "string"}}, required: ["code"]}},
          {name: "run_tests", description: "Run pytest", input_schema: {type: "object", properties: {path: {type: "string"}}, required: ["path"]}}
        ],
        messages: $msgs
      }')")

    STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
    CONTENT=$(echo "$RESPONSE" | jq -c '.content')

    # Print text content
    echo "$CONTENT" | jq -r '.[] | select(.type=="text") | .text'

    if [[ "$STOP_REASON" == "end_turn" ]]; then
      echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{"role": "assistant", "content": $c}]'
      return
    fi

    # Handle tools
    MESSAGES=$(echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{"role": "assistant", "content": $c}]')

    TOOL_RESULTS="[]"
    for tool in $(echo "$CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
      TOOL_NAME=$(echo "$tool" | jq -r '.name')
      TOOL_ID=$(echo "$tool" | jq -r '.id')
      TOOL_INPUT=$(echo "$tool" | jq -c '.input')

      echo ""
      echo ">>> Executing: $TOOL_NAME"
      RESULT=$(execute_tool "$TOOL_NAME" "$TOOL_INPUT")
      echo "$RESULT"
      echo ""

      TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq --arg id "$TOOL_ID" --arg r "$RESULT" '. + [{"type": "tool_result", "tool_use_id": $id, "content": $r}]')
    done

    MESSAGES=$(echo "$MESSAGES" | jq --argjson r "$TOOL_RESULTS" '. + [{"role": "user", "content": $r}]')
  done
}

# Interactive mode
echo "Coding Assistant (workspace: $WORKSPACE)"
echo "Type 'quit' to exit"
echo ""

MESSAGES="[]"
while true; do
  read -p "You: " input
  [[ "$input" == "quit" ]] && break

  MESSAGES=$(echo "$MESSAGES" | jq --arg msg "$input" '. + [{"role": "user", "content": $msg}]')
  echo ""
  echo "Assistant:"
  MESSAGES=$(chat "$MESSAGES")
  echo ""
done
```

---

## Best Practices

1. **Test Before Presenting**: Always run code before showing final version.

2. **Handle Errors Gracefully**: Show helpful error messages.

3. **Stream Long Outputs**: Use streaming for better UX.

4. **Sandbox Code Execution**: Run untrusted code in isolation.

5. **Maintain Context**: Keep conversation history for follow-ups.

---

## Related Examples

- [Example 02: Streaming](example-02-streaming.md) - Real-time responses
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Autonomous execution
- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool fundamentals
