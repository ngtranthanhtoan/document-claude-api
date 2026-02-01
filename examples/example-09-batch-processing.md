# Example 09: Batch Processing

> Process many requests at 50% cost savings with asynchronous batch operations.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Batch API
- **Use Cases**:
  - Bulk content generation
  - Large-scale data labeling
  - Mass translation
  - Document classification
  - Resume screening
  - Survey response analysis
  - SEO meta generation

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
- Multiple tasks to process

---

## Batch Limits

| Limit | Value |
|-------|-------|
| Max requests per batch | 10,000 |
| Max batch size | 256 MB |
| Processing time | Usually < 1 hour, max 24 hours |
| Results available | 29 days |
| **Cost savings** | **50% off all tokens** |

---

## Batch Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Create    │ ──> │   Process   │ ──> │   Check     │ ──> │  Retrieve   │
│   Batch     │     │   (async)   │     │   Status    │     │   Results   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Step 1: Create a Batch

### Request

```bash
curl https://api.anthropic.com/v1/messages/batches \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "requests": [
      {
        "custom_id": "product-001",
        "params": {
          "model": "claude-haiku-4-5-20250514",
          "max_tokens": 500,
          "messages": [
            {
              "role": "user",
              "content": "Write a compelling product description for: Wireless Bluetooth Headphones with 40-hour battery life and active noise cancellation. Max 100 words."
            }
          ]
        }
      },
      {
        "custom_id": "product-002",
        "params": {
          "model": "claude-haiku-4-5-20250514",
          "max_tokens": 500,
          "messages": [
            {
              "role": "user",
              "content": "Write a compelling product description for: Ergonomic Office Chair with lumbar support and breathable mesh back. Max 100 words."
            }
          ]
        }
      },
      {
        "custom_id": "product-003",
        "params": {
          "model": "claude-haiku-4-5-20250514",
          "max_tokens": 500,
          "messages": [
            {
              "role": "user",
              "content": "Write a compelling product description for: Smart Water Bottle that tracks hydration and syncs with fitness apps. Max 100 words."
            }
          ]
        }
      }
    ]
  }'
```

### Response

```json
{
  "id": "batch_01ABC123XYZ",
  "type": "message_batch",
  "processing_status": "in_progress",
  "request_counts": {
    "processing": 3,
    "succeeded": 0,
    "errored": 0,
    "canceled": 0,
    "expired": 0
  },
  "created_at": "2024-01-15T10:30:00Z",
  "ended_at": null,
  "expires_at": "2024-01-16T10:30:00Z",
  "results_url": null
}
```

---

## Step 2: Check Batch Status

Poll the status until processing completes.

### Request

```bash
curl https://api.anthropic.com/v1/messages/batches/batch_01ABC123XYZ \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

### Response (In Progress)

```json
{
  "id": "batch_01ABC123XYZ",
  "type": "message_batch",
  "processing_status": "in_progress",
  "request_counts": {
    "processing": 1,
    "succeeded": 2,
    "errored": 0,
    "canceled": 0,
    "expired": 0
  }
}
```

### Response (Completed)

```json
{
  "id": "batch_01ABC123XYZ",
  "type": "message_batch",
  "processing_status": "ended",
  "request_counts": {
    "processing": 0,
    "succeeded": 3,
    "errored": 0,
    "canceled": 0,
    "expired": 0
  },
  "created_at": "2024-01-15T10:30:00Z",
  "ended_at": "2024-01-15T10:35:00Z",
  "results_url": "https://api.anthropic.com/v1/messages/batches/batch_01ABC123XYZ/results"
}
```

---

## Step 3: Retrieve Results

### Request

```bash
curl https://api.anthropic.com/v1/messages/batches/batch_01ABC123XYZ/results \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

### Response (JSONL Format)

```json
{"custom_id":"product-001","result":{"type":"succeeded","message":{"id":"msg_01ABC","type":"message","role":"assistant","content":[{"type":"text","text":"Experience audio freedom with our premium Wireless Bluetooth Headphones. Featuring an incredible 40-hour battery life, you'll go days without needing a charge. Active noise cancellation blocks out the world, letting you focus on what matters most. Plush memory foam cushions provide all-day comfort while delivering crystal-clear, immersive sound. Perfect for work, travel, or relaxation. Your music. Your world. Uninterrupted."}],"usage":{"input_tokens":45,"output_tokens":89}}}}
{"custom_id":"product-002","result":{"type":"succeeded","message":{"id":"msg_02DEF","type":"message","role":"assistant","content":[{"type":"text","text":"Transform your workspace with our Ergonomic Office Chair. Engineered for all-day comfort, the adjustable lumbar support cradles your spine while breathable mesh keeps you cool during marathon work sessions. Smooth-gliding casters and 360-degree swivel give you effortless mobility. Height-adjustable armrests reduce shoulder strain. Whether you're coding, creating, or conquering deadlines, work in comfort that works for you."}],"usage":{"input_tokens":42,"output_tokens":95}}}}
{"custom_id":"product-003","result":{"type":"succeeded","message":{"id":"msg_03GHI","type":"message","role":"assistant","content":[{"type":"text","text":"Stay hydrated smarter with our Smart Water Bottle. Built-in sensors track your daily water intake and sync seamlessly with popular fitness apps. LED reminders gently nudge you to drink throughout the day. The vacuum-insulated design keeps drinks cold for 24 hours or hot for 12. Sleek, leak-proof, and BPA-free—it's hydration evolved. Reach your wellness goals one sip at a time."}],"usage":{"input_tokens":48,"output_tokens":87}}}}
```

