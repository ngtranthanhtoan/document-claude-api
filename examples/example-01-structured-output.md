# Example 01: Structured Output

> Guarantee Claude returns data in a specific, parseable format using JSON schemas, tool definitions, and forced tool choice.

## Overview

- **Difficulty**: Beginner
- **Features Used**: System prompts, Tool definitions, `tool_choice`
- **Use Cases**:
  - API response formatting
  - Database record creation
  - Form data extraction
  - Data transformation pipelines
  - Classification tasks

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Basic understanding of JSON schemas

---

## Method 1: System Prompt with JSON Schema

The simplest approach - instruct Claude to respond in a specific JSON format.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "system": "You are a data extraction assistant. Always respond with valid JSON matching the requested schema. Never include markdown formatting, explanations, or any text outside the JSON object.",
    "messages": [
      {
        "role": "user",
        "content": "Extract information from this job posting and return JSON matching this schema:\n\n{\n  \"title\": \"string\",\n  \"company\": \"string\",\n  \"location\": {\"city\": \"string\", \"state\": \"string\", \"remote\": boolean},\n  \"salary\": {\"min\": number|null, \"max\": number|null, \"currency\": \"string\"},\n  \"requirements\": [\"string\"],\n  \"experience_years\": number|null\n}\n\nJob Posting:\nSenior Software Engineer at TechCorp\nSan Francisco, CA (Hybrid - 2 days remote)\nSalary: $150,000 - $200,000\n\nRequirements:\n- 5+ years of experience in Python or Go\n- Experience with distributed systems\n- Strong communication skills"
      }
    ]
  }'
```

### Response

```json
{
  "id": "msg_01ABC123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "{\n  \"title\": \"Senior Software Engineer\",\n  \"company\": \"TechCorp\",\n  \"location\": {\"city\": \"San Francisco\", \"state\": \"CA\", \"remote\": true},\n  \"salary\": {\"min\": 150000, \"max\": 200000, \"currency\": \"USD\"},\n  \"requirements\": [\n    \"5+ years of experience in Python or Go\",\n    \"Experience with distributed systems\",\n    \"Strong communication skills\"\n  ],\n  \"experience_years\": 5\n}"
    }
  ],
  "stop_reason": "end_turn"
}
```

---

## Method 2: Tool as Structured Output

Use a tool definition to enforce strict JSON schema. Claude returns data as tool input.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "system": "You are a sentiment analysis system. Analyze the provided text and use the record_sentiment tool to output your analysis.",
    "tools": [
      {
        "name": "record_sentiment",
        "description": "Record the sentiment analysis results",
        "input_schema": {
          "type": "object",
          "properties": {
            "overall_sentiment": {
              "type": "string",
              "enum": ["very_positive", "positive", "neutral", "negative", "very_negative"]
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score between 0 and 1"
            },
            "emotions": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "emotion": {"type": "string"},
                  "intensity": {"type": "number", "minimum": 0, "maximum": 1}
                },
                "required": ["emotion", "intensity"]
              }
            },
            "key_phrases": {
              "type": "array",
              "items": {"type": "string"}
            },
            "summary": {
              "type": "string",
              "description": "Brief summary of the sentiment analysis"
            }
          },
          "required": ["overall_sentiment", "confidence", "emotions", "key_phrases", "summary"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Analyze this review: \"I absolutely love this product! It exceeded all my expectations. The quality is outstanding and customer service was incredibly helpful. Only minor issue is shipping took a bit longer than expected, but totally worth the wait!\""
      }
    ]
  }'
```

### Response

