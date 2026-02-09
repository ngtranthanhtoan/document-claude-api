import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

// Mock tool handler
function getWeather(location: string, unit = "celsius"): Record<string, unknown> {
  const data: Record<string, { temp_c: number; condition: string; humidity: number }> = {
    "Paris, France": { temp_c: 15, condition: "Partly cloudy", humidity: 65 },
    "Tokyo, Japan": { temp_c: 22, condition: "Clear sky", humidity: 55 },
    "New York, USA": { temp_c: 8, condition: "Overcast", humidity: 72 },
  };
  const match = Object.entries(data).find(([k]) =>
    location.toLowerCase().includes(k.split(",")[0].toLowerCase())
  );
  const info = match ? match[1] : { temp_c: 20, condition: "Sunny", humidity: 50 };
  const temp = unit === "fahrenheit" ? info.temp_c * 9 / 5 + 32 : info.temp_c;
  return { location, temperature: temp, unit, condition: info.condition, humidity: info.humidity };
}

const weatherTool: Anthropic.Tool = {
  name: "get_weather",
  description: "Get the current weather for a specific location. Returns temperature, conditions, and humidity.",
  input_schema: {
    type: "object" as const,
    properties: {
      location: { type: "string", description: "City and country, e.g., Tokyo, Japan" },
      unit: { type: "string", enum: ["celsius", "fahrenheit"], description: "Temperature unit" },
    },
    required: ["location"],
  },
};

async function main() {
  // ─── Method 1: Define Tools and Send Request ───
  printHeader("Method 1: Define Tools and Send Request");

  const msg1 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    tools: [weatherTool],
    messages: [{ role: "user", content: "What is the weather like in Paris right now?" }],
  });

  console.log("Stop reason:", msg1.stop_reason);
  console.log("Content:");
  printJSON(msg1.content);

  // ─── Method 2: Complete Tool Use Loop ───
  printHeader("Method 2: Complete Tool Use Loop");

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "What is the weather like in Paris right now?" },
  ];

  const response1 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    tools: [weatherTool],
    messages,
  });

  console.log("Step 1 - Stop reason:", response1.stop_reason);

  if (response1.stop_reason === "tool_use") {
    messages.push({ role: "assistant", content: response1.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response1.content) {
      if (block.type === "tool_use") {
        console.log(`Executing tool: ${block.name}`);
        const input = block.input as Record<string, string>;
        const result = getWeather(input.location, input.unit);
        console.log("Tool result:", JSON.stringify(result));

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    const response2 = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      tools: [weatherTool],
      messages,
    });

    console.log("\nStep 2 - Final response:");
    for (const block of response2.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }
  }

  // ─── Method 3: Built-in Web Search Tool ───
  printHeader("Method 3: Built-in Web Search Tool");

  const msg3 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ],
    messages: [{ role: "user", content: "What is the latest version of Node.js?" }],
  });

  console.log("Stop reason:", msg3.stop_reason);
  for (const block of msg3.content) {
    if (block.type === "text") {
      console.log(block.text);
    } else if (block.type === "web_search_tool_result") {
      console.log("[Web search results received]");
    }
  }

  // ─── Method 4: Multiple Tool Calls ───
  printHeader("Method 4: Parallel Tool Calls");

  const msgs4: Anthropic.MessageParam[] = [
    { role: "user", content: "Compare the weather in Tokyo and New York right now." },
  ];

  const resp4 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    tools: [weatherTool],
    messages: msgs4,
  });

  if (resp4.stop_reason === "tool_use") {
    msgs4.push({ role: "assistant", content: resp4.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp4.content) {
      if (block.type === "tool_use") {
        const input = block.input as Record<string, string>;
        console.log(`Executing: ${block.name}(${input.location})`);
        const result = getWeather(input.location, input.unit);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    msgs4.push({ role: "user", content: toolResults });

    const final = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      tools: [weatherTool],
      messages: msgs4,
    });

    for (const block of final.content) {
      if (block.type === "text") console.log(block.text);
    }
  }

  console.log("\nTool use basics examples completed!");
}

main().catch(console.error);
