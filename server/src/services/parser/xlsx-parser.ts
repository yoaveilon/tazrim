import * as XLSX from 'xlsx';

export function parseXlsxBuffer(buffer: Buffer): string[][] {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    codepage: 1255, // Hebrew Windows codepage
  });

  if (!workbook.SheetNames.length) {
    throw new Error('הקובץ לא מכיל גליונות');
  }

  const allRows: string[][] = [];

  // Read ALL sheets and combine rows (e.g. Max has local + international sheets)
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false, // Get strings for dates
      defval: '',
    });

    // Filter out completely empty rows
    const nonEmpty = rows.filter(row => row.some(cell => cell !== '' && cell != null));
    allRows.push(...nonEmpty);
  }

  return allRows;
}
