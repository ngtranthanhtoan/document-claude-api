# Example 13: Agentic Tool Loop

> Build autonomous agents that execute multiple tools until task completion.

## Overview

- **Difficulty**: Advanced
- **Features Used**: Tool Use, Multi-turn, Autonomous execution
- **Use Cases**:
  - Autonomous task completion
  - Multi-step research
  - Data processing pipelines
  - Self-correcting workflows
  - Automated report generation

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Understanding of tool use and stop reasons

---

## Agentic Loop Concept

The key insight is the `stop_reason` field:
- `stop_reason: "tool_use"` → Claude wants to use tools, keep looping
- `stop_reason: "end_turn"` → Claude is done, exit the loop

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Send to Claude API                              │
│         (with tools and messages)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Check response │
              │  stop_reason   │
              └───────┬───────┘
                      │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
   ┌─────────────┐      ┌─────────────┐
   │ "tool_use"  │      │ "end_turn"  │
   └──────┬──────┘      └──────┬──────┘
          │                    │
          ▼                    ▼
   ┌─────────────┐      ┌─────────────┐
   │Execute tool │      │   Return    │
   │Send result  │      │   final     │
   │back to API  │      │  response   │
   └──────┬──────┘      └─────────────┘
          │
          └──── (loop back) ────┘
```

---

## Step-by-Step API Calls

### Turn 1: Initial Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "system": "You are a research assistant. Use the available tools to gather information and complete tasks. Continue using tools until you have enough information to provide a complete answer.",
    "tools": [
      {
        "name": "web_search",
        "description": "Search the web for information",
        "input_schema": {
          "type": "object",
          "properties": {
            "query": {"type": "string", "description": "Search query"}
          },
          "required": ["query"]
        }
      },
      {
        "name": "read_webpage",
        "description": "Read and extract content from a webpage",
        "input_schema": {
          "type": "object",
          "properties": {
            "url": {"type": "string", "description": "URL to read"}
          },
          "required": ["url"]
        }
      },
      {
        "name": "save_finding",
        "description": "Save an important finding to the research notes",
        "input_schema": {
          "type": "object",
          "properties": {
            "topic": {"type": "string"},
            "finding": {"type": "string"},
            "source": {"type": "string"}
          },
          "required": ["topic", "finding"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Research the latest developments in fusion energy and summarize the top 3 breakthroughs from 2024."
      }
    ]
  }'
```

### Response 1: Claude Calls web_search

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "I'll research the latest fusion energy developments. Let me start by searching for recent breakthroughs."
    },
    {
      "type": "tool_use",
      "id": "toolu_01A",
      "name": "web_search",
      "input": {"query": "fusion energy breakthroughs 2024"}
    }
  ]
}
```

### Turn 2: Send Tool Result

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [...],
    "messages": [
      {"role": "user", "content": "Research the latest developments in fusion energy..."},
      {"role": "assistant", "content": [
        {"type": "text", "text": "I will research the latest fusion energy developments..."},
        {"type": "tool_use", "id": "toolu_01A", "name": "web_search", "input": {"query": "fusion energy breakthroughs 2024"}}
      ]},
      {"role": "user", "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_01A",
          "content": "[{\"title\": \"NIF achieves repeated ignition\", \"url\": \"https://example.com/nif\"}, {\"title\": \"ITER construction milestone\", \"url\": \"https://example.com/iter\"}, {\"title\": \"SPARC magnet breakthrough\", \"url\": \"https://example.com/sparc\"}]"
        }
      ]}
    ]
  }'
```

### Response 2: Claude Reads a Webpage

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "Found some promising results. Let me read the NIF article for details."
    },
    {
      "type": "tool_use",
      "id": "toolu_01B",
      "name": "read_webpage",
      "input": {"url": "https://example.com/nif"}
    }
  ]
}
```

### Turns 3-N: Continue Loop

The loop continues with Claude:
1. Reading more webpages
2. Calling `save_finding` to store important facts
3. Eventually synthesizing a final response

### Final Response: stop_reason is "end_turn"

```json
{
  "stop_reason": "end_turn",
  "content": [
    {
      "type": "text",
      "text": "Based on my research, here are the top 3 fusion energy breakthroughs from 2024:\n\n## 1. NIF Achieves Repeated Ignition\nThe National Ignition Facility successfully demonstrated repeatable fusion ignition, achieving net energy gain in multiple experiments. This proves that laser-driven fusion can consistently produce more energy than it consumes.\n\n## 2. ITER Magnet Assembly Complete\nThe international ITER project completed assembly of its massive superconducting magnet system, the world's most powerful. This brings the reactor one step closer to first plasma, expected in 2025.\n\n## 3. Commonwealth Fusion's SPARC Progress\nPrivate fusion company Commonwealth Fusion Systems completed critical testing of its high-temperature superconducting magnets, validating the compact tokamak design for their SPARC reactor.\n\nThese developments mark significant progress toward practical fusion power, with multiple approaches showing viability."
    }
  ]
}
```

---

## Complete Bash Implementation

```bash
#!/bin/bash

# Agentic Loop Implementation
# Runs Claude autonomously until task completion

ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
MODEL="claude-sonnet-4-5-20250514"
MAX_ITERATIONS=10

# Initialize messages
cat > /tmp/messages.json << 'EOF'
[
  {
    "role": "user",
    "content": "Find the current Bitcoin price and the top 3 news stories about it today."
  }
]
EOF

