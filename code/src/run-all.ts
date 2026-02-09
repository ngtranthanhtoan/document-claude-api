import "dotenv/config";
import { execSync } from "child_process";
import { printHeader } from "./utils.js";

const EXAMPLES = [
  { num: "01", name: "Structured Output" },
  { num: "02", name: "Streaming" },
  { num: "03", name: "PDF Processing" },
  { num: "04", name: "Citations" },
  { num: "05", name: "Files API" },
  { num: "06", name: "Tool Use Basics" },
  { num: "07", name: "Vision Analysis" },
  { num: "08", name: "RAG & Knowledge Base" },
  { num: "09", name: "Batch Processing" },
  { num: "10", name: "Data Extraction" },
  { num: "11", name: "Customer Support Bot" },
  { num: "12", name: "Human-in-the-Loop" },
  { num: "13", name: "Agentic Tool Loop" },
  { num: "14", name: "Research Agent" },
  { num: "15", name: "Coding Assistant" },
  { num: "16", name: "MCP Connector" },
  { num: "17", name: "Computer Use" },
  { num: "18", name: "Memory Tool" },
  { num: "19", name: "Agent Skills" },
  { num: "20", name: "Deep Agent" },
  { num: "21", name: "Full-Stack Agent" },
  { num: "22", name: "Virtual File System / Container / Sandbox" },
];

function main() {
  const args = process.argv.slice(2);

  // Filter to specific examples if args provided
  let toRun = EXAMPLES;
  if (args.length > 0) {
    const nums = args.map((a) => a.replace(/^0+/, "").padStart(2, "0"));
    toRun = EXAMPLES.filter((e) => nums.includes(e.num));
    if (toRun.length === 0) {
      console.log("No matching examples found. Available: 01-22");
      console.log("Usage: tsx src/run-all.ts [num ...]");
      console.log("  e.g. tsx src/run-all.ts 1 2 6");
      process.exit(1);
    }
  }

  console.log(`\nRunning ${toRun.length} example(s)...\n`);

  const results: Array<{ num: string; name: string; status: string }> = [];

  for (const example of toRun) {
    printHeader(`Example ${example.num}: ${example.name}`);

    try {
      execSync(`tsx src/example-${example.num}-*.ts`, {
        cwd: import.meta.dirname + "/..",
        stdio: "inherit",
        timeout: 120_000, // 2 minute timeout per example
        env: { ...process.env },
      });
      results.push({ ...example, status: "PASS" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\nExample ${example.num} failed: ${msg}\n`);
      results.push({ ...example, status: "FAIL" });
    }

    console.log(""); // spacing between examples
  }

  // Summary
  printHeader("Summary");
  console.log("");
  for (const r of results) {
    const icon = r.status === "PASS" ? "[PASS]" : "[FAIL]";
    console.log(`  ${icon} Example ${r.num}: ${r.name}`);
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${results.length}\n`);
}

main();
