# Example 10: Data Extraction

> Extract structured data from documents and images using Vision and structured output.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Vision, Structured Output, Tool Use
- **SDK Methods**: `client.messages.create()`, `client.messages.parse()`, `zodOutputFormat()`
- **Use Cases**:
  - Invoice processing
  - Receipt digitization
  - Business card scanning
  - Form data extraction
  - Table extraction
  - Document digitization

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `zod`: `npm install zod` (for Zod-based extraction)
- `ANTHROPIC_API_KEY` environment variable set

---

## Invoice Data Extraction

Use a forced tool to guarantee structured invoice data from an image.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const invoiceImage = fs.readFileSync("invoice.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  tool_choice: { type: "tool", name: "extract_invoice" },
  tools: [
    {
      name: "extract_invoice",
      description: "Extract structured data from an invoice",
      input_schema: {
        type: "object" as const,
        properties: {
          invoice_number: {
            type: "string",
            description: "The invoice number or ID",
          },
          invoice_date: {
            type: "string",
            description: "The date the invoice was issued",
          },
          due_date: {
            type: "string",
            description: "The payment due date",
          },
          vendor: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: { type: "string" },
            },
            required: ["name"],
          },
          customer: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: { type: "string" },
            },
            required: ["name"],
          },
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" },
                total: { type: "number" },
              },
              required: ["description", "quantity", "unit_price", "total"],
            },
          },
          subtotal: { type: "number" },
          tax: { type: "number" },
          total: { type: "number" },
          currency: { type: "string" },
          payment_terms: { type: "string" },
        },
        required: [
          "invoice_number",
          "invoice_date",
          "vendor",
          "line_items",
          "total",
        ],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: invoiceImage,
          },
        },
        {
          type: "text",
          text: "Extract all data from this invoice.",
        },
      ],
    },
  ],
});

// Extract the tool use block
const toolUse = message.content.find((block) => block.type === "tool_use");
if (toolUse && toolUse.type === "tool_use") {
  console.log("Invoice data:", JSON.stringify(toolUse.input, null, 2));
}
```

### Response

```json
{
  "invoice_number": "INV-2025-0042",
  "invoice_date": "2025-01-15",
  "due_date": "2025-02-14",
  "vendor": {
    "name": "Acme Supplies Co.",
    "address": "123 Commerce St, Portland, OR 97201"
  },
  "customer": {
    "name": "Widget Industries LLC",
    "address": "456 Business Ave, Seattle, WA 98101"
  },
  "line_items": [
    { "description": "Widget A - Standard", "quantity": 100, "unit_price": 12.50, "total": 1250.00 },
    { "description": "Widget B - Premium", "quantity": 50, "unit_price": 24.00, "total": 1200.00 },
    { "description": "Shipping & Handling", "quantity": 1, "unit_price": 45.00, "total": 45.00 }
  ],
  "subtotal": 2495.00,
  "tax": 199.60,
  "total": 2694.60,
  "currency": "USD",
  "payment_terms": "Net 30"
}
```

---

## Invoice Extraction with Zod (TypeScript SDK Exclusive)

Use `client.messages.parse()` with `zodOutputFormat()` for compile-time type safety and automatic validation. This is the **recommended approach** for TypeScript developers.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import * as fs from "fs";

const client = new Anthropic();

const invoiceImage = fs.readFileSync("invoice.png").toString("base64");

// Define schema with Zod — gets full TypeScript type inference
const InvoiceSchema = z.object({
  invoice_number: z.string(),
  invoice_date: z.string(),
  due_date: z.string().nullable(),
  vendor: z.object({
    name: z.string(),
    address: z.string().nullable(),
  }),
  customer: z.object({
    name: z.string(),
    address: z.string().nullable(),
  }),
  line_items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      total: z.number(),
    })
  ),
  subtotal: z.number(),
  tax: z.number().nullable(),
  total: z.number(),
  currency: z.string(),
  payment_terms: z.string().nullable(),
});

const message = await client.messages.parse({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  output_config: { format: zodOutputFormat(InvoiceSchema) },
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: invoiceImage,
          },
        },
        {
          type: "text",
          text: "Extract all data from this invoice.",
        },
      ],
    },
  ],
});

// message.parsed_output is fully typed as z.infer<typeof InvoiceSchema>
if (message.parsed_output) {
  console.log("Invoice #:", message.parsed_output.invoice_number);
  console.log("Vendor:", message.parsed_output.vendor.name);
  console.log("Total:", message.parsed_output.total);
  console.log("Items:", message.parsed_output.line_items.length);
}
```

