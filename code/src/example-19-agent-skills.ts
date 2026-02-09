import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── Overview ───
  printHeader("Agent Skills: Document Generation (Excel, PowerPoint, Word, PDF)");

  console.log(`
Agent Skills extend Claude's capabilities with pre-built modules:
  - pptx: Create and edit PowerPoint presentations
  - xlsx: Create spreadsheets, analyze data, generate charts
  - docx: Create and format Word documents
  - pdf:  Generate formatted PDF documents

Skills use the Code Execution tool with a container that has skill files pre-loaded.
`);

  // ─── Method 1: Create an Excel File ───
  printHeader("Method 1: Create an Excel Spreadsheet");

  try {
    const response = await client.beta.messages.create(
      {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        container: {
          skills: [
            { type: "anthropic", skill_id: "xlsx", version: "latest" },
          ],
        },
        tools: [
          {
            type: "code_execution_20250825",
            name: "code_execution",
          },
        ],
        messages: [
          {
            role: "user",
            content:
              "Create a simple Excel spreadsheet with a sales report. Include columns: Month, Revenue, Expenses, Profit. Add data for Q1 2025 (Jan-Mar) with sample numbers. Add a total row.",
          },
        ],
      },
      { betas: ["code-execution-2025-08-25", "skills-2025-10-02"] }
    );

    console.log("Container ID:", response.container?.id || "N/A");

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      } else if (block.type === "code_execution_tool_result") {
        console.log("[Code execution completed]");
      }
    }

    // Check for generated files
    const fileIds = extractFileIds(response.content);
    if (fileIds.length > 0) {
      console.log(`\nGenerated files: ${fileIds.length}`);
      for (const fileId of fileIds) {
        console.log(`  File ID: ${fileId}`);
        // Download the file
        try {
          const fileContent = await client.beta.files.download(fileId);
          const buffer = Buffer.from(await fileContent.arrayBuffer());
          const outputPath = path.join(import.meta.dirname, "..", "tmp", `output-${fileId.slice(-8)}.xlsx`);
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(outputPath, buffer);
          console.log(`  Downloaded: ${outputPath} (${buffer.length} bytes)`);
        } catch (err) {
          console.log(`  Could not download: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.log(`API Error: ${error.status} - ${error.message}`);
      if (error.status === 400) {
        console.log("(Skills API may need specific access permissions)");
      }
    } else {
      throw error;
    }
  }

  // ─── Method 2: Create a PowerPoint Presentation ───
  printHeader("Method 2: Create a PowerPoint Presentation");

  try {
    const response = await client.beta.messages.create(
      {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        container: {
          skills: [
            { type: "anthropic", skill_id: "pptx", version: "latest" },
          ],
        },
        tools: [
          {
            type: "code_execution_20250825",
            name: "code_execution",
          },
        ],
        messages: [
          {
            role: "user",
            content:
              "Create a 3-slide PowerPoint presentation about 'Introduction to TypeScript'. Slide 1: Title slide. Slide 2: Key Benefits (bullet points). Slide 3: Getting Started code example.",
          },
        ],
      },
      { betas: ["code-execution-2025-08-25", "skills-2025-10-02"] }
    );

    for (const block of response.content) {
      if (block.type === "text") console.log(block.text);
    }

    const fileIds = extractFileIds(response.content);
    console.log(`Generated ${fileIds.length} file(s)`);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.log(`API Error: ${error.status} - ${error.message}`);
    } else {
      throw error;
    }
  }

  // ─── Skills Reference ───
  printHeader("Agent Skills Reference");

  console.log(`
Available pre-built skills:

| Skill ID | Description                    | Output Format |
|----------|--------------------------------|---------------|
| pptx     | PowerPoint presentations       | .pptx         |
| xlsx     | Excel spreadsheets + charts    | .xlsx         |
| docx     | Word documents                 | .docx         |
| pdf      | PDF documents                  | .pdf          |

Usage pattern:
  1. Set container.skills with desired skill IDs
  2. Include code_execution tool
  3. Claude reads skill instructions and generates code
  4. Code runs in sandboxed container
  5. Output files available via Files API

Handle pause_turn:
  When skills need multiple execution steps, the stop_reason will be
  "pause_turn" — continue the conversation to let Claude finish.
`);

  console.log("Agent skills example completed!");
}

// Helper to extract file IDs from response content
function extractFileIds(content: Anthropic.ContentBlock[]): string[] {
  const fileIds: string[] = [];
  for (const block of content) {
    // Check for file references in code execution results
    const blockAny = block as Record<string, unknown>;
    if (blockAny.type === "code_execution_tool_result" && Array.isArray(blockAny.content)) {
      for (const item of blockAny.content as Array<Record<string, unknown>>) {
        if (item.file_id) fileIds.push(item.file_id as string);
      }
    }
  }
  return fileIds;
}

main().catch(console.error);
