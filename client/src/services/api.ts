import axios from 'axios';
import type {
  Transaction, Category, ClassificationRule, IncomeSource, IncomeRecord,
  FixedExpense, ParseResult, ImportResult, UploadRecord,
  DashboardSummary, DashboardForecast, MonthlyTrendPoint, CashFlowData, WeeklyBreakdown,
  PaginatedResponse, CreateCategoryInput, CreateRuleInput,
  CreateIncomeInput, CreateFixedExpenseInput, UpdateTransactionInput, CreateTransactionInput,
  AppSettings, VariableIncomeData, SoftDuplicate,
} from 'shared/src/types';

const api = axios.create({
  baseURL: '/api',
});

// Automatically add Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (expired/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Transactions ---
export async function getTransactions(params: {
  month?: string;
  category_id?: number;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_dir?: string;
}): Promise<PaginatedResponse<Transaction>> {
  const { data } = await api.get('/transactions', { params });
  return data;
}

export async function getUnclassifiedTransactions(params: {
  month?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Transaction>> {
  const { data } = await api.get('/transactions/unclassified', { params });
  return data;
}

export async function updateTransaction(id: number, input: UpdateTransactionInput): Promise<Transaction> {
  const { data } = await api.patch(`/transactions/${id}`, input);
  return data;
}

export async function deleteTransaction(id: number): Promise<void> {
  await api.delete(`/transactions/${id}`);
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const { data } = await api.post('/transactions', input);
  return data;
}

export async function getSimilarTransactions(description: string, categoryId: number, excludeId: number): Promise<Transaction[]> {
  const { data } = await api.get('/transactions/similar', {
    params: { description, category_id: categoryId, exclude_id: excludeId },
  });
  return data;
}

export async function batchClassifyTransactions(transactionIds: number[], categoryId: number): Promise<{ updated: number }> {
  const { data } = await api.post('/transactions/batch-classify', {
    transaction_ids: transactionIds,
    category_id: categoryId,
  });
  return data;
}

// --- Upload ---
export async function parseFile(file: File): Promise<ParseResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function importTransactions(params: {
  transactions: any[];
  sourceCompany: string;
  filename: string;
}): Promise<ImportResult> {
  const { data } = await api.post('/upload/import', params);
  return data;
}

export async function resolveDuplicate(keepId: number, removeId: number): Promise<{ success: boolean }> {
  const { data } = await api.post('/upload/resolve-duplicate', { keepId, removeId });
  return data;
}

export async function getUploadHistory(): Promise<UploadRecord[]> {
  const { data } = await api.get('/upload/history');
  return data;
}

// --- Categories ---
export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get('/categories');
  return data;
}

export async function getCategoryUsage(): Promise<Record<number, number>> {
  const { data } = await api.get('/categories/usage');
  return data;
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const { data } = await api.post('/categories', input);
  return data;
}

export async function updateCategory(id: number, input: Partial<CreateCategoryInput>): Promise<Category> {
  const { data } = await api.patch(`/categories/${id}`, input);
  return data;
}

export async function deleteCategory(id: number, reassignTo?: number): Promise<void> {
  const params = reassignTo ? `?reassign_to=${reassignTo}` : '';
  await api.delete(`/categories/${id}${params}`);
}

// --- Classification Rules ---
export async function getClassificationRules(): Promise<ClassificationRule[]> {
  const { data } = await api.get('/classification-rules');
  return data;
}

export async function createRule(input: CreateRuleInput): Promise<ClassificationRule> {
  const { data } = await api.post('/classification-rules', input);
  return data;
}

export async function updateRule(id: number, input: Partial<CreateRuleInput>): Promise<ClassificationRule> {
  const { data } = await api.patch(`/classification-rules/${id}`, input);
  return data;
}

export async function deleteRule(id: number): Promise<void> {
  await api.delete(`/classification-rules/${id}`);
}

export async function reclassifyTransactions(month?: string): Promise<{ updated: number }> {
  const { data } = await api.post('/classification-rules/reclassify', { month });
  return data;
}

// --- Income ---
export async function getIncomeSources(): Promise<IncomeSource[]> {
  const { data } = await api.get('/income');
  return data;
}

export async function createIncome(input: CreateIncomeInput): Promise<IncomeSource> {
  const { data } = await api.post('/income', input);
  return data;
}

export async function updateIncome(id: number, input: Partial<CreateIncomeInput & { is_active: boolean }>): Promise<IncomeSource> {
  const { data } = await api.patch(`/income/${id}`, input);
  return data;
}

export async function deleteIncome(id: number): Promise<void> {
  await api.delete(`/income/${id}`);
}

export async function getIncomeRecords(month: string): Promise<IncomeRecord[]> {
  const { data } = await api.get('/income/records', { params: { month } });
  return data;
}

export async function updateIncomeRecord(id: number, input: Partial<IncomeRecord>): Promise<IncomeRecord> {
  const { data } = await api.patch(`/income/records/${id}`, input);
  return data;
}

export async function getVariableIncome(month: string): Promise<VariableIncomeData> {
  const { data } = await api.get('/income/variable', { params: { month } });
  return data;
}

// --- Fixed Expenses ---
export async function getFixedExpenses(): Promise<FixedExpense[]> {
  const { data } = await api.get('/fixed-expenses');
  return data;
}

export async function createFixedExpense(input: CreateFixedExpenseInput): Promise<FixedExpense> {
  const { data } = await api.post('/fixed-expenses', input);
  return data;
}

export async function updateFixedExpense(id: number, input: Partial<CreateFixedExpenseInput & { is_active: boolean }>): Promise<FixedExpense> {
  const { data } = await api.patch(`/fixed-expenses/${id}`, input);
  return data;
}

export async function deleteFixedExpense(id: number): Promise<void> {
  await api.delete(`/fixed-expenses/${id}`);
}

export async function getFixedExpensePayments(month: string): Promise<any[]> {
  const { data } = await api.get('/fixed-expenses/payments', { params: { month } });
  return data;
}

export async function markFixedExpensePaid(id: number, month: string, amountPaid?: number): Promise<any> {
  const { data } = await api.post(`/fixed-expenses/${id}/pay`, { month, amount_paid: amountPaid });
  return data;
}

export async function unmarkFixedExpensePaid(id: number, month: string): Promise<void> {
  await api.delete(`/fixed-expenses/${id}/pay`, { params: { month } });
}

export async function autoDetectFixedExpensePayments(month: string): Promise<{ matched: any[]; count: number }> {
  const { data } = await api.post('/fixed-expenses/auto-detect', { month });
  return data;
}

// --- Dashboard ---
export async function getDashboardSummary(month: string): Promise<DashboardSummary> {
  const { data } = await api.get('/dashboard/summary', { params: { month } });
  return data;
}

export async function getDashboardForecast(month: string): Promise<DashboardForecast> {
  const { data } = await api.get('/dashboard/forecast', { params: { month } });
  return data;
}

export async function getCashFlow(month: string): Promise<CashFlowData> {
  const { data } = await api.get('/dashboard/cashflow', { params: { month } });
  return data;
}

export async function getWeeklyBreakdown(month: string): Promise<WeeklyBreakdown> {
  const { data } = await api.get('/dashboard/weekly', { params: { month } });
  return data;
}

export async function getDashboardTrends(months: number = 12): Promise<{ months: MonthlyTrendPoint[] }> {
  const { data } = await api.get('/dashboard/trends', { params: { months } });
  return data;
}

export async function getForecastOverrides(): Promise<any[]> {
  const { data } = await api.get('/dashboard/forecast-overrides');
  return data;
}

export async function setForecastOverride(categoryId: number, monthlyBudget: number | null): Promise<any> {
  const { data } = await api.put(`/dashboard/forecast-overrides/${categoryId}`, { monthly_budget: monthlyBudget });
  return data;
}

// --- Admin ---
export interface AdminUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  created_at: string;
  transaction_count: number;
  last_transaction_date: string | null;
  last_upload_date: string | null;
  upload_count: number;
}

export async function getAdminUsers(): Promise<{ users: AdminUser[]; total: number }> {
  const { data } = await api.get('/admin/users');
  return data;
}

// --- Settings ---
export async function getSettings(): Promise<AppSettings> {
  const { data } = await api.get('/settings');
  return data;
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const { data } = await api.patch('/settings', settings);
  return data;
}
