/** Small ASCII PDF for sample drawings. Export PDFs use pdf-lib instead. */
export function textPdf(title: string, lines: string[]): Blob {
  const escape = (value: string) =>
    value.replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const commands = ["BT", "/F1 16 Tf", "48 740 Td", `(${escape(title)}) Tj`, "/F1 11 Tf"];
  for (const line of lines) {
    commands.push("0 -16 Td", `(${escape(line)}) Tj`);
  }
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const xref = body.length;
  let xrefTable = `xref\n0 ${objects.length + 1}\n`;
  xrefTable += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    xrefTable += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xrefTable += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([body + xrefTable], { type: "application/pdf" });
}

const FALLBACK_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function fallbackPng(): Blob {
  const binary = atob(FALLBACK_PNG);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: "image/png" });
}

export async function samplePhoto(lines: string[]): Promise<Blob> {
  if (typeof document === "undefined") return fallbackPng();
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallbackPng();
  ctx.fillStyle = "#101722";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#3ee0c5";
  ctx.lineWidth = 10;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
  ctx.fillStyle = "#e8843a";
  ctx.font = "700 42px sans-serif";
  ctx.fillText("JOBSITE PHOTO", 72, 130);
  ctx.fillStyle = "#f4f7fb";
  ctx.font = "700 68px sans-serif";
  lines.forEach((line, index) => ctx.fillText(line, 72, 280 + index * 92));
  ctx.fillStyle = "#b7c4d6";
  ctx.font = "400 32px sans-serif";
  ctx.fillText("Stored only on this device.", 72, 900);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/jpeg", 0.86));
  return blob ?? fallbackPng();
}
