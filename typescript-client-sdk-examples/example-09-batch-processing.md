# Example 09: Batch Processing

> Process many requests at 50% cost savings with asynchronous batch operations.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Batch API
- **SDK Methods**: `client.messages.batches.create()`, `client.messages.batches.retrieve()`, `client.messages.batches.results()`, `client.messages.batches.list()`, `client.messages.batches.cancel()`
- **Use Cases**:
  - Bulk content generation
  - Large-scale data labeling
  - Mass translation
  - Document classification
  - Resume screening
  - Survey response analysis
  - SEO meta generation

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
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

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const batch = await client.messages.batches.create({
  requests: [
    {
      custom_id: "product-001",
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content:
              "Write a compelling product description for: Wireless Bluetooth Headphones with 40-hour battery life and active noise cancellation. Max 100 words.",
          },
        ],
      },
    },
    {
      custom_id: "product-002",
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content:
              "Write a compelling product description for: Ergonomic Office Chair with lumbar support and breathable mesh back. Max 100 words.",
          },
        ],
      },
    },
    {
      custom_id: "product-003",
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content:
              "Write a compelling product description for: Smart Water Bottle that tracks hydration and syncs with fitness apps. Max 100 words.",
          },
        ],
      },
    },
  ],
});

console.log("Batch ID:", batch.id);
console.log("Status:", batch.processing_status);
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

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const status = await client.messages.batches.retrieve(batch.id);
console.log("Status:", status.processing_status);
console.log("Succeeded:", status.request_counts.succeeded);
console.log("Processing:", status.request_counts.processing);
console.log("Errored:", status.request_counts.errored);
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

> **Key Difference from REST API**: The TypeScript SDK returns an **async iterable** instead of raw JSONL. You iterate over results directly with `for await...of` -- no manual JSONL parsing required.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const results = await client.messages.batches.results(batch.id);

for await (const entry of results) {
  if (entry.result.type === "succeeded") {
    const text = entry.result.message.content.find(
      (b) => b.type === "text"
    );
    console.log(
      `[${entry.custom_id}]:`,
      text?.type === "text" ? text.text : ""
    );
  } else if (entry.result.type === "errored") {
    console.error(`[${entry.custom_id}] Error:`, entry.result.error);
  } else if (entry.result.type === "canceled") {
    console.warn(`[${entry.custom_id}] Canceled`);
  } else if (entry.result.type === "expired") {
    console.warn(`[${entry.custom_id}] Expired`);
  }
}
```

### Output

```
[product-001]: Experience audio freedom with our premium Wireless Bluetooth Headphones. Featuring an incredible 40-hour battery life, you'll go days without needing a charge. Active noise cancellation blocks out the world, letting you focus on what matters most. Plush memory foam cushions provide all-day comfort while delivering crystal-clear, immersive sound. Perfect for work, travel, or relaxation. Your music. Your world. Uninterrupted.
[product-002]: Transform your workspace with our Ergonomic Office Chair. Engineered for all-day comfort, the adjustable lumbar support cradles your spine while breathable mesh keeps you cool during marathon work sessions. Smooth-gliding casters and 360-degree swivel give you effortless mobility. Height-adjustable armrests reduce shoulder strain. Whether you're coding, creating, or conquering deadlines, work in comfort that works for you.
[product-003]: Stay hydrated smarter with our Smart Water Bottle. Built-in sensors track your daily water intake and sync seamlessly with popular fitness apps. LED reminders gently nudge you to drink throughout the day. The vacuum-insulated design keeps drinks cold for 24 hours or hot for 12. Sleek, leak-proof, and BPA-free—it's hydration evolved. Reach your wellness goals one sip at a time.
```

---

## List All Batches

Retrieve all batches with automatic pagination via async iteration.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const batches = await client.messages.batches.list();

for await (const batch of batches) {
  console.log(
    batch.id,
    batch.processing_status,
    `succeeded: ${batch.request_counts.succeeded}`,
    `errored: ${batch.request_counts.errored}`
  );
}
```

### Output

```
batch_01ABC123 ended succeeded: 100 errored: 0
batch_02DEF456 in_progress succeeded: 50 errored: 0
```

---

## Cancel a Batch

