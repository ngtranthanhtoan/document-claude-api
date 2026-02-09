import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

interface ProductTask {
  id: string;
  name: string;
  description: string;
}

async function main() {
  // ─── Step 1: Create a Batch ───
  printHeader("Step 1: Create a Batch");

  const products: ProductTask[] = [
    {
      id: "product-001",
      name: "Wireless Bluetooth Headphones",
      description: "40-hour battery life and active noise cancellation",
    },
    {
      id: "product-002",
      name: "Ergonomic Office Chair",
      description: "Lumbar support and breathable mesh back",
    },
    {
      id: "product-003",
      name: "Smart Water Bottle",
      description: "Tracks hydration and syncs with fitness apps",
    },
  ];

  const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] =
    products.map((task) => ({
      custom_id: task.id,
      params: {
        model: "claude-haiku-4-5-20251001" as const,
        max_tokens: 500,
        messages: [
          {
            role: "user" as const,
            content: `Write a compelling product description for: ${task.name} - ${task.description}. Max 100 words.`,
          },
        ],
      },
    }));

  console.log(`Creating batch with ${requests.length} requests...`);
  const batch = await client.messages.batches.create({ requests });
  console.log("Batch ID:", batch.id);
  console.log("Status:", batch.processing_status);
  console.log("Request counts:", JSON.stringify(batch.request_counts));

  // ─── Step 2: Poll for Completion ───
  printHeader("Step 2: Poll for Completion");

  let status = await client.messages.batches.retrieve(batch.id);

  while (status.processing_status !== "ended") {
    const counts = status.request_counts;
    console.log(
      `Status: ${status.processing_status} ` +
        `(succeeded: ${counts.succeeded}, ` +
        `processing: ${counts.processing}, ` +
        `errored: ${counts.errored})`
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    status = await client.messages.batches.retrieve(batch.id);
  }

  console.log("Batch processing complete!");
  console.log(
    `Final — succeeded: ${status.request_counts.succeeded}, ` +
      `errored: ${status.request_counts.errored}`
  );

  // ─── Step 3: Retrieve Results ───
  printHeader("Step 3: Retrieve Results");

  const results = await client.messages.batches.results(batch.id);

  for await (const entry of results) {
    console.log(`\n--- ${entry.custom_id} ---`);

    if (entry.result.type === "succeeded") {
      const textBlock = entry.result.message.content.find(
        (b) => b.type === "text"
      );
      if (textBlock && textBlock.type === "text") {
        console.log(textBlock.text);
      }
      console.log(
        `Tokens: ${entry.result.message.usage.input_tokens} in / ` +
          `${entry.result.message.usage.output_tokens} out`
      );
    } else if (entry.result.type === "errored") {
      console.error("Error:", entry.result.error.message);
    } else if (entry.result.type === "canceled") {
      console.warn("Request was canceled.");
    } else if (entry.result.type === "expired") {
      console.warn("Request expired (24-hour limit).");
    }
  }

  // ─── Step 4: List All Batches ───
  printHeader("Step 4: List Recent Batches");

  let count = 0;
  const batches = await client.messages.batches.list();
  for await (const b of batches) {
    console.log(
      b.id,
      b.processing_status,
      `succeeded: ${b.request_counts.succeeded}`,
      `errored: ${b.request_counts.errored}`
    );
    count++;
    if (count >= 5) break; // Only show the 5 most recent
  }

  console.log("\nBatch processing example completed!");
}

main().catch(console.error);
