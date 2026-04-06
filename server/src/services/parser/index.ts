import path from 'path';
import type { ParsedTransaction, ParseResult, CreditCardCompany } from 'shared/src/types.js';
import { parseCsvBuffer } from './csv-parser.js';
import { parseXlsxBuffer } from './xlsx-parser.js';
import {
  detectCompany,
  buildColumnMapping,
  parseHebrewDate,
  parseAmount,
  parseInstallments,
  type ColumnMapping,
} from './column-mapper.js';

export function parseFile(buffer: Buffer, filename: string): ParseResult {
  const ext = path.extname(filename).toLowerCase();
  let rows: string[][];

  if (ext === '.csv') {
    rows = parseCsvBuffer(buffer);
  } else if (ext === '.xlsx' || ext === '.xls') {
    rows = parseXlsxBuffer(buffer);
  } else {
    throw new Error('סוג קובץ לא נתמך. יש להעלות CSV או Excel (.xlsx / .xls)');
  }

  if (rows.length < 2) {
    throw new Error('הקובץ ריק או לא מכיל מספיק שורות');
  }

  // Check if this is an Isracard multi-section file
  if (isIsracardFormat(rows)) {
    return parseIsracardFile(rows, filename);
  }

  // Standard single-header format (Cal, Max, Visa/Leumi)
  return parseStandardFile(rows, filename);
}

// ============================================================
// Isracard-specific parser
// ============================================================

function isIsracardFormat(rows: string[][]): boolean {
  // Isracard files have "פירוט עסקאות" in the first few rows
  // and section headers like "עסקאות שטרם נקלטו" or "עסקאות למועד חיוב"
  const first20 = rows.slice(0, 25).map(r => r.join(' '));
  const text = first20.join(' ');
  return text.includes('פירוט עסקאות') ||
    (text.includes('עסקאות שטרם נקלטו') && text.includes('תאריך רכישה')) ||
    (text.includes('עסקאות למועד חיוב') && text.includes('תאריך רכישה'));
}

function parseIsracardFile(rows: string[][], filename: string): ParseResult {
  const errors: string[] = [];
  const parsed: ParsedTransaction[] = [];

  // Extract card last four digits and billing date from metadata rows
  let cardLastFour: string | undefined;
  let metaBillingDate: string | undefined;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const rowText = rows[i].join(' ');
    // Match pattern like "9117" from card identifier rows
    if (!cardLastFour) {
      const cardMatch = rowText.match(/[-–]\s*(\d{4})\b/);
      if (cardMatch) {
        cardLastFour = cardMatch[1];
      }
    }
    // Match "לחיוב ב-02.04" or "לחיוב ב-02/04" in metadata rows
    if (!metaBillingDate) {
      const billingMatch = rowText.match(/לחיוב ב-?\s*(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)/);
      if (billingMatch) {
        try {
          let dateStr = billingMatch[1];
          // If year is missing (e.g. "02.04"), extract from metadata month row
          if (!/\d{4}/.test(dateStr) && !/\d{2}[./]\d{2}[./]\d{2,4}/.test(dateStr)) {
            // Look for year in "אפריל 2026" or similar metadata
            for (let j = 0; j < Math.min(rows.length, 5); j++) {
              const yearMatch = rows[j].join(' ').match(/\b(20\d{2})\b/);
              if (yearMatch) {
                dateStr = dateStr + '.' + yearMatch[1];
                break;
              }
            }
          }
          const rawDate = parseHebrewDate(dateStr);
          if (rawDate) {
            // Shift one month back: billing month's transactions belong to previous month
            const d = new Date(rawDate);
            d.setMonth(d.getMonth() - 1);
            metaBillingDate = d.toISOString().slice(0, 10);
          }
        } catch { /* ignore */ }
      }
    }
  }

  // Find all sections and their header rows
  const sections = findIsracardSections(rows, metaBillingDate);

  for (const section of sections) {
    const mapping = buildColumnMapping(section.headers);
    const isPending = section.type === 'pending';

    for (let i = 0; i < section.dataRows.length; i++) {
      const row = section.dataRows[i];
      const rowIndex = section.dataRowIndices[i];

      try {
        const txn = mapIsracardRow(row, mapping, isPending, cardLastFour, section.billingDate);
        if (txn) parsed.push(txn);
      } catch (err: any) {
        errors.push(`שורה ${rowIndex + 1}: ${err.message}`);
      }
    }
  }

  return {
    rows: parsed,
    detectedCompany: 'isracard',
    filename,
    totalRows: parsed.length + errors.length,
    parsedRows: parsed.length,
    errors,
  };
}

