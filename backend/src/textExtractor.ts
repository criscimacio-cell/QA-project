import fs from 'fs';
import path from 'path';

export async function extractText(filePath: string, mimeType: string): Promise<string | null> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const buf = fs.readFileSync(filePath);

    // Plain text
    if (mimeType.startsWith('text/') || ['.txt', '.md', '.csv', '.log', '.json', '.xml', '.yaml', '.yml'].includes(ext)) {
      return buf.toString('utf8').slice(0, 100_000);
    }

    // PDF
    if (mimeType === 'application/pdf' || ext === '.pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(buf);
      return data.text.slice(0, 100_000);
    }

    // Word .docx
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value.slice(0, 100_000);
    }

    // Excel .xlsx — xlsx package has unfixed high-severity CVEs (Prototype Pollution, ReDoS).
    // Text extraction is skipped; files are still stored and downloadable.
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx') {
      return null;
    }

    return null;
  } catch {
    return null;
  }
}