### Response

The `parsed_output` field is automatically validated against the Zod schema and fully typed:

```typescript
{
  invoice_number: "INV-2025-0042",
  invoice_date: "2025-01-15",
  due_date: "2025-02-14",
  vendor: { name: "Acme Supplies Co.", address: "123 Commerce St, Portland, OR 97201" },
  customer: { name: "Widget Industries LLC", address: "456 Business Ave, Seattle, WA 98101" },
  line_items: [
    { description: "Widget A - Standard", quantity: 100, unit_price: 12.50, total: 1250.00 },
    { description: "Widget B - Premium", quantity: 50, unit_price: 24.00, total: 1200.00 },
    { description: "Shipping & Handling", quantity: 1, unit_price: 45.00, total: 45.00 }
  ],
  subtotal: 2495.00,
  tax: 199.60,
  total: 2694.60,
  currency: "USD",
  payment_terms: "Net 30"
}
```

---

## Receipt Processing

Extract itemized data from receipt images using a forced tool.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const receiptImage = fs.readFileSync("receipt.jpg").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  tool_choice: { type: "tool", name: "extract_receipt" },
  tools: [
    {
      name: "extract_receipt",
      description: "Extract structured data from a receipt",
      input_schema: {
        type: "object" as const,
        properties: {
          store_name: { type: "string" },
          store_address: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "number" },
                price: { type: "number" },
              },
              required: ["name", "price"],
            },
          },
          subtotal: { type: "number" },
          tax: { type: "number" },
          total: { type: "number" },
          payment_method: { type: "string" },
          card_last_four: { type: "string" },
        },
        required: ["store_name", "items", "total"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: receiptImage,
          },
        },
        {
          type: "text",
          text: "Extract all data from this receipt.",
        },
      ],
    },
  ],
});

const toolUse = message.content.find((block) => block.type === "tool_use");
if (toolUse && toolUse.type === "tool_use") {
  const receipt = toolUse.input as Record<string, unknown>;
  console.log("Store:", receipt.store_name);
  console.log("Total:", receipt.total);
  console.log("Items:", (receipt.items as unknown[]).length);
}
```

### Response

```json
{
  "store_name": "Whole Foods Market",
  "store_address": "399 4th St, San Francisco, CA 94107",
  "date": "2025-01-20",
  "time": "14:32",
  "items": [
    { "name": "Organic Bananas", "quantity": 1, "price": 1.99 },
    { "name": "Almond Milk 64oz", "quantity": 2, "price": 7.98 },
    { "name": "Sourdough Bread", "quantity": 1, "price": 5.49 },
    { "name": "Avocados (3 pack)", "quantity": 1, "price": 4.99 },
    { "name": "Greek Yogurt 32oz", "quantity": 1, "price": 6.49 }
  ],
  "subtotal": 26.94,
  "tax": 2.43,
  "total": 29.37,
  "payment_method": "Credit Card",
  "card_last_four": "4821"
}
```

---

## Business Card Extraction

Extract contact information from business card images.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import * as fs from "fs";

const client = new Anthropic();

const cardImage = fs.readFileSync("business-card.jpg").toString("base64");

const ContactSchema = z.object({
  full_name: z.string(),
  job_title: z.string().nullable(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  linkedin: z.string().nullable(),
  twitter: z.string().nullable(),
});

const message = await client.messages.parse({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  output_config: { format: zodOutputFormat(ContactSchema) },
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: cardImage,
          },
        },
        {
          type: "text",
          text: "Extract all contact information from this business card.",
        },
      ],
    },
  ],
});

if (message.parsed_output) {
  console.log("Name:", message.parsed_output.full_name);
  console.log("Title:", message.parsed_output.job_title);
  console.log("Company:", message.parsed_output.company);
  console.log("Email:", message.parsed_output.email);
  console.log("Phone:", message.parsed_output.phone);
}
```