interface IsracardSection {
  type: 'pending' | 'charged';
  billingDate?: string; // Billing date extracted from section header (YYYY-MM-DD)
  headers: string[];
  dataRows: string[][];
  dataRowIndices: number[];
}

function findIsracardSections(rows: string[][], metaBillingDate?: string): IsracardSection[] {
  const sections: IsracardSection[] = [];
  let i = 0;

  while (i < rows.length) {
    const rowText = rows[i].join(' ');

    // Check for section header text
    if (rowText.includes('עסקאות שטרם נקלטו') || rowText.includes('עסקאות למועד חיוב')) {
      const sectionType = rowText.includes('שטרם נקלטו') ? 'pending' : 'charged';

      // Extract billing date from section header, e.g. "עסקאות למועד חיוב 02/03/2026"
      // The billing date is when the charge hits the account, but the transactions
      // belong to the PREVIOUS month's cashflow. E.g. billing on 02/03/2026 means
      // these are February 2026 expenses, so we shift one month back.
      let billingDate: string | undefined;
      if (sectionType === 'charged') {
        const dateMatch = rowText.match(/למועד חיוב\s+(\d{1,2}[./]\d{1,2}[./]\d{2,4})/);
        if (dateMatch) {
          try {
            const rawDate = parseHebrewDate(dateMatch[1]); // e.g. "2026-03-02"
            // Shift one month back: billing month's transactions belong to previous month
            const d = new Date(rawDate);
            d.setMonth(d.getMonth() - 1);
            billingDate = d.toISOString().slice(0, 10); // e.g. "2026-02-02"
          } catch { /* ignore */ }
        }
      }

      // Next non-empty row should be the column header row
      let headerRowIdx = i + 1;
      while (headerRowIdx < rows.length) {
        const headerRow = rows[headerRowIdx];
        const headerText = headerRow.join(' ');
        if (headerText.includes('תאריך') && headerText.includes('בית עסק')) {
          break;
        }
        headerRowIdx++;
        if (headerRowIdx - i > 5) break; // safety
      }

      // Fall back to metadata billing date if section header had no date
      if (!billingDate && metaBillingDate && sectionType === 'charged') {
        billingDate = metaBillingDate;
      }

      if (headerRowIdx < rows.length) {
        const headers = rows[headerRowIdx].map(h => String(h).trim());
        const dataRows: string[][] = [];
        const dataRowIndices: number[] = [];

        // Collect data rows until we hit a summary row or another section
        let j = headerRowIdx + 1;
        while (j < rows.length) {
          const dataRow = rows[j];
          const dataRowText = dataRow.join(' ');

          // Stop conditions
          if (dataRowText.includes('סה"כ') || dataRowText.includes('סה״כ')) break;
          if (dataRowText.includes('עסקאות למועד חיוב') && sectionType === 'pending') break;
          if (dataRowText.includes('עסקאות שבוצעו וטרם')) break;
          if (dataRowText.includes('תנאים משפטיים')) break;

          // Skip empty rows
          const firstCell = String(dataRow[0] || '').trim();
          if (firstCell && isDateLike(firstCell)) {
            dataRows.push(dataRow);
            dataRowIndices.push(j);
          }

          j++;
        }

        sections.push({
          type: sectionType,
          billingDate,
          headers,
          dataRows,
          dataRowIndices,
        });

        i = j;
        continue;
      }
    }

    i++;
  }

  return sections;
}

function isDateLike(value: string): boolean {
  // Check if it looks like DD.MM.YY or DD/MM/YY
  return /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(value.trim());
}

function mapIsracardRow(
  row: string[],
  mapping: ColumnMapping,
  isPending: boolean,
  cardLastFour?: string,
  billingDate?: string
): ParsedTransaction | null {
  const get = (field: string): string => {
    const idx = mapping[field];
    if (idx === undefined || idx >= row.length) return '';
    return String(row[idx] || '').trim();
  };

  const dateRaw = get('date');
  const description = get('description');

  if (!dateRaw || !description) return null;

  // Skip summary rows
  if (description.includes('סה"כ') || description.includes('סה״כ')) return null;

  const date = parseHebrewDate(dateRaw);
  if (!date) return null;

  // For pending transactions, there's no separate charged amount
  const originalAmountRaw = get('originalAmount');
  const chargedAmountRaw = get('chargedAmount');

  let originalAmount = 0;
  let chargedAmount = 0;

  if (originalAmountRaw) {
    originalAmount = parseAmount(originalAmountRaw);
  }

  if (chargedAmountRaw) {
    chargedAmount = parseAmount(chargedAmountRaw);
  } else {
    chargedAmount = originalAmount;
  }

  // If chargedAmount is 0 but originalAmount exists, use original
  if (chargedAmount === 0 && originalAmount > 0) {
    chargedAmount = originalAmount;
  }
  if (originalAmount === 0 && chargedAmount > 0) {
    originalAmount = chargedAmount;
  }

  // Determine currency
  const currencyRaw = get('currency') || '₪';
  const currency = currencyRaw.includes('$') ? 'USD' :
    currencyRaw.includes('€') ? 'EUR' :
    currencyRaw.includes('£') ? 'GBP' : 'ILS';

  // Parse installments from the "פירוט נוסף" (notes) column
  const notesRaw = get('notes');
  const installmentInfo = parseInstallments(notesRaw);
  const type = installmentInfo.total ? 'installments' as const : 'normal' as const;

  return {
    date,
    processed_date: billingDate || undefined,
    description: description.trim(),
    original_amount: originalAmount,
    original_currency: currency,
    charged_amount: chargedAmount,
    type,
    installment_number: installmentInfo.number,
    installment_total: installmentInfo.total,
    card_last_four: cardLastFour,
  };
}

