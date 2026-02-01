# Example 03: PDF Processing

> Analyze PDF documents natively with Claude, extracting text and understanding visual layouts.

## Overview

- **Difficulty**: Beginner
- **Features Used**: PDF Support, Vision
- **Use Cases**:
  - Document summarization
  - Contract analysis
  - Invoice processing
  - Report extraction
  - Research paper analysis
  - Form data extraction

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- PDF file to analyze

---

## PDF Limits

| Constraint | Limit |
|------------|-------|
| Maximum pages | 100 |
| Maximum file size | 32 MB |
| Minimum dimensions | 10 x 10 pixels per page |

---

## Basic PDF Analysis (Base64)

### Encode PDF to Base64

```bash
# Encode PDF file to base64
PDF_BASE64=$(base64 -i document.pdf)
```

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
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
            }
          },
          {
            "type": "text",
            "text": "Summarize this document in 3-5 bullet points."
          }
        ]
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
      "text": "Here are the key points from the document:\n\n• **Main Topic**: The document discusses...\n• **Key Finding 1**: Research shows that...\n• **Key Finding 2**: The analysis reveals...\n• **Conclusion**: The authors recommend...\n• **Next Steps**: Future work should focus on..."
    }
  ],
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 2500,
    "output_tokens": 150
  }
}
```

---

## PDF from URL

Load PDF directly from a URL.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "url",
              "url": "https://example.com/report.pdf"
            }
          },
          {
            "type": "text",
            "text": "What are the main conclusions of this report?"
          }
        ]
      }
    ]
  }'
```

---

## Contract Analysis

Extract key terms from legal documents.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "base64",
              "media_type": "application/pdf",
              "data": "'"$CONTRACT_PDF"'"
            }
          },
          {
            "type": "text",
            "text": "Extract the following from this contract and return as JSON:\n\n{\n  \"parties\": [],\n  \"effective_date\": \"\",\n  \"termination_date\": \"\",\n  \"payment_terms\": \"\",\n  \"key_obligations\": [],\n  \"termination_clauses\": [],\n  \"liability_caps\": \"\",\n  \"governing_law\": \"\"\n}"
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
      "text": "{\n  \"parties\": [\"Acme Corporation\", \"Widget Industries LLC\"],\n  \"effective_date\": \"January 1, 2024\",\n  \"termination_date\": \"December 31, 2026\",\n  \"payment_terms\": \"Net 30 days from invoice date\",\n  \"key_obligations\": [\n    \"Acme shall deliver monthly reports\",\n    \"Widget shall provide access to facilities\",\n    \"Both parties shall maintain confidentiality\"\n  ],\n  \"termination_clauses\": [\n    \"30 days written notice for convenience\",\n    \"Immediate termination for material breach\"\n  ],\n  \"liability_caps\": \"$1,000,000 aggregate\",\n  \"governing_law\": \"State of Delaware\"\n}"
    }
  ]
}
```

---

## Invoice Processing

Extract structured data from invoices.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "base64",
              "media_type": "application/pdf",
              "data": "'"$INVOICE_PDF"'"
            }
          },
          {
            "type": "text",
            "text": "Extract invoice data as JSON:\n{\n  \"invoice_number\": \"\",\n  \"date\": \"\",\n  \"due_date\": \"\",\n  \"vendor\": {\"name\": \"\", \"address\": \"\"},\n  \"customer\": {\"name\": \"\", \"address\": \"\"},\n  \"line_items\": [{\"description\": \"\", \"quantity\": 0, \"unit_price\": 0, \"total\": 0}],\n  \"subtotal\": 0,\n  \"tax\": 0,\n  \"total\": 0\n}"
          }
        ]
      }
    ]
  }'
```

---

## Multi-Page Document Analysis

For documents with multiple pages, Claude processes all pages together.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 8000,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "base64",
              "media_type": "application/pdf",
              "data": "'"$MULTI_PAGE_PDF"'"
            }
          },
          {
            "type": "text",
            "text": "This is a 50-page research paper. Please provide:\n1. A one-paragraph executive summary\n2. Key findings from each major section\n3. The methodology used\n4. Main conclusions and recommendations"
          }
        ]
      }
    ]
  }'
```

---

## PDF with Tables

Claude can understand and extract tabular data from PDFs.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "base64",
              "media_type": "application/pdf",
              "data": "'"$PDF_WITH_TABLES"'"
            }
          },
          {
            "type": "text",
            "text": "Extract all tables from this document and convert them to CSV format. Label each table with its page number and a descriptive title."
          }
        ]
      }
    ]
  }'
```

---

## Comparing Multiple PDFs

Analyze multiple documents in a single request.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 4096,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Compare these two contracts and identify the key differences:"
          },
          {
            "type": "document",
            "source": {
              "type": "base64",
              "media_type": "application/pdf",
              "data": "'"$CONTRACT_V1"'"
            }
          },
          {
            "type": "document",
            "source": {
              "type": "base64",
              "media_type": "application/pdf",
              "data": "'"$CONTRACT_V2"'"
            }
          }
        ]
      }
    ]
  }'
```

---

## Complete PDF Processing Script

```bash
#!/bin/bash

# PDF Document Processor
# Usage: ./process_pdf.sh document.pdf "Your question about the document"

PDF_FILE="$1"
QUESTION="${2:-Summarize this document}"

if [[ ! -f "$PDF_FILE" ]]; then
  echo "Error: PDF file not found: $PDF_FILE"
  exit 1
fi

# Check file size (32MB limit)
FILE_SIZE=$(stat -f%z "$PDF_FILE" 2>/dev/null || stat -c%s "$PDF_FILE")
MAX_SIZE=$((32 * 1024 * 1024))

if [[ $FILE_SIZE -gt $MAX_SIZE ]]; then
  echo "Error: File exceeds 32MB limit"
  exit 1
fi

echo "Processing: $PDF_FILE"
echo "Question: $QUESTION"
echo ""

# Encode PDF to base64
PDF_BASE64=$(base64 -i "$PDF_FILE" | tr -d '\n')

# Create request JSON
REQUEST=$(jq -n \
  --arg pdf "$PDF_BASE64" \
  --arg question "$QUESTION" \
  '{
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: $pdf
          }
        },
        {
          type: "text",
          text: $question
        }
      ]
    }]
  }')

# Make API call
RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$REQUEST")

# Extract and display response
echo "=== Response ==="
echo "$RESPONSE" | jq -r '.content[0].text'

echo ""
echo "=== Usage ==="
echo "$RESPONSE" | jq '.usage'
```

---

## Best Practices

1. **Check File Size**: Verify PDFs are under 32MB before sending.

2. **Handle Scanned Documents**: Claude can OCR scanned PDFs but may have lower accuracy than text-based PDFs.

3. **Be Specific with Questions**: For long documents, ask targeted questions rather than open-ended ones.

4. **Page References**: Ask Claude to cite page numbers when extracting information.

5. **Combine with Citations**: Use the Citations feature for verifiable document references.

---

## Related Examples

- [Example 04: Citations](example-04-citations.md) - Add source attribution to PDF analysis
- [Example 05: Files API](example-05-files-api.md) - Upload PDFs for reuse
- [Example 10: Data Extraction](example-10-data-extraction.md) - Extract structured data from documents
