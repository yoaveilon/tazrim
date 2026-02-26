/** Check if a fixed expense is due in the given month based on its frequency */
export function isExpenseDueInMonth(frequency: string, startMonth: string | null, targetMonth: string): boolean {
  if (frequency !== 'bimonthly') return true;
  if (!startMonth) return true;
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ty, tm] = targetMonth.split('-').map(Number);
  const diff = (ty - sy) * 12 + (tm - sm);
  return diff % 2 === 0;
}
