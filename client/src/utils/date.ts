import dayjs from 'dayjs';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export function formatDateHebrew(date: string): string {
  const d = dayjs(date);
  return d.format('DD/MM/YYYY');
}

export function formatMonthHebrew(month: string): string {
  const d = dayjs(month + '-01');
  return `${HEBREW_MONTHS[d.month()]} ${d.year()}`;
}

export function getCurrentMonth(): string {
  return dayjs().format('YYYY-MM');
}

export function getPrevMonth(month: string): string {
  return dayjs(month + '-01').subtract(1, 'month').format('YYYY-MM');
}

export function getNextMonth(month: string): string {
  return dayjs(month + '-01').add(1, 'month').format('YYYY-MM');
}
