# Example 11: Customer Support Bot

> Build a complete customer support assistant with multi-turn conversations, tools, and sentiment awareness.

## Overview

- **Difficulty**: Advanced
- **Features Used**: System prompts, Multi-turn, Tool Use
- **Use Cases**:
  - Customer service automation
  - Ticket management
  - Order tracking
  - FAQ handling
  - Escalation workflows

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
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

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "system": "You are a friendly and helpful customer support agent for TechStore, an online electronics retailer. Follow these guidelines:\n\n1. TONE: Be warm, empathetic, and professional. Acknowledge customer frustrations.\n2. EFFICIENCY: Get to solutions quickly while being thorough.\n3. TOOLS: Use available tools to look up information before responding.\n4. ESCALATION: If a customer asks for a manager or you cannot resolve the issue, use the escalate_to_human tool.\n5. REFUNDS: You can process refunds up to $100. For larger amounts, escalate.\n6. PRIVACY: Never share full account details. Only confirm last 4 digits of payment methods.\n\nStore policies:\n- 30-day return policy\n- Free shipping on orders over $50\n- Price match within 14 days of purchase",
    "tools": [
      {
        "name": "lookup_order",
        "description": "Look up order details by order ID or customer email",
        "input_schema": {
          "type": "object",
          "properties": {
            "order_id": {"type": "string"},
            "email": {"type": "string"}
          }
        }
      },
      {
        "name": "check_account_status",
        "description": "Check customer account status and history",
        "input_schema": {
          "type": "object",
          "properties": {
            "email": {"type": "string", "description": "Customer email address"}
          },
          "required": ["email"]
        }
      },
      {
        "name": "create_ticket",
        "description": "Create a support ticket for follow-up",
        "input_schema": {
          "type": "object",
          "properties": {
            "customer_email": {"type": "string"},
            "category": {"type": "string", "enum": ["billing", "shipping", "product", "technical", "general"]},
            "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
            "summary": {"type": "string"},
            "details": {"type": "string"}
          },
          "required": ["customer_email", "category", "priority", "summary"]
        }
      },
      {
        "name": "process_refund",
        "description": "Process a refund for an order. Limited to $100 max.",
        "input_schema": {
          "type": "object",
          "properties": {
            "order_id": {"type": "string"},
            "amount": {"type": "number", "description": "Refund amount in USD"},
            "reason": {"type": "string"}
          },
          "required": ["order_id", "amount", "reason"]
        }
      },
      {
        "name": "escalate_to_human",
        "description": "Escalate to a human agent when you cannot resolve the issue",
        "input_schema": {
          "type": "object",
          "properties": {
            "customer_email": {"type": "string"},
            "reason": {"type": "string"},
            "urgency": {"type": "string", "enum": ["normal", "high", "critical"]},
            "conversation_summary": {"type": "string"}
          },
          "required": ["customer_email", "reason", "urgency"]
        }
      },
      {
        "name": "search_knowledge_base",
        "description": "Search the FAQ and knowledge base for answers",
        "input_schema": {
          "type": "object",
          "properties": {
            "query": {"type": "string"}
          },
          "required": ["query"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Hi, I ordered a laptop 2 weeks ago (order #ORD-12345) and it still has not arrived. This is really frustrating! My email is john@example.com"
      }
    ]
  }'
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

### Turn 1: Initial Complaint → Lookup Order

```bash
# (First request as shown above)
# Claude calls lookup_order tool
```

### Turn 2: Send Tool Result

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "system": "[Same system prompt as above]",
    "tools": [...],
    "messages": [
      {
        "role": "user",
        "content": "Hi, I ordered a laptop 2 weeks ago (order #ORD-12345) and it still has not arrived..."
      },
      {
        "role": "assistant",
        "content": [
          {"type": "text", "text": "I completely understand your frustration..."},
          {"type": "tool_use", "id": "toolu_01ABC", "name": "lookup_order", "input": {"order_id": "ORD-12345", "email": "john@example.com"}}
        ]
      },
      {
        "role": "user",
        "content": [
          {
            "type": "tool_result",
            "tool_use_id": "toolu_01ABC",
            "content": "{\"order_id\": \"ORD-12345\", \"status\": \"shipped\", \"shipped_date\": \"2024-01-10\", \"carrier\": \"FedEx\", \"tracking\": \"789456123\", \"estimated_delivery\": \"2024-01-15\", \"current_status\": \"In transit - delayed at distribution center\", \"items\": [{\"name\": \"ProBook Laptop 15\", \"price\": 899.99}], \"customer\": {\"name\": \"John Smith\", \"email\": \"john@example.com\"}}"
          }
        ]
      }
    ]
  }'
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

```bash
# Customer responds: "This is unacceptable. I want a full refund."

# Claude will use escalate_to_human since refund is over $100
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

Adjust tone based on customer emotion.

### Frustrated Customer

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250514",
    "max_tokens": 2048,
    "system": "You are a customer support agent. Detect customer sentiment and adjust your response accordingly:\n- Frustrated/Angry: Lead with empathy, acknowledge feelings, prioritize solutions\n- Confused: Be patient, use simple language, offer step-by-step guidance\n- Happy: Match their energy, thank them, ask if there is anything else\n- Neutral: Be efficient and helpful",
    "messages": [
      {
        "role": "user",
        "content": "THIS IS THE THIRD TIME IM CONTACTING YOU!!! Nobody can figure out why my account is locked!!! I have been a customer for 5 YEARS and this is how you treat me?!"
      }
    ]
  }'
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

```bash
#!/bin/bash

# Customer Support Bot
# Maintains conversation state and handles tool execution

CONVERSATION_FILE="/tmp/support_conversation.json"
echo "[]" > "$CONVERSATION_FILE"

# Tool execution function (mock)
execute_tool() {
  local tool_name="$1"
  local tool_input="$2"

  case "$tool_name" in
    "lookup_order")
      echo '{"order_id": "ORD-12345", "status": "shipped", "tracking": "789456123", "customer": {"name": "John"}}'
      ;;
    "create_ticket")
      echo '{"ticket_id": "TKT-98765", "status": "created", "estimated_response": "2 hours"}'
      ;;
    "escalate_to_human")
      echo '{"escalation_id": "ESC-111", "status": "queued", "position": 3, "estimated_wait": "5 minutes"}'
      ;;
    *)
      echo '{"error": "Tool not implemented"}'
      ;;
  esac
}

