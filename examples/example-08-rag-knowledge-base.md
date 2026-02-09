# Example 08: RAG Knowledge Base

> Build a document Q&A system using prompt caching for efficient repeated queries.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Prompt Caching, Multi-turn
- **Use Cases**:
  - Documentation assistants
  - Legal contract Q&A
  - Customer support knowledge bases
  - Technical documentation helpers
  - Compliance checking
  - Educational tutoring systems

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Large document(s) to query against

---

## How RAG with Caching Works

```
┌─────────────────────────────────────────────────────────────┐
│                    First Request                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  System Prompt + Documents (cached)                   │   │
│  │  cache_control: {"type": "ephemeral"}                │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↓                                    │
│  Usage: cache_creation_input_tokens: 15000                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Subsequent Requests                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Same cached content (90% cost savings)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↓                                    │
│  Usage: cache_read_input_tokens: 15000                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Initial Request with Cache

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 2048,
    "system": [
      {
        "type": "text",
        "text": "You are a helpful documentation assistant. You have access to the following product documentation. Answer questions based ONLY on this documentation. If information is not in the docs, say so clearly. Always cite the relevant section when answering.\n\n---\n\n# Product Documentation\n\n## Chapter 1: Getting Started\n\n### 1.1 Installation\nTo install the product, run: npm install @company/product\nRequirements: Node.js 18+, npm 9+\n\n### 1.2 Configuration\nCreate a config.json file in your project root:\n{\n  \"apiKey\": \"your-api-key\",\n  \"environment\": \"production\",\n  \"timeout\": 30000\n}\n\n### 1.3 Quick Start\nimport { Client } from '@company/product';\nconst client = new Client({ apiKey: process.env.API_KEY });\nawait client.connect();\n\n## Chapter 2: Authentication\n\n### 2.1 API Keys\nAPI keys can be generated in the dashboard. Keys have two types:\n- Production keys (pk_live_*)\n- Test keys (pk_test_*)\n\n### 2.2 OAuth Integration\nFor OAuth, configure your redirect URI in the dashboard.\nSupported flows: Authorization Code, Client Credentials\n\n### 2.3 Rate Limits\n- Free tier: 100 requests/minute\n- Pro tier: 1000 requests/minute\n- Enterprise: Unlimited\n\n## Chapter 3: API Reference\n\n### 3.1 Users API\nGET /api/users - List all users\nGET /api/users/:id - Get user by ID\nPOST /api/users - Create user\nPUT /api/users/:id - Update user\nDELETE /api/users/:id - Delete user\n\n### 3.2 Products API\nGET /api/products - List products\nGET /api/products/:id - Get product\nPOST /api/products - Create product\n\n[... imagine 10,000+ more tokens of documentation ...]",
        "cache_control": {
          "type": "ephemeral"
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "How do I install the product?"
      }
    ]
  }'
```

### Response (Cache Created)

```json
{
  "id": "msg_01ABC123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Based on the documentation (Chapter 1.1 Installation), you can install the product by running:\n\n```bash\nnpm install @company/product\n```\n\n**Requirements:**\n- Node.js 18 or higher\n- npm 9 or higher\n\nMake sure your environment meets these requirements before installation."
    }
  ],
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 85,
    "cache_creation_input_tokens": 15000,
    "cache_read_input_tokens": 0
  }
}
```

---

## Step 2: Follow-up Query (Cache Hit)

Same system prompt will hit the cache.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 2048,
    "system": [
      {
        "type": "text",
        "text": "[SAME DOCUMENTATION AS BEFORE]",
        "cache_control": {"type": "ephemeral"}
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "What are the rate limits?"
      }
    ]
  }'
```

### Response (Cache Read)

```json
{
  "id": "msg_01DEF456",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "According to the documentation (Chapter 2.3 Rate Limits), the rate limits are:\n\n| Tier | Rate Limit |\n|------|------------|\n| Free | 100 requests/minute |\n| Pro | 1000 requests/minute |\n| Enterprise | Unlimited |\n\nIf you need higher limits, consider upgrading to the Pro or Enterprise tier."
    }
  ],
  "usage": {
    "input_tokens": 25,
    "output_tokens": 78,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 15000
  }
}
```

**Note:** `cache_read_input_tokens: 15000` indicates the cache was used!

---

## Extended Cache TTL (1 Hour)

For high-traffic systems, use 1-hour TTL.

```bash
"cache_control": {
  "type": "ephemeral",
  "ttl": "1h"
}
```

**Cost Trade-off:**
- 5-min TTL: +25% write cost, 10% read cost
- 1-hour TTL: +100% write cost, 10% read cost

---

## Multi-Document RAG

Cache multiple documents in the system prompt.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 2048,
    "system": [
      {
        "type": "text",
        "text": "You are a support assistant with access to multiple knowledge bases.\n\n---\n\n# Document 1: User Guide\n[User guide content...]\n\n---\n\n# Document 2: API Reference\n[API reference content...]\n\n---\n\n# Document 3: Troubleshooting\n[Troubleshooting content...]\n\n---\n\n# Document 4: FAQ\n[FAQ content...]",
        "cache_control": {"type": "ephemeral"}
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "How do I reset my password?"
      }
    ]
  }'
```

