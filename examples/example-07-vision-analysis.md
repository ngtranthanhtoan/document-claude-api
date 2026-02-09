# Example 07: Vision Analysis

> Analyze images using Claude's vision capabilities for understanding, OCR, and interpretation.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Vision, Image input
- **Use Cases**:
  - Image description and captioning
  - OCR (text extraction)
  - Chart and graph interpretation
  - UI/UX analysis
  - Product image cataloging
  - Document digitization
  - Accessibility alt-text generation

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Images to analyze (base64 or URL)

---

## Image Limits

| Constraint | Limit |
|------------|-------|
| Maximum dimension | 8000 x 8000 pixels |
| Maximum images per request | 100 |
| Supported formats | JPEG, PNG, GIF, WebP |

---

## Base64 Image Analysis

### Encode Image

```bash
# Encode image to base64
IMAGE_BASE64=$(base64 -i photo.jpg | tr -d '\n')
```

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/jpeg",
              "data": "'"$IMAGE_BASE64"'"
            }
          },
          {
            "type": "text",
            "text": "Describe what you see in this image in detail."
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
      "text": "The image shows a modern office workspace with a large wooden desk positioned near floor-to-ceiling windows. On the desk, there's a silver laptop, a ceramic coffee mug, and a small potted succulent plant. The natural lighting from the windows creates a warm, inviting atmosphere..."
    }
  ],
  "stop_reason": "end_turn"
}
```

---

## URL-Based Image

Load images directly from URLs.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "url",
              "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg"
            }
          },
          {
            "type": "text",
            "text": "What animal is in this image? Describe its characteristics."
          }
        ]
      }
    ]
  }'
```

---

## OCR: Text Extraction

Extract text from images of documents, signs, or screenshots.

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
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$DOCUMENT_IMAGE"'"
            }
          },
          {
            "type": "text",
            "text": "Extract all text from this image. Maintain the original formatting and structure as much as possible."
          }
        ]
      }
    ]
  }'
```

---

## Invoice/Receipt OCR with Structured Output

Extract and structure data from invoices.

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
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$INVOICE_IMAGE"'"
            }
          },
          {
            "type": "text",
            "text": "Extract all information from this invoice and return as JSON:\n{\n  \"invoice_number\": \"\",\n  \"date\": \"\",\n  \"vendor\": {\"name\": \"\", \"address\": \"\"},\n  \"line_items\": [{\"description\": \"\", \"quantity\": 0, \"unit_price\": 0, \"total\": 0}],\n  \"subtotal\": 0,\n  \"tax\": 0,\n  \"total\": 0,\n  \"payment_terms\": \"\"\n}"
          }
        ]
      }
    ]
  }'
```

---

## Chart and Graph Interpretation

Analyze data visualizations.

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
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$CHART_IMAGE"'"
            }
          },
          {
            "type": "text",
            "text": "Analyze this chart and provide:\n1. Type of chart\n2. What data it represents\n3. Key trends or patterns\n4. Notable data points\n5. Business insights you can derive"
          }
        ]
      }
    ]
  }'
```

---

## Multiple Image Comparison

Analyze and compare multiple images.

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
            "type": "text",
            "text": "Compare these two product images and identify all differences:"
          },
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$IMAGE1_BASE64"'"
            }
          },
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$IMAGE2_BASE64"'"
            }
          }
        ]
      }
    ]
  }'
```

---

## UI/UX Screenshot Analysis

Analyze user interface designs.

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
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$UI_SCREENSHOT"'"
            }
          },
          {
            "type": "text",
            "text": "Analyze this UI screenshot and provide:\n1. Overall layout assessment\n2. Visual hierarchy analysis\n3. Usability concerns\n4. Accessibility issues\n5. Suggestions for improvement"
          }
        ]
      }
    ]
  }'
```

---

## Error/Bug Screenshot Debugging

Analyze error messages and bugs from screenshots.

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
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "'"$ERROR_SCREENSHOT"'"
            }
          },
          {
            "type": "text",
            "text": "I am getting this error. What does it mean and how do I fix it?"
          }
        ]
      }
    ]
  }'
```

---

## Accessibility Alt-Text Generation

Generate descriptive alt-text for images.

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 500,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/jpeg",
              "data": "'"$IMAGE_BASE64"'"
            }
          },
          {
            "type": "text",
            "text": "Generate concise, descriptive alt-text for this image suitable for screen readers. Keep it under 125 characters."
          }
        ]
      }
    ]
  }'
```

---

## Complete Image Analysis Script

```bash
#!/bin/bash

# Image Analysis Script
# Usage: ./analyze_image.sh image.jpg "Your question"

IMAGE_FILE="$1"
QUESTION="${2:-Describe this image in detail.}"

if [[ ! -f "$IMAGE_FILE" ]]; then
  echo "Error: Image file not found: $IMAGE_FILE"
  exit 1
fi

# Detect media type
case "$IMAGE_FILE" in
  *.jpg|*.jpeg) MEDIA_TYPE="image/jpeg" ;;
  *.png) MEDIA_TYPE="image/png" ;;
  *.gif) MEDIA_TYPE="image/gif" ;;
  *.webp) MEDIA_TYPE="image/webp" ;;
  *) echo "Unsupported format"; exit 1 ;;
esac

echo "Analyzing: $IMAGE_FILE"
echo "Question: $QUESTION"
echo ""

# Encode image
IMAGE_BASE64=$(base64 -i "$IMAGE_FILE" | tr -d '\n')

# Create request
REQUEST=$(jq -n \
  --arg img "$IMAGE_BASE64" \
  --arg media "$MEDIA_TYPE" \
  --arg q "$QUESTION" \
  '{
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        {type: "image", source: {type: "base64", media_type: $media, data: $img}},
        {type: "text", text: $q}
      ]
    }]
  }')

# Make API call
RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$REQUEST")

# Display result
echo "=== Analysis ==="
echo "$RESPONSE" | jq -r '.content[0].text'

echo ""
echo "=== Token Usage ==="
echo "$RESPONSE" | jq '.usage'
```

---

## Best Practices

1. **Optimize Image Size**: Resize large images to reduce token usage.

2. **Be Specific**: Ask targeted questions rather than open-ended ones.

3. **Use Appropriate Model**: Sonnet is best for most vision tasks; use Opus for complex analysis.

4. **Batch When Possible**: Send multiple related images in one request.

5. **Combine with Tools**: Use vision with tool use for structured data extraction.

---

## Related Examples

- [Example 10: Data Extraction](example-10-data-extraction.md) - Structured extraction from images
- [Example 03: PDF Processing](example-03-pdf-processing.md) - Document analysis
- [Example 17: Computer Use](example-17-computer-use.md) - Screenshot-based automation
