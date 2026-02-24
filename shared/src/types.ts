// ============================================================
// Shared Types - RiseUp Cash Flow Manager
// ============================================================

// --- Auth / Users ---
export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  picture: string | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// --- Categories ---
export interface Category {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  is_expense: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateCategoryInput {
  name: string;
  icon?: string;
  color?: string;
  is_expense: boolean;
}

// --- Classification Rules ---
export interface ClassificationRule {
  id: number;
  keyword: string;
  category_id: number;
  category_name?: string;
  priority: number;
  is_regex: boolean;
  created_at: string;
}

export interface CreateRuleInput {
  keyword: string;
  category_id: number;
  priority?: number;
  is_regex?: boolean;
}

// --- Transactions ---
export interface Transaction {
  id: number;
  date: string;
  processed_date: string | null;
  description: string;
  original_amount: number;
  original_currency: string;
  charged_amount: number;
  category_id: number | null;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  type: 'normal' | 'installments';
  installment_number: number | null;
  installment_total: number | null;
  card_last_four: string | null;
  source_file: string | null;
  source_company: string | null;
  classification_method: 'keyword' | 'ai' | 'manual' | 'history' | null;
  notes: string | null;
  created_at: string;
}

export interface ParsedTransaction {
  date: string;
  processed_date?: string;
  description: string;
  original_amount: number;
  original_currency: string;
  charged_amount: number;
  type: 'normal' | 'installments';
  installment_number?: number;
  installment_total?: number;
  card_last_four?: string;
}

export interface UpdateTransactionInput {
  category_id?: number | null;
  notes?: string;
}

// --- Income ---
export interface IncomeSource {
  id: number;
  name: string;
  amount: number;
  expected_day: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface CreateIncomeInput {
  name: string;
  amount: number;
  expected_day: number;
  notes?: string;
}

export interface IncomeRecord {
  id: number;
  income_source_id: number;
  source_name?: string;
  month: string;
  expected_amount: number;
  actual_amount: number | null;
  received_date: string | null;
  status: 'expected' | 'received' | 'partial';
  notes: string | null;
  created_at: string;
}

// --- Fixed Expenses ---
export interface FixedExpense {
  id: number;
  name: string;
  amount: number;
  billing_day: number;
  category_id: number | null;
  category_name?: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface CreateFixedExpenseInput {
  name: string;
  amount: number;
  billing_day: number;
  category_id?: number;
  notes?: string;
}

// --- Upload ---
export type CreditCardCompany = 'cal' | 'max' | 'visa_leumi' | 'isracard' | 'unknown';

export interface ParseResult {
  rows: ParsedTransaction[];
  detectedCompany: CreditCardCompany;
  filename: string;
  totalRows: number;
  parsedRows: number;
  errors: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  autoClassified: number;
}

export interface UploadRecord {
  id: number;
  filename: string;
  source_company: string | null;
  rows_total: number;
  rows_imported: number;
  rows_skipped: number;
  rows_failed: number;
  uploaded_at: string;
}

// --- Dashboard ---
export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  expensesByCategory: CategoryBreakdown[];
}

export interface CategoryBreakdown {
  name: string;
  amount: number;
  color: string;
  icon: string | null;
  percentage: number;
}

export interface DashboardForecast {
  expectedIncome: number;
  actualIncome: number;
  expectedExpenses: number;
  actualExpenses: number;
  upcomingFixedExpenses: UpcomingExpense[];
}

export interface UpcomingExpense {
  name: string;
  amount: number;
  billing_day: number;
  days_until: number;
}

export interface MonthlyTrendPoint {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

// --- Variable Income (credit card refunds) ---
export interface VariableIncomeItem {
  id: number;
  date: string;
  description: string;
  charged_amount: number;
  amount: number; // absolute value for display
  original_amount: number;
  original_currency: string;
  card_last_four: string | null;
  source_company: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
}

export interface VariableIncomeData {
  refunds: VariableIncomeItem[];
  total: number;
  count: number;
}

// --- Cash Flow ---
export interface CashFlowData {
  // Income
  expectedIncome: number;
  actualIncome: number;
  variableIncome?: number;
  // Totals
  totalForecastExpenses: number;
  totalActualExpenses: number;
  // Per-category breakdown
  categoryForecasts: CategoryForecast[];
  // The key number: remaining to spend
  remainingToSpend: number;
}

export interface CategoryWeekData {
  label: string;
  startDay: number;
  endDay: number;
  actual: number;
  remaining: number;
}

export interface CategoryForecast {
  category_id: number;
  name: string;
  icon: string | null;
  color: string;
  forecast: number;       // Predicted spend based on history + fixed
  actual: number;         // Actual spend this month
  difference: number;     // forecast - actual (positive = under budget)
  monthsOfData: number;   // How many months of data used for avg
  weeklyBreakdown?: CategoryWeekData[];
}

export interface WeeklyBreakdown {
  weeks: WeekData[];
}

export interface WeekData {
  label: string;
  days: string;
  forecast: number;
  actual: number;
}

// --- Settings ---
export interface AppSettings {
  ai_enabled: string;
  ai_provider: string;
  ai_api_key: string;
  [key: string]: string;
}

// --- API Response wrappers ---
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
