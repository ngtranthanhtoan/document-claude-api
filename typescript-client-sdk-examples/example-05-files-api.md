# Example 05: Files API

> Upload files once and reference them across multiple requests, with automatic caching.

## Overview

- **Difficulty**: Beginner
- **Features Used**: Files API
- **Beta**: `files-api-2025-04-14`
- **SDK Methods**: `client.beta.files.upload()`, `client.beta.files.list()`, `client.beta.files.retrieve()`, `client.beta.files.delete()`, `client.beta.messages.create()`
- **Use Cases**:
  - Reusable document analysis
  - Multi-turn conversations about files
  - Reduced bandwidth for repeated file access
  - File caching for cost optimization

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- Files to upload

---

## Files API Workflow

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Upload File   │ ───> │   Get File ID   │ ───> │ Use in Messages │
│   POST /files   │      │   file_xxx      │      │  Reference by ID│
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## Step 1: Upload a File

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { toFile } from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const file = await client.beta.files.upload(
  {
    file: await toFile(
      fs.createReadStream("document.pdf"),
      "document.pdf",
      { type: "application/pdf" }
    ),
  },
  { betas: ["files-api-2025-04-14"] }
);

console.log("File ID:", file.id);
console.log("Filename:", file.filename);
console.log("MIME Type:", file.mime_type);
console.log("Size:", file.size_bytes, "bytes");
console.log("Expires:", file.expires_at);
```

### Response

```json
{
  "id": "file_01ABC123DEF456",
  "type": "file",
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 1048576,
  "created_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-01-22T10:30:00Z"
}
```

---

## Step 2: Use File in Messages

Reference the uploaded file by its ID.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.beta.messages.create(
  {
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "file",
              file_id: file.id,
            },
          },
          {
            type: "text",
            text: "Summarize this document.",
          },
        ],
      },
    ],
  },
  { betas: ["files-api-2025-04-14"] }
);

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

### Response

```json
{
  "id": "msg_01XYZ789",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "This document covers..."
    }
  ],
  "stop_reason": "end_turn"
}
```

---

## Step 3: Multiple Questions (Same File)

Reuse the same file ID for follow-up questions without re-uploading.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Ask a different question about the same file — no re-upload needed
const followUp = await client.beta.messages.create(
  {
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "file",
              file_id: file.id,
            },
          },
          {
            type: "text",
            text: "What are the key risks mentioned in section 3?",
          },
        ],
      },
    ],
  },
  { betas: ["files-api-2025-04-14"] }
);

const textBlock = followUp.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

---

## Get File Metadata

Retrieve information about an uploaded file.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const metadata = await client.beta.files.retrieve(
  file.id,
  { betas: ["files-api-2025-04-14"] }
);

console.log("File ID:", metadata.id);
console.log("Filename:", metadata.filename);
console.log("MIME Type:", metadata.mime_type);
console.log("Size:", metadata.size_bytes, "bytes");
console.log("Created:", metadata.created_at);
console.log("Expires:", metadata.expires_at);
```

### Response

```json
{
  "id": "file_01ABC123DEF456",
  "type": "file",
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 1048576,
  "created_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-01-22T10:30:00Z"
}
```

---

## List All Files

Get a list of all uploaded files.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const files = await client.beta.files.list(
  { betas: ["files-api-2025-04-14"] }
);

for (const f of files.data) {
  console.log(`${f.id} - ${f.filename} (${f.size_bytes} bytes, expires: ${f.expires_at})`);
}
```

### Response

```json
{
  "data": [
    {
      "id": "file_01ABC123DEF456",
      "type": "file",
      "filename": "document.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 1048576,
      "created_at": "2024-01-15T10:30:00Z",
      "expires_at": "2024-01-22T10:30:00Z"
    },
    {
      "id": "file_02XYZ789ABC123",
      "type": "file",
      "filename": "report.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 2097152,
      "created_at": "2024-01-14T08:00:00Z",
      "expires_at": "2024-01-21T08:00:00Z"
    }
  ],
  "has_more": false
}
```

---

## Delete a File

Remove an uploaded file.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const result = await client.beta.files.delete(
  file.id,
  { betas: ["files-api-2025-04-14"] }
);

console.log("Deleted:", result.id, "—", result.deleted);
```

### Response

