import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getCategories, getCategoryUsage, createCategory, updateCategory, deleteCategory,
} from '../../services/api';
import type { Category } from 'shared/src/types';
import { AlertTriangle } from 'lucide-react';
import CategoryIcon, { PRESET_ICON_NAMES, getIconComponent } from '../ui/CategoryIcon';

const PRESET_COLORS = [
  '#00D68F', '#FF6B35', '#FF6B6B', '#7C5CFC', '#6C5CE7',
  '#EC4899', '#14B8A6', '#FFC048', '#5A4BD1', '#8B5CF6',
  '#06B6D4', '#D946EF', '#6B7280', '#10B981', '#0EA5E9',
  '#E11D48', '#84CC16', '#F43F5E',
];

interface EditingCategory {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_expense: boolean;
}

interface DeleteModal {
  category: Category;
  reassignTo: string;
}

export default function CategoriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Package');
  const [color, setColor] = useState('#6B7280');
  const [isExpense, setIsExpense] = useState(true);
  const [editing, setEditing] = useState<EditingCategory | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModal | null>(null);

  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: usage } = useQuery({
    queryKey: ['categories-usage'],
    queryFn: getCategoryUsage,
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      resetForm();
      toast.success('קטגוריה נוספה');
    },
    onError: () => toast.error('שגיאה ביצירת קטגוריה'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: number } & Partial<{ name: string; icon: string; color: string; is_expense: boolean }>) =>
      updateCategory(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditing(null);
      toast.success('קטגוריה עודכנה');
    },
    onError: () => toast.error('שגיאה בעדכון קטגוריה'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reassignTo }: { id: number; reassignTo?: number }) =>
      deleteCategory(id, reassignTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories-usage'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['classification-rules'] });
      setDeleteModal(null);
      toast.success('קטגוריה נמחקה');
    },
    onError: () => toast.error('שגיאה במחיקת קטגוריה'),
  });

  const resetForm = () => {
    setShowForm(false);
    setName('');
    setIcon('Package');
    setColor('#6B7280');
    setIsExpense(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, icon, color, is_expense: isExpense });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      name: editing.name,
      icon: editing.icon,
      color: editing.color,
      is_expense: editing.is_expense,
    });
  };

  const handleDelete = () => {
    if (!deleteModal) return;
    const reassignTo = deleteModal.reassignTo ? parseInt(deleteModal.reassignTo) : undefined;
    deleteMutation.mutate({ id: deleteModal.category.id, reassignTo });
  };

  const expenseCategories = categories?.filter((c) => c.is_expense) || [];
  const incomeCategories = categories?.filter((c) => !c.is_expense) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">ניהול קטגוריות</h2>
        <button onClick={() => { setEditing(null); setShowForm(!showForm); }} className="btn-primary">
          {showForm ? 'ביטול' : '+ קטגוריה חדשה'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6">
          <h3 className="font-semibold mb-4">קטגוריה חדשה</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">שם</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: חיות מחמד"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">סוג</label>
              <select
                value={isExpense ? '1' : '0'}
                onChange={(e) => setIsExpense(e.target.value === '1')}
                className="input"
              >
                <option value="1">הוצאה</option>
                <option value="0">הכנסה</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="label">אייקון</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICON_NAMES.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                    icon === ic
                      ? 'bg-primary-100 ring-2 ring-primary-500 scale-110'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <CategoryIcon icon={ic} className="w-5 h-5" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="label">צבע</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color + '20', color }}
            >
              <CategoryIcon icon={icon} className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <span className="text-sm text-gray-500">תצוגה מקדימה: <strong>{name || '...'}</strong></span>
          </div>

          <button type="submit" className="btn-primary mt-4" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'שומר...' : 'צור קטגוריה'}
          </button>
        </form>
      )}

      {/* Expense Categories */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3 text-gray-700">הוצאות ({expenseCategories.length})</h3>
        {expenseCategories.length === 0 ? (
          <p className="text-gray-400 text-sm">אין קטגוריות הוצאה</p>
        ) : (
          <div className="space-y-2">
            {expenseCategories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                count={usage?.[cat.id] || 0}
                isEditing={editing?.id === cat.id}
                editing={editing}
                onEdit={() =>
                  setEditing({
                    id: cat.id,
                    name: cat.name,
                    icon: cat.icon || 'Package',
                    color: cat.color,
                    is_expense: cat.is_expense,
                  })
                }
                onCancelEdit={() => setEditing(null)}
                onSaveEdit={handleUpdate}
                onEditChange={setEditing}
                onDelete={() => setDeleteModal({ category: cat, reassignTo: '' })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Income Categories */}
      <div className="card">
        <h3 className="font-semibold mb-3 text-gray-700">הכנסות ({incomeCategories.length})</h3>
        {incomeCategories.length === 0 ? (
          <p className="text-gray-400 text-sm">אין קטגוריות הכנסה</p>
        ) : (
          <div className="space-y-2">
            {incomeCategories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                count={usage?.[cat.id] || 0}
                isEditing={editing?.id === cat.id}
                editing={editing}
                onEdit={() =>
                  setEditing({
                    id: cat.id,
                    name: cat.name,
                    icon: cat.icon || 'Package',
                    color: cat.color,
                    is_expense: cat.is_expense,
                  })
                }
                onCancelEdit={() => setEditing(null)}
                onSaveEdit={handleUpdate}
                onEditChange={setEditing}
                onDelete={() => setDeleteModal({ category: cat, reassignTo: '' })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <DeleteCategoryModal
          category={deleteModal.category}
          count={usage?.[deleteModal.category.id] || 0}
          reassignTo={deleteModal.reassignTo}
          onReassignChange={(v) => setDeleteModal({ ...deleteModal, reassignTo: v })}
          categories={(categories || []).filter(
            (c) => c.id !== deleteModal.category.id && c.is_expense === deleteModal.category.is_expense
          )}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function CategoryRow({
  category,
  count,
  isEditing,
  editing,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onEditChange,
  onDelete,
}: {
  category: Category;
  count: number;
  isEditing: boolean;
  editing: EditingCategory | null;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (e: React.FormEvent) => void;
  onEditChange: (e: EditingCategory) => void;
  onDelete: () => void;
}) {
  if (isEditing && editing) {
    return (
      <form
        onSubmit={onSaveEdit}
        className="flex items-center gap-3 py-2 px-3 bg-primary-50 rounded-lg border border-primary-200"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: editing.color + '20', color: editing.color }}
        >
          <CategoryIcon icon={editing.icon} className="w-4 h-4" strokeWidth={1.5} />
        </div>
        <input
          value={editing.name}
          onChange={(e) => onEditChange({ ...editing, name: e.target.value })}
          className="input py-1 text-sm flex-1"
          required
        />
        <input
          type="color"
          value={editing.color}
          onChange={(e) => onEditChange({ ...editing, color: e.target.value })}
          className="w-8 h-8 rounded cursor-pointer border-0"
        />
        <select
          value={editing.icon}
          onChange={(e) => onEditChange({ ...editing, icon: e.target.value })}
          className="input py-1 text-sm w-20"
        >
          {PRESET_ICON_NAMES.map((ic) => (
            <option key={ic} value={ic}>{ic}</option>
          ))}
        </select>
        <button type="submit" className="text-primary-600 hover:text-primary-800 text-sm font-medium">
          שמור
        </button>
        <button type="button" onClick={onCancelEdit} className="text-gray-400 hover:text-gray-600 text-sm">
          ביטול
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: category.color + '20', color: category.color }}
        >
          <CategoryIcon icon={category.icon} className="w-4 h-4" strokeWidth={1.5} />
        </div>
        <span className="font-medium text-sm">{category.name}</span>
        {count > 0 && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {count} עסקאות
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
        <button onClick={onEdit} className="text-gray-400 hover:text-primary-600 text-sm">
          עריכה
        </button>
        <button onClick={onDelete} className="text-gray-400 hover:text-danger-500 text-sm">
          מחיקה
        </button>
      </div>
    </div>
  );
}

function DeleteCategoryModal({
  category,
  count,
  reassignTo,
  onReassignChange,
  categories,
  onConfirm,
  onCancel,
  isPending,
}: {
  category: Category;
  count: number;
  reassignTo: string;
  onReassignChange: (v: string) => void;
  categories: Category[];
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold mb-2">מחיקת קטגוריה</h3>
        <p className="text-gray-600 mb-1">
          האם למחוק את הקטגוריה <strong>"{category.name}"</strong>?
        </p>

        {count > 0 ? (
          <div className="bg-gold-50 border border-gold-200 rounded-lg p-3 my-4">
            <p className="text-gold-800 text-sm font-medium mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              יש {count} עסקאות משויכות לקטגוריה זו
            </p>
            <p className="text-gold-700 text-sm mb-3">מה לעשות עם העסקאות?</p>
            <select
              value={reassignTo}
              onChange={(e) => onReassignChange(e.target.value)}
              className="input text-sm"
            >
              <option value="">הסר סיווג (יהפכו ללא קטגוריה)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  העבר ל: {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-gray-400 text-sm my-4">אין עסקאות משויכות לקטגוריה זו.</p>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            ביטול
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm bg-danger-500 text-white rounded-lg hover:bg-danger-600 disabled:opacity-50"
          >
            {isPending ? 'מוחק...' : 'מחק קטגוריה'}
          </button>
        </div>
      </div>
    </div>
  );
}
