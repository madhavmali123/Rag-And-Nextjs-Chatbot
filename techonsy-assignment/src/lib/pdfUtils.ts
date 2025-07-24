import fs from "fs";
import pdf from "pdf-parse";

export async function readPdfChunks(filePath: string): Promise<string[]> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  const text = data.text;

  // Simple fixed-size chunking (you can improve this)
  const chunks = text.match(/[\s\S]{1,1000}/g) || [];
  return chunks;
}
