import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader } from "./utils.js";

const client = new Anthropic();

const DOCS = `# Company Product Documentation

## Chapter 1: Getting Started

### 1.1 Installation
To install the product, run: npm install @company/product
Requirements: Node.js 18+, npm 9+

### 1.2 Configuration
Create a config.json file in your project root:
{
  "apiKey": "your-api-key",
  "environment": "production",
  "timeout": 30000
}

### 1.3 Quick Start
import { Client } from '@company/product';
const client = new Client({ apiKey: process.env.API_KEY });
await client.connect();

## Chapter 2: Authentication

### 2.1 API Keys
API keys can be generated in the dashboard. Keys have two types:
- Production keys (pk_live_*)
- Test keys (pk_test_*)

### 2.2 OAuth Integration
For OAuth, configure your redirect URI in the dashboard.
Supported flows: Authorization Code, Client Credentials

### 2.3 Rate Limits
- Free tier: 100 requests/minute
- Pro tier: 1000 requests/minute
- Enterprise: Unlimited

## Chapter 3: API Reference

### 3.1 Users API
GET /api/users - List all users
GET /api/users/:id - Get user by ID
POST /api/users - Create user
PUT /api/users/:id - Update user
DELETE /api/users/:id - Delete user

### 3.2 Products API
GET /api/products - List products
GET /api/products/:id - Get product
POST /api/products - Create product

## Chapter 4: Troubleshooting

### 4.1 Common Errors
- "Connection timeout": Check your network and increase the timeout value in config.json
- "Invalid API key": Ensure your key starts with pk_live_ or pk_test_
- "Rate limit exceeded": Upgrade your plan or implement exponential backoff

### 4.2 Support
Contact support@company.com for assistance.`;

const systemPrompt: Anthropic.TextBlockParam[] = [
  {
    type: "text",
    text: `You are a helpful documentation assistant. Answer questions based ONLY on this documentation. If information is not in the docs, say so clearly. Always cite the relevant section when answering.\n\n---\n\n${DOCS}`,
    cache_control: { type: "ephemeral" },
  },
];

async function askQuestion(question: string): Promise<void> {
  console.log(`Q: ${question}`);

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (textBlock && textBlock.type === "text") {
    console.log(`A: ${textBlock.text}`);
  }
  console.log("");

  const cacheCreate = message.usage.cache_creation_input_tokens ?? 0;
  const cacheRead = message.usage.cache_read_input_tokens ?? 0;

  console.log(`Tokens — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}`);
  if (cacheCreate > 0) {
    console.log(`  Cache CREATED: ${cacheCreate} tokens`);
  }
  if (cacheRead > 0) {
    console.log(`  Cache HIT: ${cacheRead} tokens (90% savings!)`);
  }
  console.log("---\n");
}

async function main() {
  // ─── Step 1: First Query (Creates Cache) ───
  printHeader("Step 1: First Query (Creates Cache)");
  await askQuestion("How do I install the product?");

  // ─── Step 2: Follow-up Query (Cache Hit) ───
  printHeader("Step 2: Follow-up Query (Cache Hit)");
  await askQuestion("What are the rate limits?");

  // ─── Step 3: Another Query (Cache Hit) ───
  printHeader("Step 3: Another Query (Cache Hit)");
  await askQuestion("What API endpoints are available for users?");

  // ─── Step 4: Troubleshooting Query ───
  printHeader("Step 4: Troubleshooting Query");
  await askQuestion("I'm getting a connection timeout error. How do I fix it?");

  // ─── Step 5: Multi-Turn RAG Conversation ───
  printHeader("Step 5: Multi-Turn RAG Conversation");

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "How do I authenticate?" },
  ];

  const response1 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const text1 = response1.content.find((b) => b.type === "text");
  console.log("Turn 1 Q: How do I authenticate?");
  console.log("Turn 1 A:", text1?.type === "text" ? text1.text : "");
  console.log("");

  // Build on the conversation
  messages.push({
    role: "assistant",
    content: text1?.type === "text" ? text1.text : "",
  });
  messages.push({
    role: "user",
    content: "Can you show me a quick start code example?",
  });

  const response2 = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const text2 = response2.content.find((b) => b.type === "text");
  console.log("Turn 2 Q: Can you show me a quick start code example?");
  console.log("Turn 2 A:", text2?.type === "text" ? text2.text : "");

  const cacheRead = response2.usage.cache_read_input_tokens ?? 0;
  if (cacheRead > 0) {
    console.log(`\nCache reused across turns: ${cacheRead} tokens`);
  }

  console.log("\nRAG knowledge base examples completed!");
}

main().catch(console.error);
