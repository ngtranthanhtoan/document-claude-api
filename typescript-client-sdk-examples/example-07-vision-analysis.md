# Example 07: Vision Analysis

> Analyze images using Claude's vision capabilities for understanding, OCR, and interpretation.

## Overview

- **Difficulty**: Intermediate
- **Features Used**: Vision, Image input
- **SDK Methods**: `client.messages.create()`
- **Use Cases**:
  - Image description and captioning
  - OCR (text extraction)
  - Chart and graph interpretation
  - UI/UX analysis
  - Product image cataloging
  - Document digitization
  - Accessibility alt-text generation

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
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

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

// Read and encode image
const imageBase64 = fs.readFileSync("photo.jpg").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: imageBase64,
          },
        },
        {
          type: "text",
          text: "Describe what you see in this image in detail.",
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
      "text": "The image shows a modern office workspace with a large wooden desk positioned near floor-to-ceiling windows. On the desk, there's a silver laptop, a ceramic coffee mug, and a small potted succulent plant. The natural lighting from the windows creates a warm, inviting atmosphere..."
    }
  ],
  "stop_reason": "end_turn"
}
```

---

## URL-Based Image

Load images directly from URLs without downloading or encoding them first.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "url",
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg",
          },
        },
        {
          type: "text",
          text: "What animal is in this image? Describe its characteristics.",
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

## OCR: Text Extraction

Extract text from images of documents, signs, or screenshots.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const documentImage = fs.readFileSync("document.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: documentImage,
          },
        },
        {
          type: "text",
          text: "Extract all text from this image. Maintain the original formatting and structure as much as possible.",
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
  "type": "text",
  "text": "MEETING AGENDA\n\nDate: January 15, 2025\nTime: 10:00 AM - 11:30 AM\nLocation: Conference Room B\n\n1. Opening Remarks\n2. Q4 Revenue Review\n3. Product Roadmap Update\n4. Hiring Plan Discussion\n5. Action Items & Next Steps"
}
```

---

## Invoice/Receipt OCR with Structured Output

Extract and structure data from invoices.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const invoiceImage = fs.readFileSync("invoice.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
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
          text: `Extract all information from this invoice and return as JSON:
{
  "invoice_number": "",
  "date": "",
  "vendor": {"name": "", "address": ""},
  "line_items": [{"description": "", "quantity": 0, "unit_price": 0, "total": 0}],
  "subtotal": 0,
  "tax": 0,
  "total": 0,
  "payment_terms": ""
}`,
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  const invoiceData = JSON.parse(textBlock.text);
  console.log("Invoice Number:", invoiceData.invoice_number);
  console.log("Total:", invoiceData.total);
  console.log("Line Items:", invoiceData.line_items.length);
}
```

### Response

```json
{
  "invoice_number": "INV-2025-0042",
  "date": "2025-01-15",
  "vendor": {
    "name": "Acme Supplies Co.",
    "address": "123 Commerce St, Portland, OR 97201"
  },
  "line_items": [
    { "description": "Widget A", "quantity": 100, "unit_price": 12.50, "total": 1250.00 },
    { "description": "Widget B", "quantity": 50, "unit_price": 24.00, "total": 1200.00 },
    { "description": "Shipping", "quantity": 1, "unit_price": 45.00, "total": 45.00 }
  ],
  "subtotal": 2495.00,
  "tax": 199.60,
  "total": 2694.60,
  "payment_terms": "Net 30"
}
```

---

## Chart and Graph Interpretation

Analyze data visualizations.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const chartImage = fs.readFileSync("quarterly-chart.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: chartImage,
          },
        },
        {
          type: "text",
          text: `Analyze this chart and provide:
1. Type of chart
2. What data it represents
3. Key trends or patterns
4. Notable data points
5. Business insights you can derive`,
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
  "type": "text",
  "text": "1. **Type of chart**: Grouped bar chart with a trend line overlay\n\n2. **Data represented**: Quarterly revenue (bars) and profit margin percentage (line) for fiscal year 2024, broken down by product category.\n\n3. **Key trends**: Revenue shows consistent growth across all categories from Q1 to Q4, with the strongest acceleration in Q3-Q4. Profit margins improved from 18% to 24% over the year.\n\n4. **Notable data points**: Q4 Electronics category reached $4.2M (highest single category). Q2 showed a slight dip in Software margins.\n\n5. **Business insights**: The company is scaling effectively — growing revenue while expanding margins suggests operational efficiency improvements. Electronics is the growth driver and may warrant increased investment."
}
```

---

## Multiple Image Comparison

Analyze and compare multiple images in a single request.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const image1Base64 = fs.readFileSync("product-v1.png").toString("base64");
const image2Base64 = fs.readFileSync("product-v2.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Compare these two product images and identify all differences:",
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: image1Base64,
          },
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: image2Base64,
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

### Response

```json
{
  "type": "text",
  "text": "Here are the differences between the two product images:\n\n1. **Color**: The first image shows the product in matte black, while the second is in brushed silver.\n2. **Button layout**: V2 has consolidated the three separate buttons into a single touch-sensitive strip.\n3. **Display**: The screen in V2 appears slightly larger with thinner bezels.\n4. **Port placement**: USB-C port moved from the bottom to the right side in V2.\n5. **Logo**: The brand logo is embossed in V1 but laser-etched in V2.\n6. **Dimensions**: V2 appears approximately 15% thinner based on the side profile."
}
```

---

## UI/UX Screenshot Analysis

