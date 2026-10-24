import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const target = resolve("public/pdf.worker.min.mjs");
if (!existsSync(source)) {
  console.error("pdf.js worker was not found. Run npm install first.");
  process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log("Copied pdf.js worker to public/pdf.worker.min.mjs");
