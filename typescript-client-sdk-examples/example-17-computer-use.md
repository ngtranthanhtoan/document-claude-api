# Example 17: Computer Use

> Enable Claude to interact with desktop environments using mouse, keyboard, and screen capture.

## Overview

- **Difficulty**: Expert
- **Features Used**: Computer Use
- **SDK Methods**: `client.beta.messages.create()`
- **Beta**: `computer-use-2025-01-24`
- **Use Cases**:
  - Automated UI testing
  - Desktop workflow automation
  - Form filling and data entry
  - Web scraping via browser interaction
  - Accessibility testing
  - Legacy system automation

## Prerequisites

- Node.js 20+ with TypeScript 4.9+
- `@anthropic-ai/sdk`: `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` environment variable set
- Virtual machine or container with a desktop environment (e.g., Docker with VNC)
- Screen capture capability (e.g., `scrot` on Linux)
- Input simulation tools (e.g., `xdotool` on Linux)

---

## Safety Warning

> **Computer use is a beta feature.** Claude interacts with a real desktop environment and can perform destructive actions (deleting files, sending messages, making purchases). Always:
>
> - Run in an isolated environment (VM or container)
> - Never give access to sensitive accounts or credentials
> - Monitor all actions in real time
> - Set strict iteration limits
> - Avoid using on production systems

---

## Computer Use Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
│                                                              │
│   1. Take screenshot                                         │
│   2. Send to Claude with task description                    │
│   3. Receive action (click, type, etc.)                     │
│   4. Execute action on desktop                               │
│   5. Take new screenshot                                     │
│   6. Repeat until task complete                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Anthropic API                               │
│                                                              │
│   Claude sees the screenshot and decides:                    │
│   - What action to take (mouse, keyboard, etc.)             │
│   - Where to click (x, y coordinates)                       │
│   - What to type                                             │
│   - When the task is complete                                │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Desktop Environment                            │
│                                                              │
│   - Linux VM with XFCE/GNOME                                │
│   - Screen: 1920x1080                                        │
│   - Applications: Browser, Terminal, etc.                    │
│   - Input tools: xdotool, xclip                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Computer Use Tools

Define the computer tool with your display dimensions. The tool type `computer_20241022` tells Claude about your desktop setup.

```typescript
const tools = [
  {
    type: "computer_20241022" as const,
    name: "computer",
    display_width_px: 1920,
    display_height_px: 1080,
    display_number: 0,
  },
];
```

| Property | Description |
|----------|-------------|
| `type` | Must be `"computer_20241022"` |
| `name` | Must be `"computer"` |
| `display_width_px` | Width of the screen in pixels |
| `display_height_px` | Height of the screen in pixels |
| `display_number` | X11 display number (typically `0`) |

---

## Basic Computer Use Request

Send a screenshot with a task description. Claude analyzes the screen and returns an action to perform.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const client = new Anthropic();

// Take a screenshot and encode it as base64
const screenshot = fs.readFileSync("screenshot.png").toString("base64");

const message = await client.beta.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  betas: ["computer-use-2025-01-24"],
  tools: [
    {
      type: "computer_20241022",
      name: "computer",
      display_width_px: 1920,
      display_height_px: 1080,
      display_number: 0,
    },
  ],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Open the Firefox browser and go to example.com",
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: screenshot,
          },
        },
      ],
    },
  ],
});

console.log("Stop reason:", message.stop_reason);
console.log("Content:", JSON.stringify(message.content, null, 2));
```

### Response

Claude returns a tool_use block with the computer action to perform.

```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "I can see the desktop. I'll click on the Firefox icon in the taskbar to open the browser."
    },
    {
      "type": "tool_use",
      "id": "toolu_01ABC",
      "name": "computer",
      "input": {
        "action": "left_click",
        "coordinate": [48, 1058]
      }
    }
  ]
}
```

---

## Computer Actions

Claude can request these actions through the computer tool.

### Mouse Actions

```typescript
// Move mouse to coordinates
{ action: "mouse_move", coordinate: [500, 300] }

// Left click at coordinates
{ action: "left_click", coordinate: [500, 300] }

// Double click at coordinates
{ action: "double_click", coordinate: [500, 300] }

// Right click at coordinates
{ action: "right_click", coordinate: [500, 300] }

// Click and drag from one point to another
{ action: "left_click_drag", start_coordinate: [100, 200], coordinate: [400, 500] }

// Scroll up or down at coordinates
{ action: "scroll", coordinate: [500, 300], direction: "down", amount: 3 }
```

### Keyboard Actions

```typescript
// Type a string of text
{ action: "type", text: "Hello, world!" }

