# Example 04: Citations

> Enable source attribution in Claude's responses, grounding answers in provided documents.

## Overview

- **Difficulty**: Beginner
- **Features Used**: Citations API, Document grounding
- **Use Cases**:
  - Legal document analysis
  - Research paper summarization
  - Contract review with quotes
  - Compliance verification
  - Fact-checking systems
  - Knowledge base Q&A

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Source documents to reference

---

## How Citations Work

1. Enable citations with `"citations": {"enabled": true}`
2. Provide documents in the message content
3. Claude responds with inline citations pointing to source text
4. Response includes `citation` blocks with exact quotes and locations

---

## Basic Citations with Text Document

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "citations": {"enabled": true},
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "text",
              "media_type": "text/plain",
              "data": "Company Policy Document\n\nSection 1: Remote Work Policy\nEmployees may work remotely up to 3 days per week with manager approval. All remote work must be logged in the HR system by end of day Monday.\n\nSection 2: Equipment\nThe company provides a laptop and monitor for home office use. Employees are responsible for maintaining a suitable work environment.\n\nSection 3: Communication\nRemote employees must be available on Slack during core hours (10am-3pm local time). Video should be enabled for all team meetings."
            },
            "title": "Employee Handbook 2024"
          },
          {
            "type": "text",
            "text": "How many days can I work from home?"
          }
        ]
      }
    ]
  }'
```

### Response with Citations

```json
{
  "id": "msg_01ABC123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "According to the company policy, "
    },
    {
      "type": "citation",
      "cited_text": "Employees may work remotely up to 3 days per week with manager approval.",
      "document_index": 0,
      "document_title": "Employee Handbook 2024",
      "start_char": 45,
      "end_char": 116
    },
    {
      "type": "text",
      "text": " So you can work from home up to 3 days per week, but you need to get approval from your manager first."
    }
  ],
  "stop_reason": "end_turn"
}
```

---

## Multiple Documents

Reference multiple sources in a single query.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "citations": {"enabled": true},
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "text",
              "media_type": "text/plain",
              "data": "Q3 2024 Financial Report\n\nRevenue: $45.2M (up 12% YoY)\nNet Income: $8.1M (up 18% YoY)\nOperating Margin: 22%\nCustomer Count: 15,000 (up 25% YoY)"
            },
            "title": "Q3 Financial Report"
          },
          {
            "type": "document",
            "source": {
              "type": "text",
              "media_type": "text/plain",
              "data": "Q2 2024 Financial Report\n\nRevenue: $42.1M (up 10% YoY)\nNet Income: $7.2M (up 15% YoY)\nOperating Margin: 20%\nCustomer Count: 13,500 (up 22% YoY)"
            },
            "title": "Q2 Financial Report"
          },
          {
            "type": "text",
            "text": "How has the company's revenue changed from Q2 to Q3?"
          }
        ]
      }
    ]
  }'
```

### Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "The company's revenue increased from Q2 to Q3. In Q2, "
    },
    {
      "type": "citation",
      "cited_text": "Revenue: $42.1M (up 10% YoY)",
      "document_index": 1,
      "document_title": "Q2 Financial Report",
      "start_char": 28,
      "end_char": 56
    },
    {
      "type": "text",
      "text": " while in Q3, "
    },
    {
      "type": "citation",
      "cited_text": "Revenue: $45.2M (up 12% YoY)",
      "document_index": 0,
      "document_title": "Q3 Financial Report",
      "start_char": 28,
      "end_char": 56
    },
    {
      "type": "text",
      "text": " This represents a quarter-over-quarter increase of $3.1M or approximately 7.4%."
    }
  ]
}
```

---

## Citations with PDF Documents

Works seamlessly with PDF files.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "citations": {"enabled": true},
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "base64",
              "media_type": "application/pdf",
              "data": "'"$PDF_BASE64"'"
            },
            "title": "Research Paper"
          },
          {
            "type": "text",
            "text": "What methodology did the authors use? Quote the relevant sections."
          }
        ]
      }
    ]
  }'
```

