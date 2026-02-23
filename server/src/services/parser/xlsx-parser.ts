import * as XLSX from 'xlsx';

export function parseXlsxBuffer(buffer: Buffer): string[][] {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    codepage: 1255, // Hebrew Windows codepage
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('הקובץ לא מכיל גליונות');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false, // Get strings for dates
    defval: '',
  });

  // Filter out completely empty rows
  return rows.filter(row => row.some(cell => cell !== '' && cell != null));
}
