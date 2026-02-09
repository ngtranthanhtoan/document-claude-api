import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader, printJSON } from "./utils.js";

const client = new Anthropic();

// 1x1 pixel white PNG as mock screenshot
const MOCK_SCREENSHOT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

function mockExecuteAction(action: Record<string, unknown>): void {
  const type = action.action || action.type;
  switch (type) {
    case "mouse_move":
      console.log(`  [Mock] Mouse moved to (${(action.coordinate as number[])?.[0]}, ${(action.coordinate as number[])?.[1]})`);
      break;
    case "left_click":
      console.log(`  [Mock] Left click at current position`);
      break;
    case "right_click":
      console.log(`  [Mock] Right click at current position`);
      break;
    case "double_click":
      console.log(`  [Mock] Double click at current position`);
      break;
    case "type":
      console.log(`  [Mock] Typed: "${action.text}"`);
      break;
    case "key":
      console.log(`  [Mock] Key press: ${action.key}`);
      break;
    case "screenshot":
      console.log(`  [Mock] Screenshot taken`);
      break;
    case "scroll":
      console.log(`  [Mock] Scrolled ${action.direction} by ${action.amount || 3}`);
      break;
    default:
      console.log(`  [Mock] Action: ${JSON.stringify(action)}`);
  }
}

async function main() {
  // ─── Overview ───
  printHeader("Computer Use: Desktop Automation via Claude");

  console.log(`
SAFETY WARNING: Computer use is a beta feature. Claude interacts with a real
desktop environment and can perform destructive actions. Always:
  - Run in an isolated environment (VM or container)
  - Never give access to sensitive accounts
  - Monitor all actions in real time
  - Set strict iteration limits

Architecture:
  1. Take screenshot → 2. Send to Claude → 3. Receive action
  4. Execute action → 5. Take new screenshot → 6. Repeat
`);

  // ─── Method 1: Basic Computer Use Request ───
  printHeader("Method 1: Basic Computer Use Request (Mock)");

  console.log("Sending initial screenshot to Claude with a task...\n");

  try {
    const response = await client.beta.messages.create(
      {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        tools: [
          {
            type: "computer_20241022",
            name: "computer",
            display_width_px: 1024,
            display_height_px: 768,
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "I need you to help me open a text editor. Here is what my screen looks like. Just describe what you would do (don't actually try to interact since this is a demo).",
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: MOCK_SCREENSHOT,
                },
              },
            ],
          },
        ],
      },
      { betas: ["computer-use-2025-01-24"] }
    );

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      } else if (block.type === "tool_use") {
        console.log(`\nClaude wants to use tool: ${block.name}`);
        printJSON(block.input);
        mockExecuteAction(block.input as Record<string, unknown>);
      }
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.log(`API response: ${error.status} - ${error.message}`);
      if (error.status === 400 || error.status === 403) {
        console.log("(Computer use may need to be enabled for your API key)");
      }
    } else {
      throw error;
    }
  }

  // ─── Method 2: Computer Use Loop Pattern ───
  printHeader("Method 2: Computer Use Loop Pattern (Pseudo-code)");

  console.log(`The full computer use loop pattern:

async function computerUseLoop(task: string) {
  const MAX_ITERATIONS = 20;
  let screenshot = takeScreenshot();  // scrot or similar

  const messages = [{
    role: "user",
    content: [
      { type: "text", text: task },
      { type: "image", source: { type: "base64", media_type: "image/png", data: screenshot } }
    ]
  }];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      betas: ["computer-use-2025-01-24"],
      // IMPORTANT: disable parallel tool use for sequential actions
      disable_parallel_tool_use: true,
      tools: [{
        type: "computer_20241022",
        name: "computer",
        display_width_px: 1920,
        display_height_px: 1080
      }],
      messages
    });

    if (response.stop_reason === "end_turn") {
      // Claude is done — print final message
      break;
    }

    // Execute the computer action
    for (const block of response.content) {
      if (block.type === "tool_use") {
        executeAction(block.input);  // xdotool, scrot, etc.
      }
    }

    // Take new screenshot and continue
    messages.push({ role: "assistant", content: response.content });
    screenshot = takeScreenshot();
    messages.push({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: [{
          type: "image",
          source: { type: "base64", media_type: "image/png", data: screenshot }
        }]
      }]
    });
  }
}`);

  // ─── Action Types Reference ───
  printHeader("Computer Use Action Types Reference");

  console.log(`
| Action        | Description              | Key Fields                    |
|---------------|--------------------------|-------------------------------|
| mouse_move    | Move cursor              | coordinate: [x, y]           |
| left_click    | Single left click        | coordinate: [x, y]           |
| right_click   | Right click              | coordinate: [x, y]           |
| double_click  | Double click             | coordinate: [x, y]           |
| type          | Type text                | text: "string"               |
| key           | Press key combo          | key: "Return", "ctrl+c"      |
| screenshot    | Capture screen           | (no params)                  |
| scroll        | Scroll page              | direction: "up"|"down",      |
|               |                          | amount: number               |
| drag          | Drag from A to B         | start: [x,y], end: [x,y]    |

Requirements for computer use:
  - Linux desktop environment (e.g., Docker with VNC)
  - scrot or similar for screenshots
  - xdotool for input simulation
  - Container isolation recommended
`);

  console.log("Computer use example completed!");
}

main().catch(console.error);
