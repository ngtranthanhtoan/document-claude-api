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

  const sampleFilePath = path.join(tmpDir, "sample-document.txt");
  fs.writeFileSync(
    sampleFilePath,
    `Product Requirements Document

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
`
  );

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
  console.log("Expires:", file.expires_at);

  // ─── Step 2: Use File in Messages ───
  printHeader("Step 2: Use File in Messages");

  const msg1 = await client.beta.messages.create(
    {
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "file",
                file_id: file.id,
              },
            },
            {
              type: "text",
              text: "Summarize this document in 3 bullet points.",
            },
          ],
        },
      ],
    },
    { betas: ["files-api-2025-04-14"] }
  );

  const textBlock1 = msg1.content.find((block) => block.type === "text");
  if (textBlock1 && textBlock1.type === "text") {
    console.log(textBlock1.text);
  }

  // ─── Step 3: Follow-up Question (Reuse File) ───
  printHeader("Step 3: Follow-up Question (Reusing Same File)");

  const msg2 = await client.beta.messages.create(
    {
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "file",
                file_id: file.id,
              },
            },
            {
              type: "text",
              text: "What security considerations are mentioned? List them all.",
            },
          ],
        },
      ],
    },
    { betas: ["files-api-2025-04-14"] }
  );

  const textBlock2 = msg2.content.find((block) => block.type === "text");
  if (textBlock2 && textBlock2.type === "text") {
    console.log(textBlock2.text);
  }

  // ─── Step 4: Get File Metadata ───
  printHeader("Step 4: Get File Metadata");

  const metadata = await client.beta.files.retrieve(file.id, {
    betas: ["files-api-2025-04-14"],
  });

  console.log("File ID:", metadata.id);
  console.log("Filename:", metadata.filename);
  console.log("MIME Type:", metadata.mime_type);
  console.log("Size:", metadata.size_bytes, "bytes");
  console.log("Created:", metadata.created_at);
  console.log("Expires:", metadata.expires_at);

  // ─── Step 5: List All Files ───
  printHeader("Step 5: List All Files");

  const files = await client.beta.files.list({
    betas: ["files-api-2025-04-14"],
  });

  for (const f of files.data) {
    console.log(`${f.id} - ${f.filename} (${f.size_bytes} bytes, expires: ${f.expires_at})`);
  }

  // ─── Step 6: Delete the File ───
  printHeader("Step 6: Delete the File");

  const result = await client.beta.files.delete(file.id, {
    betas: ["files-api-2025-04-14"],
  });

  console.log("Deleted:", result.id, "—", result.deleted);

  // Cleanup temp file
  fs.unlinkSync(sampleFilePath);
  fs.rmdirSync(tmpDir, { recursive: true });

  console.log("\nFiles API example completed!");
}

main().catch(console.error);
