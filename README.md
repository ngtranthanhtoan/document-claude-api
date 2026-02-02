# Claude API Reference

> Complete HTTP API documentation with cURL examples and practical use cases

---

## Table of Contents

- [API Overview](#api-overview)
- [Authentication](#authentication)
- [Available Models](#available-models)
- [Messages API](#messages-api)
- [Advanced Features](#advanced-features)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Pricing](#pricing)
- [Examples Index](#examples-index)
- [Resources](#resources)

---

## API Overview

### Base URL

```
https://api.anthropic.com
```

### API Version

```
2023-06-01
```

### Required Headers

| Header | Value | Required |
|--------|-------|----------|
| `x-api-key` | Your API key | Yes |
| `anthropic-version` | `2023-06-01` | Yes |
| `content-type` | `application/json` | Yes |

### Beta Headers

Some features require additional beta headers:

| Feature | Beta Header |
|---------|-------------|
| Files API | `anthropic-beta: files-api-2025-04-14` |
| MCP Connector | `anthropic-beta: mcp-client-2025-11-20` |
| Computer Use | `anthropic-beta: computer-use-2025-01-24` |
| Memory Tool | `anthropic-beta: context-management-2025-06-27` |
| Agent Skills | `anthropic-beta: code-execution-2025-08-25,skills-2025-10-02` |

### Standard Request Template

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{...}'
```

---

## Authentication

### Getting Your API Key

1. Create an account at [console.anthropic.com](https://console.anthropic.com)
2. Navigate to API Keys section
3. Generate a new API key (starts with `sk-ant-`)

### Setting Up Environment Variable

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### Testing Your Authentication

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

**Success Response:**
```json
{
  "id": "msg_01ABC123",
  "type": "message",
  "role": "assistant",
  "content": [{"type": "text", "text": "Hello! How can I help you today?"}],
  "model": "claude-sonnet-4-5-20250514",
  "stop_reason": "end_turn",
  "usage": {"input_tokens": 8, "output_tokens": 12}
}
```

---

## Available Models

### Model Comparison

| Model | Model ID | Context | Max Output | Input $/M | Output $/M |
|-------|----------|---------|------------|-----------|------------|
| **Opus 4.5** | `claude-opus-4-5-20251101` | 200K | 32K | $5 | $25 |
| **Sonnet 4.5** | `claude-sonnet-4-5-20250514` | 200K | 16K | $3 | $15 |
| **Haiku 4.5** | `claude-haiku-4-5-20250514` | 200K | 8K | $1 | $5 |

### Model Selection Guide

| Use Case | Recommended Model |
|----------|-------------------|
| Complex research, analysis, creative writing | Opus 4.5 |
| Production apps, coding, general purpose | Sonnet 4.5 |
| High-volume, real-time, cost-sensitive | Haiku 4.5 |

### Feature Support

All current models support: Vision, Tool Use, Extended Thinking, Prompt Caching, Batch API, Citations, PDF Support

---

## Messages API

### Endpoint

`POST /v1/messages`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model ID to use |
| `max_tokens` | integer | Yes | Maximum tokens in response |
| `messages` | array | Yes | Conversation messages |
| `system` | string/array | No | System prompt |
| `stream` | boolean | No | Enable streaming |
| `tools` | array | No | Available tools |
| `tool_choice` | object | No | Tool selection mode |
| `thinking` | object | No | Extended thinking config |

### Basic Message

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Explain quantum computing in 3 sentences."}
    ]
  }'
```

### With System Prompt

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "system": "You are a helpful Python developer. Always provide code examples.",
    "messages": [
      {"role": "user", "content": "How do I read a JSON file?"}
    ]
  }'
```

### Multi-turn Conversation

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "What is Python?"},
      {"role": "assistant", "content": "Python is a high-level programming language..."},
      {"role": "user", "content": "What are its main uses?"}
    ]
  }'
```

### Response Structure

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [
    {"type": "text", "text": "Response text here..."}
  ],
  "model": "claude-sonnet-4-5-20250514",
  "stop_reason": "end_turn",
  "usage": {"input_tokens": 18, "output_tokens": 103}
}
```

### Stop Reasons

| Value | Description |
|-------|-------------|
| `end_turn` | Model completed its response |
| `max_tokens` | Hit max_tokens limit |
| `stop_sequence` | Hit a stop sequence |
| `tool_use` | Model wants to use a tool |

---

## Advanced Features

### Streaming

Real-time token-by-token responses using Server-Sent Events (SSE).

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "stream": true,
    "messages": [{"role": "user", "content": "Write a haiku."}]
  }'
```

**SSE Event Types:**
- `message_start` - Initial metadata
- `content_block_delta` - Text chunks
- `message_delta` - Final metadata (stop_reason)
- `message_stop` - Stream complete

> **Detailed example:** [examples/example-02-streaming.md](examples/example-02-streaming.md)

---

### Tool Use (Function Calling)

Allow Claude to call external functions/APIs.

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "tools": [{
      "name": "get_weather",
      "description": "Get current weather for a location",
      "input_schema": {
        "type": "object",
        "properties": {
          "location": {"type": "string"}
        },
        "required": ["location"]
      }
    }],
    "messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]
  }'
```

**Flow:** Request → `stop_reason: "tool_use"` → Execute tool → Send result → Final response

> **Detailed examples:**
> - [examples/example-06-tool-use-basics.md](examples/example-06-tool-use-basics.md)
> - [examples/example-13-agentic-tool-loop.md](examples/example-13-agentic-tool-loop.md)

---

### Vision (Image Analysis)

Analyze images using base64 encoding or URLs.

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "messages": [{
      "role": "user",
      "content": [
        {"type": "image", "source": {"type": "url", "url": "https://example.com/image.jpg"}},
        {"type": "text", "text": "Describe this image."}
      ]
    }]
  }'
```

**Limits:** Max 8000x8000px, 100 images per request. Formats: JPEG, PNG, GIF, WebP

> **Detailed example:** [examples/example-07-vision-analysis.md](examples/example-07-vision-analysis.md)

---

### PDF Support

Native PDF document analysis (up to 100 pages, 32MB).

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "messages": [{
      "role": "user",
      "content": [
        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": "BASE64_PDF"}},
        {"type": "text", "text": "Summarize this document."}
      ]
    }]
  }'
```

> **Detailed example:** [examples/example-03-pdf-processing.md](examples/example-03-pdf-processing.md)

---

### Citations

Source attribution for document-grounded responses.

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "citations": {"enabled": true},
    "messages": [{
      "role": "user",
      "content": [
        {"type": "document", "source": {"type": "text", "content": "Document content here..."}},
        {"type": "text", "text": "What does the document say about X?"}
      ]
    }]
  }'
```

> **Detailed example:** [examples/example-04-citations.md](examples/example-04-citations.md)

---

### Extended Thinking

Deep reasoning with visible thought process.

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 16000,
    "thinking": {"type": "enabled", "budget_tokens": 10000},
    "messages": [{"role": "user", "content": "Solve this logic puzzle..."}]
  }'
```

Response includes `{"type": "thinking", "thinking": "..."}` content block.

---

### Prompt Caching

Cache large contexts for cost savings (90% off cached reads).

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 1024,
    "system": [{
      "type": "text",
      "text": "[Large document content - 10,000+ tokens]",
      "cache_control": {"type": "ephemeral"}
    }],
    "messages": [{"role": "user", "content": "Question about the document"}]
  }'
```

**Minimum:** 1024 tokens. **TTL:** 5 min (default) or 1 hour.

> **Detailed example:** [examples/example-08-rag-knowledge-base.md](examples/example-08-rag-knowledge-base.md)

---

### Batch Processing

Process many requests at 50% cost savings.

**Endpoint:** `POST /v1/messages/batches`

```bash
curl https://api.anthropic.com/v1/messages/batches \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "requests": [
      {"custom_id": "req-1", "params": {"model": "claude-haiku-4-5-20250514", "max_tokens": 500, "messages": [{"role": "user", "content": "Task 1"}]}},
      {"custom_id": "req-2", "params": {"model": "claude-haiku-4-5-20250514", "max_tokens": 500, "messages": [{"role": "user", "content": "Task 2"}]}}
    ]
  }'
```

**Limits:** 10,000 requests, 256MB max, results available 29 days.

> **Detailed example:** [examples/example-09-batch-processing.md](examples/example-09-batch-processing.md)

---

### Files API

Upload and reuse files across requests.

**Beta Header Required:** `anthropic-beta: files-api-2025-04-14`

```bash
# Upload file
curl https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  -F "file=@document.pdf"

# Reference in message
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "messages": [{
      "role": "user",
      "content": [
        {"type": "document", "source": {"type": "file", "file_id": "file_xxx"}},
        {"type": "text", "text": "Summarize this document."}
      ]
    }]
  }'
```

> **Detailed example:** [examples/example-05-files-api.md](examples/example-05-files-api.md)

---

### MCP Connector

Connect to Model Context Protocol servers for external tools.

**Beta Header Required:** `anthropic-beta: mcp-client-2025-11-20`

> **Detailed example:** [examples/example-16-mcp-connector.md](examples/example-16-mcp-connector.md)

---

### Computer Use

Desktop automation with mouse and keyboard control.

**Beta Header Required:** `anthropic-beta: computer-use-2025-01-24`

> **Detailed example:** [examples/example-17-computer-use.md](examples/example-17-computer-use.md)

---

### Memory Tool

Cross-conversation memory for persistent context.

**Beta Header Required:** `anthropic-beta: context-management-2025-06-27`

> **Detailed example:** [examples/example-18-memory-tool.md](examples/example-18-memory-tool.md)

---

### Agent Skills

Modular capabilities for document generation (Excel, PowerPoint, Word, PDF).

**Beta Headers Required:** `anthropic-beta: code-execution-2025-08-25,skills-2025-10-02`

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
        {"type": "anthropic", "skill_id": "xlsx", "version": "latest"}
      ]
    },
    "tools": [{"type": "code_execution_20250825", "name": "code_execution"}],
    "messages": [{"role": "user", "content": "Create a budget spreadsheet"}]
  }'
