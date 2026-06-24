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
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buf);
      return data.text.slice(0, 100_000);
    }

    // Word .docx
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value.slice(0, 100_000);
    }

    // Excel .xlsx
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx') {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buf, { type: 'buffer' });
      const texts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        texts.push(XLSX.utils.sheet_to_csv(ws));
      }
      return texts.join('\n').slice(0, 100_000);
    }

    return null;
  } catch {
    return null;
  }
}
