# Example 12: Human in the Loop

> Implement approval patterns for sensitive actions requiring human confirmation.

## Overview

- **Difficulty**: Advanced
- **Features Used**: Tool Use, Approval patterns
- **Use Cases**:
  - Financial transactions
  - Data deletion
  - External API calls with side effects
  - Email/notification sending
  - Production deployments
  - Access control decisions

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "system": "You are a helpful assistant that can perform actions on behalf of the user. IMPORTANT: For any action that modifies data, sends communications, or involves money, you MUST first use the request_approval tool and wait for approval before proceeding. Never execute sensitive actions without explicit approval.",
    "tools": [
      {
        "name": "request_approval",
        "description": "Request human approval before performing a sensitive action. Use this before any action that modifies data, sends messages, or involves financial transactions.",
        "input_schema": {
          "type": "object",
          "properties": {
            "action": {
              "type": "string",
              "description": "Clear description of the action to be performed"
            },
            "reason": {
              "type": "string",
              "description": "Why this action is necessary"
            },
            "risk_level": {
              "type": "string",
              "enum": ["low", "medium", "high"],
              "description": "Risk level of the action"
            },
            "reversible": {
              "type": "boolean",
              "description": "Whether this action can be undone"
            },
            "affected_resources": {
              "type": "array",
              "items": {"type": "string"},
              "description": "List of resources that will be affected"
            }
          },
          "required": ["action", "reason", "risk_level", "reversible"]
        }
      },
      {
        "name": "send_email",
        "description": "Send an email. Requires prior approval.",
        "input_schema": {
          "type": "object",
          "properties": {
            "to": {"type": "string"},
            "subject": {"type": "string"},
            "body": {"type": "string"}
          },
          "required": ["to", "subject", "body"]
        }
      },
      {
        "name": "delete_records",
        "description": "Delete records from database. Requires prior approval.",
        "input_schema": {
          "type": "object",
          "properties": {
            "table": {"type": "string"},
            "condition": {"type": "string"},
            "count": {"type": "integer", "description": "Number of records to delete"}
          },
          "required": ["table", "condition", "count"]
        }
      },
      {
        "name": "transfer_funds",
        "description": "Transfer money between accounts. Requires prior approval.",
        "input_schema": {
          "type": "object",
          "properties": {
            "from_account": {"type": "string"},
            "to_account": {"type": "string"},
            "amount": {"type": "number"},
            "currency": {"type": "string"}
          },
          "required": ["from_account", "to_account", "amount", "currency"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Please send an email to the team at team@company.com announcing that the server maintenance is scheduled for tonight at 10 PM."
      }
    ]
  }'
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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "tools": [...],
    "messages": [
      {"role": "user", "content": "Please send an email to the team..."},
      {"role": "assistant", "content": [
        {"type": "text", "text": "I will help you send that..."},
        {"type": "tool_use", "id": "toolu_approval_01", "name": "request_approval", "input": {...}}
      ]},
      {"role": "user", "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_approval_01",
          "content": "{\"approved\": true, \"approved_by\": \"admin@company.com\", \"timestamp\": \"2024-01-15T10:30:00Z\", \"notes\": \"Approved for maintenance notification\"}"
        }
      ]}
    ]
  }'
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

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_approval_01",
  "content": "{\"approved\": false, \"denied_by\": \"admin@company.com\", \"reason\": \"Need to wait until tomorrow to notify team\"}"
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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "system": "You are a financial assistant. For any transaction over $100, you must:\n1. Use get_confirmation_code to generate a code\n2. Wait for the user to confirm the code\n3. Only then execute the transaction with the confirmed code",
    "tools": [
      {
        "name": "get_confirmation_code",
        "description": "Generate a confirmation code for high-value transactions. The code must be verified before proceeding.",
        "input_schema": {
          "type": "object",
          "properties": {
            "transaction_type": {"type": "string"},
            "amount": {"type": "number"},
            "description": {"type": "string"}
          },
          "required": ["transaction_type", "amount", "description"]
        }
      },
      {
        "name": "execute_transaction",
        "description": "Execute a financial transaction. Requires confirmation_code for amounts over $100.",
        "input_schema": {
          "type": "object",
          "properties": {
            "type": {"type": "string", "enum": ["transfer", "payment", "withdrawal"]},
            "amount": {"type": "number"},
            "destination": {"type": "string"},
            "confirmation_code": {"type": "string"}
          },
          "required": ["type", "amount", "destination"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Transfer $500 to account 1234-5678 for the consulting invoice"
      }
    ]
  }'
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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "system": "You are an operations assistant. Different actions require different approval levels:\n\n- LEVEL 1 (Team Lead): Actions under $1000, non-critical systems\n- LEVEL 2 (Manager): Actions $1000-$10000, production systems\n- LEVEL 3 (Director): Actions over $10000, customer data, security changes\n\nAlways request the appropriate approval level.",
    "tools": [
      {
        "name": "request_approval",
        "description": "Request approval at the specified level",
        "input_schema": {
          "type": "object",
          "properties": {
            "level": {"type": "integer", "enum": [1, 2, 3]},
            "action": {"type": "string"},
            "justification": {"type": "string"},
            "impact_assessment": {"type": "string"}
          },
          "required": ["level", "action", "justification"]
        }
      },
      {
        "name": "modify_production_database",
        "description": "Make changes to production database. Requires Level 2+ approval.",
        "input_schema": {
          "type": "object",
          "properties": {
            "query": {"type": "string"},
            "approval_id": {"type": "string"}
          },
          "required": ["query", "approval_id"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "We need to update the pricing for all products by 10%"
      }
    ]
  }'
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
  "conditions": ["Must complete within 24 hours", "Notify security team after completion"]
}
```

---

## Complete Human-in-the-Loop Script

```bash
#!/bin/bash

# Human-in-the-Loop Workflow Script

# Function to get human approval
get_human_approval() {
  local action="$1"
  local risk="$2"

  echo ""
  echo "╔════════════════════════════════════════════════════╗"
  echo "║          APPROVAL REQUIRED                          ║"
  echo "╠════════════════════════════════════════════════════╣"
  echo "║ Action: $action"
  echo "║ Risk Level: $risk"
  echo "╚════════════════════════════════════════════════════╝"
  echo ""
  read -p "Approve this action? (yes/no): " response

  if [[ "$response" == "yes" ]]; then
    echo '{"approved": true, "approved_by": "operator", "timestamp": "'$(date -Iseconds)'"}'
  else
    read -p "Reason for denial: " reason
    echo '{"approved": false, "denied_by": "operator", "reason": "'"$reason"'"}'
  fi
}

# Main conversation loop with approval handling
MESSAGES="[]"

chat_with_approval() {
  local user_input="$1"

  # Add user message
  MESSAGES=$(echo "$MESSAGES" | jq --arg msg "$user_input" '. + [{"role": "user", "content": $msg}]')

  while true; do
    # Call Claude
    RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d "$(jq -n --argjson msgs "$MESSAGES" '{
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 2048,
        system: "You are a helpful assistant. For any action that could have side effects (sending emails, modifying data, transactions), use request_approval first.",
        tools: [
          {name: "request_approval", description: "Request approval for sensitive actions", input_schema: {type: "object", properties: {action: {type: "string"}, risk_level: {type: "string"}}, required: ["action", "risk_level"]}},
          {name: "send_email", description: "Send an email", input_schema: {type: "object", properties: {to: {type: "string"}, subject: {type: "string"}, body: {type: "string"}}, required: ["to", "subject", "body"]}}
        ],
        messages: $msgs
      }')")

    STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
    CONTENT=$(echo "$RESPONSE" | jq -c '.content')

    # Add assistant response
    MESSAGES=$(echo "$MESSAGES" | jq --argjson content "$CONTENT" '. + [{"role": "assistant", "content": $content}]')

    # Handle end_turn
    if [[ "$STOP_REASON" == "end_turn" ]]; then
      echo "$RESPONSE" | jq -r '.content[] | select(.type=="text") | .text'
      break
    fi

    # Handle tool_use
    if [[ "$STOP_REASON" == "tool_use" ]]; then
      TOOL_RESULTS="[]"

      for tool_call in $(echo "$CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
        TOOL_NAME=$(echo "$tool_call" | jq -r '.name')
        TOOL_ID=$(echo "$tool_call" | jq -r '.id')
        TOOL_INPUT=$(echo "$tool_call" | jq -c '.input')

        if [[ "$TOOL_NAME" == "request_approval" ]]; then
          ACTION=$(echo "$TOOL_INPUT" | jq -r '.action')
          RISK=$(echo "$TOOL_INPUT" | jq -r '.risk_level')
          RESULT=$(get_human_approval "$ACTION" "$RISK")
        else
          # Check if we have approval (in real system, verify approval token)
          RESULT='{"status": "executed", "timestamp": "'$(date -Iseconds)'"}'
        fi

        TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq --arg id "$TOOL_ID" --arg result "$RESULT" '. + [{"type": "tool_result", "tool_use_id": $id, "content": $result}]')
      done

      MESSAGES=$(echo "$MESSAGES" | jq --argjson results "$TOOL_RESULTS" '. + [{"role": "user", "content": $results}]')
    fi
  done
}

# Run
echo "Human-in-the-Loop Demo"
echo "Type 'quit' to exit"
echo ""

while true; do
  read -p "You: " input
  [[ "$input" == "quit" ]] && break
  chat_with_approval "$input"
  echo ""
done
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
