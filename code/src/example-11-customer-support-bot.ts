import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader } from "./utils.js";

const client = new Anthropic();

const systemPrompt = `You are a friendly and helpful customer support agent for TechStore.

Guidelines:
1. TONE: Be warm, empathetic, and professional
2. EFFICIENCY: Get to solutions quickly
3. TOOLS: Use tools to look up information before responding
4. ESCALATION: Use escalate_to_human if you can't resolve the issue
5. REFUNDS: You can process refunds up to $100
6. PRIVACY: Never share full account details with the customer

Store policies:
- 30-day return policy for all items
- Free shipping on orders over $50
- Premium members get priority support`;

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
      properties: { email: { type: "string" } },
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
        category: { type: "string", enum: ["billing", "shipping", "product", "technical"] },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        summary: { type: "string" },
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
        amount: { type: "number" },
        reason: { type: "string" },
      },
      required: ["order_id", "amount", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description: "Escalate to a human agent when you cannot resolve the issue",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_email: { type: "string" },
        reason: { type: "string" },
        urgency: { type: "string", enum: ["normal", "high", "critical"] },
      },
      required: ["customer_email", "reason", "urgency"],
    },
  },
  {
    name: "search_knowledge_base",
    description: "Search the FAQ and knowledge base",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
];

// Mock tool execution
function executeTool(name: string, input: Record<string, unknown>): string {
  console.log(`  [Mock Tool] ${name}(${JSON.stringify(input)})`);

  switch (name) {
    case "lookup_order":
      return JSON.stringify({
        order_id: input.order_id || "ORD-12345",
        status: "shipped",
        tracking_number: "1Z999AA10123456784",
        items: [
          { name: "ProBook Laptop 15\"", price: 899.99, quantity: 1 },
          { name: "USB-C Dock", price: 79.99, quantity: 1 },
        ],
        total: 979.98,
        ordered_date: "2025-01-10",
        estimated_delivery: "2025-01-18",
      });
    case "check_account_status":
      return JSON.stringify({
        email: input.email,
        status: "active",
        member_since: "2019-03-15",
        tier: "Gold",
        total_orders: 47,
        lifetime_value: 12450.0,
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
        estimated_credit: "3-5 business days",
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
          { title: "Return Policy", content: "30-day return policy for all items in original condition." },
          { title: "Shipping Info", content: "Free shipping on orders over $50. Standard delivery 5-7 days." },
        ],
      });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function chat(
  messages: Anthropic.MessageParam[],
  userMessage: string
): Promise<Anthropic.MessageParam[]> {
  console.log(`\nCustomer: ${userMessage}`);
  messages.push({ role: "user", content: userMessage });

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      for (const block of response.content) {
        if (block.type === "text") {
          console.log(`Agent: ${block.text}`);
        }
      }
      return messages;
    }

    if (response.stop_reason === "tool_use") {
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
    }
  }
}

async function main() {
  printHeader("Customer Support Bot Demo");
  console.log("Simulating a multi-turn customer support conversation...\n");

  let messages: Anthropic.MessageParam[] = [];

  // Turn 1: Customer inquiry
  messages = await chat(
    messages,
    "Hi, I ordered a laptop last week (order ORD-12345) and I haven't received it yet. Can you check on it?"
  );

  // Turn 2: Follow-up
  messages = await chat(
    messages,
    "The tracking shows it should have arrived yesterday. Can I get a refund for the USB-C dock? I found it cheaper elsewhere."
  );

  // Turn 3: Account question
  messages = await chat(
    messages,
    "Also, can you check my account status? My email is jane@example.com. Am I eligible for any loyalty perks?"
  );

  console.log("\nCustomer support bot demo completed!");
}

main().catch(console.error);
