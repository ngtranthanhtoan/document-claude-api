import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader } from "./utils.js";

const client = new Anthropic();

const systemPrompt = `You are a helpful assistant that can perform actions.
IMPORTANT: For any action that modifies data, sends communications, or involves money,
you MUST first use the request_approval tool and wait for approval before proceeding.
Never execute sensitive actions without explicit approval.`;

const tools: Anthropic.Tool[] = [
  {
    name: "request_approval",
    description: "Request human approval before performing a sensitive action",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", description: "Clear description of the action" },
        reason: { type: "string", description: "Why this action is necessary" },
        risk_level: { type: "string", enum: ["low", "medium", "high"] },
        reversible: { type: "boolean", description: "Can this be undone?" },
        affected_resources: { type: "array", items: { type: "string" } },
      },
      required: ["action", "reason", "risk_level", "reversible"],
    },
  },
  {
    name: "send_email",
    description: "Send an email to a recipient",
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
    name: "transfer_funds",
    description: "Transfer funds between accounts",
    input_schema: {
      type: "object" as const,
      properties: {
        from_account: { type: "string" },
        to_account: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
      },
      required: ["from_account", "to_account", "amount"],
    },
  },
  {
    name: "delete_records",
    description: "Delete records from the database",
    input_schema: {
      type: "object" as const,
      properties: {
        table: { type: "string" },
        filter: { type: "string" },
        count: { type: "number" },
      },
      required: ["table", "filter"],
    },
  },
];

// Track approval state for demo
let approvalDecision = true; // Auto-approve for demo
let approvalCount = 0;

function executeTool(name: string, input: Record<string, unknown>): string {
  console.log(`  [Tool Call] ${name}`);

  switch (name) {
    case "request_approval": {
      approvalCount++;
      console.log("\n  ╔══════════════════════════════════════╗");
      console.log("  ║       APPROVAL REQUIRED               ║");
      console.log("  ╠══════════════════════════════════════╣");
      console.log(`  ║ Action: ${input.action}`);
      console.log(`  ║ Reason: ${input.reason}`);
      console.log(`  ║ Risk:   ${input.risk_level}`);
      console.log(`  ║ Reversible: ${input.reversible}`);
      if (input.affected_resources) {
        console.log(`  ║ Resources: ${(input.affected_resources as string[]).join(", ")}`);
      }
      console.log("  ╚══════════════════════════════════════╝");

      // Auto-approve first two, deny third for demo
      const approved = approvalCount <= 2;
      console.log(`  >>> Auto-${approved ? "APPROVED" : "DENIED"} (demo mode)\n`);

      return JSON.stringify({
        approved,
        approved_by: approved ? "operator" : undefined,
        denied_by: approved ? undefined : "operator",
        reason: approved ? undefined : "Budget exceeded for this quarter",
        timestamp: new Date().toISOString(),
      });
    }
    case "send_email":
      console.log(`  [Mock] Sending email to ${input.to}: "${input.subject}"`);
      return JSON.stringify({ status: "sent", message_id: "MSG-12345" });
    case "transfer_funds":
      console.log(`  [Mock] Transferring $${input.amount} from ${input.from_account} to ${input.to_account}`);
      return JSON.stringify({
        status: "completed",
        transaction_id: "TXN-67890",
        amount: input.amount,
      });
    case "delete_records":
      console.log(`  [Mock] Deleting records from ${input.table} where ${input.filter}`);
      return JSON.stringify({ status: "deleted", records_affected: input.count || 5 });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function runWithApproval(userMessage: string): Promise<void> {
  console.log(`\nUser: ${userMessage}`);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  for (let i = 0; i < 10; i++) {
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
        if (block.type === "text") console.log(`Assistant: ${block.text}`);
      }
      return;
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
  // ─── Scenario 1: Approved Action (Send Email) ───
  printHeader("Scenario 1: Send Email (Approved)");
  approvalCount = 0;
  await runWithApproval(
    "Send an email to team@company.com with subject 'Q4 Report Ready' telling them the quarterly report is available for review."
  );

  // ─── Scenario 2: Approved Action (Transfer Funds) ───
  printHeader("Scenario 2: Transfer Funds (Approved)");
  await runWithApproval(
    "Transfer $500 from the marketing budget (ACCT-001) to the events fund (ACCT-002) for the upcoming conference."
  );

  // ─── Scenario 3: Denied Action ───
  printHeader("Scenario 3: Delete Records (Denied)");
  await runWithApproval(
    "Delete all inactive user records from the users table that haven't logged in since 2023."
  );

  console.log("\nHuman-in-the-loop examples completed!");
}

main().catch(console.error);
