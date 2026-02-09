import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "get_crypto_price",
    description: "Get current cryptocurrency price",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Crypto symbol like BTC, ETH" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "search_news",
    description: "Search for recent news articles",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        max_results: { type: "integer" },
      },
      required: ["query"],
    },
  },
  {
    name: "calculate",
    description: "Perform a mathematical calculation",
    input_schema: {
      type: "object" as const,
      properties: {
        expression: { type: "string", description: "Math expression to evaluate" },
      },
      required: ["expression"],
    },
  },
  {
    name: "save_report",
    description: "Save a final report to storage",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        format: { type: "string", enum: ["markdown", "json", "text"] },
      },
      required: ["title", "content"],
    },
  },
];

// Mock tool implementations
function executeTool(name: string, input: Record<string, unknown>): string {
  console.log(`  >>> Executing: ${name}(${JSON.stringify(input).slice(0, 100)})`);

  switch (name) {
    case "get_crypto_price": {
      const prices: Record<string, number> = {
        BTC: 67234.50, ETH: 3456.78, SOL: 98.45, ADA: 0.62, DOT: 7.89,
      };
      const symbol = (input.symbol as string).toUpperCase();
      return JSON.stringify({
        symbol,
        price: prices[symbol] || 1.0,
        change_24h: "+2.3%",
        market_cap: symbol === "BTC" ? "$1.32T" : "$415B",
        volume_24h: "$28.5B",
      });
    }
    case "search_news":
      return JSON.stringify({
        results: [
          {
            title: `${input.query}: Major developments this week`,
            source: "CryptoNews",
            date: "2025-02-08",
            snippet: "Market analysts are watching closely as institutional adoption continues to grow...",
          },
          {
            title: `${input.query}: Regulatory update`,
            source: "FinanceToday",
            date: "2025-02-07",
            snippet: "New framework proposed by SEC could significantly impact trading patterns...",
          },
        ],
      });
    case "calculate":
      try {
        // Simple eval for demo purposes
        const expr = (input.expression as string).replace(/[^0-9+\-*/().% ]/g, "");
        const result = Function(`"use strict"; return (${expr})`)();
        return JSON.stringify({ expression: input.expression, result });
      } catch {
        return JSON.stringify({ error: "Invalid expression" });
      }
    case "save_report":
      console.log(`  [Saved report: "${input.title}"]`);
      return JSON.stringify({ status: "saved", id: "RPT-001", title: input.title });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function main() {
  // ─── Method 1: Manual Agentic Loop ───
  printHeader("Method 1: Manual Agentic Loop");

  const MAX_ITERATIONS = 10;
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Research the current Bitcoin and Ethereum prices, find recent news about them, calculate the BTC/ETH ratio, and save a brief report with your findings.",
    },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      system:
        "You are a crypto research assistant. Use tools to gather data, analyze it, and produce reports. Always save your final report using the save_report tool.",
      tools,
      messages,
    });

    console.log(`\nIteration ${i + 1}: stop_reason = ${response.stop_reason}`);

    if (response.stop_reason === "end_turn") {
      for (const block of response.content) {
        if (block.type === "text") {
          console.log("\n=== FINAL RESPONSE ===");
          console.log(block.text);
        }
      }
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    // Print any text blocks
    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }

    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        try {
          const result = executeTool(block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }
    }

    messages.push({ role: "user", content: toolResults });

    if (i === MAX_ITERATIONS - 1) {
      console.log(`\nHit max iterations (${MAX_ITERATIONS})`);
    }
  }

  console.log("\nAgentic tool loop example completed!");
}

main().catch(console.error);
