import { createRequire } from "node:module";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

try {
  loadEnvFile(resolve(process.cwd(), "../.env.local"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const require = createRequire(import.meta.url);
require("../node_modules/next/dist/bin/next");
