import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { toFile } from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { printHeader } from "./utils.js";

const client = new Anthropic();

async function main() {
  // Create a temporary text file to upload
  const tmpDir = path.join(import.meta.dirname, "..", "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const sampleContent = `Product Requirements Document

Title: User Authentication System v2.0
Author: Engineering Team
Date: January 2025

1. Overview
This document outlines the requirements for upgrading the authentication system to support OAuth 2.0, multi-factor authentication (MFA), and single sign-on (SSO).

2. Requirements
2.1 OAuth 2.0 Support
- Support Authorization Code flow with PKCE
- Support Client Credentials flow for service-to-service auth
- Token expiry: 1 hour for access tokens, 30 days for refresh tokens

2.2 Multi-Factor Authentication
- Support TOTP (Time-based One-Time Password)
- Support SMS verification as fallback
- Recovery codes: 10 single-use codes generated at setup

2.3 Single Sign-On
- SAML 2.0 integration
- Support for major IdPs: Okta, Azure AD, Google Workspace

3. Security Considerations
- All tokens must be stored encrypted at rest
- Rate limit login attempts: 5 per minute per IP
- Session timeout: 30 minutes of inactivity

4. Timeline
- Phase 1 (Q1): OAuth 2.0 implementation
- Phase 2 (Q2): MFA rollout
- Phase 3 (Q3): SSO integration
`;

  const sampleFilePath = path.join(tmpDir, "sample-document.txt");
  fs.writeFileSync(sampleFilePath, sampleContent);

  // ─── Step 1: Upload a File ───
  printHeader("Step 1: Upload a File");

  const file = await client.beta.files.upload(
    {
      file: await toFile(
        fs.createReadStream(sampleFilePath),
        "sample-document.txt",
        { type: "text/plain" }
      ),
    },
    { betas: ["files-api-2025-04-14"] }
  );

  console.log("File ID:", file.id);
  console.log("Filename:", file.filename);
  console.log("MIME Type:", file.mime_type);
  console.log("Size:", file.size_bytes, "bytes");

  // ─── Step 2: Use File Content in Messages ───
  printHeader("Step 2: Use File Content in Messages");

  // Files API files are designed for container/code-execution workflows.
  // For messages, use the file content as a text document source:
  const msg1 = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: sampleContent,
            },
            title: file.filename,
          },
          {
            type: "text",
            text: "Summarize this document in 3 bullet points.",
          },
        ],
      },
    ],
  });

  const textBlock1 = msg1.content.find((block) => block.type === "text");
  if (textBlock1 && textBlock1.type === "text") {
    console.log(textBlock1.text);
  }

  // ─── Step 3: Retrieve File Metadata ───
  printHeader("Step 3: Retrieve File Metadata");

  const metadata = await client.beta.files.retrieveMetadata(file.id);

  console.log("File ID:", metadata.id);
  console.log("Filename:", metadata.filename);
  console.log("MIME Type:", metadata.mime_type);
  console.log("Size:", metadata.size_bytes, "bytes");
  console.log("Created:", metadata.created_at);

  // ─── Step 4: List All Files ───
  printHeader("Step 4: List All Files");

  let fileCount = 0;
  for await (const f of client.beta.files.list()) {
    console.log(`${f.id} - ${f.filename} (${f.size_bytes} bytes)`);
    fileCount++;
    if (fileCount >= 10) {
      console.log("(showing first 10 files only)");
      break;
    }
  }
  if (fileCount === 0) console.log("No files found.");

  // ─── Step 5: Delete the File ───
  printHeader("Step 5: Delete the File");

  const result = await client.beta.files.delete(file.id);

  console.log("Deleted:", result.id);

  // Cleanup temp file
  fs.unlinkSync(sampleFilePath);

  console.log("\nFiles API example completed!");
}

main().catch(console.error);
