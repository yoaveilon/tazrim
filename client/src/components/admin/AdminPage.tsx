import { useQuery } from '@tanstack/react-query';
import { getAdminUsers } from '../../services/api';
import type { AdminUser } from '../../services/api';
import { Users, Mail, Calendar, Upload, Receipt } from 'lucide-react';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  if (diffDays < 30) return `לפני ${Math.floor(diffDays / 7)} שבועות`;
  if (diffDays < 365) return `לפני ${Math.floor(diffDays / 30)} חודשים`;
  return formatDate(dateStr);
}

function UserCard({ user }: { user: AdminUser }) {
  return (
    <div className="card !p-4">
      <div className="flex items-start gap-3">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            className="w-11 h-11 rounded-xl object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center text-base font-bold text-accent-blue shrink-0">
            {user.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-800 truncate">{user.name}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          <span>הצטרף {formatRelative(user.created_at)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Receipt className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          <span>{user.transaction_count.toLocaleString()} עסקאות</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Upload className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          <span>{user.upload_count || 0} העלאות</span>
        </div>
        {user.last_upload_date && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            <span>העלאה אחרונה {formatRelative(user.last_upload_date)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users className="w-6 h-6" strokeWidth={1.5} />
        ניהול משתמשים
      </h2>

      {/* Summary */}
      {data && (
        <div className="card mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center">
            <Users className="w-6 h-6 text-accent-blue" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{data.total}</p>
            <p className="text-sm text-gray-500">משתמשים רשומים</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">טוען...</div>
      ) : !data?.users?.length ? (
        <div className="card text-center py-12 text-gray-500">
          <Users className="w-10 h-10 mx-auto text-gray-300 mb-3" strokeWidth={1.5} />
          <p>אין משתמשים רשומים</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="card hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="text-right py-3 pe-4">משתמש</th>
                  <th className="text-right py-3 pe-4">אימייל</th>
                  <th className="text-right py-3 pe-4">הצטרף</th>
                  <th className="text-right py-3 pe-4">עסקאות</th>
                  <th className="text-right py-3 pe-4">העלאות</th>
                  <th className="text-right py-3">העלאה אחרונה</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user: AdminUser) => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 pe-4">
                      <div className="flex items-center gap-2.5">
                        {user.picture ? (
                          <img
                            src={user.picture}
                            alt={user.name}
                            className="w-8 h-8 rounded-lg object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-xs font-bold text-accent-blue">
                            {user.name.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pe-4 text-gray-500 direction-ltr text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {user.email}
                      </span>
                    </td>
                    <td className="py-3 pe-4 text-gray-500 whitespace-nowrap">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-3 pe-4 font-mono">
                      {user.transaction_count.toLocaleString()}
                    </td>
                    <td className="py-3 pe-4 font-mono">
                      {user.upload_count || 0}
                    </td>
                    <td className="py-3 text-gray-500 whitespace-nowrap">
                      {user.last_upload_date ? formatRelative(user.last_upload_date) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {data.users.map((user: AdminUser) => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
