# Example 05: Files API

> Upload files once and reference them across multiple requests, with automatic caching.

## Overview

- **Difficulty**: Beginner
- **Features Used**: Files API
- **Beta Header Required**: `anthropic-beta: files-api-2025-04-14`
- **Use Cases**:
  - Reusable document analysis
  - Multi-turn conversations about files
  - Reduced bandwidth for repeated file access
  - File caching for cost optimization

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
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

```bash
curl https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  -F "file=@document.pdf"
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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
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
              "type": "file",
              "file_id": "file_01ABC123DEF456"
            }
          },
          {
            "type": "text",
            "text": "Summarize this document."
          }
        ]
      }
    ]
  }'
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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
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
              "type": "file",
              "file_id": "file_01ABC123DEF456"
            }
          },
          {
            "type": "text",
            "text": "What are the key risks mentioned in section 3?"
          }
        ]
      }
    ]
  }'
```

---

## Get File Metadata

Retrieve information about an uploaded file.

### Request

```bash
curl https://api.anthropic.com/v1/files/file_01ABC123DEF456 \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14"
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

```bash
curl https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14"
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

```bash
curl -X DELETE https://api.anthropic.com/v1/files/file_01ABC123DEF456 \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14"
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

```bash
# Upload first file
FILE1_ID=$(curl -s https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  -F "file=@contract_v1.pdf" | jq -r '.id')

# Upload second file
FILE2_ID=$(curl -s https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  -F "file=@contract_v2.pdf" | jq -r '.id')

echo "File 1: $FILE1_ID"
echo "File 2: $FILE2_ID"
```

### Compare Files

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
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
            "source": {"type": "file", "file_id": "'"$FILE1_ID"'"}
          },
          {
            "type": "document",
            "source": {"type": "file", "file_id": "'"$FILE2_ID"'"}
          },
          {
            "type": "text",
            "text": "Compare these two contract versions and list all changes."
          }
        ]
      }
    ]
  }'
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

```bash
#!/bin/bash

# Files API Workflow Example

# Step 1: Upload file
echo "Uploading file..."
UPLOAD_RESPONSE=$(curl -s https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" \
  -F "file=@$1")

FILE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id')
FILENAME=$(echo "$UPLOAD_RESPONSE" | jq -r '.filename')
EXPIRES=$(echo "$UPLOAD_RESPONSE" | jq -r '.expires_at')

echo "Uploaded: $FILENAME"
echo "File ID: $FILE_ID"
echo "Expires: $EXPIRES"
echo ""

# Step 2: Ask questions
ask_question() {
  local question="$1"
  echo "Q: $question"

  RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
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
          {"type": "document", "source": {"type": "file", "file_id": "'"$FILE_ID"'"}},
          {"type": "text", "text": "'"$question"'"}
        ]
      }]
    }')

  echo "A: $(echo "$RESPONSE" | jq -r '.content[0].text')"
  echo ""
}

ask_question "What is this document about?"
ask_question "What are the main conclusions?"
ask_question "Summarize in 3 bullet points."

# Step 3: Cleanup (optional)
echo "Cleaning up..."
curl -s -X DELETE "https://api.anthropic.com/v1/files/$FILE_ID" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: files-api-2025-04-14" > /dev/null

echo "Done!"
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
