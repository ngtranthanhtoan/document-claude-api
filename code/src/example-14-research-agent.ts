import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader } from "./utils.js";

const client = new Anthropic();

// In-memory notes storage
const notes: Array<Record<string, unknown>> = [];

const tools: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Search the web for current information",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        num_results: { type: "integer" },
        date_filter: { type: "string", enum: ["past_day", "past_week", "past_month", "past_year"] },
      },
      required: ["query"],
    },
  },
  {
    name: "read_url",
    description: "Read and extract content from a URL",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "save_note",
    description: "Save a research finding for later synthesis",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: { type: "string" },
        finding: { type: "string" },
        source: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["topic", "finding"],
    },
  },
  {
    name: "get_notes",
    description: "Retrieve saved research notes",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: { type: "string", description: "Filter by topic" },
      },
    },
  },
  {
    name: "fact_check",
    description: "Verify a claim against multiple sources",
    input_schema: {
      type: "object" as const,
      properties: {
        claim: { type: "string" },
        original_source: { type: "string" },
      },
      required: ["claim"],
    },
  },
];

function executeTool(name: string, input: Record<string, unknown>): string {
  console.log(`  >>> ${name}(${JSON.stringify(input).slice(0, 100)}...)`);

  switch (name) {
    case "web_search":
      return JSON.stringify({
        results: [
          {
            title: `Research: ${input.query}`,
            url: "https://example.com/research-1",
            snippet: `Recent studies on ${input.query} show significant developments in the field. Experts note that market dynamics are shifting toward increased efficiency and sustainability.`,
          },
          {
            title: `Analysis: ${input.query} Trends 2025`,
            url: "https://example.com/analysis-1",
            snippet: `A comprehensive analysis reveals key trends in ${input.query}, including technological innovation, regulatory changes, and growing institutional interest.`,
          },
          {
            title: `Industry Report: ${input.query}`,
            url: "https://example.com/report-1",
            snippet: `The latest industry report covers market size ($4.2 trillion), growth rate (12% YoY), and major players driving innovation in ${input.query}.`,
          },
        ],
      });
    case "read_url":
      return JSON.stringify({
        title: "Detailed Article",
        content: `This comprehensive article explores the topic in depth. Key findings include: 1) Market growth of 12% year-over-year, 2) Three major players control 60% of the market, 3) Regulatory frameworks are evolving rapidly, 4) Technology adoption is accelerating across all segments. The analysis concludes that sustainable growth is expected through 2027.`,
        word_count: 850,
      });
    case "save_note": {
      notes.push({ ...input, saved_at: new Date().toISOString() });
      return JSON.stringify({ status: "saved", total_notes: notes.length });
    }
    case "get_notes": {
      const topic = input.topic as string | undefined;
      if (topic) {
        const filtered = notes.filter((n) => n.topic === topic);
        return JSON.stringify(filtered);
      }
      return JSON.stringify(notes);
    }
    case "fact_check":
      return JSON.stringify({
        claim: input.claim,
        verified: true,
        supporting_sources: 3,
        confidence: "high",
        details: "Claim verified against 3 independent sources. Data is consistent across all sources.",
      });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function main() {
  printHeader("Research Agent with Extended Thinking");

  const MAX_ITERATIONS = 10;
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Research the current state of AI adoption in enterprise software. I need: 1) Market size and growth rate, 2) Key players and their strategies, 3) Main challenges for adoption. Save your key findings as notes and provide a synthesis at the end.",
    },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n--- Iteration ${i + 1} ---`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 16000,
      thinking: {
        type: "enabled",
        budget_tokens: 5000,
      },
      system:
        "You are an expert research analyst. Your role is to:\n1. PLAN: Break down research questions into specific queries\n2. GATHER: Use tools to collect information from multiple sources\n3. VERIFY: Cross-reference facts across sources\n4. SYNTHESIZE: Combine findings into coherent insights\n5. REPORT: Present findings clearly\n\nAlways think through your research strategy before starting. Save important findings as notes.",
      tools,
      messages,
    });

    console.log(`Stop reason: ${response.stop_reason}`);

    // Display thinking and text blocks
    for (const block of response.content) {
      if (block.type === "thinking") {
        console.log(`\n[Thinking]: ${block.thinking.slice(0, 200)}...`);
      } else if (block.type === "text") {
        console.log(`\n${block.text}`);
      } else if (block.type === "tool_use") {
        console.log(`[Tool call]: ${block.name}`);
      }
    }

    if (response.stop_reason === "end_turn") {
      console.log("\n=== Research Complete ===");
      break;
    }

    // Continue the agentic loop
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = executeTool(block.name, block.input as Record<string, unknown>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }
  }

  console.log(`\nTotal notes saved: ${notes.length}`);
  console.log("\nResearch agent example completed!");
}

main().catch(console.error);
