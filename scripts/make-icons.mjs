import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#07090f"/>
  <rect x="28" y="28" width="456" height="456" rx="76" fill="none" stroke="#3ee0c5" stroke-width="18"/>
  <path d="M78 330c70-150 120-150 170 0s100 150 186 0" fill="none" stroke="#3ee0c5" stroke-width="28" stroke-linecap="round"/>
  <circle cx="372" cy="150" r="36" fill="#e8843a"/>
</svg>`;

const sizes = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/apple-touch-icon.png", 180],
  ["src/app/icon.png", 192],
];

mkdirSync(resolve("src/app"), { recursive: true });
for (const [file, size] of sizes) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  writeFileSync(resolve(file), png);
  console.log(file, size);
}
