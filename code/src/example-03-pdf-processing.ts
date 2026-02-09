import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { printHeader } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── Method 1: PDF from URL ───
  printHeader("Method 1: PDF from URL");

  const msg1 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "url",
              url: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
            },
          },
          {
            type: "text",
            text: "Describe what you see in this document/image.",
          },
        ],
      },
    ],
  });

  const textBlock1 = msg1.content.find((block) => block.type === "text");
  if (textBlock1 && textBlock1.type === "text") {
    console.log(textBlock1.text);
  }
  console.log("\nTokens — input:", msg1.usage.input_tokens, "output:", msg1.usage.output_tokens);

  // ─── Method 2: Base64 PDF (inline generated) ───
  printHeader("Method 2: Inline Text as Document");

  // Since we may not have a local PDF, demonstrate with a text document
  const msg2 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: `QUARTERLY FINANCIAL REPORT - Q3 2024

Executive Summary
Revenue grew 15% year-over-year to $45.2M, driven by strong enterprise adoption.

Revenue Breakdown
- Enterprise: $28.1M (62%)
- Mid-Market: $12.3M (27%)
- SMB: $4.8M (11%)

Key Metrics
- Net Revenue Retention: 125%
- Customer Count: 1,250 (+18% YoY)
- Average Contract Value: $36,160

Outlook
Q4 guidance: $48-50M revenue with continued margin expansion.`,
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

  const textBlock2 = msg2.content.find((block) => block.type === "text");
  if (textBlock2 && textBlock2.type === "text") {
    console.log(textBlock2.text);
  }
  console.log("\nTokens — input:", msg2.usage.input_tokens, "output:", msg2.usage.output_tokens);

  // ─── Method 3: Contract Analysis (Structured Extraction) ───
  printHeader("Method 3: Contract Analysis (Structured Extraction)");

  const msg3 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    system: "You are a data extraction assistant. Always respond with valid JSON. No markdown formatting.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: `SERVICE AGREEMENT

Between: Acme Corporation ("Provider") and Widget Industries LLC ("Client")
Effective Date: January 1, 2024
Termination Date: December 31, 2026

Payment Terms: Net 30 days from invoice date

Obligations:
- Provider shall deliver monthly performance reports
- Client shall provide timely access to necessary systems
- Both parties shall maintain strict confidentiality

Termination:
- 30 days written notice for termination for convenience
- Immediate termination for material breach

Liability: Total aggregate liability capped at $1,000,000
Governing Law: State of Delaware`,
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

  const textBlock3 = msg3.content.find((block) => block.type === "text");
  if (textBlock3 && textBlock3.type === "text") {
    const contractData = JSON.parse(textBlock3.text);
    console.log("Parties:", contractData.parties);
    console.log("Effective Date:", contractData.effective_date);
    console.log("Payment Terms:", contractData.payment_terms);
    console.log("Governing Law:", contractData.governing_law);
    console.log("\nFull extracted data:");
    console.log(JSON.stringify(contractData, null, 2));
  }

  // ─── Method 4: Local PDF Processing (if file provided) ───
  printHeader("Method 4: Local PDF Processing Utility");

  const pdfPath = process.argv[2];
  if (pdfPath) {
    const resolvedPath = path.resolve(pdfPath);
    if (!fs.existsSync(resolvedPath)) {
      console.log(`File not found: ${resolvedPath}`);
    } else {
      const stats = fs.statSync(resolvedPath);
      const MAX_SIZE = 32 * 1024 * 1024;
      if (stats.size > MAX_SIZE) {
        console.log(`File exceeds 32MB limit: ${(stats.size / (1024 * 1024)).toFixed(1)}MB`);
      } else {
        console.log(`Processing: ${path.basename(resolvedPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
        const pdfBase64 = fs.readFileSync(resolvedPath).toString("base64");

        const pdfMsg = await client.messages.create({
          model: "claude-sonnet-4-5-20250514",
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
                  text: process.argv[3] || "Summarize this document.",
                },
              ],
            },
          ],
        });

        const textBlock = pdfMsg.content.find((b) => b.type === "text");
        if (textBlock && textBlock.type === "text") {
          console.log(textBlock.text);
        }
        console.log("\nTokens — input:", pdfMsg.usage.input_tokens, "output:", pdfMsg.usage.output_tokens);
      }
    }
  } else {
    console.log("No PDF file provided. Pass a PDF path as argument to test local PDF processing:");
    console.log("  npx tsx src/example-03-pdf-processing.ts path/to/file.pdf [question]");
  }

  console.log("\nPDF processing examples completed!");
}

main().catch(console.error);
