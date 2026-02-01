# Example 02: Streaming

> Receive Claude's response in real-time, token by token, using Server-Sent Events (SSE).

## Overview

- **Difficulty**: Beginner
- **Features Used**: Streaming, SSE
- **Use Cases**:
  - Real-time chat UI (typewriter effect)
  - Live coding assistants
  - Progressive content rendering
  - Long-form content generation
  - Reduced perceived latency
  - Voice synthesis integration (TTS pipeline)

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Understanding of Server-Sent Events (SSE)

---

## Basic Streaming Request

Add `"stream": true` to enable streaming.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Write a haiku about programming."
      }
    ]
  }'
```

### Streamed Response (SSE Format)

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_01ABC","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-5-20250514","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":12,"output_tokens":1}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Lines"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" of"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" code"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" cascade"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" down"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"\n"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Bugs"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" hide"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" in"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" the"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" shadows"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":","}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" wait"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"\n"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Debug"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ging"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" brings"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" peace"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":25}}

event: message_stop
data: {"type":"message_stop"}
```

---

## SSE Event Types

| Event | Description | Key Data |
|-------|-------------|----------|
| `message_start` | Stream begins | `message.id`, `message.model`, initial `usage` |
| `content_block_start` | New content block begins | `index`, `content_block.type` |
| `content_block_delta` | Incremental text chunk | `delta.text` |
| `content_block_stop` | Content block complete | `index` |
| `message_delta` | Final metadata | `stop_reason`, final `usage` |
| `message_stop` | Stream complete | - |

---

## Parsing Streaming Response with Bash

```bash
#!/bin/bash

# Stream and display response in real-time
curl -sN https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "stream": true,
    "messages": [{"role": "user", "content": "Write a short poem about the moon."}]
  }' | while IFS= read -r line; do
    # Skip empty lines and event lines
    if [[ "$line" == data:* ]]; then
      # Extract JSON data
      json="${line#data: }"

      # Extract text deltas
      if echo "$json" | jq -e '.delta.text' > /dev/null 2>&1; then
        text=$(echo "$json" | jq -r '.delta.text')
        printf "%s" "$text"
      fi
    fi
  done

echo ""  # Final newline
```

---

## Streaming with Tool Use

When Claude wants to use a tool during streaming, you'll receive tool use events.

### Request

```bash
curl -sN https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "stream": true,
    "tools": [{
      "name": "get_weather",
      "description": "Get weather for a location",
      "input_schema": {
        "type": "object",
        "properties": {"location": {"type": "string"}},
        "required": ["location"]
      }
    }],
    "messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]
  }'
```

### Streamed Tool Use Response

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_01ABC","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-5-20250514","stop_reason":null}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_01ABC","name":"get_weather","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"location\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":" \"Tokyo, Japan\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}

event: message_stop
data: {"type":"message_stop"}
```

---

## Complete Streaming Script

A complete bash script that handles streaming and builds the full response.

```bash
#!/bin/bash

# Configuration
MODEL="claude-sonnet-4-5-20250514"
MAX_TOKENS=2048

# Build request
REQUEST=$(cat << 'EOF'
{
  "model": "claude-sonnet-4-5-20250514",
  "max_tokens": 2048,
  "stream": true,
  "messages": [
    {
      "role": "user",
      "content": "Explain how HTTP streaming works in 3 paragraphs."
    }
  ]
}
EOF
)

echo "=== Streaming Response ==="
echo ""

# Variables to track state
FULL_TEXT=""
INPUT_TOKENS=0
OUTPUT_TOKENS=0

# Stream and process
curl -sN https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$REQUEST" | while IFS= read -r line; do

    if [[ "$line" == data:* ]]; then
      json="${line#data: }"
      event_type=$(echo "$json" | jq -r '.type // empty')

      case "$event_type" in
        "message_start")
          INPUT_TOKENS=$(echo "$json" | jq -r '.message.usage.input_tokens // 0')
          ;;
        "content_block_delta")
          delta_type=$(echo "$json" | jq -r '.delta.type // empty')
          if [[ "$delta_type" == "text_delta" ]]; then
            text=$(echo "$json" | jq -r '.delta.text // empty')
            printf "%s" "$text"
            FULL_TEXT+="$text"
          fi
          ;;
        "message_delta")
          OUTPUT_TOKENS=$(echo "$json" | jq -r '.usage.output_tokens // 0')
          STOP_REASON=$(echo "$json" | jq -r '.delta.stop_reason // empty')
          ;;
        "message_stop")
          echo ""
          echo ""
          echo "=== Stream Complete ==="
          echo "Stop reason: $STOP_REASON"
          echo "Output tokens: $OUTPUT_TOKENS"
          ;;
      esac
    fi
  done
```

---

## Error Handling in Streams

Errors during streaming are sent as regular SSE events.

### Error Event Format

```
event: error
data: {"type":"error","error":{"type":"rate_limit_error","message":"Rate limit exceeded"}}
```

### Handling Errors

```bash
curl -sN https://api.anthropic.com/v1/messages ... | while IFS= read -r line; do
    if [[ "$line" == data:* ]]; then
      json="${line#data: }"

      # Check for errors
      if echo "$json" | jq -e '.type == "error"' > /dev/null 2>&1; then
        error_type=$(echo "$json" | jq -r '.error.type')
        error_msg=$(echo "$json" | jq -r '.error.message')
        echo "ERROR: $error_type - $error_msg" >&2
        exit 1
      fi

      # Process normal events...
    fi
  done
```

---

## Streaming with Extended Thinking

When using extended thinking, you'll receive thinking blocks in the stream.

```bash
curl -sN https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 8000,
    "stream": true,
    "thinking": {"type": "enabled", "budget_tokens": 5000},
    "messages": [{"role": "user", "content": "What is 15 * 27?"}]
  }'
```

### Thinking Block Events

```
event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me calculate 15 * 27..."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"15 * 27 = 405"}}
```

---

## Best Practices

1. **Use `-N` Flag with curl**: Disables buffering for real-time output.

2. **Handle Partial JSON**: Tool use inputs stream as partial JSON that must be concatenated.

3. **Track Token Usage**: `message_start` gives input tokens, `message_delta` gives output tokens.

4. **Graceful Disconnection**: Handle connection drops and implement retry logic.

5. **Progress Indicators**: Show users that content is being generated.

---

## Related Examples

- [Example 15: Coding Assistant](example-15-coding-assistant.md) - Streaming with tools
- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Understanding tool flow
