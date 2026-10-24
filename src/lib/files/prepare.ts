const MAX_PDF = 30 * 1024 * 1024;
const MAX_EDGE = 2000;

export async function prepareUpload(file: File): Promise<{ blob: Blob; mimeType: string; fileName: string }> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    if (file.size > MAX_PDF) {
      throw new Error("That PDF is over 30 MB. Attach a smaller sheet.");
    }
    return { blob: file, mimeType: "application/pdf", fileName: file.name };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Attach a photo or a PDF.");
  }
  const blob = await compressImage(file);
  const fileName = file.name.replace(/\.\w+$/, "") + ".jpg";
  return { blob, mimeType: "image/jpeg", fileName };
}

async function compressImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/jpeg", 0.84));
  return blob ?? file;
}

export function isPdf(mimeType: string, fileName: string): boolean {
  return mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
