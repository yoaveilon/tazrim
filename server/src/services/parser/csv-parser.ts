import { parse } from 'csv-parse/sync';
import * as jschardet from 'jschardet';
import iconv from 'iconv-lite';

export function detectEncoding(buffer: Buffer): string {
  const detected = jschardet.detect(buffer);
  if (detected && detected.encoding) {
    const enc = detected.encoding.toLowerCase();
    // Map common Hebrew encodings
    if (enc.includes('windows-1255') || enc.includes('iso-8859-8')) {
      return 'windows-1255';
    }
    if (enc.includes('utf-8') || enc.includes('ascii')) {
      return 'utf-8';
    }
    return enc;
  }
  // Default to windows-1255 for Hebrew files
  return 'windows-1255';
}

export function parseCsvBuffer(buffer: Buffer): string[][] {
  // Detect and convert encoding
  const encoding = detectEncoding(buffer);
  let text: string;

  if (encoding === 'utf-8') {
    text = buffer.toString('utf-8');
  } else {
    text = iconv.decode(buffer, encoding);
  }

  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  // Try parsing with comma delimiter first, then tab
  try {
    const rows = parse(text, {
      delimiter: ',',
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];

    // If first row has only 1 column, probably tab-delimited
    if (rows.length > 0 && rows[0].length <= 1) {
      return parse(text, {
        delimiter: '\t',
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true,
      }) as string[][];
    }

    return rows;
  } catch {
    // Fallback to tab delimiter
    return parse(text, {
      delimiter: '\t',
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];
  }
}
