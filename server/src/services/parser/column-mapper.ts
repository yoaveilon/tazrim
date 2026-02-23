import type { CreditCardCompany } from 'shared/src/types.js';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

// Canonical field names mapped from Hebrew column name variations
const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['תאריך עסקה', 'תאריך', 'תאריך העסקה', 'תאריך רכישה'],
  processedDate: ['תאריך חיוב', 'תאריך עיבוד', 'מועד חיוב'],
  description: ['שם בית עסק', 'שם בית העסק', 'בית עסק', 'תיאור', 'פרטי העסקה', 'שם בית-העסק'],
  originalAmount: ['סכום עסקה', 'סכום העסקה', 'סכום מקורי'],
  chargedAmount: ['סכום חיוב', 'סכום לחיוב', 'סכום בש"ח', 'סכום'],
  currency: ['מטבע', 'מטבע מקור', 'מט"ח', 'מטבע עסקה'],
  chargedCurrency: ['מטבע חיוב'],
  type: ['סוג עסקה', 'סוג'],
  installments: ['תשלומים', 'מספר תשלום', 'תשלום'],
  cardLastFour: ['4 ספרות אחרונות', 'ארבע ספרות', 'כרטיס', 'מספר כרטיס'],
  voucherNumber: ["מס' שובר"],
  notes: ['הערות', 'פירוט נוסף'],
};

// Company-specific known header sets
const COMPANY_SCHEMAS: Record<string, { knownHeaders: string[] }> = {
  isracard: {
    knownHeaders: ['תאריך רכישה', 'שם בית עסק', 'סכום עסקה', 'מטבע עסקה', 'סכום חיוב', 'מטבע חיוב', 'פירוט נוסף'],
  },
  cal: {
    knownHeaders: ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'מטבע', 'סוג עסקה'],
  },
  max: {
    knownHeaders: ['תאריך העסקה', 'שם בית העסק', 'סכום העסקה', 'סכום חיוב', 'תשלומים'],
  },
  visa_leumi: {
    knownHeaders: ['תאריך', 'פרטי העסקה', 'סכום', 'סכום חיוב'],
  },
};

export interface ColumnMapping {
  [canonicalName: string]: number; // maps canonical field name to column index
}

export function detectCompany(headers: string[]): CreditCardCompany {
  const headerSet = new Set(headers.map(h => h.trim()));

  for (const [company, schema] of Object.entries(COMPANY_SCHEMAS)) {
    const matchCount = schema.knownHeaders.filter(h => headerSet.has(h)).length;
    if (matchCount >= 3) {
      return company as CreditCardCompany;
    }
  }
  return 'unknown';
}

export function buildColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map(h => h.trim());

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (aliases.includes(normalizedHeaders[i])) {
        mapping[canonical] = i;
        break;
      }
    }
  }

  return mapping;
}

export function parseHebrewDate(raw: string): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();

  // Support all common Israeli date formats:
  // DD/MM/YYYY, DD/MM/YY, DD.MM.YY, DD.MM.YYYY
  const parsed = dayjs(trimmed, [
    'DD/MM/YYYY', 'DD/MM/YY', 'D/M/YYYY', 'D/M/YY',
    'DD.MM.YYYY', 'DD.MM.YY', 'D.M.YYYY', 'D.M.YY',
  ], true);

  if (!parsed.isValid()) {
    throw new Error(`תאריך לא תקין: ${raw}`);
  }
  return parsed.format('YYYY-MM-DD');
}

export function parseAmount(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  if (!raw || !raw.trim()) return 0;
  // Remove ₪, $, commas, spaces, non-breaking spaces, bidi control characters
  let cleaned = raw.replace(/[₪$,\s\u00A0\u200F\u200E\u202A\u202B\u202C\u200B\uFEFF]/g, '');
  // Handle parentheses as negative
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }
  // Handle trailing minus (some Israeli exports use 123.45-)
  if (cleaned.endsWith('-')) {
    cleaned = '-' + cleaned.slice(0, -1);
  }
  const num = parseFloat(cleaned);
  if (isNaN(num)) throw new Error(`סכום לא תקין: ${raw}`);
  return num;
}

export function parseInstallments(raw: string | undefined): { number?: number; total?: number } {
  if (!raw || !raw.trim()) return {};
  const trimmed = raw.trim();

  // Match "תשלום 2 מתוך 6" or "2 מתוך 6"
  const hebrewMatch = trimmed.match(/(\d+)\s*מתוך\s*(\d+)/);
  if (hebrewMatch) {
    return { number: parseInt(hebrewMatch[1]), total: parseInt(hebrewMatch[2]) };
  }

  // Match "2/6" format
  const slashMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (slashMatch) {
    return { number: parseInt(slashMatch[1]), total: parseInt(slashMatch[2]) };
  }

  return {};
}
