import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── Method 1: System Prompt with JSON Schema ───
  printHeader("Method 1: System Prompt with JSON Schema");

  const msg1 = await client.messages.create({
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

  const textBlock1 = msg1.content.find((block) => block.type === "text");
  if (textBlock1 && textBlock1.type === "text") {
    // Strip markdown code fences if present
    const jsonStr = textBlock1.text.replace(/^```(?:json)?\n?/gm, "").replace(/```$/gm, "").trim();
    const data = JSON.parse(jsonStr);
    printJSON(data);
  }

  // ─── Method 2: Tool as Structured Output ───
  printHeader("Method 2: Tool as Structured Output");

  const msg2 = await client.messages.create({
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
              enum: ["very_positive", "positive", "neutral", "negative", "very_negative"],
            },
            confidence: { type: "number", description: "Confidence score between 0 and 1" },
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
            key_phrases: { type: "array", items: { type: "string" } },
            summary: { type: "string", description: "Brief summary of the sentiment analysis" },
          },
          required: ["overall_sentiment", "confidence", "emotions", "key_phrases", "summary"],
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

  const toolUse2 = msg2.content.find((block) => block.type === "tool_use");
  if (toolUse2 && toolUse2.type === "tool_use") {
    console.log("Structured data:");
    printJSON(toolUse2.input);
  }

  // ─── Method 3: Forced Tool Choice (Guaranteed Structure) ───
  printHeader("Method 3: Forced Tool Choice (Guaranteed Structure)");

  const msg3 = await client.messages.create({
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
          required: ["people", "organizations", "locations", "dates", "monetary_values"],
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

  const toolUse3 = msg3.content.find((block) => block.type === "tool_use");
  if (toolUse3 && toolUse3.type === "tool_use") {
    console.log("Entities:");
    printJSON(toolUse3.input);
  }

  // ─── Method 4: Zod Output Format (TypeScript SDK Exclusive) ───
  printHeader("Method 4: Zod Output Format (zodOutputFormat)");

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

  const msg4 = await client.messages.parse({
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

  if (msg4.parsed_output) {
    console.log("Title:", msg4.parsed_output.title);
    console.log("Company:", msg4.parsed_output.company);
    console.log("Remote:", msg4.parsed_output.location.remote);
    console.log("Salary range:", msg4.parsed_output.salary.min, "-", msg4.parsed_output.salary.max);
    console.log("Requirements:", msg4.parsed_output.requirements);
  }

  // ─── Method 5: Enum Constraints for Classification ───
  printHeader("Method 5: Enum Constraints for Classification");

  const msg5 = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
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
              enum: ["billing", "technical", "account", "feature_request", "bug_report", "general"],
            },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            sentiment: { type: "string", enum: ["positive", "neutral", "negative", "angry"] },
            requires_escalation: { type: "boolean" },
            suggested_department: {
              type: "string",
              enum: ["support", "engineering", "billing", "sales", "management"],
            },
          },
          required: ["category", "priority", "sentiment", "requires_escalation", "suggested_department"],
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

  const toolUse5 = msg5.content.find((block) => block.type === "tool_use");
  if (toolUse5 && toolUse5.type === "tool_use") {
    const classification = toolUse5.input as Record<string, unknown>;
    console.log("Category:", classification.category);
    console.log("Priority:", classification.priority);
    console.log("Sentiment:", classification.sentiment);
    console.log("Escalation needed:", classification.requires_escalation);
    console.log("Department:", classification.suggested_department);
  }

  console.log("\nAll 5 methods completed successfully!");
}

main().catch(console.error);
