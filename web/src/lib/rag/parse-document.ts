/**
 * Parse uploaded document into plain text.
 * Supports PDF, DOCX, and TXT.
 */
export async function parseDocument(
  buffer: Buffer,
  contentType: string
): Promise<string> {
  switch (contentType) {
    case "application/pdf":
      return parsePdf(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocx(buffer);
    case "text/plain":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text;
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
