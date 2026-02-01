# Example 14: Research Agent

> Build a sophisticated research agent using extended thinking and multiple tools.

## Overview

- **Difficulty**: Advanced
- **Features Used**: Extended Thinking, Multi-tool, Agentic loop
- **Use Cases**:
  - Market research
  - Competitive analysis
  - Literature reviews
  - Due diligence
  - Technical research

## Prerequisites

- Claude API key set as `ANTHROPIC_API_KEY`
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
│  ├── save_note         │  search_database                   │
│  ├── create_outline    │  generate_report                   │
│  └── fact_check                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Research Request with Extended Thinking

### Request

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-opus-4-5-20251101",
    "max_tokens": 16000,
    "thinking": {
      "type": "enabled",
      "budget_tokens": 10000
    },
    "system": "You are an expert research analyst. Your role is to:\n\n1. PLAN: Break down research questions into specific queries\n2. GATHER: Use tools to collect information from multiple sources\n3. VERIFY: Cross-reference facts across sources\n4. SYNTHESIZE: Combine findings into coherent insights\n5. REPORT: Present findings with proper citations\n\nAlways think through your research strategy before starting. Save important findings as you go.",
    "tools": [
      {
        "name": "web_search",
        "description": "Search the web for current information",
        "input_schema": {
          "type": "object",
          "properties": {
            "query": {"type": "string"},
            "num_results": {"type": "integer", "default": 10},
            "date_filter": {"type": "string", "enum": ["past_day", "past_week", "past_month", "past_year"]}
          },
          "required": ["query"]
        }
      },
      {
        "name": "read_url",
        "description": "Read and extract content from a URL",
        "input_schema": {
          "type": "object",
          "properties": {
            "url": {"type": "string"},
            "extract_sections": {"type": "array", "items": {"type": "string"}, "description": "Specific sections to extract"}
          },
          "required": ["url"]
        }
      },
      {
        "name": "save_note",
        "description": "Save a research finding for later synthesis",
        "input_schema": {
          "type": "object",
          "properties": {
            "topic": {"type": "string"},
            "finding": {"type": "string"},
            "source": {"type": "string"},
            "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
            "tags": {"type": "array", "items": {"type": "string"}}
          },
          "required": ["topic", "finding"]
        }
      },
      {
        "name": "get_notes",
        "description": "Retrieve saved research notes",
        "input_schema": {
          "type": "object",
          "properties": {
            "topic": {"type": "string", "description": "Filter by topic (optional)"},
            "tags": {"type": "array", "items": {"type": "string"}}
          }
        }
      },
      {
        "name": "fact_check",
        "description": "Verify a claim against multiple sources",
        "input_schema": {
          "type": "object",
          "properties": {
            "claim": {"type": "string"},
            "original_source": {"type": "string"}
          },
          "required": ["claim"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Research the current state of quantum computing commercialization. I need to understand:\n1. Major players and their approaches\n2. Current practical applications\n3. Timeline predictions for mainstream adoption\n\nProvide a comprehensive report with sources."
      }
    ]
  }'
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

```bash
#!/bin/bash

# Research Agent with Extended Thinking

NOTES_FILE="/tmp/research_notes.json"
echo "[]" > "$NOTES_FILE"

# Tool execution
execute_tool() {
  local tool_name="$1"
  local tool_input="$2"

  case "$tool_name" in
    "web_search")
      # Mock search results
      query=$(echo "$tool_input" | jq -r '.query')
      echo '[{"title": "Result 1", "url": "https://example.com/1", "snippet": "Relevant information..."}]'
      ;;
    "read_url")
      echo '{"content": "Article content with detailed information about the topic...", "title": "Article Title"}'
      ;;
    "save_note")
      # Actually save notes
      NOTE=$(echo "$tool_input" | jq -c .)
      NOTES=$(cat "$NOTES_FILE")
      echo "$NOTES" | jq --argjson note "$NOTE" '. + [$note]' > "$NOTES_FILE"
      echo '{"status": "saved", "note_id": "'$(date +%s)'"}'
      ;;
    "get_notes")
      cat "$NOTES_FILE"
      ;;
    "fact_check")
      echo '{"verified": true, "supporting_sources": 3, "confidence": "high"}'
      ;;
    *)
      echo '{"error": "Unknown tool"}'
      ;;
  esac
}

# Research function
research() {
  local question="$1"
  local MESSAGES='[{"role": "user", "content": "'"$question"'"}]'

  local iteration=0
  local max_iterations=15

  while [ $iteration -lt $max_iterations ]; do
    iteration=$((iteration + 1))
    echo "Step $iteration..."

    RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d "$(jq -n \
        --argjson msgs "$MESSAGES" \
        '{
          model: "claude-opus-4-5-20251101",
          max_tokens: 16000,
          thinking: {type: "enabled", budget_tokens: 5000},
          system: "You are a research analyst. Use tools to gather information, save findings, and synthesize reports.",
          tools: [
            {name: "web_search", description: "Search the web", input_schema: {type: "object", properties: {query: {type: "string"}}, required: ["query"]}},
            {name: "save_note", description: "Save a finding", input_schema: {type: "object", properties: {topic: {type: "string"}, finding: {type: "string"}, source: {type: "string"}}, required: ["topic", "finding"]}},
            {name: "get_notes", description: "Get saved notes", input_schema: {type: "object", properties: {}}}
          ],
          messages: $msgs
        }')")

    STOP_REASON=$(echo "$RESPONSE" | jq -r '.stop_reason')
    CONTENT=$(echo "$RESPONSE" | jq -c '.content')

    # Show thinking
    THINKING=$(echo "$CONTENT" | jq -r '.[] | select(.type=="thinking") | .thinking' 2>/dev/null)
    if [ -n "$THINKING" ] && [ "$THINKING" != "null" ]; then
      echo "[Thinking: ${THINKING:0:100}...]"
    fi

    if [ "$STOP_REASON" = "end_turn" ]; then
      echo ""
      echo "=== RESEARCH REPORT ==="
      echo "$RESPONSE" | jq -r '.content[] | select(.type=="text") | .text'
      return
    fi

    # Handle tools
    MESSAGES=$(echo "$MESSAGES" | jq --argjson content "$CONTENT" '. + [{"role": "assistant", "content": $content}]')

    TOOL_RESULTS="[]"
    for tool in $(echo "$CONTENT" | jq -c '.[] | select(.type=="tool_use")'); do
      TOOL_NAME=$(echo "$tool" | jq -r '.name')
      TOOL_ID=$(echo "$tool" | jq -r '.id')
      TOOL_INPUT=$(echo "$tool" | jq -c '.input')

      echo "  -> $TOOL_NAME"
      RESULT=$(execute_tool "$TOOL_NAME" "$TOOL_INPUT")
      TOOL_RESULTS=$(echo "$TOOL_RESULTS" | jq --arg id "$TOOL_ID" --arg r "$RESULT" '. + [{"type": "tool_result", "tool_use_id": $id, "content": $r}]')
    done

    MESSAGES=$(echo "$MESSAGES" | jq --argjson results "$TOOL_RESULTS" '. + [{"role": "user", "content": $results}]')
  done
}

# Run research
research "Analyze the competitive landscape of electric vehicle charging networks in North America"
```

---

## Best Practices

1. **Use Extended Thinking**: For complex research, thinking helps Claude plan systematically.

2. **Save Findings Incrementally**: Don't rely on Claude's memory—save notes as you go.

3. **Cross-Reference Sources**: Use fact-checking for important claims.

4. **Structure the Final Report**: Request specific sections for consistent output.

5. **Set Appropriate Thinking Budget**: 5000-10000 tokens for complex research.

---

## Related Examples

- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Basic autonomous agents
- [Example 08: RAG Knowledge Base](example-08-rag-knowledge-base.md) - Document research
- [Example 04: Citations](example-04-citations.md) - Source attribution