### Response

```typescript
{
  full_name: "Sarah Chen",
  job_title: "VP of Engineering",
  company: "TechVentures Inc.",
  email: "sarah.chen@techventures.io",
  phone: "+1 (415) 555-0198",
  mobile: "+1 (415) 555-0199",
  website: "www.techventures.io",
  address: "500 Innovation Dr, Suite 300, San Francisco, CA 94105",
  linkedin: "linkedin.com/in/sarahchen",
  twitter: null
}
```

---

## Table Extraction

Extract tabular data from images and convert to structured formats.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const tableImage = fs.readFileSync("spreadsheet.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: tableImage,
          },
        },
        {
          type: "text",
          text: `Extract the table from this image and return it in two formats:

1. As a JSON array of objects (one object per row, using column headers as keys)
2. As CSV format

Return your response as JSON with "json_data" and "csv_data" fields.`,
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  const result = JSON.parse(textBlock.text);

  // Use JSON data programmatically
  console.log("Rows:", result.json_data.length);
  console.log("First row:", result.json_data[0]);

  // Write CSV to file
  fs.writeFileSync("extracted-table.csv", result.csv_data);
  console.log("CSV saved to extracted-table.csv");
}
```

### Response

```json
{
  "json_data": [
    { "Product": "Widget A", "Q1": 15000, "Q2": 18500, "Q3": 22000, "Q4": 25000 },
    { "Product": "Widget B", "Q1": 8000, "Q2": 9200, "Q3": 11000, "Q4": 13500 },
    { "Product": "Widget C", "Q1": 3500, "Q2": 4100, "Q3": 5800, "Q4": 7200 }
  ],
  "csv_data": "Product,Q1,Q2,Q3,Q4\nWidget A,15000,18500,22000,25000\nWidget B,8000,9200,11000,13500\nWidget C,3500,4100,5800,7200"
}
```

---

## Batch Document Extraction

Process multiple documents in a single batch using `client.messages.batches.create()`.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

// Prepare batch requests for multiple invoices
const invoiceFiles = ["invoice-001.png", "invoice-002.png", "invoice-003.png"];

const batchRequests: Anthropic.Messages.BatchCreateParams.Request[] =
  invoiceFiles.map((file, index) => {
    const imageBase64 = fs.readFileSync(file).toString("base64");
    return {
      custom_id: `invoice-${index + 1}`,
      params: {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        tool_choice: {
          type: "tool" as const,
          name: "extract_invoice",
        },
        tools: [
          {
            name: "extract_invoice",
            description: "Extract structured data from an invoice",
            input_schema: {
              type: "object" as const,
              properties: {
                invoice_number: { type: "string" },
                vendor_name: { type: "string" },
                total: { type: "number" },
                currency: { type: "string" },
                line_items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      quantity: { type: "number" },
                      unit_price: { type: "number" },
                      total: { type: "number" },
                    },
                    required: ["description", "total"],
                  },
                },
              },
              required: ["invoice_number", "vendor_name", "total"],
            },
          },
        ],
        messages: [
          {
            role: "user" as const,
            content: [
              {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: "image/png" as const,
                  data: imageBase64,
                },
              },
              {
                type: "text" as const,
                text: "Extract all data from this invoice.",
              },
            ],
          },
        ],
      },
    };
  });

// Create the batch
const batch = await client.messages.batches.create({
  requests: batchRequests,
});

console.log("Batch ID:", batch.id);
console.log("Status:", batch.processing_status);

// Poll for completion
let status = batch.processing_status;
while (status !== "ended") {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const updated = await client.messages.batches.retrieve(batch.id);
  status = updated.processing_status;
  console.log(
    `Status: ${status} | Succeeded: ${updated.request_counts.succeeded} | Processing: ${updated.request_counts.processing}`
  );
}

// Retrieve results
console.log("\n=== Batch Results ===");
for await (const result of client.messages.batches.results(batch.id)) {
  console.log(`\n--- ${result.custom_id} ---`);
  if (result.result.type === "succeeded") {
    const toolUse = result.result.message.content.find(
      (block) => block.type === "tool_use"
    );
    if (toolUse && toolUse.type === "tool_use") {
      console.log(JSON.stringify(toolUse.input, null, 2));
    }
  } else {
    console.log("Failed:", result.result.type);
  }
}
```

