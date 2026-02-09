# Example 18: Memory Tool

> Enable persistent memory across conversations for long-running agents.

## Overview

- **Difficulty**: Expert
- **Features Used**: Memory Tool
- **Beta Header Required**: `anthropic-beta: context-management-2025-06-27`
- **Use Cases**:
  - Long-running agents
  - Personalized assistants
  - Cross-session context
  - Knowledge accumulation
  - User preference tracking

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Understanding of multi-turn conversations

---

## What is the Memory Tool?

The Memory Tool enables Claude to store and retrieve information across conversations. This allows:
- Remembering user preferences
- Accumulating knowledge over time
- Maintaining context across sessions
- Building persistent agents

```
┌─────────────────────────────────────────────────────────────┐
│                    Session 1                                 │
│  User: "My favorite color is blue"                          │
│  Claude: store_memory("user_preference", "favorite_color",  │
│          "blue")                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Session 2                                 │
│  User: "What's my favorite color?"                          │
│  Claude: retrieve_memory("user_preference") →               │
│          "Your favorite color is blue"                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Enabling Memory Tool

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: context-management-2025-06-27" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "system": "You are a personal assistant with persistent memory. Use the memory tools to remember important information about the user across conversations. Store preferences, facts, and context that will be useful in future sessions.",
    "tools": [
      {
        "type": "memory_20250627",
        "name": "memory"
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Hi! I am starting a new project called ProjectX. It is a web application using React and Node.js. The deadline is March 15th."
      }
    ]
  }'
```

### Response (Storing Memory)

```json
{
  "content": [
    {
      "type": "text",
      "text": "Great to hear about ProjectX! I will remember the details about your project."
    },
    {
      "type": "tool_use",
      "id": "toolu_mem_01",
      "name": "memory",
      "input": {
        "action": "store",
        "key": "project_projectx",
        "value": {
          "name": "ProjectX",
          "type": "web application",
          "tech_stack": ["React", "Node.js"],
          "deadline": "2024-03-15",
          "created_at": "2024-01-15"
        },
        "category": "projects"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## Memory Actions

### Store Memory

```json
{
  "action": "store",
  "key": "unique_key",
  "value": "any JSON value",
  "category": "optional_category",
  "ttl": 86400
}
```

### Retrieve Memory

```json
{
  "action": "retrieve",
  "key": "unique_key"
}
```

### Search Memory

```json
{
  "action": "search",
  "query": "search terms",
  "category": "optional_category",
  "limit": 10
}
```

### Delete Memory

```json
{
  "action": "delete",
  "key": "unique_key"
}
```

### List All Memories

```json
{
  "action": "list",
  "category": "optional_category"
}
```

---

## Multi-Session Example

### Session 1: Store Information

```bash
# First session - user provides information
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: context-management-2025-06-27" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "tools": [{"type": "memory_20250627", "name": "memory"}],
    "messages": [
      {
        "role": "user",
        "content": "Some things about me: I work as a software engineer at TechCorp. I prefer dark mode. My timezone is PST. I like concise answers."
      }
    ]
  }'
```

Claude stores:
```json
{"action": "store", "key": "user_profile", "value": {"job": "software engineer", "company": "TechCorp"}}
{"action": "store", "key": "user_preferences", "value": {"theme": "dark", "timezone": "PST", "response_style": "concise"}}
```

### Session 2: Retrieve Information

```bash
# Later session - Claude remembers
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: context-management-2025-06-27" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "tools": [{"type": "memory_20250627", "name": "memory"}],
    "messages": [
      {
        "role": "user",
        "content": "What time is our 2pm meeting in my timezone?"
      }
    ]
  }'
```

Claude retrieves timezone and responds appropriately.

---

## Conversation Search Tool

Search through past conversations.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: context-management-2025-06-27" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "tools": [
      {"type": "memory_20250627", "name": "memory"},
      {
        "type": "conversation_search_20250627",
        "name": "conversation_search"
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "What did we discuss about the API integration last week?"
      }
    ]
  }'
```

### Conversation Search Action

```json
{
  "action": "search",
  "query": "API integration",
  "date_range": {
    "start": "2024-01-08",
    "end": "2024-01-15"
  },
  "limit": 5
}
```

---

## Recent Chats Tool

Access recent conversation history.

```json
{
  "type": "recent_chats_20250627",
  "name": "recent_chats"
}
```

### Usage

```json
{
  "action": "get_recent",
  "limit": 10,
  "include_messages": true
}
```

---

## File-Based Memory Storage

For self-managed memory, use file-based storage.

### System Prompt

```
You have access to a memory file at /data/memory.json. Use the file tools to:
- Read the file at the start of each conversation
- Update it when you learn new important information
- Keep it organized by category

Always check memory before answering questions about the user or past conversations.
```

### Implementation

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "system": "You are an assistant with persistent memory. At the start of each conversation, read /data/memory.json to recall previous information. Update the file when you learn important new facts.",
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
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "What projects am I currently working on?"
      }
    ]
  }'
