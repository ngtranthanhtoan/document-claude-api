# Example 12: Human in the Loop

> Implement approval patterns for sensitive actions requiring human confirmation.

## Overview

- **Difficulty**: Advanced
- **Features Used**: Tool Use, Approval patterns
- **SDK Methods**: `client.messages.create()`
- **Use Cases**:
  - Financial transactions
  - Data deletion
  - External API calls with side effects
  - Email/notification sending
  - Production deployments
  - Access control decisions

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- Understanding of tool use

---

## Human-in-the-Loop Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │ ──> │  Request    │ ──> │   Human     │
│   proposes  │     │  Approval   │     │   Reviews   │
│   action    │     │  (tool)     │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
      ┌────────────────────────────────────────┘
      │
      ▼
┌─────────────┐     ┌─────────────┐
│  Approved?  │ ──> │   Execute   │
│  Yes / No   │     │   Action    │
└─────────────┘     └─────────────┘
```

---

## Pattern 1: Approval Tool

Define an explicit approval tool that Claude must use before sensitive actions.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const systemPrompt =
  "You are a helpful assistant that can perform actions on behalf of the user. " +
  "IMPORTANT: For any action that modifies data, sends communications, or involves money, " +
  "you MUST first use the request_approval tool and wait for approval before proceeding. " +
  "Never execute sensitive actions without explicit approval.";

const tools: Anthropic.Tool[] = [
  {
    name: "request_approval",
    description:
      "Request human approval before performing a sensitive action. Use this before any action that modifies data, sends messages, or involves financial transactions.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          description: "Clear description of the action to be performed",
        },
        reason: {
          type: "string",
          description: "Why this action is necessary",
        },
        risk_level: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Risk level of the action",
        },
        reversible: {
          type: "boolean",
          description: "Whether this action can be undone",
        },
        affected_resources: {
          type: "array",
          items: { type: "string" },
          description: "List of resources that will be affected",
        },
      },
      required: ["action", "reason", "risk_level", "reversible"],
    },
  },
  {
    name: "send_email",
    description: "Send an email. Requires prior approval.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "delete_records",
    description: "Delete records from database. Requires prior approval.",
    input_schema: {
      type: "object" as const,
      properties: {
        table: { type: "string" },
        condition: { type: "string" },
        count: {
          type: "integer",
          description: "Number of records to delete",
        },
      },
      required: ["table", "condition", "count"],
    },
  },
  {
    name: "transfer_funds",
    description:
      "Transfer money between accounts. Requires prior approval.",
    input_schema: {
      type: "object" as const,
      properties: {
        from_account: { type: "string" },
        to_account: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
      },
      required: ["from_account", "to_account", "amount", "currency"],
    },
  },
];

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system: systemPrompt,
  tools,
  messages: [
    {
      role: "user",
      content:
        "Please send an email to the team at team@company.com announcing that the server maintenance is scheduled for tonight at 10 PM.",
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
console.log("Content:", JSON.stringify(message.content, null, 2));
```

### Response (Requests Approval)

```json
{
  "content": [
    {
      "type": "text",
      "text": "I'll help you send that maintenance announcement. First, let me request your approval since this involves sending external communications."
    },
    {
      "type": "tool_use",
      "id": "toolu_approval_01",
      "name": "request_approval",
      "input": {
        "action": "Send email to team@company.com with subject 'Server Maintenance Tonight at 10 PM' announcing scheduled maintenance",
        "reason": "User requested to notify the team about scheduled server maintenance",
        "risk_level": "low",
        "reversible": false,
        "affected_resources": ["team@company.com"]
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## Handling Approval Response

### Approved

```typescript
const messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content: "Please send an email to the team...",
  },
  {
    role: "assistant",
    content: [
      {
        type: "text",
        text: "I'll help you send that maintenance announcement...",
      },
      {
        type: "tool_use",
        id: "toolu_approval_01",
        name: "request_approval",
        input: {
          action: "Send email to team@company.com...",
          reason: "User requested to notify the team...",
          risk_level: "low",
          reversible: false,
        },
      },
    ],
  },
  {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "toolu_approval_01",
        content: JSON.stringify({
          approved: true,
          approved_by: "admin@company.com",
          timestamp: "2024-01-15T10:30:00Z",
          notes: "Approved for maintenance notification",
        }),
      },
    ],
  },
];

