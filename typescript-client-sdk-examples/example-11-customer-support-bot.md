# Example 11: Customer Support Bot

> Build a complete customer support assistant with multi-turn conversations, tools, and sentiment awareness.

## Overview

- **Difficulty**: Advanced
- **Features Used**: System prompts, Multi-turn, Tool Use
- **SDK Methods**: `client.messages.create()`
- **Use Cases**:
  - Customer service automation
  - Ticket management
  - Order tracking
  - FAQ handling
  - Escalation workflows

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- Understanding of tool use basics

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Support Bot                      │
├─────────────────────────────────────────────────────────────┤
│  System Prompt (persona, policies, guidelines)              │
├─────────────────────────────────────────────────────────────┤
│  Tools:                                                      │
│  ├── lookup_order         │  check_account_status           │
│  ├── create_ticket        │  process_refund                 │
│  ├── escalate_to_human    │  update_shipping                │
│  └── search_knowledge_base                                   │
├─────────────────────────────────────────────────────────────┤
│  Conversation History (multi-turn context)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Support Bot Request

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const systemPrompt = `You are a friendly and helpful customer support agent for TechStore, an online electronics retailer. Follow these guidelines:

1. TONE: Be warm, empathetic, and professional. Acknowledge customer frustrations.
2. EFFICIENCY: Get to solutions quickly while being thorough.
3. TOOLS: Use available tools to look up information before responding.
4. ESCALATION: If a customer asks for a manager or you cannot resolve the issue, use the escalate_to_human tool.
5. REFUNDS: You can process refunds up to $100. For larger amounts, escalate.
6. PRIVACY: Never share full account details. Only confirm last 4 digits of payment methods.

Store policies:
- 30-day return policy
- Free shipping on orders over $50
- Price match within 14 days of purchase`;

