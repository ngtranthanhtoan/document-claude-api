# Claude API TypeScript SDK Examples

22 runnable TypeScript examples demonstrating every major feature of the Anthropic Claude API SDK.

## Setup

```bash
cd code
npm install
```

Create a `.env` file (or use the existing one) with your API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Running Examples

Run a single example:

```bash
npm run example:01    # Structured Output
npm run example:02    # Streaming
npm run example:06    # Tool Use Basics
```

Run all examples:

```bash
npm run all
```

Run specific examples by number:

```bash
npx tsx src/run-all.ts 1 2 6
```

## Example Index

| # | Name | Category | Key Concepts |
|---|------|----------|-------------|
| 01 | Structured Output | Core | JSON mode, Zod schemas, `zodOutputFormat` |
| 02 | Streaming | Core | SSE events, `for await`, streaming helpers |
| 03 | PDF Processing | Core | Document blocks, URL/base64 sources |
| 04 | Citations | Core | Text & document citations, source extraction |
| 05 | Files API | Core | Upload, retrieve, use in messages, delete |
| 06 | Tool Use Basics | Tools | Define tools, execute loop, built-in web_search |
| 07 | Vision Analysis | Core | URL/base64 images, multi-image comparison |
| 08 | RAG & Knowledge Base | Caching | Prompt caching, cache_control, multi-turn |
| 09 | Batch Processing | Batch | Create batch, poll status, retrieve results |
| 10 | Data Extraction | Tools | Invoice/receipt parsing, Zod extraction |
| 11 | Customer Support Bot | Agent | Multi-turn, 6 mock tools, conversation flow |
| 12 | Human-in-the-Loop | Agent | Approval workflows, confirmation patterns |
| 13 | Agentic Tool Loop | Agent | Manual loop, error recovery, toolRunner |
| 14 | Research Agent | Agent | Extended thinking, research workflow |
| 15 | Coding Assistant | Agent | File operations, code generation |
| 16 | MCP Connector | Beta | MCP server config, tool filtering |
| 17 | Computer Use | Beta | Desktop automation, screenshot loop |
| 18 | Memory Tool | Agent | Persistent memory across conversations |
| 19 | Agent Skills | Beta | Excel, PowerPoint, Word, PDF generation |
| 20 | Deep Agent | Agent | Orchestrator + subagent delegation |
| 21 | Full-Stack Agent | Agent | Multi-tool orchestration, web_search + code_execution |
| 22 | VFS / Container / Sandbox | Beta | Code execution, stateful containers |

## Categories

- **Core** (01-05, 07): Direct API features that work out of the box
- **Tools** (06, 10): Tool use patterns with mock handlers
- **Caching** (08): Prompt caching for RAG workflows
- **Batch** (09): Asynchronous batch processing
- **Agent** (11-15, 18, 20-21): Agentic patterns with tool loops
- **Beta** (16-17, 19, 22): Beta features (MCP, computer use, skills, code execution)

## Notes

- All examples use mock/simulated tool results where real infrastructure isn't available
- Beta examples (16, 17, 19, 22) make real API calls but handle errors gracefully if features aren't enabled for your key
- Example 09 (Batch Processing) creates a real batch job which takes time to complete
- Example 12 (Human-in-the-Loop) uses auto-approval for demo purposes (no interactive prompts)
