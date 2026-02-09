# Example 03: PDF Processing

> Analyze PDF documents natively with Claude, extracting text and understanding visual layouts.

## Overview

- **Difficulty**: Beginner
- **Features Used**: PDF Support, Vision
- **SDK Methods**: `client.messages.create()`
- **Use Cases**:
  - Document summarization
  - Contract analysis
  - Invoice processing
  - Report extraction
  - Research paper analysis
  - Form data extraction

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
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

Read a local PDF file, encode it to base64, and send it to Claude for analysis.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const pdfBase64 = fs.readFileSync("document.pdf").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          type: "text",
          text: "Summarize this document in 3-5 bullet points.",
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
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

Load a PDF directly from a URL without downloading it first.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "url",
            url: "https://example.com/report.pdf",
          },
        },
        {
          type: "text",
          text: "What are the main conclusions of this report?",
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

---

## Contract Analysis

Extract key terms from legal documents and return them as structured JSON.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const contractPdf = fs.readFileSync("contract.pdf").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: contractPdf,
          },
        },
        {
          type: "text",
          text: `Extract the following from this contract and return as JSON:

{
  "parties": [],
  "effective_date": "",
  "termination_date": "",
  "payment_terms": "",
  "key_obligations": [],
  "termination_clauses": [],
  "liability_caps": "",
  "governing_law": ""
}`,
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  const contractData = JSON.parse(textBlock.text);
  console.log("Parties:", contractData.parties);
  console.log("Effective Date:", contractData.effective_date);
  console.log("Payment Terms:", contractData.payment_terms);
}
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

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const invoicePdf = fs.readFileSync("invoice.pdf").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: invoicePdf,
          },
        },
        {
          type: "text",
          text: `Extract invoice data as JSON:
{
  "invoice_number": "",
  "date": "",
  "due_date": "",
  "vendor": {"name": "", "address": ""},
  "customer": {"name": "", "address": ""},
  "line_items": [{"description": "", "quantity": 0, "unit_price": 0, "total": 0}],
  "subtotal": 0,
  "tax": 0,
  "total": 0
}`,
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  const invoiceData = JSON.parse(textBlock.text);
  console.log(`Invoice #${invoiceData.invoice_number}`);
  console.log(`Total: $${invoiceData.total}`);
  console.log(`Line items: ${invoiceData.line_items.length}`);
}
```

---

## Multi-Page Document Analysis

For documents with multiple pages, Claude processes all pages together.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const multiPagePdf = fs.readFileSync("research-paper.pdf").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 8000,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: multiPagePdf,
          },
        },
        {
          type: "text",
          text: `This is a 50-page research paper. Please provide:
1. A one-paragraph executive summary
2. Key findings from each major section
3. The methodology used
4. Main conclusions and recommendations`,
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

---

## PDF with Tables

Claude can understand and extract tabular data from PDFs and convert it to CSV format.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const pdfWithTables = fs.readFileSync("financial-report.pdf").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfWithTables,
          },
        },
        {
          type: "text",
          text: "Extract all tables from this document and convert them to CSV format. Label each table with its page number and a descriptive title.",
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);

  // Optionally write CSV output to a file
  fs.writeFileSync("extracted-tables.csv", textBlock.text);
}
```

---

## Comparing Multiple PDFs

Analyze multiple documents in a single request by including multiple document content blocks.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const contractV1 = fs.readFileSync("contract-v1.pdf").toString("base64");
const contractV2 = fs.readFileSync("contract-v2.pdf").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Compare these two contracts and identify the key differences:",
        },
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: contractV1,
          },
        },
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: contractV2,
          },
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

---

## Complete PDF Processing Script

A full TypeScript script with file validation, size checking, and error handling.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic();

const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32 MB

interface PdfProcessingResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function processPdf(
  pdfPath: string,
  question: string
): Promise<PdfProcessingResult> {
  // Resolve to absolute path
  const resolvedPath = path.resolve(pdfPath);

  // Check file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`PDF file not found: ${resolvedPath}`);
  }

  // Check file extension
  if (path.extname(resolvedPath).toLowerCase() !== ".pdf") {
    throw new Error(`File is not a PDF: ${resolvedPath}`);
  }

  // Check file size (32MB limit)
  const stats = fs.statSync(resolvedPath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(
      `File exceeds 32MB limit: ${(stats.size / (1024 * 1024)).toFixed(1)}MB`
    );
  }

  console.log(`Processing: ${path.basename(resolvedPath)}`);
  console.log(`File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Question: ${question}\n`);

  // Read and encode PDF to base64
  const pdfBase64 = fs.readFileSync(resolvedPath).toString("base64");

  // Create message request
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: question,
          },
        ],
      },
    ],
  });

  // Extract text from response
  const textBlock = message.content.find((block) => block.type === "text");
  const text =
    textBlock && textBlock.type === "text" ? textBlock.text : "(no text response)";

  return {
    text,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

// --- Main execution ---

const pdfPath = process.argv[2];
const question = process.argv[3] || "Summarize this document.";

if (!pdfPath) {
  console.error("Usage: npx ts-node process_pdf.ts <pdf-file> [question]");
  process.exit(1);
}

try {
  const result = await processPdf(pdfPath, question);

  console.log("=== Response ===");
  console.log(result.text);
  console.log("\n=== Usage ===");
  console.log(`Input tokens:  ${result.inputTokens}`);
  console.log(`Output tokens: ${result.outputTokens}`);
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    console.error(`API Error ${error.status}: ${error.message}`);
    if (error.status === 413) {
      console.error("Payload too large - try a smaller PDF or fewer pages.");
    }
  } else if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}
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