---

## PDF Form Extraction

Extract structured data from PDF forms using the document content block.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import * as fs from "fs";

const client = new Anthropic();

const pdfBase64 = fs.readFileSync("application-form.pdf").toString("base64");

const FormSchema = z.object({
  form_title: z.string(),
  submission_date: z.string().nullable(),
  applicant: z.object({
    first_name: z.string(),
    last_name: z.string(),
    date_of_birth: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.object({
      street: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      zip: z.string().nullable(),
    }),
  }),
  fields: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    })
  ),
  checkboxes: z.array(
    z.object({
      label: z.string(),
      checked: z.boolean(),
    })
  ),
  signatures: z.array(
    z.object({
      signer: z.string(),
      signed: z.boolean(),
      date: z.string().nullable(),
    })
  ),
});

const message = await client.messages.parse({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  output_config: { format: zodOutputFormat(FormSchema) },
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
          text: "Extract all form fields, checkboxes, and signature information from this PDF form.",
        },
      ],
    },
  ],
});

if (message.parsed_output) {
  console.log("Form:", message.parsed_output.form_title);
  console.log(
    "Applicant:",
    message.parsed_output.applicant.first_name,
    message.parsed_output.applicant.last_name
  );
  console.log("Fields:", message.parsed_output.fields.length);
  console.log("Checkboxes:", message.parsed_output.checkboxes.length);
  console.log("Signatures:", message.parsed_output.signatures.length);
}
```

### Response

```typescript
{
  form_title: "Employment Application",
  submission_date: "2025-01-18",
  applicant: {
    first_name: "James",
    last_name: "Rodriguez",
    date_of_birth: "1992-03-15",
    email: "j.rodriguez@email.com",
    phone: "+1 (503) 555-0147",
    address: {
      street: "789 Oak Lane",
      city: "Portland",
      state: "OR",
      zip: "97205"
    }
  },
  fields: [
    { label: "Position Applied For", value: "Senior Software Engineer" },
    { label: "Desired Salary", value: "$160,000" },
    { label: "Start Date", value: "2025-03-01" },
    { label: "Years of Experience", value: "8" }
  ],
  checkboxes: [
    { label: "US Citizen or Authorized to Work", checked: true },
    { label: "Willing to Relocate", checked: false },
    { label: "Agree to Background Check", checked: true }
  ],
  signatures: [
    { signer: "James Rodriguez", signed: true, date: "2025-01-18" }
  ]
}
```

---

## Complete Extraction Script

A full TypeScript script that accepts any image or PDF file and extracts structured data with automatic media type detection.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic();

// Map file extensions to MIME types
type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function getMediaType(filePath: string): ImageMediaType | "application/pdf" {
  const ext = path.extname(filePath).toLowerCase();
  const mediaTypes: Record<string, ImageMediaType | "application/pdf"> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };

  const mediaType = mediaTypes[ext];
  if (!mediaType) {
    throw new Error(
      `Unsupported format: ${ext}. Supported: .jpg, .jpeg, .png, .gif, .webp, .pdf`
    );
  }
  return mediaType;
}

// Generic extraction schema
const ExtractionSchema = z.object({
  document_type: z.string().describe("Type of document: invoice, receipt, business card, form, table, other"),
  title: z.string().nullable(),
  date: z.string().nullable(),
  entities: z.array(
    z.object({
      type: z.string().describe("Entity type: person, organization, address, phone, email, amount, date, etc."),
      value: z.string(),
      context: z.string().nullable().describe("Where this entity appears or its role"),
    })
  ),
  line_items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().nullable(),
        unit_price: z.number().nullable(),
        total: z.number().nullable(),
      })
    )
    .nullable(),
  totals: z
    .object({
      subtotal: z.number().nullable(),
      tax: z.number().nullable(),
      total: z.number().nullable(),
      currency: z.string().nullable(),
    })
    .nullable(),
  raw_text: z.string().describe("Full text content extracted from the document"),
});

async function extractData(
  filePath: string,
  customPrompt?: string
): Promise<z.infer<typeof ExtractionSchema>> {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  const maxSize = 32 * 1024 * 1024; // 32 MB
  if (stats.size > maxSize) {
    throw new Error(
      `File exceeds 32MB limit: ${(stats.size / (1024 * 1024)).toFixed(1)}MB`
    );
  }

  const mediaType = getMediaType(resolvedPath);
  const fileBase64 = fs.readFileSync(resolvedPath).toString("base64");
  const isPdf = mediaType === "application/pdf";

  console.log(`Processing: ${path.basename(resolvedPath)}`);
  console.log(`Media type: ${mediaType}`);
  console.log(`File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log("");

  // Build the content block based on file type
  const contentBlock = isPdf
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: fileBase64,
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType as ImageMediaType,
          data: fileBase64,
        },
      };

  const prompt =
    customPrompt ||
    "Extract all structured data from this document. Identify the document type, extract all entities, line items, totals, and full text content.";

  const message = await client.messages.parse({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    output_config: { format: zodOutputFormat(ExtractionSchema) },
    messages: [
      {
        role: "user",
        content: [contentBlock, { type: "text", text: prompt }],
      },
    ],
  });

  if (!message.parsed_output) {
    throw new Error("No parsed output received from the API.");
  }

  return message.parsed_output;
}

