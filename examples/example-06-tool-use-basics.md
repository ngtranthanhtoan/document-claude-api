# Example 06: Tool Use Basics

> Enable Claude to call external functions and APIs to perform real-world actions.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Tool Use (Function Calling)
- **Use Cases**:
  - Weather lookup
  - Database queries
  - API integrations
  - Calculator operations
  - Calendar scheduling
  - Email sending

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Understanding of JSON schemas

---

## How Tool Use Works

```
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  User Request │ ───> │ Claude + Tools│ ───> │ Tool Use      │
│               │      │               │      │ stop_reason   │
└───────────────┘      └───────────────┘      └───────┬───────┘
                                                      │
                                                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ Final Answer  │ <─── │ Claude        │ <─── │ Execute Tool  │
│ to User       │      │ Processes     │      │ Send Result   │
└───────────────┘      └───────────────┘      └───────────────┘
```

---

## Step 1: Define Tools and Send Request

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
        "name": "get_weather",
        "description": "Get the current weather for a specific location. Returns temperature, conditions, and humidity.",
        "input_schema": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City and country, e.g., Tokyo, Japan or New York, USA"
            },
            "unit": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"],
              "description": "Temperature unit preference"
            }
          },
          "required": ["location"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "What is the weather like in Paris right now?"
      }
    ]
  }'
```

### Response (Tool Use Request)

```json
{
  "id": "msg_01ABC123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01XYZ789",
      "name": "get_weather",
      "input": {
        "location": "Paris, France",
        "unit": "celsius"
      }
    }
  ],
  "model": "claude-sonnet-4-5-20250514",
  "stop_reason": "tool_use",
  "usage": {"input_tokens": 150, "output_tokens": 45}
}
```

**Key indicators:**
- `stop_reason: "tool_use"` - Claude wants to use a tool
- `content` contains a `tool_use` block with tool name and input

---

## Step 2: Execute Tool and Send Result

Execute the tool on your side, then send the result back.

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
        "name": "get_weather",
        "description": "Get the current weather for a specific location",
        "input_schema": {
          "type": "object",
          "properties": {
            "location": {"type": "string"},
            "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
          },
          "required": ["location"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "What is the weather like in Paris right now?"
      },
      {
        "role": "assistant",
        "content": [
          {
            "type": "tool_use",
            "id": "toolu_01XYZ789",
            "name": "get_weather",
            "input": {"location": "Paris, France", "unit": "celsius"}
          }
        ]
      },
      {
        "role": "user",
        "content": [
          {
            "type": "tool_result",
            "tool_use_id": "toolu_01XYZ789",
            "content": "{\"temperature\": 18, \"condition\": \"partly cloudy\", \"humidity\": 65, \"wind_speed\": 12}"
          }
        ]
      }
    ]
  }'
```

### Final Response

```json
{
  "id": "msg_01DEF456",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "The weather in Paris right now is quite pleasant! It's 18°C (64°F) with partly cloudy skies. The humidity is at 65%, and there's a light breeze with wind speeds of 12 km/h. Great weather for a stroll along the Seine!"
    }
  ],
  "stop_reason": "end_turn"
}
```

---

## Tool Schema Structure

```json
{
  "name": "tool_name",
  "description": "Clear description of what this tool does",
  "input_schema": {
    "type": "object",
    "properties": {
      "required_param": {
        "type": "string",
        "description": "What this parameter is for"
      },
      "optional_param": {
        "type": "integer",
        "description": "Optional parameter with default"
      },
      "enum_param": {
        "type": "string",
        "enum": ["option1", "option2", "option3"]
      }
    },
    "required": ["required_param"]
  }
}
```

### Supported Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"hello"` |
| `integer` | Whole number | `42` |
| `number` | Any number | `3.14` |
| `boolean` | True/false | `true` |
| `array` | List of items | `["a", "b"]` |
| `object` | Nested object | `{"key": "value"}` |

---

## Multiple Tools

Define multiple tools for Claude to choose from.

### Request

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
        "name": "get_weather",
        "description": "Get current weather for a location",
        "input_schema": {
          "type": "object",
          "properties": {
            "location": {"type": "string"}
          },
          "required": ["location"]
        }
      },
      {
        "name": "search_restaurants",
        "description": "Search for restaurants in a location",
        "input_schema": {
          "type": "object",
          "properties": {
            "location": {"type": "string"},
            "cuisine": {"type": "string"},
            "price_range": {"type": "string", "enum": ["$", "$$", "$$$", "$$$$"]}
          },
          "required": ["location"]
        }
      },
      {
        "name": "book_reservation",
        "description": "Book a restaurant reservation",
        "input_schema": {
          "type": "object",
          "properties": {
            "restaurant_id": {"type": "string"},
            "date": {"type": "string"},
            "time": {"type": "string"},
            "party_size": {"type": "integer"}
          },
          "required": ["restaurant_id", "date", "time", "party_size"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Find me a nice Italian restaurant in San Francisco"
      }
    ]
  }'
```

---

## Tool Errors

Send error information when a tool fails.

```bash
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01ABC",
      "is_error": true,
      "content": "Error: Location not found. Please provide a valid city name."
    }
  ]
}
```

Claude will handle the error gracefully and may retry or ask for clarification.

---

## Tool Choice Options

Control how Claude uses tools.

### Auto (Default)
Claude decides whether to use tools.
```json
"tool_choice": {"type": "auto"}
```

### Any Tool
Claude must use one of the available tools.
```json
"tool_choice": {"type": "any"}
```

### Specific Tool
Force Claude to use a specific tool.
```json
"tool_choice": {"type": "tool", "name": "get_weather"}
```

### No Tools
Disable tool use for this request.
```json
"tool_choice": {"type": "none"}
```

---

## Complete Example: Calculator

```bash
#!/bin/bash

# Calculator tool example

curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "tools": [
      {
        "name": "calculate",
        "description": "Perform mathematical calculations. Supports basic arithmetic, exponents, and common math functions.",
        "input_schema": {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Mathematical expression to evaluate, e.g., 2 + 2, sqrt(16), 2^10"
            }
          },
          "required": ["expression"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "What is 15% of 847?"
      }
    ]
  }'
```

---

## Parallel Tool Calls

Claude can request multiple tools at once.

### Response with Multiple Tool Uses

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01AAA",
      "name": "get_weather",
      "input": {"location": "New York"}
    },
    {
      "type": "tool_use",
      "id": "toolu_01BBB",
      "name": "get_weather",
      "input": {"location": "Los Angeles"}
    }
  ],
  "stop_reason": "tool_use"
}
```

### Sending Multiple Results

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01AAA",
      "content": "{\"temperature\": 22, \"condition\": \"sunny\"}"
    },
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01BBB",
      "content": "{\"temperature\": 28, \"condition\": \"clear\"}"
    }
  ]
}
```

---

## Best Practices

1. **Clear Descriptions**: Write detailed tool descriptions so Claude understands when to use each tool.

2. **Validate Inputs**: Always validate tool inputs before executing.

3. **Handle Errors Gracefully**: Return helpful error messages that Claude can work with.

4. **Match Tool IDs**: Always use the exact `tool_use_id` when sending results.

5. **Keep Tools Focused**: Each tool should do one thing well.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Multi-step autonomous agents
- [Example 12: Human in the Loop](example-12-human-in-the-loop.md) - Add approval for sensitive tools
- [Example 01: Structured Output](example-01-structured-output.md) - Use tools for structured responses
- [Example 23: Custom Tools & Client-Side Agents Outside Containers](example-23-custom-skills-client-tools.md) - Custom tool definitions + bash/text_editor outside containers