# Tools definition
TOOLS='[
  {
    "name": "get_crypto_price",
    "description": "Get current cryptocurrency price",
    "input_schema": {
      "type": "object",
      "properties": {
        "symbol": {"type": "string", "description": "Crypto symbol like BTC, ETH"}
      },
      "required": ["symbol"]
    }
  },
  {
    "name": "search_news",
    "description": "Search for recent news articles",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {"type": "string"},
        "limit": {"type": "integer", "default": 5}
      },
      "required": ["query"]
    }
  },
  {
    "name": "read_article",
    "description": "Read full content of a news article",
    "input_schema": {
      "type": "object",
      "properties": {
        "url": {"type": "string"}
      },
      "required": ["url"]
    }
  }
]'

# Mock tool execution function
execute_tool() {
  local tool_name="$1"
  local tool_input="$2"

  case "$tool_name" in
    "get_crypto_price")
      echo '{"symbol": "BTC", "price": 67234.50, "change_24h": "+2.3%", "volume": "28.5B"}'
      ;;
    "search_news")
      echo '[
        {"title": "Bitcoin ETF sees record inflows", "url": "https://example.com/btc-etf", "source": "Reuters"},
        {"title": "BTC breaks resistance level", "url": "https://example.com/btc-price", "source": "CoinDesk"},
        {"title": "Institutional adoption accelerates", "url": "https://example.com/btc-institutional", "source": "Bloomberg"}
      ]'
      ;;
    "read_article")
      echo '{"content": "Full article content here with detailed analysis...", "author": "John Smith", "date": "2024-01-15"}'
      ;;
    *)
      echo '{"error": "Unknown tool"}'
      ;;
  esac
}

# Main agentic loop
echo "Starting agentic loop..."
echo "========================"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "=== Iteration $i ==="

  MESSAGES=$(cat /tmp/messages.json)

  # Call Claude API
  RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "{
      \"model\": \"$MODEL\",
      \"max_tokens\": 4096,
      \"system\": \"You are a helpful research assistant. Use tools to gather information. Continue until you have a complete answer.\",
      \"tools\": $TOOLS,
      \"messages\": $MESSAGES
    }")

  STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
  echo "Stop reason: $STOP_REASON"

  # Check if we're done
  if [ "$STOP_REASON" = "end_turn" ]; then
    echo ""
    echo "=== FINAL RESPONSE ==="
    echo "$RESPONSE" | jq -r '.content[] | select(.type=="text") | .text'
    break
  fi

  # Handle tool use
  if [ "$STOP_REASON" = "tool_use" ]; then
    # Get assistant content
    ASSISTANT_CONTENT=$(echo "$RESPONSE" | jq -c '.content')

    # Add assistant message
    MESSAGES=$(echo "$MESSAGES" | jq --argjson content "$ASSISTANT_CONTENT" '. + [{"role": "assistant", "content": $content}]')

    # Process each tool call
    TOOL_RESULTS="[]"

    for tool_call in $(echo "$ASSISTANT_CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
      TOOL_NAME=$(echo "$tool_call" | jq -r '.name')
      TOOL_ID=$(echo "$tool_call" | jq -r '.id')
      TOOL_INPUT=$(echo "$tool_call" | jq -c '.input')

      echo "Executing: $TOOL_NAME"

      # Execute the tool
      RESULT=$(execute_tool "$TOOL_NAME" "$TOOL_INPUT")

      # Add to results
      TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq --arg id "$TOOL_ID" --arg result "$RESULT" '. + [{"type": "tool_result", "tool_use_id": $id, "content": $result}]')
    done

    # Add tool results as user message
    MESSAGES=$(echo "$MESSAGES" | jq --argjson results "$TOOL_RESULTS" '. + [{"role": "user", "content": $results}]')

    # Save updated messages
    echo "$MESSAGES" > /tmp/messages.json
  fi
done

echo ""
echo "=== Loop Complete ==="
```

---

## Handling Parallel Tool Calls

Claude may request multiple tools at once.

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01A",
      "name": "get_weather",
      "input": {"location": "New York"}
    },
    {
      "type": "tool_use",
      "id": "toolu_01B",
      "name": "get_weather",
      "input": {"location": "Los Angeles"}
    }
  ],
  "stop_reason": "tool_use"
}
```

Execute both and return multiple results:

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A",
      "content": "{\"temp\": 22, \"condition\": \"sunny\"}"
    },
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01B",
      "content": "{\"temp\": 28, \"condition\": \"clear\"}"
    }
  ]
}
```

---

## Error Recovery

When tools fail, Claude can adapt:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01A",
  "is_error": true,
  "content": "Error: Website not accessible (HTTP 503)"
}
```

Claude will typically try an alternative approach or inform the user.

---

## Best Practices

1. **Set Max Iterations**: Prevent infinite loops with a reasonable limit.

2. **Log Tool Calls**: Track what tools were called for debugging.

3. **Handle Errors Gracefully**: Return structured error messages.

4. **Provide Clear Tool Descriptions**: Help Claude understand when to use each tool.

5. **Preserve Full Conversation**: Always send the complete message history.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool fundamentals
- [Example 14: Research Agent](example-14-research-agent.md) - Advanced research with thinking
- [Example 12: Human in the Loop](example-12-human-in-the-loop.md) - Add approval checkpoints