---

## Legal Document Analysis with Citations

Perfect for contract review where exact quotes matter.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-opus-4-5-20251101",
    "max_tokens": 8000,
    "citations": {"enabled": true},
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "text",
              "media_type": "text/plain",
              "data": "SERVICE AGREEMENT\n\nArticle 5: Termination\n5.1 Either party may terminate this Agreement with 30 days written notice.\n5.2 Immediate termination is permitted upon material breach that remains uncured for 15 days after written notice.\n5.3 Upon termination, all confidential information must be returned within 10 business days.\n\nArticle 6: Liability\n6.1 Neither party shall be liable for indirect, incidental, or consequential damages.\n6.2 Total liability under this Agreement shall not exceed the fees paid in the 12 months preceding the claim.\n6.3 The limitations in this section shall not apply to breaches of confidentiality obligations."
            },
            "title": "Service Agreement v2.1"
          },
          {
            "type": "text",
            "text": "What are all the termination conditions and their requirements? Quote each one."
          }
        ]
      }
    ]
  }'
```

---

## Extracting Citations Programmatically

Parse the response to build a structured list of citations.

```bash
#!/bin/bash

RESPONSE=$(curl -s https://api.anthropic.com/v1/messages ...)

# Extract all citations
echo "$RESPONSE" | jq '[.content[] | select(.type == "citation") | {
  quote: .cited_text,
  source: .document_title,
  position: {start: .start_char, end: .end_char}
}]'
```

### Output

```json
[
  {
    "quote": "Either party may terminate this Agreement with 30 days written notice.",
    "source": "Service Agreement v2.1",
    "position": {"start": 45, "end": 115}
  },
  {
    "quote": "Immediate termination is permitted upon material breach...",
    "source": "Service Agreement v2.1",
    "position": {"start": 120, "end": 210}
  }
]
```

---

## Combining Citations with Tool Output

Use citations alongside structured output.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "citations": {"enabled": true},
    "tools": [{
      "name": "extract_claims",
      "description": "Extract claims from a document with citations",
      "input_schema": {
        "type": "object",
        "properties": {
          "claims": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "claim": {"type": "string"},
                "evidence": {"type": "string"},
                "confidence": {"type": "string", "enum": ["high", "medium", "low"]}
              }
            }
          }
        }
      }
    }],
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "text",
              "media_type": "text/plain",
              "data": "Study Results: The treatment group showed a 45% improvement in symptoms compared to placebo (p<0.01). Side effects were mild and occurred in only 5% of participants."
            },
            "title": "Clinical Trial Results"
          },
          {
            "type": "text",
            "text": "Extract all claims from this study with supporting evidence."
          }
        ]
      }
    ]
  }'
```

---

## Citation Block Structure

```json
{
  "type": "citation",
  "cited_text": "The exact quoted text from the source",
  "document_index": 0,
  "document_title": "Document Name",
  "start_char": 100,
  "end_char": 150
}
```

| Field | Description |
|-------|-------------|
| `cited_text` | The exact text being quoted |
| `document_index` | Index of source document (0-based) |
| `document_title` | Title of the source document |
| `start_char` | Character position where quote starts |
| `end_char` | Character position where quote ends |

---

## Best Practices

1. **Provide Document Titles**: Always include a `title` field to make citations more readable.

2. **Use for Verification**: Citations are essential when answers must be verifiable.

3. **Combine with PDFs**: Great for legal, academic, and compliance documents.

4. **Structure Long Documents**: Break very long documents into sections with clear headings.

5. **Validate Citations**: You can verify citations by checking the character positions against the original text.

---

## Related Examples

- [Example 03: PDF Processing](example-03-pdf-processing.md) - Analyze PDF documents
- [Example 08: RAG Knowledge Base](example-08-rag-knowledge-base.md) - Build a Q&A system with citations
- [Example 14: Research Agent](example-14-research-agent.md) - Research with source attribution
