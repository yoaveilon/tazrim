import { Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import AppShell from './components/layout/AppShell';
import DashboardPage from './components/dashboard/DashboardPage';
import TransactionsPage from './components/transactions/TransactionsPage';
import UploadPage from './components/upload/UploadPage';
import IncomePage from './components/income/IncomePage';
import FixedExpensesPage from './components/fixed-expenses/FixedExpensesPage';
import CategoriesPage from './components/categories/CategoriesPage';
import RulesPage from './components/classification/RulesPage';
import AnalysisPage from './components/analysis/AnalysisPage';
import SettingsPage from './components/settings/SettingsPage';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { getCurrentMonth } from './utils/date';

export default function App() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell currentMonth={currentMonth} onMonthChange={setCurrentMonth}>
              <Routes>
                <Route path="/" element={<DashboardPage month={currentMonth} />} />
                <Route path="/transactions" element={<TransactionsPage month={currentMonth} />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/income" element={<IncomePage month={currentMonth} />} />
                <Route path="/fixed-expenses" element={<FixedExpensesPage month={currentMonth} />} />
                <Route path="/analysis" element={<AnalysisPage month={currentMonth} />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/rules" element={<RulesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
