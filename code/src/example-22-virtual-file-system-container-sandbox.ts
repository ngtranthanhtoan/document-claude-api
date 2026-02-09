import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── Overview ───
  printHeader("Virtual File System, Container & Sandbox");

  console.log(`
When Claude executes code, three layers work together:

┌──────────────────────────────────────────────────────────┐
│  CONTAINER (Anthropic-managed Linux environment)         │
│  ┌────────────────────────────────────────────────────┐  │
│  │  SANDBOX (OS-level isolation)                      │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  VIRTUAL FILE SYSTEM (5 GiB ephemeral disk)  │  │  │
│  │  │                                              │  │  │
│  │  │  /tmp/               ← writable workspace    │  │  │
│  │  │  /skills/{dir}/      ← loaded skill files    │  │  │
│  │  │  /uploads/           ← uploaded files        │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │  No internet | Python 3.11 | bash | text_editor   │  │
│  └────────────────────────────────────────────────────┘  │
│  Container ID: container_xxx  |  Expires: 30 days        │
└──────────────────────────────────────────────────────────┘
`);

  // ─── Method 1: Basic Code Execution with Container ───
  printHeader("Method 1: Code Execution in a Container");

  try {
    const response = await client.beta.messages.create(
      {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
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
              "Write a Python script that: 1) Creates a CSV file with sample data (Name, Age, City for 5 people), 2) Reads it back and prints a summary, 3) Shows the filesystem contents of /tmp/",
          },
        ],
      },
      { betas: ["code-execution-2025-08-25"] }
    );

    const containerId = response.container?.id;
    console.log("Container ID:", containerId || "N/A");

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      } else if (block.type === "code_execution_tool_result") {
        console.log("\n[Code execution result]");
        const resultBlock = block as Record<string, unknown>;
        if (Array.isArray(resultBlock.content)) {
          for (const item of resultBlock.content as Array<Record<string, unknown>>) {
            if (item.type === "text") console.log(item.text);
          }
        }
      }
    }

    // ─── Method 2: Reuse Container (Stateful) ───
    if (containerId) {
      printHeader("Method 2: Reuse Container (Stateful Multi-Turn)");

      console.log(`Reusing container ${containerId} for a follow-up request...\n`);

      const response2 = await client.beta.messages.create(
        {
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          container: { id: containerId },
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
                "Read the CSV file created in the previous step and calculate the average age. Also list all files in /tmp/ to show the container state persisted.",
            },
          ],
        },
        { betas: ["code-execution-2025-08-25"] }
      );

      for (const block of response2.content) {
        if (block.type === "text") {
          console.log(block.text);
        } else if (block.type === "code_execution_tool_result") {
          console.log("\n[Code execution result]");
          const resultBlock = block as Record<string, unknown>;
          if (Array.isArray(resultBlock.content)) {
            for (const item of resultBlock.content as Array<Record<string, unknown>>) {
              if (item.type === "text") console.log(item.text);
            }
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.log(`API Error: ${error.status} - ${error.message}`);
      if (error.status === 400) {
        console.log("(Code execution may need to be enabled for your API key)");
      }
    } else {
      throw error;
    }
  }

  // ─── Container Management Reference ───
  printHeader("Container & Sandbox Reference");

  console.log(`
Container Lifecycle:
  1. First request: container auto-created (or specify container.id to reuse)
  2. Container persists files across requests (same container ID)
  3. Container expires after 30 days
  4. Each request runs in a fresh sandbox within the container

Key Constraints:
  - No internet access from within the sandbox
  - 5 GiB ephemeral disk
  - Pre-installed: Python 3.11, numpy, pandas, matplotlib, etc.
  - Sub-tools: bash, text_editor (within code execution)
  - Max execution time per code block: configurable

File Upload to Container:
  const file = await client.beta.files.upload({
    file: await toFile(stream, "data.csv", { type: "text/csv" })
  }, { betas: ["files-api-2025-04-14"] });

  // Use in request:
  container: {
    id: "container_xxx",
    files: [{ file_id: file.id, path: "/uploads/data.csv" }]
  }

File Download from Container:
  // Extract file_id from code execution results
  const content = await client.beta.files.download(fileId);
  const buffer = Buffer.from(await content.arrayBuffer());
  fs.writeFileSync("output.xlsx", buffer);
`);

  console.log("VFS/Container/Sandbox example completed!");
}

main().catch(console.error);
