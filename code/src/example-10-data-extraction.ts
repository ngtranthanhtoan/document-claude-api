import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── Method 1: Invoice Extraction with Tool Use ───
  printHeader("Method 1: Invoice Extraction (Tool-Based, Text Document)");

  // Since we don't have a real invoice image, use a text-based document
  const msg1 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    tool_choice: { type: "tool", name: "extract_invoice" },
    tools: [
      {
        name: "extract_invoice",
        description: "Extract structured data from an invoice",
        input_schema: {
          type: "object" as const,
          properties: {
            invoice_number: { type: "string" },
            invoice_date: { type: "string" },
            due_date: { type: "string" },
            vendor: {
              type: "object",
              properties: { name: { type: "string" }, address: { type: "string" } },
              required: ["name"],
            },
            customer: {
              type: "object",
              properties: { name: { type: "string" }, address: { type: "string" } },
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
          required: ["invoice_number", "invoice_date", "vendor", "line_items", "total"],
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Extract all data from this invoice:

INVOICE #INV-2025-0042
Date: January 15, 2025
Due: February 14, 2025

From: Acme Supplies Co.
      123 Commerce St, Portland, OR 97201

To: Widget Industries LLC
    456 Business Ave, Seattle, WA 98101

Items:
1. Widget A - Standard    x100  @$12.50  = $1,250.00
2. Widget B - Premium     x50   @$24.00  = $1,200.00
3. Shipping & Handling    x1    @$45.00  = $45.00

Subtotal: $2,495.00
Tax (8%): $199.60
TOTAL: $2,694.60

Payment Terms: Net 30`,
      },
    ],
  });

  const toolUse1 = msg1.content.find((block) => block.type === "tool_use");
  if (toolUse1 && toolUse1.type === "tool_use") {
    console.log("Invoice data:");
    printJSON(toolUse1.input);
  }

  // ─── Method 2: Zod-Based Extraction (Type-Safe) ───
  printHeader("Method 2: Zod-Based Extraction (zodOutputFormat)");

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

  const msg2 = await client.messages.parse({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    output_format: zodOutputFormat(InvoiceSchema, "invoice"),
    messages: [
      {
        role: "user",
        content: `Extract all data from this invoice:

INVOICE #INV-2025-0099
Date: February 1, 2025

From: TechParts International
      789 Industry Blvd, Austin, TX 78701

To: GlobalCorp Inc.
    321 Main St, New York, NY 10001

Items:
1. CPU Processor x5 @$350.00 = $1,750.00
2. RAM 32GB Kit x10 @$89.99 = $899.90
3. SSD 1TB x8 @$120.00 = $960.00
4. Express Shipping x1 @$75.00 = $75.00

Subtotal: $3,684.90
Tax (6.25%): $230.31
TOTAL: $3,915.21
Currency: USD
Payment Terms: Net 45`,
      },
    ],
  });

  if (msg2.parsed_output) {
    console.log("Invoice #:", msg2.parsed_output.invoice_number);
    console.log("Vendor:", msg2.parsed_output.vendor.name);
    console.log("Customer:", msg2.parsed_output.customer.name);
    console.log("Items:", msg2.parsed_output.line_items.length);
    console.log("Total:", `${msg2.parsed_output.currency} ${msg2.parsed_output.total}`);
    console.log("\nFull typed output:");
    printJSON(msg2.parsed_output);
  }

  // ─── Method 3: Business Card Extraction ───
  printHeader("Method 3: Business Card Extraction (Zod)");

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
  });

  const msg3 = await client.messages.parse({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    output_format: zodOutputFormat(ContactSchema, "contact"),
    messages: [
      {
        role: "user",
        content: `Extract contact info from this business card text:

Sarah Chen
VP of Engineering
TechVentures Inc.

sarah.chen@techventures.io
+1 (415) 555-0198 (office)
+1 (415) 555-0199 (mobile)
www.techventures.io
linkedin.com/in/sarahchen

500 Innovation Dr, Suite 300
San Francisco, CA 94105`,
      },
    ],
  });

  if (msg3.parsed_output) {
    console.log("Name:", msg3.parsed_output.full_name);
    console.log("Title:", msg3.parsed_output.job_title);
    console.log("Company:", msg3.parsed_output.company);
    console.log("Email:", msg3.parsed_output.email);
    console.log("Phone:", msg3.parsed_output.phone);
    console.log("Mobile:", msg3.parsed_output.mobile);
  }

  // ─── Method 4: Receipt Processing ───
  printHeader("Method 4: Receipt Data Extraction");

  const msg4 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
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
          },
          required: ["store_name", "items", "total"],
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Extract data from this receipt:

WHOLE FOODS MARKET
399 4th St, San Francisco, CA 94107

Date: 01/20/2025  Time: 2:32 PM

Organic Bananas          1   $1.99
Almond Milk 64oz         2   $7.98
Sourdough Bread          1   $5.49
Avocados (3 pack)        1   $4.99
Greek Yogurt 32oz        1   $6.49

Subtotal:   $26.94
Tax (9%):   $2.43
TOTAL:      $29.37

VISA ending in 4821`,
      },
    ],
  });

  const toolUse4 = msg4.content.find((block) => block.type === "tool_use");
  if (toolUse4 && toolUse4.type === "tool_use") {
    const receipt = toolUse4.input as Record<string, unknown>;
    console.log("Store:", receipt.store_name);
    console.log("Total:", receipt.total);
    console.log("Items:", (receipt.items as unknown[]).length);
    console.log("\nFull receipt data:");
    printJSON(toolUse4.input);
  }

  console.log("\nData extraction examples completed!");
}

main().catch(console.error);