---

## RAG with Citations

Combine caching with citations for verifiable answers.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 2048,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "text",
              "media_type": "text/plain",
              "data": "[Documentation content here...]"
            },
            "title": "Product Documentation v2.0",
            "citations": {"enabled": true},
            "cache_control": {"type": "ephemeral"}
          },
          {
            "type": "text",
            "text": "What authentication methods are supported?"
          }
        ]
      }
    ]
  }'
```

---

## Multi-Turn RAG Conversation

Maintain context across multiple exchanges.

### Request (Turn 1)

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 2048,
    "system": [{"type": "text", "text": "[DOCS]", "cache_control": {"type": "ephemeral"}}],
    "messages": [
      {"role": "user", "content": "How do I authenticate?"}
    ]
  }'
```

### Request (Turn 2)

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 2048,
    "system": [{"type": "text", "text": "[DOCS]", "cache_control": {"type": "ephemeral"}}],
    "messages": [
      {"role": "user", "content": "How do I authenticate?"},
      {"role": "assistant", "content": "You can authenticate using API keys or OAuth..."},
      {"role": "user", "content": "Show me an example of OAuth setup"}
    ]
  }'
```

---

## Complete RAG Script

```bash
#!/bin/bash

# RAG Knowledge Base Assistant
# Usage: ./rag_assistant.sh

# Load documentation
DOCS=$(cat << 'DOCS_END'
# Company Product Documentation

## Installation
Run: npm install @company/product

## Configuration
Create config.json with your API key.

## API Endpoints
- GET /users - List users
- POST /users - Create user
- GET /products - List products

## Troubleshooting
Common issues and solutions...
DOCS_END
)

# Function to ask a question
ask() {
  local question="$1"

  echo "Q: $question"

  RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "$(jq -n \
      --arg docs "$DOCS" \
      --arg q "$question" \
      '{
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: [{
          type: "text",
          text: ("You are a documentation assistant. Answer based on this documentation:\n\n" + $docs),
          cache_control: {type: "ephemeral"}
        }],
        messages: [{role: "user", content: $q}]
      }')")

  echo "A: $(echo "$RESPONSE" | jq -r '.content[0].text')"
  echo ""

  # Show cache stats
  CACHE_CREATE=$(echo "$RESPONSE" | jq -r '.usage.cache_creation_input_tokens // 0')
  CACHE_READ=$(echo "$RESPONSE" | jq -r '.usage.cache_read_input_tokens // 0')

  if [[ "$CACHE_CREATE" -gt 0 ]]; then
    echo "(Cache created: $CACHE_CREATE tokens)"
  elif [[ "$CACHE_READ" -gt 0 ]]; then
    echo "(Cache hit: $CACHE_READ tokens - 90% savings!)"
  fi
  echo "---"
}

# Ask multiple questions
ask "How do I install the product?"
ask "What API endpoints are available?"
ask "How do I create a user?"
ask "What are common troubleshooting steps?"
```

---

## Cache Pricing

| TTL | Write Cost | Read Cost |
|-----|------------|-----------|
| 5 min (default) | Base + 25% | Base × 10% |
| 1 hour | Base + 100% | Base × 10% |

**Minimum cacheable:** 1024 tokens

---

## Best Practices

1. **Cache Large, Static Content**: Put documentation in the cached system prompt.

2. **Consistent Cache Keys**: The exact same text triggers cache hits.

3. **Monitor Cache Metrics**: Check `cache_creation_input_tokens` vs `cache_read_input_tokens`.

4. **Use 1-Hour TTL for High Traffic**: More expensive write, but better for busy systems.

5. **Combine with Citations**: Add verifiability to RAG responses.

---

## Related Examples

- [Example 04: Citations](example-04-citations.md) - Add source attribution
- [Example 03: PDF Processing](example-03-pdf-processing.md) - Process PDF documentation
- [Example 11: Customer Support Bot](example-11-customer-support-bot.md) - Full support system