# Chat function
chat() {
  local user_message="$1"

  # Add user message to conversation
  MESSAGES=$(cat "$CONVERSATION_FILE")
  MESSAGES=$(echo "$MESSAGES" | jq --arg msg "$user_message" '. + [{"role": "user", "content": $msg}]')
  echo "$MESSAGES" > "$CONVERSATION_FILE"

  # Call API
  while true; do
    RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d "$(jq -n \
        --argjson messages "$MESSAGES" \
        '{
          model: "claude-sonnet-4-5-20250514",
          max_tokens: 2048,
          system: "You are a helpful customer support agent.",
          tools: [
            {name: "lookup_order", description: "Look up order details", input_schema: {type: "object", properties: {order_id: {type: "string"}}}},
            {name: "create_ticket", description: "Create support ticket", input_schema: {type: "object", properties: {summary: {type: "string"}}}}
          ],
          messages: $messages
        }')")

    STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
    CONTENT=$(echo "$RESPONSE" | jq -c '.content')

    # Add assistant response
    MESSAGES=$(echo "$MESSAGES" | jq --argjson content "$CONTENT" '. + [{"role": "assistant", "content": $content}]')

    if [[ "$STOP_REASON" == "end_turn" ]]; then
      # Print final text response
      echo "$RESPONSE" | jq -r '.content[] | select(.type=="text") | .text'
      echo "$MESSAGES" > "$CONVERSATION_FILE"
      break
    fi

    if [[ "$STOP_REASON" == "tool_use" ]]; then
      # Execute tools and continue
      TOOL_RESULTS="[]"
      for tool_call in $(echo "$CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
        TOOL_NAME=$(echo "$tool_call" | jq -r '.name')
        TOOL_ID=$(echo "$tool_call" | jq -r '.id')
        TOOL_INPUT=$(echo "$tool_call" | jq -c '.input')

        RESULT=$(execute_tool "$TOOL_NAME" "$TOOL_INPUT")
        TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq --arg id "$TOOL_ID" --arg result "$RESULT" '. + [{"type": "tool_result", "tool_use_id": $id, "content": $result}]')
      done

      MESSAGES=$(echo "$MESSAGES" | jq --argjson results "$TOOL_RESULTS" '. + [{"role": "user", "content": $results}]')
    fi
  done
}

# Interactive loop
echo "Customer Support Bot (type 'exit' to quit)"
echo "---"
while true; do
  read -p "Customer: " input
  [[ "$input" == "exit" ]] && break
  echo ""
  echo "Agent:"
  chat "$input"
  echo ""
  echo "---"
done
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
