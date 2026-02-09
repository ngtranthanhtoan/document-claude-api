import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── Phase 1: Web Research with Built-in Tools ───
  printHeader("Phase 1: Web Research (Built-in web_search)");

  const phase1 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ],
    messages: [
      {
        role: "user",
        content:
          "Search for the latest trends in AI-powered developer tools in 2025. Provide a brief summary of the top 3 trends.",
      },
    ],
  });

  for (const block of phase1.content) {
    if (block.type === "text") console.log(block.text);
    if (block.type === "web_search_tool_result") console.log("[Web search results received]");
  }

  // ─── Phase 2: Data Analysis with Code Execution ───
  printHeader("Phase 2: Data Analysis (Built-in code_execution)");

  const phase2 = await client.beta.messages.create(
    {
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      tools: [
        {
          type: "code_execution_20250825",
          name: "code_execution",
        },
      ],
      messages: [
        {
          role: "user",
          content:
            "Using Python, create a simple analysis: generate a list of 10 random numbers between 1-100, calculate the mean, median, and standard deviation, then create a simple ASCII bar chart of the numbers.",
        },
      ],
    },
    { betas: ["code-execution-2025-08-25"] }
  );

  for (const block of phase2.content) {
    if (block.type === "text") {
      console.log(block.text);
    } else if (block.type === "code_execution_tool_result") {
      console.log("[Code execution completed]");
      const resultBlock = block as Record<string, unknown>;
      if (resultBlock.content && Array.isArray(resultBlock.content)) {
        for (const item of resultBlock.content) {
          if ((item as Record<string, unknown>).type === "text") {
            console.log((item as Record<string, unknown>).text);
          }
        }
      }
    }
  }

  // ─── Phase 3: Multi-Tool Orchestration (Custom + Built-in) ───
  printHeader("Phase 3: Multi-Tool Orchestration");

  const customTools: Anthropic.Tool[] = [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 2,
    },
    {
      name: "format_report",
      description: "Format data into a structured report",
      input_schema: {
        type: "object" as const,
        properties: {
          title: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                content: { type: "string" },
              },
              required: ["heading", "content"],
            },
          },
          format: { type: "string", enum: ["markdown", "json", "text"] },
        },
        required: ["title", "sections"],
      },
    },
    {
      name: "save_deliverable",
      description: "Save a finished deliverable",
      input_schema: {
        type: "object" as const,
        properties: {
          filename: { type: "string" },
          content: { type: "string" },
          type: { type: "string", enum: ["report", "spreadsheet", "presentation"] },
        },
        required: ["filename", "content"],
      },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Create a brief report about TypeScript adoption trends. Search for current info, format it as a structured report, and save it. Keep it concise (3 sections max).",
    },
  ];

  for (let i = 0; i < 8; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      system: "You are a research analyst. Use available tools to gather data, analyze it, and produce deliverables.",
      tools: customTools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text") console.log(block.text);
    }

    if (response.stop_reason === "end_turn") break;

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`  [Tool] ${block.name}`);
        let result: string;

        switch (block.name) {
          case "format_report": {
            const input = block.input as Record<string, unknown>;
            const sections = input.sections as Array<{ heading: string; content: string }>;
            result = JSON.stringify({
              status: "formatted",
              report: `# ${input.title}\n\n${sections.map((s) => `## ${s.heading}\n${s.content}`).join("\n\n")}`,
            });
            break;
          }
          case "save_deliverable": {
            const input = block.input as Record<string, unknown>;
            console.log(`  [Saved] ${input.filename} (${input.type})`);
            result = JSON.stringify({ status: "saved", filename: input.filename, size: "2.4 KB" });
            break;
          }
          default:
            result = JSON.stringify({ info: "Tool handled by API" });
        }

        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      } else if (block.type === "web_search_tool_result") {
        // Web search is handled automatically by the API, no tool_result needed
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }
  }

  // ─── Phase 4: Streaming with Tools ───
  printHeader("Phase 4: Fine-Grained Streaming");

  const stream = client.messages.stream({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: "Write a brief executive summary of how AI is transforming software development in 2025. Keep it to 3 paragraphs.",
      },
    ],
  });

  stream.on("text", (text) => {
    process.stdout.write(text);
  });

  const finalMessage = await stream.finalMessage();
  console.log(`\n\nTokens: ${finalMessage.usage.input_tokens} in / ${finalMessage.usage.output_tokens} out`);

  console.log("\nFull-stack agent example completed!");
}

main().catch(console.error);