const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system: systemPrompt,
  tools,
  messages,
});
```

### Claude Proceeds with Action

```json
{
  "content": [
    {
      "type": "text",
      "text": "Thank you for the approval. I'll now send the email."
    },
    {
      "type": "tool_use",
      "id": "toolu_email_01",
      "name": "send_email",
      "input": {
        "to": "team@company.com",
        "subject": "Server Maintenance Tonight at 10 PM",
        "body": "Hi Team,\n\nThis is to inform you that server maintenance has been scheduled for tonight at 10 PM. Please save your work and expect brief service interruptions.\n\nThank you for your understanding.\n\nBest regards"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

### Denied

```typescript
// Send denial as the tool result
{
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: "toolu_approval_01",
      content: JSON.stringify({
        approved: false,
        denied_by: "admin@company.com",
        reason: "Need to wait until tomorrow to notify team"
      })
    }
  ]
}
```

### Claude Handles Denial

```json
{
  "content": [
    {
      "type": "text",
      "text": "I understand. The approval was denied with the note that we need to wait until tomorrow to notify the team. I won't send the email now. Would you like me to set a reminder or help you draft a revised message for tomorrow?"
    }
  ],
  "stop_reason": "end_turn"
}
```

---

## Pattern 2: Confirmation Code

Require a confirmation code for high-value transactions.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system: `You are a financial assistant. For any transaction over $100, you must:
1. Use get_confirmation_code to generate a code
2. Wait for the user to confirm the code
3. Only then execute the transaction with the confirmed code`,
  tools: [
    {
      name: "get_confirmation_code",
      description:
        "Generate a confirmation code for high-value transactions. The code must be verified before proceeding.",
      input_schema: {
        type: "object" as const,
        properties: {
          transaction_type: { type: "string" },
          amount: { type: "number" },
          description: { type: "string" },
        },
        required: ["transaction_type", "amount", "description"],
      },
    },
    {
      name: "execute_transaction",
      description:
        "Execute a financial transaction. Requires confirmation_code for amounts over $100.",
      input_schema: {
        type: "object" as const,
        properties: {
          type: {
            type: "string",
            enum: ["transfer", "payment", "withdrawal"],
          },
          amount: { type: "number" },
          destination: { type: "string" },
          confirmation_code: { type: "string" },
        },
        required: ["type", "amount", "destination"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "Transfer $500 to account 1234-5678 for the consulting invoice",
    },
  ],
});

console.log(JSON.stringify(message.content, null, 2));
```

### Flow

1. Claude calls `get_confirmation_code`
2. Your system generates code (e.g., "CONF-ABC123") and sends to user
3. User confirms by saying "I confirm CONF-ABC123"
4. Claude calls `execute_transaction` with the code

---

## Pattern 3: Multi-Level Approval

Different actions require different approval levels.

### Request

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system: `You are an operations assistant. Different actions require different approval levels:

- LEVEL 1 (Team Lead): Actions under $1000, non-critical systems
- LEVEL 2 (Manager): Actions $1000-$10000, production systems
- LEVEL 3 (Director): Actions over $10000, customer data, security changes

Always request the appropriate approval level.`,
  tools: [
    {
      name: "request_approval",
      description: "Request approval at the specified level",
      input_schema: {
        type: "object" as const,
        properties: {
          level: {
            type: "integer",
            enum: [1, 2, 3],
          },
          action: { type: "string" },
          justification: { type: "string" },
          impact_assessment: { type: "string" },
        },
        required: ["level", "action", "justification"],
      },
    },
    {
      name: "modify_production_database",
      description:
        "Make changes to production database. Requires Level 2+ approval.",
      input_schema: {
        type: "object" as const,
        properties: {
          query: { type: "string" },
          approval_id: { type: "string" },
        },
        required: ["query", "approval_id"],
      },
    },
  ],
  messages: [
    {
      role: "user",
      content:
        "We need to update the pricing for all products by 10%",
    },
  ],
});

console.log(JSON.stringify(message.content, null, 2));
```

---

## Audit Logging

Always log approval decisions for compliance.

### Approval Response with Audit Info

```json
{
  "approved": true,
  "approved_by": "jane.doe@company.com",
  "approver_role": "Engineering Manager",
  "timestamp": "2024-01-15T10:30:00Z",
  "approval_id": "APR-2024-0042",
  "audit_log": {
    "request_id": "REQ-123",
    "ip_address": "192.168.1.100",
    "user_agent": "Company Dashboard v2.1",
    "session_id": "sess_abc123"
  },
  "conditions": [
    "Must complete within 24 hours",
    "Notify security team after completion"
  ]
}
```

---

## Complete Human-in-the-Loop Script

A full interactive script that prompts the operator for approval before executing sensitive actions.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline/promises";

const client = new Anthropic();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let messages: Anthropic.MessageParam[] = [];

const systemPrompt =
  "You are a helpful assistant. For any action that could have side effects " +
  "(sending emails, modifying data, transactions), use request_approval first.";

const tools: Anthropic.Tool[] = [
  {
    name: "request_approval",
    description:
      "Request approval for sensitive actions",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        risk_level: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        details: { type: "string" },
      },
      required: ["action", "risk_level"],
    },
  },
  {
    name: "send_email",
    description: "Send an email",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "delete_records",
    description: "Delete records from database",
    input_schema: {
      type: "object" as const,
      properties: {
        table: { type: "string" },
        condition: { type: "string" },
        count: { type: "integer" },
      },
      required: ["table", "condition", "count"],
    },
  },
  {
    name: "transfer_funds",
    description: "Transfer money between accounts",
    input_schema: {
      type: "object" as const,
      properties: {
        from_account: { type: "string" },
        to_account: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
      },
      required: ["from_account", "to_account", "amount", "currency"],
    },
  },
];

// Get human approval interactively
async function getHumanApproval(
  action: string,
  riskLevel: string
): Promise<string> {
  console.log("\n=== APPROVAL REQUIRED ===");
  console.log(`Action: ${action}`);
  console.log(`Risk Level: ${riskLevel}`);
  console.log("=========================");

  const answer = await rl.question("Approve? (yes/no): ");

  if (answer.toLowerCase() === "yes") {
    return JSON.stringify({
      approved: true,
      approved_by: "operator",
      timestamp: new Date().toISOString(),
    });
  }

  const reason = await rl.question("Reason for denial: ");
  return JSON.stringify({
    approved: false,
    denied_by: "operator",
    reason,
    timestamp: new Date().toISOString(),
  });
}

// Execute non-approval tools (mock)
function executeTool(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "send_email":
      console.log(`  [Sending email to ${input.to}]`);
      return JSON.stringify({
        status: "sent",
        message_id: "msg_123",
        timestamp: new Date().toISOString(),
      });
    case "delete_records":
      console.log(`  [Deleting ${input.count} records from ${input.table}]`);
      return JSON.stringify({
        status: "deleted",
        count: input.count,
        timestamp: new Date().toISOString(),
      });
    case "transfer_funds":
      console.log(`  [Transferring ${input.amount} ${input.currency}]`);
      return JSON.stringify({
        status: "completed",
        transaction_id: "txn_456",
        timestamp: new Date().toISOString(),
      });
    default:
      return JSON.stringify({ error: "Tool not implemented" });
  }
}

// Chat function with approval handling
async function chat(userMessage: string): Promise<void> {
  messages.push({ role: "user", content: userMessage });

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    // Add assistant response to conversation
    messages.push({ role: "assistant", content: response.content });

    // If Claude is done, print text and break
    if (response.stop_reason === "end_turn") {
      for (const block of response.content) {
        if (block.type === "text") {
          console.log(`\nAssistant: ${block.text}\n`);
        }
      }
      break;
    }

    // Handle tool use
    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          let result: string;

          if (block.name === "request_approval") {
            // This tool requires human interaction
            const input = block.input as Record<string, unknown>;
            result = await getHumanApproval(
              input.action as string,
              input.risk_level as string
            );
          } else {
            // Execute the action tool
            result = executeTool(
              block.name,
              block.input as Record<string, unknown>
            );
          }

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

// Main interactive loop
console.log("Human-in-the-Loop Demo (type 'quit' to exit)");
console.log("---");

while (true) {
  const input = await rl.question("You: ");
  if (input.toLowerCase() === "quit") break;
  await chat(input);
  console.log("---");
}

rl.close();
console.log("Session ended.");
```

---

## Best Practices

1. **Clear Action Descriptions**: Explain exactly what will happen.

2. **Include Risk Assessment**: Help approvers understand impact.

3. **Timeout Approvals**: Don't wait forever for approval.

4. **Log Everything**: Maintain audit trail for compliance.

5. **Graceful Denial Handling**: Claude should handle "no" responses well.

---

## Related Examples

- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool fundamentals
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Autonomous workflows
- [Example 11: Customer Support Bot](example-11-customer-support-bot.md) - Escalation patterns