```json
{
  "id": "msg_01DEF456",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01XYZ",
      "name": "record_sentiment",
      "input": {
        "overall_sentiment": "very_positive",
        "confidence": 0.92,
        "emotions": [
          {"emotion": "joy", "intensity": 0.9},
          {"emotion": "satisfaction", "intensity": 0.85},
          {"emotion": "trust", "intensity": 0.8},
          {"emotion": "mild_frustration", "intensity": 0.2}
        ],
        "key_phrases": [
          "absolutely love",
          "exceeded all my expectations",
          "quality is outstanding",
          "incredibly helpful",
          "worth the wait"
        ],
        "summary": "Highly positive review expressing strong satisfaction with product quality and customer service. Minor complaint about shipping time but overall enthusiastic recommendation."
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## Method 3: Forced Tool Choice (Guaranteed Structure)

Use `tool_choice` to guarantee Claude always uses the specified tool.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "tool_choice": {"type": "tool", "name": "extract_entities"},
    "tools": [
      {
        "name": "extract_entities",
        "description": "Extract named entities from text",
        "input_schema": {
          "type": "object",
          "properties": {
            "people": {
              "type": "array",
              "items": {"type": "string"}
            },
            "organizations": {
              "type": "array",
              "items": {"type": "string"}
            },
            "locations": {
              "type": "array",
              "items": {"type": "string"}
            },
            "dates": {
              "type": "array",
              "items": {"type": "string"}
            },
            "monetary_values": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "amount": {"type": "number"},
                  "currency": {"type": "string"}
                }
              }
            }
          },
          "required": ["people", "organizations", "locations", "dates", "monetary_values"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Apple CEO Tim Cook announced the new iPhone 15 at their Cupertino headquarters on September 12, 2023. The device starts at $799."
      }
    ]
  }'
```

### Response

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01ABC",
      "name": "extract_entities",
      "input": {
        "people": ["Tim Cook"],
        "organizations": ["Apple"],
        "locations": ["Cupertino"],
        "dates": ["September 12, 2023"],
        "monetary_values": [{"amount": 799, "currency": "USD"}]
      }
    }
  ]
}
```

---

## Method 4: Enum Constraints for Classification

Use enums to restrict Claude's output to specific categories.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20250514",
    "max_tokens": 500,
    "tool_choice": {"type": "tool", "name": "classify_ticket"},
    "tools": [
      {
        "name": "classify_ticket",
        "description": "Classify a support ticket",
        "input_schema": {
          "type": "object",
          "properties": {
            "category": {
              "type": "string",
              "enum": ["billing", "technical", "account", "feature_request", "bug_report", "general"]
            },
            "priority": {
              "type": "string",
              "enum": ["low", "medium", "high", "urgent"]
            },
            "sentiment": {
              "type": "string",
              "enum": ["positive", "neutral", "negative", "angry"]
            },
            "requires_escalation": {
              "type": "boolean"
            },
            "suggested_department": {
              "type": "string",
              "enum": ["support", "engineering", "billing", "sales", "management"]
            }
          },
          "required": ["category", "priority", "sentiment", "requires_escalation", "suggested_department"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "URGENT: My payment failed 3 times and now my account is locked! I have a presentation tomorrow and need access NOW. This is completely unacceptable!"
      }
    ]
  }'
```

### Response

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01DEF",
      "name": "classify_ticket",
      "input": {
        "category": "billing",
        "priority": "urgent",
        "sentiment": "angry",
        "requires_escalation": true,
        "suggested_department": "billing"
      }
    }
  ]
}
```

---

## Extracting the Structured Data

After receiving the response, extract the structured data:

```bash
# Using jq to extract tool input
response=$(curl -s https://api.anthropic.com/v1/messages ...)
structured_data=$(echo "$response" | jq '.content[] | select(.type=="tool_use") | .input')
echo "$structured_data"
```

---

## Best Practices

1. **Use Tool Choice for Guaranteed Structure**: When you need 100% reliable JSON output, use `tool_choice` with a specific tool name.

2. **Define Required Fields**: Always specify `required` fields in your schema to ensure essential data is included.

3. **Use Enums for Classification**: When outputs must be from a fixed set of values, use enum constraints.

4. **Provide Clear Descriptions**: Add `description` fields to properties to guide Claude's understanding.

5. **Handle Edge Cases**: Define nullable types (`number|null`) for optional data that may not be present.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Learn tool fundamentals
- [Example 10: Data Extraction](example-10-data-extraction.md) - Extract data from documents
- [Example 04: Citations](example-04-citations.md) - Structured output with source attribution
