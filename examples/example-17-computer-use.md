# Example 17: Computer Use

> Enable Claude to interact with desktop environments using mouse, keyboard, and screen capture.

## Overview

- **Difficulty**: Expert
- **Features Used**: Computer Use
- **Beta Header Required**: `anthropic-beta: computer-use-2025-01-24`
- **Use Cases**:
  - UI automation
  - Web testing
  - Desktop application control
  - Workflow automation
  - Accessibility testing

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Virtual machine or container with desktop environment
- Screen capture capability

---

## Safety Warning

**Important:** Always run computer use in an isolated environment:
- Use virtual machines or containers
- Limit network access
- Don't run on machines with sensitive data
- Monitor all actions

---

## Computer Use Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │ ──> │  Your Code  │ ──> │   VM/       │
│   API       │     │  (executor) │     │   Container │
│             │ <── │             │ <── │   Desktop   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │    Actions:       │    Execute:        │
      │    click(x,y)     │    xdotool         │
      │    type(text)     │    screenshots     │
      │    screenshot     │    keyboard        │
```

---

## Computer Use Tools

Claude uses special computer use tools:

```json
{
  "tools": [
    {
      "type": "computer_20241022",
      "name": "computer",
      "display_width_px": 1920,
      "display_height_px": 1080,
      "display_number": 0
    }
  ]
}
```

---

## Basic Computer Use Request

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: computer-use-2025-01-24" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [
      {
        "type": "computer_20241022",
        "name": "computer",
        "display_width_px": 1920,
        "display_height_px": 1080,
        "display_number": 0
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Open the Firefox browser and go to example.com"
          },
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$(base64 -i screenshot.png)"'"
            }
          }
        ]
      }
    ]
  }'
```

### Response (Computer Action)

```json
{
  "content": [
    {
      "type": "text",
      "text": "I can see the desktop. Let me open Firefox by clicking on its icon in the taskbar."
    },
    {
      "type": "tool_use",
      "id": "toolu_01ABC",
      "name": "computer",
      "input": {
        "action": "mouse_move",
        "coordinate": [450, 1050]
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## Computer Actions

### Mouse Actions

**Move Mouse:**
```json
{
  "action": "mouse_move",
  "coordinate": [x, y]
}
```

**Click:**
```json
{
  "action": "left_click"
}
```

**Double Click:**
```json
{
  "action": "double_click"
}
```

**Right Click:**
```json
{
  "action": "right_click"
}
```

**Click and Drag:**
```json
{
  "action": "left_click_drag",
  "start_coordinate": [x1, y1],
  "coordinate": [x2, y2]
}
```

**Scroll:**
```json
{
  "action": "scroll",
  "coordinate": [x, y],
  "direction": "down",
  "amount": 3
}
```

### Keyboard Actions

**Type Text:**
```json
{
  "action": "type",
  "text": "Hello, World!"
}
```

**Press Key:**
```json
{
  "action": "key",
  "key": "Return"
}
```

**Key Combination:**
```json
{
  "action": "key",
  "key": "ctrl+c"
}
```

### Screen Actions

**Take Screenshot:**
```json
{
  "action": "screenshot"
}
```

---

## Computer Use Loop

```bash
#!/bin/bash

# Computer Use Automation Loop

take_screenshot() {
  # Capture current screen
  scrot /tmp/screenshot.png
  base64 -i /tmp/screenshot.png | tr -d '\n'
}

execute_action() {
  local action="$1"
  local input="$2"

  case "$action" in
    "mouse_move")
      x=$(echo "$input" | jq -r '.coordinate[0]')
      y=$(echo "$input" | jq -r '.coordinate[1]')
      xdotool mousemove $x $y
      ;;
    "left_click")
      xdotool click 1
      ;;
    "right_click")
      xdotool click 3
      ;;
    "double_click")
      xdotool click --repeat 2 --delay 100 1
      ;;
    "type")
      text=$(echo "$input" | jq -r '.text')
      xdotool type --delay 50 "$text"
      ;;
    "key")
      key=$(echo "$input" | jq -r '.key')
      xdotool key "$key"
      ;;
    "scroll")
      direction=$(echo "$input" | jq -r '.direction')
      amount=$(echo "$input" | jq -r '.amount // 3')
      if [ "$direction" = "down" ]; then
        xdotool click --repeat $amount 5
      else
        xdotool click --repeat $amount 4
      fi
      ;;
    "screenshot")
      echo "Screenshot action - will be taken automatically"
      ;;
  esac

  # Wait for UI to update
  sleep 0.5
}