// --- Main execution ---

const filePath = process.argv[2];
const customPrompt = process.argv[3];

if (!filePath) {
  console.error(
    "Usage: npx ts-node extract.ts <file-path> [custom-prompt]"
  );
  console.error("Supported formats: .jpg, .jpeg, .png, .gif, .webp, .pdf");
  process.exit(1);
}

try {
  const result = await extractData(filePath, customPrompt);

  console.log("=== Extraction Result ===");
  console.log(`Document Type: ${result.document_type}`);
  console.log(`Title: ${result.title || "(none)"}`);
  console.log(`Date: ${result.date || "(none)"}`);
  console.log(`Entities found: ${result.entities.length}`);

  if (result.line_items && result.line_items.length > 0) {
    console.log(`Line items: ${result.line_items.length}`);
  }

  if (result.totals?.total) {
    console.log(
      `Total: ${result.totals.currency || ""}${result.totals.total}`
    );
  }

  console.log("\n=== Full Result (JSON) ===");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    console.error(`API Error ${error.status}: ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}
```

---

## Best Practices

1. **Use Forced Tool Choice for Guaranteed Structure**: When you need 100% reliable structured output from extraction, use `tool_choice: { type: "tool", name: "..." }` to guarantee Claude returns data in the exact schema you define.

2. **Use Zod for Type Safety**: Prefer `messages.parse()` with `zodOutputFormat()` for compile-time type checking, runtime validation, and auto-typed results.

3. **Pre-process Images for Quality**: Resize oversized images, increase contrast on faded receipts, and straighten skewed documents before sending. Better input quality leads to more accurate extraction.

4. **Handle Missing Fields Gracefully**: Use `nullable()` in Zod schemas or nullable types in JSON schemas for fields that may not be present on every document. Not all invoices have a due date; not all business cards have a LinkedIn profile.

5. **Validate Extracted Data**: Always validate critical fields (totals, dates, IDs) after extraction. Cross-check line item totals against the reported total, and verify date formats are consistent.

---

## Related Examples

- [Example 07: Vision Analysis](example-07-vision-analysis.md) - Image analysis fundamentals
- [Example 01: Structured Output](example-01-structured-output.md) - Structured output techniques
- [Example 09: Batch Processing](example-09-batch-processing.md) - Process documents at scale