```json
{
  "id": "file_01ABC123DEF456",
  "type": "file",
  "deleted": true
}
```

---

## Upload Multiple Files

Upload and use multiple files in conversations.

### Upload Files

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { toFile } from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

// Upload first file
const file1 = await client.beta.files.upload(
  {
    file: await toFile(
      fs.createReadStream("contract_v1.pdf"),
      "contract_v1.pdf",
      { type: "application/pdf" }
    ),
  },
  { betas: ["files-api-2025-04-14"] }
);

// Upload second file
const file2 = await client.beta.files.upload(
  {
    file: await toFile(
      fs.createReadStream("contract_v2.pdf"),
      "contract_v2.pdf",
      { type: "application/pdf" }
    ),
  },
  { betas: ["files-api-2025-04-14"] }
);

console.log("File 1:", file1.id);
console.log("File 2:", file2.id);
```

### Compare Files

```typescript
const comparison = await client.beta.messages.create(
  {
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "file", file_id: file1.id },
          },
          {
            type: "document",
            source: { type: "file", file_id: file2.id },
          },
          {
            type: "text",
            text: "Compare these two contract versions and list all changes.",
          },
        ],
      },
    ],
  },
  { betas: ["files-api-2025-04-14"] }
);

const textBlock = comparison.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

---

## Supported File Types

| Format | MIME Type | Extension |
|--------|-----------|-----------|
| PDF | `application/pdf` | .pdf |
| Plain Text | `text/plain` | .txt |
| Markdown | `text/markdown` | .md |
| HTML | `text/html` | .html |
| CSV | `text/csv` | .csv |
| JSON | `application/json` | .json |
| Images | `image/jpeg`, `image/png`, etc. | .jpg, .png |

---

## File Caching Benefits

Files API provides automatic caching, reducing costs when reusing files.

| Scenario | Without Files API | With Files API |
|----------|------------------|----------------|
| 10 questions, same PDF | Upload 10x, full input cost | Upload 1x, cached reads |
| Multi-user access | Each user uploads | Share file ID |
| Large documents | Bandwidth each request | Upload once |

---

## Complete Workflow Script

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { toFile } from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

async function filesApiWorkflow(filePath: string) {
  // Step 1: Upload file
  console.log("Uploading file...");
  const file = await client.beta.files.upload(
    {
      file: await toFile(
        fs.createReadStream(filePath),
        filePath.split("/").pop() || "document",
        { type: "application/pdf" }
      ),
    },
    { betas: ["files-api-2025-04-14"] }
  );

  console.log("Uploaded:", file.filename);
  console.log("File ID:", file.id);
  console.log("Expires:", file.expires_at);
  console.log("");

  // Step 2: Ask questions using a helper function
  async function askQuestion(question: string): Promise<void> {
    console.log("Q:", question);

    const response = await client.beta.messages.create(
      {
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "file", file_id: file.id },
              },
              {
                type: "text",
                text: question,
              },
            ],
          },
        ],
      },
      { betas: ["files-api-2025-04-14"] }
    );

    const textBlock = response.content.find((block) => block.type === "text");
    if (textBlock && textBlock.type === "text") {
      console.log("A:", textBlock.text);
    }
    console.log("");
  }

  await askQuestion("What is this document about?");
  await askQuestion("What are the main conclusions?");
  await askQuestion("Summarize in 3 bullet points.");

  // Step 3: Cleanup (optional)
  console.log("Cleaning up...");
  await client.beta.files.delete(file.id, {
    betas: ["files-api-2025-04-14"],
  });

  console.log("Done!");
}

// Run the workflow
filesApiWorkflow(process.argv[2] || "document.pdf");
```

---

## Best Practices

1. **Reuse File IDs**: Upload once, reference many times to save bandwidth and costs.

2. **Track Expiration**: Files expire after 7 days - plan for re-upload if needed.

3. **Delete Unused Files**: Clean up files you no longer need.

4. **Use Meaningful Filenames**: Original filenames are preserved for reference.

5. **Combine with Citations**: Use Files API with Citations for verifiable document analysis.

---

## Related Examples

- [Example 03: PDF Processing](example-03-pdf-processing.md) - PDF analysis techniques
- [Example 04: Citations](example-04-citations.md) - Add source attribution
- [Example 08: RAG Knowledge Base](example-08-rag-knowledge-base.md) - Document Q&A systems
