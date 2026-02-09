import "dotenv/config";

export function printHeader(title: string): void {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60) + "\n");
}

export function printJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printUsage(usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }): void {
  console.log(`\nTokens — input: ${usage.input_tokens}, output: ${usage.output_tokens}`);
  if (usage.cache_creation_input_tokens) {
    console.log(`  cache_creation: ${usage.cache_creation_input_tokens}`);
  }
  if (usage.cache_read_input_tokens) {
    console.log(`  cache_read: ${usage.cache_read_input_tokens}`);
  }
}
