# Example 01: Structured Output

> Guarantee Claude returns data in a specific, parseable format using JSON schemas, tool definitions, Zod validation, and forced tool choice.

## Overview

- **Difficulty**: Beginner
- **Features Used**: System prompts, Tool definitions, `tool_choice`, Zod helpers
- **SDK Methods**: `client.messages.create()`, `client.messages.parse()`, `zodOutputFormat()`
- **Use Cases**:
  - API response formatting
  - Database record creation
  - Form data extraction
  - Data transformation pipelines
  - Classification tasks

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `zod`: `npm install zod` (for Methods 4 and 5)
- `ANTHROPIC_API_KEY` environment variable set
- Basic understanding of JSON schemas

---

## Method 1: System Prompt with JSON Schema

The simplest approach - instruct Claude to respond in a specific JSON format.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system:
    "You are a data extraction assistant. Always respond with valid JSON matching the requested schema. Never include markdown formatting, explanations, or any text outside the JSON object.",
  messages: [
    {
      role: "user",
      content: `Extract information from this job posting and return JSON matching this schema:

{
  "title": "string",
  "company": "string",
  "location": {"city": "string", "state": "string", "remote": boolean},
  "salary": {"min": number|null, "max": number|null, "currency": "string"},
  "requirements": ["string"],
  "experience_years": number|null
}

Job Posting:
Senior Software Engineer at TechCorp
San Francisco, CA (Hybrid - 2 days remote)
Salary: $150,000 - $200,000

Requirements:
- 5+ years of experience in Python or Go
- Experience with distributed systems
- Strong communication skills`,
    },
  ],
});

// Extract and parse the JSON text
const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  const data = JSON.parse(textBlock.text);
  console.log(data);
}
```

### Response

```json
{
  "title": "Senior Software Engineer",
  "company": "TechCorp",
  "location": { "city": "San Francisco", "state": "CA", "remote": true },
  "salary": { "min": 150000, "max": 200000, "currency": "USD" },
  "requirements": [
    "5+ years of experience in Python or Go",
    "Experience with distributed systems",
    "Strong communication skills"
  ],
  "experience_years": 5
}
```

---

## Method 2: Tool as Structured Output

Use a tool definition to enforce strict JSON schema. Claude returns data as tool input.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system:
    "You are a sentiment analysis system. Analyze the provided text and use the record_sentiment tool to output your analysis.",
  tools: [
    {
      name: "record_sentiment",
      description: "Record the sentiment analysis results",
      input_schema: {
        type: "object" as const,
        properties: {
          overall_sentiment: {
            type: "string",
            enum: [
              "very_positive",
              "positive",
              "neutral",
              "negative",
              "very_negative",
            ],
          },
          confidence: {
            type: "number",
            description: "Confidence score between 0 and 1",
          },
          emotions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                emotion: { type: "string" },
                intensity: { type: "number" },
              },
              required: ["emotion", "intensity"],
            },
          },
          key_phrases: {
            type: "array",
            items: { type: "string" },
          },
          summary: {
            type: "string",
            description: "Brief summary of the sentiment analysis",
          },
        },
        required: [
          "overall_sentiment",
          "confidence",
          "emotions",
          "key_phrases",
          "summary",
        ],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        'Analyze this review: "I absolutely love this product! It exceeded all my expectations. The quality is outstanding and customer service was incredibly helpful. Only minor issue is shipping took a bit longer than expected, but totally worth the wait!"',
    },
  ],
});

// Extract the tool use block
const toolUse = message.content.find((block) => block.type === "tool_use");
if (toolUse && toolUse.type === "tool_use") {
  console.log("Structured data:", JSON.stringify(toolUse.input, null, 2));
}
```

### Response

```json
{
  "overall_sentiment": "very_positive",
  "confidence": 0.92,
  "emotions": [
    { "emotion": "joy", "intensity": 0.9 },
    { "emotion": "satisfaction", "intensity": 0.85 },
    { "emotion": "trust", "intensity": 0.8 },
    { "emotion": "mild_frustration", "intensity": 0.2 }
  ],
  "key_phrases": [
    "absolutely love",
    "exceeded all my expectations",
    "quality is outstanding",
    "incredibly helpful",
    "worth the wait"
  ],
  "summary": "Highly positive review expressing strong satisfaction with product quality and customer service. Minor complaint about shipping time but overall enthusiastic recommendation."
}
```

---

## Method 3: Forced Tool Choice (Guaranteed Structure)

Use `tool_choice` to guarantee Claude always uses the specified tool.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  tool_choice: { type: "tool", name: "extract_entities" },
  tools: [
    {
      name: "extract_entities",
      description: "Extract named entities from text",
      input_schema: {
        type: "object" as const,
        properties: {
          people: { type: "array", items: { type: "string" } },
          organizations: { type: "array", items: { type: "string" } },
          locations: { type: "array", items: { type: "string" } },
          dates: { type: "array", items: { type: "string" } },
          monetary_values: {
            type: "array",
            items: {
              type: "object",
              properties: {
                amount: { type: "number" },
                currency: { type: "string" },
              },
            },
          },
        },
        required: [
          "people",
          "organizations",
          "locations",
          "dates",
          "monetary_values",
        ],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Apple CEO Tim Cook announced the new iPhone 15 at their Cupertino headquarters on September 12, 2023. The device starts at $799.",
    },
  ],
});