# Main loop
MESSAGES='[]'
TASK="Open Firefox and search for 'Claude AI'"

# Add initial task with screenshot
SCREENSHOT=$(take_screenshot)
MESSAGES=$(jq -n --arg task "$TASK" --arg img "$SCREENSHOT" '[{
  "role": "user",
  "content": [
    {"type": "text", "text": $task},
    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": $img}}
  ]
}]')

MAX_ITERATIONS=20
for i in $(seq 1 $MAX_ITERATIONS); do
  echo "Step $i..."

  RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: computer-use-2025-01-24" \
    -H "content-type: application/json" \
    -d "$(jq -n --argjson msgs "$MESSAGES" '{
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      tools: [{
        type: "computer_20241022",
        name: "computer",
        display_width_px: 1920,
        display_height_px: 1080,
        display_number: 0
      }],
      messages: $msgs
    }')")

  STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
  CONTENT=$(echo "$RESPONSE" | jq -c '.content')

  # Print Claude's thoughts
  echo "$CONTENT" | jq -r '.[] | select(.type=="text") | .text'

  if [ "$STOP_REASON" = "end_turn" ]; then
    echo "Task completed!"
    break
  fi

  # Execute computer actions
  MESSAGES=$(echo "$MESSAGES" | jq --argjson c "$CONTENT" '. + [{"role": "assistant", "content": $c}]')

  for tool_use in $(echo "$CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
    TOOL_ID=$(echo "$tool_use" | jq -r '.id')
    ACTION=$(echo "$tool_use" | jq -r '.input.action')
    INPUT=$(echo "$tool_use" | jq -c '.input')

    echo "  -> $ACTION"
    execute_action "$ACTION" "$INPUT"
  done

  # Take new screenshot and send as tool result
  sleep 0.5
  NEW_SCREENSHOT=$(take_screenshot)

  TOOL_ID=$(echo "$CONTENT" | jq -r '.[] | select(.type=="tool_use") | .id' | head -1)

  MESSAGES=$(echo "$MESSAGES" | jq --arg id "$TOOL_ID" --arg img "$NEW_SCREENSHOT" '. + [{
    "role": "user",
    "content": [{
      "type": "tool_result",
      "tool_use_id": $id,
      "content": [{
        "type": "image",
        "source": {"type": "base64", "media_type": "image/png", "data": $img}
      }]
    }]
  }]')
done
```

---

## Zoom Feature (Opus 4.5)

Opus 4.5 supports zooming for precise clicking.

### Request Zoom

```json
{
  "action": "zoom",
  "coordinate": [500, 300],
  "zoom_level": 2.0
}
```

Claude will receive a zoomed screenshot around that coordinate for precise actions.

---

## Web Testing Example

### Task

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: computer-use-2025-01-24" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "tools": [{
      "type": "computer_20241022",
      "name": "computer",
      "display_width_px": 1920,
      "display_height_px": 1080
    }],
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Test the login flow on our website:\n1. Go to https://test.example.com\n2. Click Login\n3. Enter username: testuser\n4. Enter password: testpass123\n5. Click Submit\n6. Verify the dashboard loads\n\nReport any issues you find."},
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "..."}}
      ]
    }]
  }'
```

---

## Docker Setup for Computer Use

```dockerfile
FROM ubuntu:22.04

# Install desktop and tools
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    xdotool \
    scrot \
    firefox \
    && rm -rf /var/lib/apt/lists/*

# Set up virtual display
ENV DISPLAY=:99

# Start script
COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
```

```bash
# entrypoint.sh
#!/bin/bash
Xvfb :99 -screen 0 1920x1080x24 &
sleep 2
x11vnc -display :99 -forever -nopw &
exec "$@"
```

---

## Best Practices

1. **Use Isolated Environments**: Always use VMs or containers.

2. **Send Screenshots After Actions**: Claude needs to see results.

3. **Handle Timeouts**: UI operations can be slow.

4. **Add Delays**: Wait for UI updates before next action.

5. **Monitor Actions**: Log all actions for debugging.

6. **Set Iteration Limits**: Prevent infinite loops.

---

## Related Examples

- [Example 07: Vision Analysis](example-07-vision-analysis.md) - Image understanding
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Autonomous execution
- [Example 16: MCP Connector](example-16-mcp-connector.md) - External integrations