// ============================================================
// Standard single-header format parser (Cal, Max, Visa/Leumi)
// ============================================================

function parseStandardFile(rows: string[][], filename: string): ParseResult {
  const { headerRowIndex, headers } = findHeaderRow(rows);
  const dataRows = rows.slice(headerRowIndex + 1);

  const detectedCompany = detectCompany(headers);
  const mapping = buildColumnMapping(headers);

  // Validate minimum required fields
  if (mapping.date === undefined || mapping.description === undefined) {
    throw new Error('לא ניתן לזהות את עמודות התאריך ושם בית העסק בקובץ');
  }
  if (mapping.chargedAmount === undefined && mapping.originalAmount === undefined) {
    throw new Error('לא ניתן לזהות עמודת סכום בקובץ');
  }

  const errors: string[] = [];
  const parsed: ParsedTransaction[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    try {
      const txn = mapStandardRow(row, mapping);
      if (txn) parsed.push(txn);
    } catch (err: any) {
      errors.push(`שורה ${i + headerRowIndex + 2}: ${err.message}`);
    }
  }

  return {
    rows: parsed,
    detectedCompany,
    filename,
    totalRows: dataRows.length,
    parsedRows: parsed.length,
    errors,
  };
}

function findHeaderRow(rows: string[][]): { headerRowIndex: number; headers: string[] } {
  const headerIndicators = [
    'תאריך', 'סכום', 'בית עסק', 'תיאור', 'פרטי', 'חיוב', 'עסקה',
  ];

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    const rowText = row.join(' ');
    const matchCount = headerIndicators.filter(h => rowText.includes(h)).length;
    if (matchCount >= 2) {
      return { headerRowIndex: i, headers: row.map(h => String(h).trim()) };
    }
  }

  return { headerRowIndex: 0, headers: rows[0].map(h => String(h).trim()) };
}

function mapStandardRow(row: string[], mapping: ColumnMapping): ParsedTransaction | null {
  const get = (field: string): string => {
    const idx = mapping[field];
    if (idx === undefined || idx >= row.length) return '';
    return String(row[idx] || '').trim();
  };

  const dateRaw = get('date');
  const description = get('description');

  if (!dateRaw || !description) return null;
  if (description.includes('סה"כ') || description.includes('סה״כ')) return null;

  const date = parseHebrewDate(dateRaw);
  if (!date) return null;

  const processedDateRaw = get('processedDate');
  const processedDate = processedDateRaw ? parseHebrewDate(processedDateRaw) : undefined;

  const chargedAmountRaw = get('chargedAmount');
  const originalAmountRaw = get('originalAmount');

  const chargedAmount = chargedAmountRaw ? parseAmount(chargedAmountRaw) : parseAmount(originalAmountRaw);
  const originalAmount = originalAmountRaw ? parseAmount(originalAmountRaw) : chargedAmount;

  const currencyRaw = get('currency') || 'ILS';
  // Normalize currency symbols to ISO codes
  const currency = currencyRaw.includes('$') ? 'USD' :
    currencyRaw.includes('€') ? 'EUR' :
    currencyRaw.includes('£') ? 'GBP' :
    currencyRaw.replace(/['"₪\s]/g, '') || 'ILS';

  // Check installments in dedicated column or notes
  const installmentInfo = parseInstallments(get('installments') || get('notes'));
  const type = installmentInfo.total ? 'installments' as const : 'normal' as const;

  const cardLastFour = get('cardLastFour') || undefined;

  return {
    date,
    processed_date: processedDate,
    description,
    original_amount: originalAmount,
    original_currency: currency,
    charged_amount: chargedAmount,
    type,
    installment_number: installmentInfo.number,
    installment_total: installmentInfo.total,
    card_last_four: cardLastFour,
  };
}