const tools: Anthropic.Tool[] = [
  {
    name: "lookup_order",
    description: "Look up order details by order ID or customer email",
    input_schema: {
      type: "object" as const,
      properties: {
        order_id: { type: "string" },
        email: { type: "string" },
      },
    },
  },
  {
    name: "check_account_status",
    description: "Check customer account status and history",
    input_schema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description: "Customer email address",
        },
      },
      required: ["email"],
    },
  },
  {
    name: "create_ticket",
    description: "Create a support ticket for follow-up",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_email: { type: "string" },
        category: {
          type: "string",
          enum: ["billing", "shipping", "product", "technical", "general"],
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
        },
        summary: { type: "string" },
        details: { type: "string" },
      },
      required: ["customer_email", "category", "priority", "summary"],
    },
  },
  {
    name: "process_refund",
    description: "Process a refund for an order. Limited to $100 max.",
    input_schema: {
      type: "object" as const,
      properties: {
        order_id: { type: "string" },
        amount: {
          type: "number",
          description: "Refund amount in USD",
        },
        reason: { type: "string" },
      },
      required: ["order_id", "amount", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate to a human agent when you cannot resolve the issue",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_email: { type: "string" },
        reason: { type: "string" },
        urgency: {
          type: "string",
          enum: ["normal", "high", "critical"],
        },
        conversation_summary: { type: "string" },
      },
      required: ["customer_email", "reason", "urgency"],
    },
  },
  {
    name: "search_knowledge_base",
    description: "Search the FAQ and knowledge base for answers",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
];

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  system: systemPrompt,
  tools,
  messages: [
    {
      role: "user",
      content:
        "Hi, I ordered a laptop 2 weeks ago (order #ORD-12345) and it still has not arrived. This is really frustrating! My email is john@example.com",
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
console.log("Content:", JSON.stringify(message.content, null, 2));
```

### Response (Tool Use)

```json
{
  "content": [
    {
      "type": "text",
      "text": "I completely understand your frustration, and I apologize for the delay with your laptop order. Two weeks is definitely longer than expected. Let me look up your order right away to see what's happening."
    },
    {
      "type": "tool_use",
      "id": "toolu_01ABC",
      "name": "lookup_order",
      "input": {
        "order_id": "ORD-12345",
        "email": "john@example.com"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## Multi-Turn Conversation Flow

### Turn 1: Initial Complaint -> Lookup Order

```typescript
// (First request as shown above)
// Claude calls lookup_order tool
```

### Turn 2: Send Tool Result

```typescript
const messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content:
      "Hi, I ordered a laptop 2 weeks ago (order #ORD-12345) and it still has not arrived...",
  },
  {
    role: "assistant",
    content: [
      {
        type: "text",
        text: "I completely understand your frustration...",
      },
      {
        type: "tool_use",
        id: "toolu_01ABC",
        name: "lookup_order",
        input: { order_id: "ORD-12345", email: "john@example.com" },
      },
    ],
  },
  {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "toolu_01ABC",
        content: JSON.stringify({
          order_id: "ORD-12345",
          status: "shipped",
          shipped_date: "2024-01-10",
          carrier: "FedEx",
          tracking: "789456123",
          estimated_delivery: "2024-01-15",
          current_status: "In transit - delayed at distribution center",
          items: [{ name: "ProBook Laptop 15", price: 899.99 }],
          customer: { name: "John Smith", email: "john@example.com" },
        }),
      },
    ],
  },
];

const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  system: systemPrompt,
  tools,
  messages,
});
```

### Response (Explanation + Offer)

```json
{
  "content": [
    {
      "type": "text",
      "text": "Thank you for your patience, John. I found your order and I can see what's happening:\n\n**Order Status:**\n- Your ProBook Laptop 15 was shipped on January 10th via FedEx\n- Tracking number: 789456123\n- Unfortunately, it's currently delayed at a distribution center\n\nI sincerely apologize for this delay. This is not the experience we want for our customers. Here's what I can do for you:\n\n1. **Immediate action**: I'll create a priority ticket to have our shipping team contact FedEx directly\n2. **Compensation**: I'd like to offer you a $25 store credit for the inconvenience\n\nWould you like me to proceed with both of these? Also, would you prefer to wait for the package or would you like to discuss other options?"
    }
  ],
  "stop_reason": "end_turn"
}
```

### Turn 3: Customer Wants Refund

```typescript
// Customer responds: "This is unacceptable. I want a full refund."
// Claude will use escalate_to_human since refund amount ($899.99) exceeds $100 limit
```

---

## Handling Escalation

When the customer asks for a manager or refund exceeds limits:

```json
{
  "content": [
    {
      "type": "text",
      "text": "I completely understand, and I want to make sure you're taken care of properly. Since your order is $899.99, I'll need to escalate this to a senior support specialist who has the authorization to process larger refunds. Let me connect you right away."
    },
    {
      "type": "tool_use",
      "id": "toolu_02DEF",
      "name": "escalate_to_human",
      "input": {
        "customer_email": "john@example.com",
        "reason": "Customer requesting full refund of $899.99 for delayed laptop order ORD-12345. Shipment delayed at distribution center for over a week past estimated delivery.",
        "urgency": "high",
        "conversation_summary": "Customer ordered laptop 2 weeks ago, still not delivered, shipment stuck at distribution center. Customer frustrated and requesting full refund. Order value exceeds my refund limit."
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## Sentiment-Aware Responses

Adjust tone based on customer emotion by including sentiment guidance in the system prompt.

### Frustrated Customer

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 2048,
  system: `You are a customer support agent. Detect customer sentiment and adjust your response accordingly:
- Frustrated/Angry: Lead with empathy, acknowledge feelings, prioritize solutions
- Confused: Be patient, use simple language, offer step-by-step guidance
- Happy: Match their energy, thank them, ask if there is anything else
- Neutral: Be efficient and helpful`,
  messages: [
    {
      role: "user",
      content:
        "THIS IS THE THIRD TIME IM CONTACTING YOU!!! Nobody can figure out why my account is locked!!! I have been a customer for 5 YEARS and this is how you treat me?!",
    },
  ],
});

const textBlock = message.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  console.log(textBlock.text);
}
```

### Response (Empathy-First)

```json
{
  "content": [
    {
      "type": "text",
      "text": "I am truly sorry for what you've been going through. Having to reach out three times for the same issue is absolutely unacceptable, and I can completely understand your frustration. After 5 years of loyalty, you deserve so much better than this.\n\nI want to personally make sure this gets resolved right now. Let me immediately look into your account and find out exactly what's happening. Can you please provide your account email so I can pull up your records?\n\nI promise I won't let this go until we have a solution for you today."
    }
  ]
}
```

---

## Complete Support Bot Script

A full interactive support bot with tool execution and multi-turn conversation.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline/promises";

const client = new Anthropic();
let messages: Anthropic.MessageParam[] = [];

const systemPrompt =
  "You are a helpful and empathetic customer support agent for TechStore. " +
  "Use tools to look up information before responding. " +
  "You can process refunds up to $100. For larger amounts, escalate. " +
  "Always acknowledge customer frustrations before solving problems.";

const tools: Anthropic.Tool[] = [
  {
    name: "lookup_order",
    description: "Look up order details by order ID",
    input_schema: {
      type: "object" as const,
      properties: {
        order_id: { type: "string" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "check_account_status",
    description: "Check customer account status",
    input_schema: {
      type: "object" as const,
      properties: {
        email: { type: "string" },
      },
      required: ["email"],
    },
  },
  {
    name: "create_ticket",
    description: "Create a support ticket",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
        },
      },
      required: ["summary"],
    },
  },
  {
    name: "process_refund",
    description: "Process a refund (max $100)",
    input_schema: {
      type: "object" as const,
      properties: {
        order_id: { type: "string" },
        amount: { type: "number" },
        reason: { type: "string" },
      },
      required: ["order_id", "amount", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description: "Escalate to a human agent",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: { type: "string" },
        urgency: {
          type: "string",
          enum: ["normal", "high", "critical"],
        },
      },
      required: ["reason", "urgency"],
    },
  },
  {
    name: "search_knowledge_base",
    description: "Search FAQ and knowledge base",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
];

// Mock tool executor
function executeTool(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "lookup_order":
      return JSON.stringify({
        order_id: input.order_id,
        status: "shipped",
        tracking: "789456123",
        items: [{ name: "ProBook Laptop 15", price: 899.99 }],
        customer: { name: "John Smith" },
      });
    case "check_account_status":
      return JSON.stringify({
        email: input.email,
        status: "active",
        member_since: "2019-03-15",
        tier: "Gold",
      });
    case "create_ticket":
      return JSON.stringify({
        ticket_id: "TKT-98765",
        status: "created",
        estimated_response: "2 hours",
      });
    case "process_refund":
      return JSON.stringify({
        refund_id: "REF-111",
        status: "processed",
        amount: input.amount,
      });
    case "escalate_to_human":
      return JSON.stringify({
        escalation_id: "ESC-222",
        status: "queued",
        position: 3,
        estimated_wait: "5 minutes",
      });
    case "search_knowledge_base":
      return JSON.stringify({
        results: [
          {
            title: "Return Policy",
            content: "30-day return policy for all items.",
          },
        ],
      });
    default:
      return JSON.stringify({ error: "Tool not implemented" });
  }
}

// Chat function with agentic tool loop
async function chat(userMessage: string): Promise<void> {
  messages.push({ role: "user", content: userMessage });

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    // Add assistant response to conversation
    messages.push({ role: "assistant", content: response.content });

    // If Claude is done, print the text and break
    if (response.stop_reason === "end_turn") {
      for (const block of response.content) {
        if (block.type === "text") {
          console.log(`\nAgent: ${block.text}\n`);
        }
      }
      break;
    }

    // If Claude wants to use tools, execute them
    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`  [Tool: ${block.name}]`);
          const result = executeTool(
            block.name,
            block.input as Record<string, unknown>
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Add tool results as a user message
      messages.push({ role: "user", content: toolResults });
    }
  }
}

// Interactive loop with readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Customer Support Bot (type 'exit' to quit)");
console.log("---");

while (true) {
  const input = await rl.question("Customer: ");
  if (input.toLowerCase() === "exit") break;
  await chat(input);
  console.log("---");
}

rl.close();
console.log("Session ended.");
```

---

## Best Practices

1. **Clear System Prompt**: Define tone, policies, and escalation rules.

2. **Empathy First**: Acknowledge emotions before solving problems.

3. **Use Tools for Verification**: Always look up orders before responding.

4. **Know Your Limits**: Escalate when outside your authority.

5. **Summarize for Handoffs**: Provide context when escalating.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool fundamentals
- [Example 12: Human in the Loop](example-12-human-in-the-loop.md) - Approval patterns
- [Example 08: RAG Knowledge Base](example-08-rag-knowledge-base.md) - FAQ search
