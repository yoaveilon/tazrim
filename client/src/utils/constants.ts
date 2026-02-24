export const CATEGORY_COLORS: Record<string, string> = {
  'מזון': '#22C55E',
  'מסעדות': '#F97316',
  'דלק': '#EF4444',
  'תקשורת': '#3B82F6',
  'ביגוד': '#A855F7',
  'בריאות': '#EC4899',
  'חינוך': '#14B8A6',
  'בילויים': '#F59E0B',
  'תחבורה': '#6366F1',
  'ביטוח': '#8B5CF6',
  'דיור': '#06B6D4',
  'מנויים': '#D946EF',
  'אחר': '#6B7280',
};

export const PRIMARY_NAV = [
  { path: '/', label: 'תזרים חודשי', icon: 'LayoutDashboard' },
  { path: '/analysis', label: 'ניתוח', icon: 'PieChart' },
  { path: '/transactions', label: 'עסקאות', icon: 'Receipt' },
  { path: '/income', label: 'הכנסות', icon: 'TrendingUp' },
  { path: '/fixed-expenses', label: 'הוצאות קבועות', icon: 'Calendar' },
] as const;

export const MENU_NAV = [
  { path: '/upload', label: 'העלאת קובץ', icon: 'Upload' },
  { path: '/categories', label: 'קטגוריות', icon: 'FolderOpen' },
  { path: '/rules', label: 'כללי סיווג', icon: 'Tags' },
  { path: '/settings', label: 'הגדרות', icon: 'Settings' },
] as const;

export const NAV_ITEMS = [...PRIMARY_NAV, ...MENU_NAV] as const;
