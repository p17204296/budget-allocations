import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";

interface BudgetItem {
  _id: Id<"budgetItems">;
  name: string;
  category: "essentials" | "savings";
  amount: number;
  accountId?: Id<"accounts">;
}

interface Account {
  _id: Id<"accounts">;
  name: string;
  type: "current" | "savings";
}

interface BudgetItemManagerProps {
  category: "essentials" | "savings";
  items: BudgetItem[];
  accounts: Account[];
  currency: string;
}

export function BudgetItemManager({ category, items, accounts, currency }: BudgetItemManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"budgetItems"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    accountId: "",
  });

  const upsertBudgetItem = useMutation(api.budget.upsertBudgetItem);
  const deleteBudgetItem = useMutation(api.budget.deleteBudgetItem);
  const sym = getCurrencySymbol(currency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) return;

    await upsertBudgetItem({
      id: editingId || undefined,
      name: formData.name,
      category,
      amount: parseFloat(formData.amount),
      accountId: formData.accountId ? formData.accountId as Id<"accounts"> : undefined,
    });

    setFormData({ name: "", amount: "", accountId: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (item: BudgetItem) => {
    setFormData({
      name: item.name,
      amount: item.amount.toString(),
      accountId: item.accountId || "",
    });
    setEditingId(item._id);
    setIsAdding(true);
  };

  const handleDelete = async (id: Id<"budgetItems">) => {
    await deleteBudgetItem({ id });
  };

  const handleCancel = () => {
    setFormData({ name: "", amount: "", accountId: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Existing Items */}
      {items.map((item) => {
        const account = accounts.find(acc => acc._id === item.accountId);
        return (
          <div key={item._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex-1">
              <div className="font-medium text-slate-800">{item.name}</div>
              {account && (
                <div className="text-sm text-slate-500 mt-1">{account.name}</div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-800 text-lg">
                {sym}{item.amount.toLocaleString()}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(item._id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add/Edit Form */}
      {isAdding ? (
        <form onSubmit={handleSubmit} className="p-6 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-4">
            <div>
              <label className="form-label">Item Name</label>
              <input
                type="text"
                placeholder="Enter item name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Amount ({sym})</label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Account</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="form-input"
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account._id} value={account._id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary">
                {editingId ? "Update" : "Add"} Item
              </button>
              <button type="button" onClick={handleCancel} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full p-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
        >
          + Add {category === "essentials" ? "Essential Expense" : "Savings Item"}
        </button>
      )}
    </div>
  );
}