// Press a single key or key combination
{ action: "key", text: "Return" }
{ action: "key", text: "ctrl+a" }
{ action: "key", text: "ctrl+c" }
{ action: "key", text: "alt+Tab" }
{ action: "key", text: "ctrl+shift+t" }
```

### Screen Actions

```typescript
// Request a screenshot (Claude asks for a fresh screenshot)
{ action: "screenshot" }
```

### Common Key Names

| Key | Value |
|-----|-------|
| Enter | `"Return"` |
| Tab | `"Tab"` |
| Escape | `"Escape"` |
| Backspace | `"BackSpace"` |
| Delete | `"Delete"` |
| Arrow keys | `"Up"`, `"Down"`, `"Left"`, `"Right"` |
| Modifier combos | `"ctrl+a"`, `"ctrl+c"`, `"ctrl+v"`, `"alt+F4"` |

---

## Computer Use Loop

The core pattern for computer use: send a screenshot, get an action, execute it, take a new screenshot, and repeat.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";

const client = new Anthropic();

const DISPLAY_WIDTH = 1920;
const DISPLAY_HEIGHT = 1080;
const MAX_ITERATIONS = 20;

const tools: Anthropic.Beta.BetaTool[] = [
  {
    type: "computer_20241022",
    name: "computer",
    display_width_px: DISPLAY_WIDTH,
    display_height_px: DISPLAY_HEIGHT,
    display_number: 0,
  },
];

// Take a screenshot and return base64-encoded PNG
function takeScreenshot(): string {
  execSync("scrot /tmp/screenshot.png", { env: { ...process.env, DISPLAY: ":0" } });
  return fs.readFileSync("/tmp/screenshot.png").toString("base64");
}

// Execute a computer action based on Claude's instructions
function executeAction(action: string, input: Record<string, any>): void {
  const displayEnv = { ...process.env, DISPLAY: ":0" };

  switch (action) {
    case "mouse_move":
      execSync(
        `xdotool mousemove ${input.coordinate[0]} ${input.coordinate[1]}`,
        { env: displayEnv }
      );
      break;

    case "left_click":
      execSync(
        `xdotool mousemove ${input.coordinate[0]} ${input.coordinate[1]} click 1`,
        { env: displayEnv }
      );
      break;

    case "double_click":
      execSync(
        `xdotool mousemove ${input.coordinate[0]} ${input.coordinate[1]} click --repeat 2 1`,
        { env: displayEnv }
      );
      break;

    case "right_click":
      execSync(
        `xdotool mousemove ${input.coordinate[0]} ${input.coordinate[1]} click 3`,
        { env: displayEnv }
      );
      break;

    case "left_click_drag":
      execSync(
        `xdotool mousemove ${input.start_coordinate[0]} ${input.start_coordinate[1]} mousedown 1 mousemove ${input.coordinate[0]} ${input.coordinate[1]} mouseup 1`,
        { env: displayEnv }
      );
      break;

    case "scroll": {
      const button = input.direction === "up" ? 4 : 5;
      const clicks = input.amount || 3;
      execSync(
        `xdotool mousemove ${input.coordinate[0]} ${input.coordinate[1]} click --repeat ${clicks} ${button}`,
        { env: displayEnv }
      );
      break;
    }

    case "type":
      // Use xdotool type for text input
      execSync(`xdotool type --clearmodifiers -- "${input.text.replace(/"/g, '\\"')}"`, {
        env: displayEnv,
      });
      break;

    case "key":
      // Convert key names for xdotool (e.g., "ctrl+a" -> "ctrl+a")
      execSync(`xdotool key -- ${input.text}`, { env: displayEnv });
      break;

    case "screenshot":
      // No action needed -- we take a screenshot after every action
      break;

    default:
      console.warn(`Unknown action: ${action}`);
  }
}