```

**Pre-built Skills:** `pptx` (PowerPoint), `xlsx` (Excel), `docx` (Word), `pdf`

**Limits:** Up to 8 skills per request. Download files via Files API.

> **Detailed example:** [examples/example-19-agent-skills.md](examples/example-19-agent-skills.md)

---

## Token Counting

**Endpoint:** `POST /v1/messages/count_tokens`

```bash
curl https://api.anthropic.com/v1/messages/count_tokens \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "messages": [{"role": "user", "content": "Hello world"}]
  }'
```

**Response:** `{"input_tokens": 12}`

---

## Error Handling

### Error Response Format

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "max_tokens: value must be greater than 0"
  }
}
```

### Error Types

| HTTP Code | Error Type | Description | Solution |
|-----------|------------|-------------|----------|
| 400 | `invalid_request_error` | Malformed request | Check request format |
| 401 | `authentication_error` | Invalid API key | Verify API key |
| 403 | `permission_error` | Access denied | Check permissions |
| 404 | `not_found_error` | Resource not found | Check endpoint/ID |
| 429 | `rate_limit_error` | Too many requests | Implement backoff |
| 500 | `api_error` | Server error | Retry with backoff |
| 529 | `overloaded_error` | API overloaded | Wait and retry |

---

## Rate Limits