---

## Processing JSONL Results

Parse the JSONL output:

```bash
# Download results
curl -s https://api.anthropic.com/v1/messages/batches/batch_01ABC123XYZ/results \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" > results.jsonl

# Process each result
while IFS= read -r line; do
  CUSTOM_ID=$(echo "$line" | jq -r '.custom_id')
  STATUS=$(echo "$line" | jq -r '.result.type')
  TEXT=$(echo "$line" | jq -r '.result.message.content[0].text')

  echo "=== $CUSTOM_ID ($STATUS) ==="
  echo "$TEXT"
  echo ""
done < results.jsonl
```

---

## List All Batches

### Request

```bash
curl https://api.anthropic.com/v1/messages/batches \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

### Response

```json
{
  "data": [
    {
      "id": "batch_01ABC123",
      "type": "message_batch",
      "processing_status": "ended",
      "request_counts": {"succeeded": 100, "errored": 0}
    },
    {
      "id": "batch_02DEF456",
      "type": "message_batch",
      "processing_status": "in_progress",
      "request_counts": {"processing": 50, "succeeded": 50}
    }
  ],
  "has_more": false
}
```

---

## Cancel a Batch

Stop processing before completion.

### Request

```bash
curl -X POST https://api.anthropic.com/v1/messages/batches/batch_01ABC123XYZ/cancel \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

---

## Complete Batch Processing Script

```bash
#!/bin/bash

# Batch Processing Script
# Creates a batch, monitors progress, and retrieves results

ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"

# Step 1: Create batch
echo "Creating batch..."
CREATE_RESPONSE=$(curl -s https://api.anthropic.com/v1/messages/batches \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "requests": [
      {"custom_id": "task-1", "params": {"model": "claude-haiku-4-5-20250514", "max_tokens": 100, "messages": [{"role": "user", "content": "Hello, world!"}]}},
      {"custom_id": "task-2", "params": {"model": "claude-haiku-4-5-20250514", "max_tokens": 100, "messages": [{"role": "user", "content": "What is 2+2?"}]}},
      {"custom_id": "task-3", "params": {"model": "claude-haiku-4-5-20250514", "max_tokens": 100, "messages": [{"role": "user", "content": "Name a color."}]}}
    ]
  }')

BATCH_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')
echo "Batch created: $BATCH_ID"

# Step 2: Poll for completion
echo "Waiting for batch to complete..."
while true; do
  STATUS_RESPONSE=$(curl -s "https://api.anthropic.com/v1/messages/batches/$BATCH_ID" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01")

  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.processing_status')
  SUCCEEDED=$(echo "$STATUS_RESPONSE" | jq -r '.request_counts.succeeded')
  PROCESSING=$(echo "$STATUS_RESPONSE" | jq -r '.request_counts.processing')

  echo "Status: $STATUS (succeeded: $SUCCEEDED, processing: $PROCESSING)"

  if [[ "$STATUS" == "ended" ]]; then
    break
  fi

  sleep 5
done

# Step 3: Retrieve results
echo ""
echo "Retrieving results..."
curl -s "https://api.anthropic.com/v1/messages/batches/$BATCH_ID/results" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" | while IFS= read -r line; do

  CUSTOM_ID=$(echo "$line" | jq -r '.custom_id')
  TEXT=$(echo "$line" | jq -r '.result.message.content[0].text')
  echo "[$CUSTOM_ID]: $TEXT"
done

echo ""
echo "Batch processing complete!"
```

---

## Error Handling

Results may include errors for individual requests.

```json
{
  "custom_id": "task-5",
  "result": {
    "type": "errored",
    "error": {
      "type": "invalid_request_error",
      "message": "max_tokens must be greater than 0"
    }
  }
}
```

Check the `result.type` field:
- `succeeded` - Request completed successfully
- `errored` - Request failed with an error
- `canceled` - Batch was canceled
- `expired` - Request expired (24-hour limit)

---

## Cost Comparison

| Scenario | Standard API | Batch API | Savings |
|----------|--------------|-----------|---------|
| 1000 requests | $10.00 | $5.00 | 50% |
| 10,000 requests | $100.00 | $50.00 | 50% |

---

## Best Practices

1. **Use for Non-Urgent Work**: Batch processing is asynchronous—not for real-time needs.

2. **Unique Custom IDs**: Use meaningful IDs to match results with original requests.

3. **Handle Partial Failures**: Check each result's type individually.

4. **Monitor Progress**: Poll status endpoint for large batches.

5. **Stay Within Limits**: Max 10,000 requests and 256MB per batch.

---

## Related Examples

- [Example 10: Data Extraction](example-10-data-extraction.md) - Batch document processing
- [Example 01: Structured Output](example-01-structured-output.md) - Consistent output formats
