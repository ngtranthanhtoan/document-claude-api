import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── Method 1: Basic Streaming with Event Callbacks ───
  printHeader("Method 1: Basic Streaming with Event Callbacks");

  const stream1 = client.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Write a haiku about programming." }],
  });

  stream1.on("text", (text) => {
    process.stdout.write(text);
  });

  const finalMessage1 = await stream1.finalMessage();
  console.log("\n\nDone! Total tokens:", finalMessage1.usage.output_tokens);

  // ─── Method 2: Streaming with for-await Iterator ───
  printHeader("Method 2: Streaming with for-await Iterator (SSE Events)");

  const stream2 = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: "user", content: "Explain how HTTP streaming works in 2 sentences." },
    ],
  });

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream2) {
    switch (event.type) {
      case "message_start":
        inputTokens = event.message.usage.input_tokens;
        break;
      case "content_block_delta":
        if (event.delta.type === "text_delta") {
          process.stdout.write(event.delta.text);
        }
        break;
      case "message_delta":
        outputTokens = event.usage.output_tokens;
        break;
      case "message_stop":
        console.log("\n\n=== Stream Complete ===");
        console.log(`Input tokens: ${inputTokens}`);
        console.log(`Output tokens: ${outputTokens}`);
        break;
    }
  }

  // ─── Method 3: Streaming with Tool Use ───
  printHeader("Method 3: Streaming with Tool Use");

  const stream3 = client.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    tools: [
      {
        name: "get_weather",
        description: "Get weather for a location",
        input_schema: {
          type: "object" as const,
          properties: { location: { type: "string" } },
          required: ["location"],
        },
      },
    ],
    messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
  });

  stream3.on("inputJson", (partialJson) => {
    process.stdout.write(`[Tool JSON delta]: ${partialJson}\n`);
  });

  stream3.on("text", (text) => {
    process.stdout.write(text);
  });

  const finalMessage3 = await stream3.finalMessage();
  console.log("\nStop reason:", finalMessage3.stop_reason);

  if (finalMessage3.stop_reason === "tool_use") {
    const toolUse = finalMessage3.content.find((block) => block.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      console.log("Tool requested:", toolUse.name);
      console.log("Input:", JSON.stringify(toolUse.input));
    }
  }

  // ─── Method 4: Streaming with Extended Thinking ───
  printHeader("Method 4: Streaming with Extended Thinking");

  const stream4 = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8000,
    stream: true,
    thinking: { type: "enabled", budget_tokens: 5000 },
    messages: [{ role: "user", content: "What is 15 * 27?" }],
  });

  let currentBlockType = "";

  for await (const event of stream4) {
    if (event.type === "content_block_start") {
      currentBlockType = event.content_block.type;
      if (currentBlockType === "thinking") {
        process.stdout.write("[Thinking]: ");
      } else if (currentBlockType === "text") {
        process.stdout.write("\n[Response]: ");
      }
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "thinking_delta") {
        process.stdout.write(event.delta.thinking);
      } else if (event.delta.type === "text_delta") {
        process.stdout.write(event.delta.text);
      }
    }
  }

  console.log("\n");

  // ─── Method 5: Convenience Methods ───
  printHeader("Method 5: Convenience Methods (finalText)");

  const stream5 = client.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Say hello in 3 languages!" }],
  });

  const text = await stream5.finalText();
  console.log("Final text:", text);

  console.log("\nAll streaming methods completed successfully!");
}

main().catch(console.error);