### Rate Limit Headers

| Header | Description |
|--------|-------------|
| `anthropic-ratelimit-requests-limit` | Max requests per minute |
| `anthropic-ratelimit-requests-remaining` | Remaining requests |
| `anthropic-ratelimit-tokens-limit` | Max tokens per minute |
| `anthropic-ratelimit-tokens-remaining` | Remaining tokens |
| `retry-after` | Seconds to wait (on 429) |

### Rate Limit Tiers

| Tier | RPM | Input TPM | Output TPM | Requirement |
|------|-----|-----------|------------|-------------|
| 1 | 50 | 40,000 | 8,000 | Default |
| 2 | 1,000 | 80,000 | 16,000 | $40 credits |
| 3 | 2,000 | 160,000 | 32,000 | $200 credits |
| 4 | 4,000 | 400,000 | 80,000 | $400 credits |

---

## Pricing

### Per Million Tokens

| Model | Input | Output | Batch Input | Batch Output |
|-------|-------|--------|-------------|--------------|
| Opus 4.5 | $5.00 | $25.00 | $2.50 | $12.50 |
| Sonnet 4.5 | $3.00 | $15.00 | $1.50 | $7.50 |
| Haiku 4.5 | $1.00 | $5.00 | $0.50 | $2.50 |

### Prompt Caching