Stop processing before completion. Already-completed requests within the batch are not affected.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const canceledBatch = await client.messages.batches.cancel(batch.id);
console.log("Status:", canceledBatch.processing_status);
```

---

## Complete Batch Processing Script

A full end-to-end script that creates a batch, polls for completion, and processes the results.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface ProductTask {
  id: string;
  name: string;
  description: string;
}

async function processBatch(tasks: ProductTask[]): Promise<void> {
  // Step 1: Build batch requests from tasks
  const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] =
    tasks.map((task) => ({
      custom_id: task.id,
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [
          {
            role: "user" as const,
            content: `Write a compelling product description for: ${task.name} - ${task.description}. Max 100 words.`,
          },
        ],
      },
    }));

  // Step 2: Create the batch
  console.log(`Creating batch with ${requests.length} requests...`);
  const batch = await client.messages.batches.create({ requests });
  console.log(`Batch created: ${batch.id}`);

  // Step 3: Poll until the batch has ended
  console.log("Waiting for batch to complete...");
  let status = await client.messages.batches.retrieve(batch.id);

  while (status.processing_status !== "ended") {
    const counts = status.request_counts;
    console.log(
      `Status: ${status.processing_status} ` +
        `(succeeded: ${counts.succeeded}, ` +
        `processing: ${counts.processing}, ` +
        `errored: ${counts.errored})`
    );

    // Wait 5 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 5000));
    status = await client.messages.batches.retrieve(batch.id);
  }

  console.log("Batch processing complete!");
  console.log(
    `Final counts - succeeded: ${status.request_counts.succeeded}, ` +
      `errored: ${status.request_counts.errored}`
  );

  // Step 4: Retrieve and process results
  console.log("\nResults:");
  console.log("=".repeat(60));

  const results = await client.messages.batches.results(batch.id);

  for await (const entry of results) {
    console.log(`\n--- ${entry.custom_id} ---`);

    if (entry.result.type === "succeeded") {
      const textBlock = entry.result.message.content.find(
        (b) => b.type === "text"
      );
      if (textBlock && textBlock.type === "text") {
        console.log(textBlock.text);
      }
      console.log(
        `Tokens: ${entry.result.message.usage.input_tokens} in / ` +
          `${entry.result.message.usage.output_tokens} out`
      );
    } else if (entry.result.type === "errored") {
      console.error("Error:", entry.result.error.message);
    } else if (entry.result.type === "canceled") {
      console.warn("Request was canceled.");
    } else if (entry.result.type === "expired") {
      console.warn("Request expired (24-hour limit).");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Batch processing complete!");
}

// Run the batch
const products: ProductTask[] = [
  {
    id: "product-001",
    name: "Wireless Bluetooth Headphones",
    description: "40-hour battery life and active noise cancellation",
  },
  {
    id: "product-002",
    name: "Ergonomic Office Chair",
    description: "Lumbar support and breathable mesh back",
  },
  {
    id: "product-003",
    name: "Smart Water Bottle",
    description: "Tracks hydration and syncs with fitness apps",
  },
];

processBatch(products).catch(console.error);
```

---

## Error Handling

Results may include errors for individual requests. Always check `entry.result.type` for each result.

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
- `canceled` - Batch was canceled before this request processed
- `expired` - Request expired (24-hour limit)

Handle batch-level errors with try/catch:

```typescript
try {
  const batch = await client.messages.batches.create({ requests });
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    console.error(`API Error ${error.status}:`, error.message);
  } else {
    throw error;
  }
}
```

---

## Cost Comparison

| Scenario | Standard API | Batch API | Savings |
|----------|--------------|-----------|---------|
| 1,000 requests | $10.00 | $5.00 | 50% |
| 10,000 requests | $100.00 | $50.00 | 50% |

---

## Best Practices

1. **Use for Non-Urgent Work**: Batch processing is asynchronous -- not for real-time needs. Results may take up to 24 hours.

2. **Unique Custom IDs**: Use meaningful IDs to match results with original requests (e.g., `product-001`, `user-42-email`).

3. **Handle Partial Failures**: Check each result's `type` individually. Some requests may succeed while others fail.

4. **Monitor Progress**: Poll the status endpoint for large batches and log progress counts.

5. **Stay Within Limits**: Max 10,000 requests and 256 MB per batch. Split larger workloads into multiple batches.

---

## Related Examples

- [Example 10: Data Extraction](example-10-data-extraction.md) - Batch document processing
- [Example 01: Structured Output](example-01-structured-output.md) - Consistent output formats
