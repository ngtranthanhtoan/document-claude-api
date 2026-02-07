# Example 14: Research Agent

> Build a sophisticated research agent using extended thinking and multiple tools.

## Overview

- **Difficulty**: Advanced
- **Features Used**: Extended Thinking, Multi-tool, Agentic loop
- **SDK Methods**: `client.messages.create()` with `thinking`
- **Use Cases**:
  - Market research
  - Competitive analysis
  - Literature reviews
  - Due diligence
  - Technical research

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- Understanding of tool use and agentic loops

---

## Research Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Research Agent                            │
├─────────────────────────────────────────────────────────────┤
│  Extended Thinking (planning, reasoning, synthesis)         │
├─────────────────────────────────────────────────────────────┤
│  Tools:                                                      │
│  ├── web_search        │  read_url                          │
│  ├── save_note         │  get_notes                         │
│  └── fact_check                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Research Request with Extended Thinking

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-opus-4-5-20251101",
  max_tokens: 16000,
  thinking: {
    type: "enabled",
    budget_tokens: 10000,
  },
  system:
    "You are an expert research analyst. Your role is to:\n\n" +
    "1. PLAN: Break down research questions into specific queries\n" +
    "2. GATHER: Use tools to collect information from multiple sources\n" +
    "3. VERIFY: Cross-reference facts across sources\n" +
    "4. SYNTHESIZE: Combine findings into coherent insights\n" +
    "5. REPORT: Present findings with proper citations\n\n" +
    "Always think through your research strategy before starting. Save important findings as you go.",
  tools: [
    {
      name: "web_search",
      description: "Search the web for current information",
      input_schema: {
        type: "object" as const,
        properties: {
          query: { type: "string" },
          num_results: { type: "integer", default: 10 },
          date_filter: {
            type: "string",
            enum: ["past_day", "past_week", "past_month", "past_year"],
          },
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
          extract_sections: {
            type: "array",
            items: { type: "string" },
            description: "Specific sections to extract",
          },
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
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
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
          topic: {
            type: "string",
            description: "Filter by topic (optional)",
          },
          tags: { type: "array", items: { type: "string" } },
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
  ],
  messages: [
    {
      role: "user",
      content:
        "Research the current state of quantum computing commercialization. I need to understand:\n" +
        "1. Major players and their approaches\n" +
        "2. Current practical applications\n" +
        "3. Timeline predictions for mainstream adoption\n\n" +
        "Provide a comprehensive report with sources.",
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
console.log("Content:", JSON.stringify(message.content, null, 2));
```

### Response with Thinking

```json
{
  "content": [
    {
      "type": "thinking",
      "thinking": "This is a complex research task about quantum computing commercialization. Let me plan my approach:\n\n1. First, I should search for the current major players in quantum computing. This will likely include IBM, Google, IonQ, Rigetti, D-Wave, and some newer entrants.\n\n2. For each major player, I need to understand their approach - are they using superconducting qubits, trapped ions, photonics, or other technologies?\n\n3. I'll need to find information about current applications - things like optimization problems, drug discovery, cryptography, and financial modeling.\n\n4. Timeline predictions will require looking at expert opinions and company roadmaps.\n\nLet me start with a broad search to identify the key players, then dig deeper into each one."
    },
    {
      "type": "text",
      "text": "I'll conduct comprehensive research on quantum computing commercialization. Let me start by identifying the major players in this space."
    },
    {
      "type": "tool_use",
      "id": "toolu_01",
      "name": "web_search",
      "input": {
        "query": "quantum computing companies commercialization 2024",
        "num_results": 15,
        "date_filter": "past_month"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## Processing Thinking Blocks from Response

```typescript
for (const block of message.content) {
  if (block.type === "thinking") {
    console.log("[Thinking]:", block.thinking);
  }
  if (block.type === "text") {
    console.log("[Response]:", block.text);
  }
  if (block.type === "tool_use") {
    console.log("[Tool]:", block.name, block.input);
  }
}
```

---

## Multi-Step Research Flow

### Step 1: Broad Search

```json
{"name": "web_search", "input": {"query": "quantum computing companies commercialization 2024"}}
```

### Step 2: Deep Dive on Key Players

```json
{"name": "read_url", "input": {"url": "https://example.com/ibm-quantum-roadmap"}}
{"name": "read_url", "input": {"url": "https://example.com/google-quantum-supremacy"}}
```

### Step 3: Save Key Findings

```json
{
  "name": "save_note",
  "input": {
    "topic": "IBM Quantum",
    "finding": "IBM plans to release a 100,000+ qubit system by 2033. Currently offers 1,000+ qubit processors.",
    "source": "IBM Quantum Roadmap 2024",
    "confidence": "high",
    "tags": ["IBM", "roadmap", "qubit_count"]
  }
}
```

### Step 4: Cross-Reference

```json
{
  "name": "fact_check",
  "input": {
    "claim": "Google achieved quantum supremacy in 2019",
    "original_source": "Nature publication"
  }
}
```

### Step 5: Synthesize Report

After gathering enough information, Claude synthesizes a final report.

---

## Preserving Thinking Blocks in Multi-Turn with Tool Use

When continuing a conversation that includes extended thinking and tool use, you must include all content blocks (including thinking blocks) in the assistant message. This ensures the conversation history remains consistent.

```typescript
// Build messages array for the agentic loop
let messages: Anthropic.MessageParam[] = [
  { role: "user", content: "Research quantum computing commercialization..." },
];

// After receiving a response with thinking + tool_use:
// IMPORTANT: Include ALL content blocks (thinking + text + tool_use) when continuing
messages.push({ role: "assistant", content: response.content });

// Execute the tool and send results back
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

messages.push({ role: "user", content: toolResults });

// Continue the conversation — Claude sees its own thinking from the previous turn
const nextResponse = await client.messages.create({
  model: "claude-opus-4-5-20251101",
  max_tokens: 16000,
  thinking: { type: "enabled", budget_tokens: 10000 },
  tools: [...],
  messages,
});
```

---

## Final Research Report Example

```markdown
# Quantum Computing Commercialization: 2024 Analysis

## Executive Summary
The quantum computing industry is transitioning from research to early commercial adoption...

## 1. Major Players and Approaches

### IBM Quantum
- **Approach**: Superconducting qubits
- **Current Status**: 1,121 qubit processor (Condor)
- **Roadmap**: 100,000+ qubit system by 2033
- **Business Model**: Cloud access via IBM Quantum Network

### Google Quantum AI
- **Approach**: Superconducting qubits
- **Milestone**: Quantum supremacy demonstration (2019)
- **Focus**: Error correction research

### IonQ
- **Approach**: Trapped ions
- **Advantage**: Longer coherence times
- **Status**: Publicly traded, cloud access available

### D-Wave
- **Approach**: Quantum annealing
- **Focus**: Optimization problems
- **Status**: Commercial systems deployed

## 2. Current Practical Applications

| Application | Maturity | Key Users |
|-------------|----------|-----------|
| Drug Discovery | Early pilots | Roche, Merck |
| Financial Optimization | Testing | JPMorgan, Goldman |
| Materials Science | Research | BMW, Airbus |
| Cryptography | Theoretical | Government agencies |

## 3. Timeline Predictions

| Milestone | Predicted Timeline | Confidence |
|-----------|-------------------|------------|
| 1,000+ logical qubits | 2028-2030 | Medium |
| Practical advantage | 2025-2027 | High |
| Mainstream enterprise adoption | 2030-2035 | Low |

## Sources
1. IBM Quantum Roadmap (2024)
2. Google Quantum AI Publications
3. McKinsey Quantum Report (2024)
4. Nature: Quantum Computing Review
```

---

## Complete Research Agent Script

A full end-to-end script that runs an agentic research loop with extended thinking, mock tools, and note persistence.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();
const NOTES_FILE = "./research_notes.json";

// Initialize notes file
if (!fs.existsSync(NOTES_FILE)) {
  fs.writeFileSync(NOTES_FILE, "[]");
}

// Tool execution
function executeTool(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "web_search": {
      // Mock search results — replace with real search API
      const query = input.query as string;
      return JSON.stringify([
        {
          title: `Result 1 for: ${query}`,
          url: "https://example.com/1",
          snippet: "Relevant information about the topic...",
        },
        {
          title: `Result 2 for: ${query}`,
          url: "https://example.com/2",
          snippet: "Additional details and analysis...",
        },
      ]);
    }
    case "read_url": {
      // Mock URL content — replace with real HTTP fetch
      return JSON.stringify({
        content:
          "Article content with detailed information about the topic...",
        title: "Article Title",
      });
    }
    case "save_note": {
      const notes = JSON.parse(fs.readFileSync(NOTES_FILE, "utf-8"));
      notes.push({
        ...input,
        saved_at: new Date().toISOString(),
      });
      fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
      return JSON.stringify({
        status: "saved",
        total_notes: notes.length,
      });
    }
    case "get_notes": {
      const allNotes = JSON.parse(fs.readFileSync(NOTES_FILE, "utf-8"));
      const topic = input.topic as string | undefined;
      if (topic) {
        const filtered = allNotes.filter(
          (n: Record<string, unknown>) => n.topic === topic
        );
        return JSON.stringify(filtered);
      }
      return JSON.stringify(allNotes);
    }
    case "fact_check": {
      // Mock fact check — replace with real verification logic
      return JSON.stringify({
        verified: true,
        supporting_sources: 3,
        confidence: "high",
      });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// Define tools once
const tools: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Search the web for current information",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        num_results: { type: "integer", default: 10 },
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
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
        },
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
        topic: { type: "string" },
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

// Main research function with agentic loop
async function research(question: string): Promise<void> {
  console.log(`\nResearching: ${question}\n`);

  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: question },
  ];

  const maxIterations = 15;

  for (let i = 0; i < maxIterations; i++) {
    console.log(`Step ${i + 1}...`);

    const response = await client.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 5000 },
      system:
        "You are a research analyst. Use tools to gather information, " +
        "save findings, and synthesize reports.",
      tools,
      messages,
    });

    // Show thinking (truncated for readability)
    for (const block of response.content) {
      if (block.type === "thinking") {
        console.log(
          `  [Thinking]: ${block.thinking.slice(0, 100)}...`
        );
      }
    }

    // Check if research is complete
    if (response.stop_reason === "end_turn") {
      console.log("\n=== RESEARCH REPORT ===\n");
      for (const block of response.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
      return;
    }

    // Handle tool use — include ALL content blocks (thinking + tool_use)
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const toolInput = block.input as Record<string, unknown>;
        console.log(`  -> ${block.name}(${JSON.stringify(toolInput).slice(0, 60)}...)`);

        const result = executeTool(block.name, toolInput);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  console.log("Max iterations reached.");
}

// Run the research agent
research(
  "Analyze the competitive landscape of electric vehicle charging networks in North America"
).catch(console.error);
```

---

## Best Practices

1. **Use Extended Thinking**: For complex research, thinking helps Claude plan systematically.

2. **Save Findings Incrementally**: Don't rely on Claude's memory -- save notes as you go.

3. **Cross-Reference Sources**: Use fact-checking for important claims.

4. **Structure the Final Report**: Request specific sections for consistent output.

5. **Set Appropriate Thinking Budget**: 5000-10000 tokens for complex research.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Basic autonomous agents
- [Example 08: RAG Knowledge Base](example-08-rag-knowledge-base.md) - Document research
- [Example 04: Citations](example-04-citations.md) - Source attribution
