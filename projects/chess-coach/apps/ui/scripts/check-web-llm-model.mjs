import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const modelsDir = path.join(root, "public", "models");

if (!existsSync(modelsDir) || readdirSync(modelsDir).length === 0) {
  console.error("ERROR: No model found at public/models/");
  console.error("  Download a WebLLM-compatible model into public/models/ before building web-full.");
  process.exit(1);
}

console.log(`Model check passed — public/models/ contains ${readdirSync(modelsDir).length} entries.`);