// Extract structured entities
const toolUse = message.content.find((block) => block.type === "tool_use");
if (toolUse && toolUse.type === "tool_use") {
  console.log("Entities:", JSON.stringify(toolUse.input, null, 2));
}
```

### Response

```json
{
  "people": ["Tim Cook"],
  "organizations": ["Apple"],
  "locations": ["Cupertino"],
  "dates": ["September 12, 2023"],
  "monetary_values": [{ "amount": 799, "currency": "USD" }]
}
```

---

## Method 4: Zod Output Format (TypeScript SDK Exclusive)

Use `client.messages.parse()` with `zodOutputFormat()` for compile-time type safety and automatic validation. This is the **recommended approach** for TypeScript developers.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();

// Define schema with Zod — gets full TypeScript type inference
const JobPostingSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.object({
    city: z.string(),
    state: z.string(),
    remote: z.boolean(),
  }),
  salary: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.string(),
  }),
  requirements: z.array(z.string()),
  experience_years: z.number().nullable(),
});

const message = await client.messages.parse({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  output_config: { format: zodOutputFormat(JobPostingSchema) },
  messages: [
    {
      role: "user",
      content: `Extract information from this job posting:

Senior Software Engineer at TechCorp
San Francisco, CA (Hybrid - 2 days remote)
Salary: $150,000 - $200,000

Requirements:
- 5+ years of experience in Python or Go
- Experience with distributed systems
- Strong communication skills`,
    },
  ],
});

// message.parsed_output is fully typed as z.infer<typeof JobPostingSchema>
if (message.parsed_output) {
  console.log("Title:", message.parsed_output.title);
  console.log("Company:", message.parsed_output.company);
  console.log("Remote:", message.parsed_output.location.remote);
  console.log("Salary range:", message.parsed_output.salary.min, "-", message.parsed_output.salary.max);
  console.log("Requirements:", message.parsed_output.requirements);
}
```

### Response

The `parsed_output` field is automatically validated against the Zod schema and fully typed:

```typescript
{
  title: "Senior Software Engineer",
  company: "TechCorp",
  location: { city: "San Francisco", state: "CA", remote: true },
  salary: { min: 150000, max: 200000, currency: "USD" },
  requirements: [
    "5+ years of experience in Python or Go",
    "Experience with distributed systems",
    "Strong communication skills"
  ],
  experience_years: 5
}
```

---

## Method 5: Enum Constraints for Classification

Use enums to restrict Claude's output to specific categories. Combines `tool_choice` with enum types.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 500,
  tool_choice: { type: "tool", name: "classify_ticket" },
  tools: [
    {
      name: "classify_ticket",
      description: "Classify a support ticket",
      input_schema: {
        type: "object" as const,
        properties: {
          category: {
            type: "string",
            enum: [
              "billing",
              "technical",
              "account",
              "feature_request",
              "bug_report",
              "general",
            ],
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
          },
          sentiment: {
            type: "string",
            enum: ["positive", "neutral", "negative", "angry"],
          },
          requires_escalation: { type: "boolean" },
          suggested_department: {
            type: "string",
            enum: ["support", "engineering", "billing", "sales", "management"],
          },
        },
        required: [
          "category",
          "priority",
          "sentiment",
          "requires_escalation",
          "suggested_department",
        ],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "URGENT: My payment failed 3 times and now my account is locked! I have a presentation tomorrow and need access NOW. This is completely unacceptable!",
    },
  ],
});

const toolUse = message.content.find((block) => block.type === "tool_use");
if (toolUse && toolUse.type === "tool_use") {
  const classification = toolUse.input as Record<string, unknown>;
  console.log("Category:", classification.category);
  console.log("Priority:", classification.priority);
  console.log("Sentiment:", classification.sentiment);
  console.log("Escalation needed:", classification.requires_escalation);
}
```

### Response

```json
{
  "category": "billing",
  "priority": "urgent",
  "sentiment": "angry",
  "requires_escalation": true,
  "suggested_department": "billing"
}
```

---

## Extracting the Structured Data

After receiving the response, extract the structured data from different response types:

```typescript
import Anthropic from "@anthropic-ai/sdk";

// From tool_use response
function extractToolInput(message: Anthropic.Message): unknown | null {
  const toolUse = message.content.find((block) => block.type === "tool_use");
  return toolUse && toolUse.type === "tool_use" ? toolUse.input : null;
}

// From text response (JSON string)
function extractJsonText(message: Anthropic.Message): unknown | null {
  const textBlock = message.content.find((block) => block.type === "text");
  if (textBlock && textBlock.type === "text") {
    return JSON.parse(textBlock.text);
  }
  return null;
}
```

---

## Best Practices

1. **Use Zod for Type Safety**: When working in TypeScript, prefer `messages.parse()` with `zodOutputFormat()` for compile-time type checking and runtime validation.

2. **Use Tool Choice for Guaranteed Structure**: When you need 100% reliable JSON output, use `tool_choice` with a specific tool name.

3. **Define Required Fields**: Always specify `required` fields in your schema to ensure essential data is included.

4. **Use Enums for Classification**: When outputs must be from a fixed set of values, use enum constraints.

5. **Provide Clear Descriptions**: Add `description` fields to properties to guide Claude's understanding.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Learn tool fundamentals
- [Example 10: Data Extraction](example-10-data-extraction.md) - Extract data from documents
- [Example 04: Citations](example-04-citations.md) - Structured output with source attribution