Analyze user interface designs for usability and design quality.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const uiScreenshot = fs.readFileSync("app-screenshot.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: uiScreenshot,
          },
        },
        {
          type: "text",
          text: `Analyze this UI screenshot and provide:
1. Overall layout assessment
2. Visual hierarchy analysis
3. Usability concerns
4. Accessibility issues
5. Suggestions for improvement`,
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
  "type": "text",
  "text": "1. **Overall Layout**: Clean grid-based layout with a left sidebar navigation and main content area. Good use of whitespace, though the sidebar feels slightly cramped on smaller viewports.\n\n2. **Visual Hierarchy**: The page title is prominent and properly sized. Call-to-action buttons use a distinct accent color. However, secondary actions have the same visual weight as primary ones, which may confuse users.\n\n3. **Usability Concerns**: The search bar is positioned in the sidebar rather than the header, which is unconventional. Dropdown menus lack visual indicators (carets). Table rows lack hover states for interactivity feedback.\n\n4. **Accessibility Issues**: Low contrast ratio on the gray placeholder text (~2.8:1, below WCAG AA minimum of 4.5:1). Icon-only buttons in the toolbar lack visible labels or tooltips. No visible focus indicators for keyboard navigation.\n\n5. **Suggestions**: Move search to the header area. Add hover/focus states to all interactive elements. Increase text contrast. Add aria-labels to icon buttons. Differentiate primary vs secondary button styles."
}
```

---

## Error/Bug Screenshot Debugging

Analyze error messages and bugs from screenshots.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const errorScreenshot = fs.readFileSync("error-screenshot.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: errorScreenshot,
          },
        },
        {
          type: "text",
          text: "I am getting this error. What does it mean and how do I fix it?",
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
  "type": "text",
  "text": "This is a **TypeError: Cannot read properties of undefined (reading 'map')** from your React application.\n\n**What it means**: You're calling `.map()` on a variable that is `undefined`. This typically happens when:\n- An API response hasn't loaded yet\n- The data structure doesn't match what you expect\n- A prop wasn't passed to the component\n\n**How to fix it**:\n1. Add optional chaining: `data?.items?.map(...)` \n2. Provide a default value: `(data.items || []).map(...)`\n3. Add a loading check: `if (!data) return <Loading />`\n4. Verify your API response shape matches your type definitions"
}
```

---

## Accessibility Alt-Text Generation

Generate descriptive alt-text for images suitable for screen readers.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

const imageBase64 = fs.readFileSync("hero-image.jpg").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 500,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: imageBase64,
          },
        },
        {
          type: "text",
          text: "Generate concise, descriptive alt-text for this image suitable for screen readers. Keep it under 125 characters.",
        },
      ],
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log("Alt text:", textBlock.text);
}
```

### Response

```json
{
  "type": "text",
  "text": "Modern open-plan office with employees collaborating at standing desks, natural light from large windows, indoor plants"
}
```

---

## Complete Image Analysis Script

A reusable TypeScript script that accepts any image file and a question, with automatic media type detection.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic();

// Map file extensions to MIME types
function getMediaType(
  filePath: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const ext = path.extname(filePath).toLowerCase();
  const mediaTypes: Record<
    string,
    "image/jpeg" | "image/png" | "image/gif" | "image/webp"
  > = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };

  const mediaType = mediaTypes[ext];
  if (!mediaType) {
    throw new Error(
      `Unsupported image format: ${ext}. Supported: .jpg, .jpeg, .png, .gif, .webp`
    );
  }
  return mediaType;
}

async function analyzeImage(
  imagePath: string,
  question: string = "Describe this image in detail."
): Promise<string> {
  // Validate file exists
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  // Read and encode the image
  const imageBase64 = fs.readFileSync(imagePath).toString("base64");
  const mediaType = getMediaType(imagePath);

  console.log(`Analyzing: ${imagePath}`);
  console.log(`Media type: ${mediaType}`);
  console.log(`Question: ${question}`);
  console.log("");

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
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

  // Extract text response
  const textBlock = message.content.find((block) => block.type === "text");
  const result =
    textBlock && textBlock.type === "text"
      ? textBlock.text
      : "No text response received.";

  console.log("=== Analysis ===");
  console.log(result);
  console.log("");
  console.log("=== Token Usage ===");
  console.log(`Input tokens: ${message.usage.input_tokens}`);
  console.log(`Output tokens: ${message.usage.output_tokens}`);

  return result;
}

// Run from command line: npx ts-node analyze.ts photo.jpg "What is in this image?"
const [imagePath, question] = process.argv.slice(2);

if (!imagePath) {
  console.error("Usage: npx ts-node analyze.ts <image-path> [question]");
  process.exit(1);
}

analyzeImage(imagePath, question).catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
```

---

## Best Practices

1. **Optimize Image Size**: Resize large images to reduce token usage. Claude processes images at a maximum of 1568px on the longest side -- anything larger is scaled down automatically, so pre-sizing saves upload bandwidth.

2. **Be Specific**: Ask targeted questions rather than open-ended ones. Instead of "describe this image," try "list all products visible on the shelf with their price tags."

3. **Use Appropriate Model**: Sonnet is best for most vision tasks; use Opus for complex analysis requiring nuanced reasoning.

4. **Batch When Possible**: Send multiple related images in one request rather than making separate API calls. This is more efficient and allows Claude to compare and cross-reference.

5. **Combine with Tools**: Use vision with tool use for structured data extraction. Define a tool schema to guarantee the output format when extracting data from images.

---

## Related Examples

- [Example 10: Data Extraction](example-10-data-extraction.md) - Structured extraction from images
- [Example 03: PDF Processing](example-03-pdf-processing.md) - Document analysis
- [Example 17: Computer Use](example-17-computer-use.md) - Screenshot-based automation
