# Example 10: Data Extraction

> Extract structured data from documents and images using Vision and structured output.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Vision, Structured Output, Tool Use
- **Use Cases**:
  - Invoice processing
  - Receipt digitization
  - Business card scanning
  - Form data extraction
  - Table extraction
  - Document digitization

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Documents or images to process

---

## Invoice Data Extraction

Extract structured data from invoice images.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 2048,
    "tool_choice": {"type": "tool", "name": "extract_invoice"},
    "tools": [
      {
        "name": "extract_invoice",
        "description": "Extract structured data from an invoice",
        "input_schema": {
          "type": "object",
          "properties": {
            "invoice_number": {"type": "string"},
            "invoice_date": {"type": "string", "description": "YYYY-MM-DD format"},
            "due_date": {"type": "string", "description": "YYYY-MM-DD format"},
            "vendor": {
              "type": "object",
              "properties": {
                "name": {"type": "string"},
                "address": {"type": "string"},
                "phone": {"type": "string"},
                "email": {"type": "string"}
              }
            },
            "customer": {
              "type": "object",
              "properties": {
                "name": {"type": "string"},
                "address": {"type": "string"}
              }
            },
            "line_items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "description": {"type": "string"},
                  "quantity": {"type": "number"},
                  "unit_price": {"type": "number"},
                  "total": {"type": "number"}
                }
              }
            },
            "subtotal": {"type": "number"},
            "tax_rate": {"type": "number"},
            "tax_amount": {"type": "number"},
            "total": {"type": "number"},
            "payment_terms": {"type": "string"},
            "currency": {"type": "string"}
          },
          "required": ["invoice_number", "invoice_date", "vendor", "line_items", "total"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$INVOICE_IMAGE"'"
            }
          },
          {
            "type": "text",
            "text": "Extract all data from this invoice."
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
      "type": "tool_use",
      "id": "toolu_01ABC",
      "name": "extract_invoice",
      "input": {
        "invoice_number": "INV-2024-0042",
        "invoice_date": "2024-01-15",
        "due_date": "2024-02-14",
        "vendor": {
          "name": "TechSupply Co.",
          "address": "123 Business Ave, Suite 100, San Francisco, CA 94105",
          "phone": "(555) 123-4567",
          "email": "billing@techsupply.com"
        },
        "customer": {
          "name": "Acme Corporation",
          "address": "456 Corporate Blvd, New York, NY 10001"
        },
        "line_items": [
          {"description": "Laptop Computer - Model X1", "quantity": 5, "unit_price": 1299.00, "total": 6495.00},
          {"description": "Wireless Mouse", "quantity": 10, "unit_price": 49.99, "total": 499.90},
          {"description": "USB-C Hub", "quantity": 5, "unit_price": 79.99, "total": 399.95}
        ],
        "subtotal": 7394.85,
        "tax_rate": 8.5,
        "tax_amount": 628.56,
        "total": 8023.41,
        "payment_terms": "Net 30",
        "currency": "USD"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## Receipt Processing

Extract data from receipts.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "tool_choice": {"type": "tool", "name": "extract_receipt"},
    "tools": [
      {
        "name": "extract_receipt",
        "description": "Extract data from a receipt",
        "input_schema": {
          "type": "object",
          "properties": {
            "store_name": {"type": "string"},
            "store_address": {"type": "string"},
            "date": {"type": "string"},
            "time": {"type": "string"},
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {"type": "string"},
                  "quantity": {"type": "number"},
                  "price": {"type": "number"}
                }
              }
            },
            "subtotal": {"type": "number"},
            "tax": {"type": "number"},
            "total": {"type": "number"},
            "payment_method": {"type": "string"},
            "card_last_four": {"type": "string"}
          },
          "required": ["store_name", "date", "items", "total"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/jpeg",
              "data": "'"$RECEIPT_IMAGE"'"
            }
          },
          {
            "type": "text",
            "text": "Extract all information from this receipt."
          }
        ]
      }
    ]
  }'
```

---

## Business Card Extraction

Parse contact information from business cards.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "tool_choice": {"type": "tool", "name": "extract_contact"},
    "tools": [
      {
        "name": "extract_contact",
        "description": "Extract contact information from a business card",
        "input_schema": {
          "type": "object",
          "properties": {
            "full_name": {"type": "string"},
            "job_title": {"type": "string"},
            "company": {"type": "string"},
            "email": {"type": "string"},
            "phone": {"type": "string"},
            "mobile": {"type": "string"},
            "fax": {"type": "string"},
            "website": {"type": "string"},
            "address": {"type": "string"},
            "linkedin": {"type": "string"},
            "twitter": {"type": "string"}
          },
          "required": ["full_name"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/jpeg",
              "data": "'"$CARD_IMAGE"'"
            }
          },
          {
            "type": "text",
            "text": "Extract all contact information from this business card."
          }
        ]
      }
    ]
  }'
```