| Operation | 5-min TTL | 1-hour TTL |
|-----------|-----------|------------|
| Write | +25% | +100% |
| Read | 10% of base | 10% of base |

---

## Examples Index

### Beginner

| # | Example | Description |
|---|---------|-------------|
| 01 | [Structured Output](examples/example-01-structured-output.md) | JSON schemas, typed responses, forced tool choice |
| 02 | [Streaming](examples/example-02-streaming.md) | Real-time responses, SSE parsing |
| 03 | [PDF Processing](examples/example-03-pdf-processing.md) | Native PDF analysis (up to 100 pages) |
| 04 | [Citations](examples/example-04-citations.md) | Source attribution, document grounding |
| 05 | [Files API](examples/example-05-files-api.md) | File upload and reuse |

### Intermediate

| # | Example | Description |
|---|---------|-------------|
| 06 | [Tool Use Basics](examples/example-06-tool-use-basics.md) | Single tool, weather example |
| 07 | [Vision Analysis](examples/example-07-vision-analysis.md) | Image understanding, OCR |
| 08 | [RAG Knowledge Base](examples/example-08-rag-knowledge-base.md) | Prompt caching + document Q&A |
| 09 | [Batch Processing](examples/example-09-batch-processing.md) | Bulk operations, 50% cost savings |
| 10 | [Data Extraction](examples/example-10-data-extraction.md) | OCR + structured output pipelines |

### Advanced

| # | Example | Description |
|---|---------|-------------|
| 11 | [Customer Support Bot](examples/example-11-customer-support-bot.md) | Multi-turn + tools + sentiment |
| 12 | [Human in the Loop](examples/example-12-human-in-the-loop.md) | Approval patterns for sensitive actions |
| 13 | [Agentic Tool Loop](examples/example-13-agentic-tool-loop.md) | Autonomous agent with tool loop |
| 14 | [Research Agent](examples/example-14-research-agent.md) | Multi-tool + extended thinking |
| 15 | [Coding Assistant](examples/example-15-coding-assistant.md) | Streaming + tools + code execution |

### Expert

| # | Example | Description |
|---|---------|-------------|
| 16 | [MCP Connector](examples/example-16-mcp-connector.md) | Model Context Protocol integration |
| 17 | [Computer Use](examples/example-17-computer-use.md) | Desktop automation |
| 18 | [Memory Tool](examples/example-18-memory-tool.md) | Cross-conversation memory |
| 19 | [Agent Skills](examples/example-19-agent-skills.md) | Document generation (Excel, PowerPoint, Word, PDF) |

---

## Resources

- [API Documentation](https://docs.anthropic.com/en/api)
- [Anthropic Console](https://console.anthropic.com)
- [Model Cards](https://docs.anthropic.com/en/docs/about-claude/models)
- [Prompt Library](https://docs.anthropic.com/en/prompt-library)
- [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook)

---

*Last updated: 2025*