// Main computer use loop
async function computerUseLoop(task: string): Promise<void> {
  console.log(`Task: ${task}\n`);

  // Take initial screenshot
  let screenshot = takeScreenshot();

  // Build initial message with task and screenshot
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: task },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: screenshot,
          },
        },
      ],
    },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`--- Iteration ${i + 1} ---`);

    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      betas: ["computer-use-2025-01-24"],
      tools,
      messages,
    });

    // Check if Claude is done
    if (response.stop_reason === "end_turn") {
      console.log("\nTask completed!");
      for (const block of response.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
      return;
    }

    // Add assistant response to conversation
    messages.push({ role: "assistant", content: response.content });

    // Process each tool use block
    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`Claude: ${block.text}`);
      }
      if (block.type === "tool_use") {
        const input = block.input as Record<string, any>;
        console.log(`Action: ${input.action}`, JSON.stringify(input));

        // Execute the action
        try {
          executeAction(input.action, input);

          // Wait for the UI to update
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Take a new screenshot
          screenshot = takeScreenshot();

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: screenshot,
                },
              },
            ],
          });
        } catch (error) {
          console.error(`Action failed: ${error}`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: `Action failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
    }

    // Send tool results (screenshots) back to Claude
    messages.push({ role: "user", content: toolResults });
  }

  console.log("Max iterations reached. Task may be incomplete.");
}

// Run the computer use loop
computerUseLoop("Open Firefox, navigate to example.com, and take a screenshot of the page.").catch(
  console.error
);
```

**Key points about the loop:**
- After each action, take a new screenshot and send it back as the tool result
- Claude uses the updated screenshot to decide the next action
- The loop continues until `stop_reason` is `"end_turn"` (task complete) or the iteration limit is reached
- Always add a small delay between actions to let the UI update

---

## Alternative: Using Playwright for Browser Automation

Instead of `xdotool` and `scrot`, you can use Playwright for browser-specific tasks. This gives you more reliable control and does not require a full desktop environment.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { chromium, Browser, Page } from "playwright";

const client = new Anthropic();

let browser: Browser;
let page: Page;

async function setup(): Promise<void> {
  browser = await chromium.launch({ headless: false });
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
}

async function takeScreenshot(): Promise<string> {
  const buffer = await page.screenshot({ type: "png" });
  return buffer.toString("base64");
}

async function executeAction(action: string, input: Record<string, any>): Promise<void> {
  switch (action) {
    case "left_click":
      await page.mouse.click(input.coordinate[0], input.coordinate[1]);
      break;
    case "double_click":
      await page.mouse.dblclick(input.coordinate[0], input.coordinate[1]);
      break;
    case "right_click":
      await page.mouse.click(input.coordinate[0], input.coordinate[1], { button: "right" });
      break;
    case "mouse_move":
      await page.mouse.move(input.coordinate[0], input.coordinate[1]);
      break;
    case "type":
      await page.keyboard.type(input.text);
      break;
    case "key":
      await page.keyboard.press(input.text);
      break;
    case "scroll":
      await page.mouse.wheel(
        0,
        input.direction === "down" ? (input.amount || 3) * 100 : -(input.amount || 3) * 100
      );
      break;
    case "screenshot":
      break;
  }
}

// Use the same computerUseLoop pattern from above,
// replacing takeScreenshot() and executeAction() with the Playwright versions
```

---

## Docker Setup

Run computer use in an isolated Docker container with a virtual desktop.

### Dockerfile

```dockerfile
FROM ubuntu:22.04

# Install desktop environment and tools
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    xfce4 \
    xfce4-terminal \
    firefox \
    scrot \
    xdotool \
    xclip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Set up virtual display
ENV DISPLAY=:0
ENV SCREEN_WIDTH=1920
ENV SCREEN_HEIGHT=1080

# Create working directory
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install

COPY . .

# Start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
```

### start.sh

```bash
#!/bin/bash

# Start virtual framebuffer
Xvfb :0 -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24 &
sleep 1

# Start desktop environment
startxfce4 &
sleep 2

# Start VNC server for monitoring (optional)
x11vnc -display :0 -forever -nopw -quiet &

# Run the TypeScript computer use script
npx ts-node computer-use.ts
```

### Running the Container

```bash
# Build
docker build -t claude-computer-use .

# Run with API key
docker run -it \
  -e ANTHROPIC_API_KEY="your-key-here" \
  -p 5900:5900 \
  claude-computer-use

# Connect VNC viewer to localhost:5900 to watch Claude work
```

---

## Best Practices

1. **Always Use Isolation**: Run computer use in a VM or Docker container, never on your local machine. Claude can and will click on things you do not expect.

2. **Set Strict Iteration Limits**: Cap the loop at a reasonable number (10-20 iterations). Tasks that take more iterations may be stuck in a loop.

3. **Add Delays Between Actions**: Wait 300-500ms after each action before taking a screenshot. UI elements need time to render, and screenshots taken too quickly will show stale state.

4. **Provide Clear Task Descriptions**: Be specific about what you want Claude to do and what the end state should look like. Vague instructions lead to unpredictable behavior.

5. **Monitor in Real Time**: Use VNC or a screen-sharing tool to watch what Claude is doing. This lets you intervene if something goes wrong and helps debug unexpected behavior.

6. **Handle Errors Gracefully**: Actions can fail (e.g., `xdotool` errors, screenshot failures). Send error results back to Claude with `is_error: true` so it can attempt recovery rather than getting stuck.

---

## Related Examples

- [Example 07: Vision Analysis](example-07-vision-analysis.md) - Image analysis fundamentals
- [Example 13: Agentic Tool Loop](example-13-agentic-tool-loop.md) - Autonomous tool execution loops
- [Example 06: Tool Use Basics](example-06-tool-use-basics.md) - Tool use fundamentals
- [Example 14: Research Agent](example-14-research-agent.md) - Multi-step agent workflows