---

## Table Extraction

Extract tabular data from documents.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$TABLE_IMAGE"'"
            }
          },
          {
            "type": "text",
            "text": "Extract the table from this image and return as JSON with:\n{\n  \"headers\": [\"column1\", \"column2\", ...],\n  \"rows\": [[\"cell1\", \"cell2\", ...], ...]\n}\n\nPreserve the exact values as they appear in the table."
          }
        ]
      }
    ]
  }'
```

---

## Batch Document Extraction

Process multiple documents using the Batch API.

### Request

```bash
curl https://api.anthropic.com/v1/messages/batches \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "requests": [
      {
        "custom_id": "invoice-001",
        "params": {
          "model": "claude-sonnet-4-5-20250929",
          "max_tokens": 2048,
          "messages": [{
            "role": "user",
            "content": [
              {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "BASE64_INVOICE_1"}},
              {"type": "text", "text": "Extract as JSON: {invoice_number, date, vendor, items: [{description, qty, price}], total}"}
            ]
          }]
        }
      },
      {
        "custom_id": "invoice-002",
        "params": {
          "model": "claude-sonnet-4-5-20250929",
          "max_tokens": 2048,
          "messages": [{
            "role": "user",
            "content": [
              {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "BASE64_INVOICE_2"}},
              {"type": "text", "text": "Extract as JSON: {invoice_number, date, vendor, items: [{description, qty, price}], total}"}
            ]
          }]
        }
      }
    ]
  }'
```

---

## PDF Form Extraction

Extract data from PDF forms.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
    "tool_choice": {"type": "tool", "name": "extract_form"},
    "tools": [
      {
        "name": "extract_form",
        "description": "Extract filled form data",
        "input_schema": {
          "type": "object",
          "properties": {
            "form_type": {"type": "string"},
            "fields": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "label": {"type": "string"},
                  "value": {"type": "string"},
                  "field_type": {"type": "string", "enum": ["text", "checkbox", "radio", "signature", "date"]}
                }
              }
            },
            "signatures": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "signer": {"type": "string"},
                  "date": {"type": "string"},
                  "present": {"type": "boolean"}
                }
              }
            }
          },
          "required": ["form_type", "fields"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "document",
            "source": {
              "type": "base64",
              "media_type": "application/pdf",
              "data": "'"$PDF_FORM"'"
            }
          },
          {
            "type": "text",
            "text": "Extract all filled fields from this form."
          }
        ]
      }
    ]
  }'
```

---

## Complete Extraction Script

```bash
#!/bin/bash

# Document Data Extraction Script
# Usage: ./extract.sh invoice.png

IMAGE_FILE="$1"

if [[ ! -f "$IMAGE_FILE" ]]; then
  echo "Error: File not found"
  exit 1
fi

# Detect media type
case "$IMAGE_FILE" in
  *.png) MEDIA_TYPE="image/png" ;;
  *.jpg|*.jpeg) MEDIA_TYPE="image/jpeg" ;;
  *.pdf) MEDIA_TYPE="application/pdf"; TYPE="document" ;;
  *) echo "Unsupported format"; exit 1 ;;
esac

TYPE="${TYPE:-image}"
IMAGE_BASE64=$(base64 -i "$IMAGE_FILE" | tr -d '\n')

# Create request
REQUEST=$(jq -n \
  --arg img "$IMAGE_BASE64" \
  --arg media "$MEDIA_TYPE" \
  --arg type "$TYPE" \
  '{
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: [
        {
          type: $type,
          source: {type: "base64", media_type: $media, data: $img}
        },
        {
          type: "text",
          text: "Extract all data from this document and return as structured JSON. Include all text, numbers, dates, and table data."
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

# Extract and format JSON
echo "$RESPONSE" | jq -r '.content[0].text'
```

---

## Best Practices

1. **Use Forced Tool Choice**: Guarantees consistent structured output.

2. **Define Complete Schemas**: Include all possible fields even if optional.

3. **Handle Missing Data**: Use `null` for fields not found in the document.

4. **Validate Output**: Check extracted data against expected formats.

5. **Batch for Volume**: Use Batch API for processing many documents.

---

## Related Examples

- [Example 07: Vision Analysis](example-07-vision-analysis.md) - Image understanding basics
- [Example 01: Structured Output](example-01-structured-output.md) - JSON schema techniques
- [Example 09: Batch Processing](example-09-batch-processing.md) - Process many documents
