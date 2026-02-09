import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { printHeader } from "./utils.js";

const client = new Anthropic();

async function main() {
  // ─── Method 1: URL-Based Image Analysis ───
  printHeader("Method 1: URL-Based Image Analysis");

  const msg1 = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg",
            },
          },
          {
            type: "text",
            text: "What animal is in this image? Describe its characteristics.",
          },
        ],
      },
    ],
  });

  const textBlock1 = msg1.content.find((block) => block.type === "text");
  if (textBlock1 && textBlock1.type === "text") {
    console.log(textBlock1.text);
  }
  console.log("\nTokens — input:", msg1.usage.input_tokens, "output:", msg1.usage.output_tokens);

  // ─── Method 2: Multiple Images Comparison ───
  printHeader("Method 2: Multiple Images via URL");

  const msg2 = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Compare these two images. What are the key similarities and differences?",
          },
          {
            type: "image",
            source: {
              type: "url",
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg",
            },
          },
          {
            type: "image",
            source: {
              type: "url",
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/YellowLabradorLooking_new.jpg/1200px-YellowLabradorLooking_new.jpg",
            },
          },
        ],
      },
    ],
  });

  const textBlock2 = msg2.content.find((block) => block.type === "text");
  if (textBlock2 && textBlock2.type === "text") {
    console.log(textBlock2.text);
  }

  // ─── Method 3: Alt-Text Generation ───
  printHeader("Method 3: Accessibility Alt-Text Generation");

  const msg3 = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg",
            },
          },
          {
            type: "text",
            text: "Generate concise, descriptive alt-text for this image suitable for screen readers. Keep it under 125 characters.",
          },
        ],
      },
    ],
  });

  const textBlock3 = msg3.content.find((block) => block.type === "text");
  if (textBlock3 && textBlock3.type === "text") {
    console.log("Alt text:", textBlock3.text);
    console.log(`Length: ${textBlock3.text.length} characters`);
  }

  // ─── Method 4: Local Image (if provided) ───
  printHeader("Method 4: Local Image Analysis");

  const imagePath = process.argv[2];
  if (imagePath) {
    const fs = await import("fs");
    const path = await import("path");

    const resolvedPath = path.resolve(imagePath);
    if (!fs.existsSync(resolvedPath)) {
      console.log(`File not found: ${resolvedPath}`);
    } else {
      const ext = path.extname(resolvedPath).toLowerCase();
      const mediaTypes: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
      };
      const mediaType = mediaTypes[ext];
      if (!mediaType) {
        console.log(`Unsupported format: ${ext}`);
      } else {
        const imageBase64 = fs.readFileSync(resolvedPath).toString("base64");
        const msg = await client.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
                { type: "text", text: process.argv[3] || "Describe this image in detail." },
              ],
            },
          ],
        });
        const tb = msg.content.find((b) => b.type === "text");
        if (tb && tb.type === "text") console.log(tb.text);
      }
    }
  } else {
    console.log("No local image provided. Pass an image path to test local analysis:");
    console.log("  npx tsx src/example-07-vision-analysis.ts path/to/image.jpg [question]");
  }

  console.log("\nVision analysis examples completed!");
}

main().catch(console.error);
