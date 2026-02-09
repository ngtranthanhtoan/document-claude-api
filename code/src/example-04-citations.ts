import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── Method 1: Basic Citations with Text Document ───
  printHeader("Method 1: Basic Citations with Text Document");

  const msg1 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    citations: { enabled: true },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: "Company Policy Document\n\nSection 1: Remote Work Policy\nEmployees may work remotely up to 3 days per week with manager approval. All remote work must be logged in the HR system by end of day Monday.\n\nSection 2: Equipment\nThe company provides a laptop and monitor for home office use. Employees are responsible for maintaining a suitable work environment.\n\nSection 3: Communication\nRemote employees must be available on Slack during core hours (10am-3pm local time). Video should be enabled for all team meetings.",
            },
            title: "Employee Handbook 2024",
          },
          {
            type: "text",
            text: "How many days can I work from home?",
          },
        ],
      },
    ],
  });

  // Display response blocks
  for (const block of msg1.content) {
    if (block.type === "text") {
      process.stdout.write(block.text);
    } else if (block.type === "citation") {
      process.stdout.write(`\n  >> [Cited: "${block.cited_text}"]\n`);
    }
  }
  console.log("\n");

  // ─── Method 2: Multiple Documents ───
  printHeader("Method 2: Multiple Document Citations");

  const msg2 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    citations: { enabled: true },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: "Q3 2024 Financial Report\n\nRevenue: $45.2M (up 12% YoY)\nNet Income: $8.1M (up 18% YoY)\nOperating Margin: 22%\nCustomer Count: 15,000 (up 25% YoY)",
            },
            title: "Q3 Financial Report",
          },
          {
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: "Q2 2024 Financial Report\n\nRevenue: $42.1M (up 10% YoY)\nNet Income: $7.2M (up 15% YoY)\nOperating Margin: 20%\nCustomer Count: 13,500 (up 22% YoY)",
            },
            title: "Q2 Financial Report",
          },
          {
            type: "text",
            text: "How has the company's revenue changed from Q2 to Q3?",
          },
        ],
      },
    ],
  });

  for (const block of msg2.content) {
    if (block.type === "text") {
      process.stdout.write(block.text);
    } else if (block.type === "citation") {
      process.stdout.write(`[${block.document_title}: "${block.cited_text}"]`);
    }
  }
  console.log("\n");

  // ─── Method 3: Legal Document Analysis with Citations ───
  printHeader("Method 3: Legal Document Analysis");

  const msg3 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 8000,
    citations: { enabled: true },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: "SERVICE AGREEMENT\n\nArticle 5: Termination\n5.1 Either party may terminate this Agreement with 30 days written notice.\n5.2 Immediate termination is permitted upon material breach that remains uncured for 15 days after written notice.\n5.3 Upon termination, all confidential information must be returned within 10 business days.\n\nArticle 6: Liability\n6.1 Neither party shall be liable for indirect, incidental, or consequential damages.\n6.2 Total liability under this Agreement shall not exceed the fees paid in the 12 months preceding the claim.\n6.3 The limitations in this section shall not apply to breaches of confidentiality obligations.",
            },
            title: "Service Agreement v2.1",
          },
          {
            type: "text",
            text: "What are all the termination conditions and their requirements? Quote each one.",
          },
        ],
      },
    ],
  });

  for (const block of msg3.content) {
    if (block.type === "text") {
      process.stdout.write(block.text);
    } else if (block.type === "citation") {
      process.stdout.write(
        `\n  >> [Cited from "${block.document_title}"]: "${block.cited_text}"\n`
      );
    }
  }
  console.log("\n");

  // ─── Method 4: Extracting Citations Programmatically ───
  printHeader("Method 4: Extracting Citations Programmatically");

  const msg4 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    citations: { enabled: true },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: "SERVICE AGREEMENT\n\nArticle 5: Termination\n5.1 Either party may terminate this Agreement with 30 days written notice.\n5.2 Immediate termination is permitted upon material breach that remains uncured for 15 days after written notice.\n5.3 Upon termination, all confidential information must be returned within 10 business days.",
            },
            title: "Service Agreement v2.1",
          },
          {
            type: "text",
            text: "What are the termination conditions?",
          },
        ],
      },
    ],
  });

  const citations = msg4.content
    .filter((block) => block.type === "citation")
    .map((block) => {
      if (block.type === "citation") {
        return {
          quote: block.cited_text,
          source: block.document_title,
          position: { start: block.start_char, end: block.end_char },
        };
      }
    });

  console.log("Extracted citations:");
  printJSON(citations);

  console.log("\nCitations examples completed!");
}

main().catch(console.error);
