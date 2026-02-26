import { useQuery } from '@tanstack/react-query';
import { getCashFlow, getDashboardTrends } from '../../services/api';
import { formatNIS } from '../../utils/currency';
import { formatMonthHebrew } from '../../utils/date';
import type { CategoryForecast } from 'shared/src/types';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';
import CategoryIcon from '../ui/CategoryIcon';

interface Props {
  month: string;
}

// Shared tooltip
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm" dir="rtl">
      <p className="font-medium text-gray-700 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-mono font-medium">{formatNIS(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function RTLLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div className="flex justify-center gap-6 mt-3 text-sm">
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisPage({ month }: Props) {
  const { data: cashflow } = useQuery({
    queryKey: ['cashflow', month],
    queryFn: () => getCashFlow(month),
  });

  const { data: trends } = useQuery({
    queryKey: ['dashboard-trends'],
    queryFn: () => getDashboardTrends(6),
  });

  const RADIAN = Math.PI / 180;

  const pieData = cashflow?.categoryForecasts?.filter((c: CategoryForecast) => c.actual > 0) || [];
  const totalActual = cashflow?.totalActualExpenses || 0;

  // Top 5 categories by spend
  const top5 = [...pieData].sort((a, b) => b.actual - a.actual).slice(0, 5);

  // Budget efficiency data: how well does each category stick to forecast
  const efficiencyData = cashflow?.categoryForecasts
    ?.filter((c: CategoryForecast) => c.forecast > 0 && c.monthsOfData !== 0)
    .map((c: CategoryForecast) => ({
      name: c.name,
      efficiency: Math.round((c.actual / c.forecast) * 100),
      color: c.color,
    })) || [];

  // Monthly comparison data: current month vs previous months averages
  const monthlyComparison = trends?.months?.length
    ? (() => {
        const currentMonth = trends.months.find((m: any) => m.month === month);
        const otherMonths = trends.months.filter((m: any) => m.month !== month && m.expenses > 0);
        const avgExpenses = otherMonths.length > 0
          ? Math.round(otherMonths.reduce((s: number, m: any) => s + m.expenses, 0) / otherMonths.length)
          : 0;
        const avgIncome = otherMonths.length > 0
          ? Math.round(otherMonths.reduce((s: number, m: any) => s + m.income, 0) / otherMonths.length)
          : 0;
        return {
          current: currentMonth || { expenses: 0, income: 0 },
          avgExpenses,
          avgIncome,
        };
      })()
    : null;

  // Pie label
  const renderPieLabel = ({ cx, cy, midAngle, outerRadius, name, percent }: any) => {
    if (percent < 0.04) return null;
    const radius = outerRadius + 22;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="fill-gray-600" style={{ fontSize: '11px' }}>
        {name} ({Math.round(percent * 100)}%)
      </text>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">ניתוח הוצאות — {formatMonthHebrew(month)}</h2>

      {/* Summary cards */}
      {monthlyComparison && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">הוצאות החודש</p>
            <p className="text-xl font-bold text-danger-400">{formatNIS(monthlyComparison.current.expenses)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">ממוצע הוצאות חודשי</p>
            <p className="text-xl font-bold text-gray-600">{formatNIS(monthlyComparison.avgExpenses)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">הפרש מהממוצע</p>
            {monthlyComparison.avgExpenses > 0 ? (
              <p className={`text-xl font-bold ${monthlyComparison.current.expenses > monthlyComparison.avgExpenses ? 'text-danger-400' : 'text-success-500'}`}>
                {monthlyComparison.current.expenses > monthlyComparison.avgExpenses ? '+' : ''}
                {formatNIS(monthlyComparison.current.expenses - monthlyComparison.avgExpenses)}
              </p>
            ) : (
              <p className="text-xl font-bold text-gray-400">—</p>
            )}
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">משכורת ממוצעת</p>
            {monthlyComparison.avgIncome > 0 ? (
              <p className="text-xl font-bold text-success-500">{formatNIS(monthlyComparison.avgIncome)}</p>
            ) : (
              <p className="text-xl font-bold text-gray-400">—</p>
            )}
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">קטגוריות פעילות</p>
            <p className="text-xl font-bold text-info-500">{pieData.length}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pie chart - spending breakdown */}
        <div className="card">
          <h3 className="font-semibold mb-4">פילוח הוצאות בפועל</h3>
          {pieData.length ? (
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="actual"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={2}
                    label={renderPieLabel}
                    labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                  >
                    {pieData.map((entry: CategoryForecast, i: number) => (
                      <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                {[...pieData]
                  .sort((a: CategoryForecast, b: CategoryForecast) => b.actual - a.actual)
                  .map((cat: CategoryForecast, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="truncate inline-flex items-center gap-1"><CategoryIcon icon={cat.icon} className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />{cat.name}</span>
                      </div>
                      <span className="font-mono text-xs text-gray-600 flex-shrink-0 ms-2">
                        {formatNIS(cat.actual)}
                        <span className="text-gray-400 ms-1">({totalActual > 0 ? Math.round((cat.actual / totalActual) * 100) : 0}%)</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-12">אין נתוני הוצאות עדיין</p>
          )}
        </div>

        {/* Top 5 categories bar chart */}
        <div className="card">
          <h3 className="font-semibold mb-4">טופ 5 קטגוריות</h3>
          {top5.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={top5}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey={(entry: CategoryForecast) => entry.name}
                  tick={{ fontSize: 12, fill: '#374151' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => v >= 1000 ? `₪${Math.round(v / 1000)}K` : `₪${v}`}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="actual" name="הוצאה" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {top5.map((entry: CategoryForecast, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">אין נתונים</p>
          )}
        </div>
      </div>

      {/* Budget efficiency */}
      <div className="card mb-6">
        <h3 className="font-semibold mb-4">יעילות תקציבית (% ניצול מהצפי)</h3>
        {efficiencyData.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {efficiencyData
              .sort((a: any, b: any) => b.efficiency - a.efficiency)
              .map((item: any, i: number) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{item.name}</span>
                    <span className={`text-sm font-mono font-medium ${
                      item.efficiency > 100 ? 'text-danger-400' : item.efficiency > 80 ? 'text-warning-500' : 'text-success-500'
                    }`}>
                      {item.efficiency}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        item.efficiency > 100 ? 'bg-danger-400' : item.efficiency > 80 ? 'bg-warning-500' : 'bg-success-500'
                      }`}
                      style={{ width: `${Math.min(item.efficiency, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-12">אין נתוני תחזית להשוואה</p>
        )}
      </div>

      {/* Monthly trend - full: income, expenses, balance */}
      <div className="card mb-6">
        <h3 className="font-semibold mb-4">מגמה חצי שנתית</h3>
        {trends?.months?.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={trends.months}
              margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tickFormatter={(m) => {
                  const parts = m.split('-');
                  return `${parts[1]}/${parts[0].slice(2)}`;
                }}
                reversed
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => v >= 1000 ? `₪${Math.round(v / 1000)}K` : `₪${v}`}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<ChartTooltip />} labelFormatter={(label) => formatMonthHebrew(label)} />
              <Legend content={<RTLLegend />} />
              <Line type="monotone" dataKey="income" name="הכנסות" stroke="#00D68F" strokeWidth={2.5} dot={{ r: 4, fill: '#00D68F' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="expenses" name="הוצאות" stroke="#FF6B6B" strokeWidth={2.5} dot={{ r: 4, fill: '#FF6B6B' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="balance" name="מאזן" stroke="#7C5CFC" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: '#7C5CFC' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">אין נתוני מגמה עדיין</p>
        )}
      </div>

      {/* Spending table - detailed breakdown */}
      {pieData.length ? (
        <div className="card">
          <h3 className="font-semibold mb-4">טבלת פירוט מלא</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="text-right py-3 pe-4">קטגוריה</th>
                <th className="text-left py-3 pe-4">בפועל</th>
                <th className="text-left py-3 pe-4">צפוי</th>
                <th className="text-left py-3 pe-4">הפרש</th>
                <th className="text-left py-3">% מסה"כ</th>
              </tr>
            </thead>
            <tbody>
              {cashflow?.categoryForecasts
                ?.filter((c: CategoryForecast) => c.actual > 0 || c.forecast > 0)
                .sort((a: CategoryForecast, b: CategoryForecast) => b.actual - a.actual)
                .map((cat: CategoryForecast) => (
                  <tr key={cat.category_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 pe-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cat.color }} />
                        <span className="inline-flex items-center gap-1"><CategoryIcon icon={cat.icon} className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pe-4 text-left font-mono">{formatNIS(cat.actual)}</td>
                    <td className="py-2.5 pe-4 text-left font-mono text-gray-500">{formatNIS(cat.forecast)}</td>
                    <td className={`py-2.5 pe-4 text-left font-mono ${cat.difference < 0 ? 'text-danger-400' : 'text-success-500'}`}>
                      {cat.difference < 0 ? '+' : '-'}{formatNIS(Math.abs(cat.difference))}
                    </td>
                    <td className="py-2.5 text-left font-mono text-gray-500">
                      {totalActual > 0 ? Math.round((cat.actual / totalActual) * 100) : 0}%
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-medium">
                <td className="py-2.5 pe-4">סה"כ</td>
                <td className="py-2.5 pe-4 text-left font-mono">{formatNIS(totalActual)}</td>
                <td className="py-2.5 pe-4 text-left font-mono text-gray-500">{formatNIS(cashflow?.totalForecastExpenses || 0)}</td>
                <td className={`py-2.5 pe-4 text-left font-mono ${(cashflow?.totalForecastExpenses || 0) - totalActual < 0 ? 'text-danger-400' : 'text-success-500'}`}>
                  {formatNIS(Math.abs((cashflow?.totalForecastExpenses || 0) - totalActual))}
                </td>
                <td className="py-2.5 text-left font-mono">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}