```

---

## Complete Memory Agent Script

```bash
#!/bin/bash

# Persistent Memory Agent

MEMORY_FILE="/tmp/agent_memory.json"

# Initialize memory if not exists
if [[ ! -f "$MEMORY_FILE" ]]; then
  echo '{"memories": {}, "updated_at": null}' > "$MEMORY_FILE"
fi

# Tool execution
execute_tool() {
  local tool_name="$1"
  local tool_input="$2"

  if [[ "$tool_name" == "memory" ]]; then
    local action=$(echo "$tool_input" | jq -r '.action')
    local key=$(echo "$tool_input" | jq -r '.key // empty')
    local value=$(echo "$tool_input" | jq -c '.value // empty')

    case "$action" in
      "store")
        CURRENT=$(cat "$MEMORY_FILE")
        echo "$CURRENT" | jq --arg key "$key" --argjson val "$value" \
          '.memories[$key] = $val | .updated_at = now' > "$MEMORY_FILE"
        echo '{"status": "stored", "key": "'"$key"'"}'
        ;;
      "retrieve")
        cat "$MEMORY_FILE" | jq -c ".memories[\"$key\"] // null"
        ;;
      "search")
        query=$(echo "$tool_input" | jq -r '.query')
        cat "$MEMORY_FILE" | jq -c '.memories | to_entries | map(select(.key | contains("'"$query"'") or (.value | tostring | contains("'"$query"'"))))'
        ;;
      "list")
        cat "$MEMORY_FILE" | jq -c '.memories | keys'
        ;;
      "delete")
        CURRENT=$(cat "$MEMORY_FILE")
        echo "$CURRENT" | jq 'del(.memories["'"$key"'"])' > "$MEMORY_FILE"
        echo '{"status": "deleted", "key": "'"$key"'"}'
        ;;
      *)
        echo '{"error": "Unknown action"}'
        ;;
    esac
  fi
}

# Chat function
chat() {
  local user_input="$1"
  local MESSAGES='[{"role": "user", "content": "'"$user_input"'"}]'

  while true; do
    RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d "$(jq -n --argjson msgs "$MESSAGES" '{
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: "You are an assistant with persistent memory. Use the memory tool to store and retrieve important information across conversations. Store user preferences, facts, and context.",
        tools: [{
          name: "memory",
          description: "Store and retrieve memories. Actions: store (key, value), retrieve (key), search (query), list (), delete (key)",
          input_schema: {
            type: "object",
            properties: {
              action: {type: "string", enum: ["store", "retrieve", "search", "list", "delete"]},
              key: {type: "string"},
              value: {},
              query: {type: "string"}
            },
            required: ["action"]
          }
        }],
        messages: $msgs
      }')")

    STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
    CONTENT=$(echo "$RESPONSE" | jq -c '.content')

    # Print text
    echo "$CONTENT" | jq -r '.[] | select(.type=="text") | .text'

    if [[ "$STOP_REASON" == "end_turn" ]]; then
      break
    fi

    # Handle memory tools
    MESSAGES=$(echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{"role": "assistant", "content": $c}]')

    TOOL_RESULTS="[]"
    for tool in $(echo "$CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
      TOOL_NAME=$(echo "$tool" | jq -r '.name')
      TOOL_ID=$(echo "$tool" | jq -r '.id')
      TOOL_INPUT=$(echo "$tool" | jq -c '.input')

      RESULT=$(execute_tool "$TOOL_NAME" "$TOOL_INPUT")
      TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq --arg id "$TOOL_ID" --arg r "$RESULT" '. + [{"type": "tool_result", "tool_use_id": $id, "content": $r}]')
    done

    MESSAGES=$(echo "$MESSAGES" | jq --argjson r "$TOOL_RESULTS" '. + [{"role": "user", "content": $r}]')
  done
}

# Interactive loop
echo "Memory Agent (memories saved to $MEMORY_FILE)"
echo "Type 'quit' to exit, 'show memory' to see stored memories"
echo ""

while true; do
  read -p "You: " input
  [[ "$input" == "quit" ]] && break
  if [[ "$input" == "show memory" ]]; then
    echo "=== Stored Memories ==="
    cat "$MEMORY_FILE" | jq '.memories'
    continue
  fi
  echo ""
  echo "Assistant:"
  chat "$input"
  echo ""
done
```

---

## Best Practices

1. **Organize by Category**: Use categories for different types of memories.

2. **Set TTL for Temporary Data**: Expire memories that aren't needed long-term.

3. **Validate Before Storing**: Don't store trivial or duplicate information.

4. **Search Before Storing**: Check if information already exists.

5. **Prune Regularly**: Remove outdated or irrelevant memories.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Multi-turn agents
- [Example 08: RAG Knowledge Base](example-08-rag-knowledge-base.md) - Document-based memory
- [Example 11: Customer Support Bot](example-11-customer-support-bot.md) - Contextual conversations
