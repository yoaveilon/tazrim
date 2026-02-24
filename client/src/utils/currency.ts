export function formatNIS(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.ceil(amount));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('he-IL').format(num);
}
