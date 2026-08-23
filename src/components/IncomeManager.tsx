import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";

interface Income {
  _id: Id<"income">;
  amount: number;
  description: string;
}

interface IncomeManagerProps {
  income: Income[];
  currency: string;
}

export function IncomeManager({ income, currency }: IncomeManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"income"> | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
  });

  const upsertIncome = useMutation(api.budget.upsertIncome);
  const deleteIncome = useMutation(api.budget.deleteIncome);
  const sym = getCurrencySymbol(currency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    await upsertIncome({
      id: editingId || undefined,
      description: formData.description,
      amount: parseFloat(formData.amount),
    });

    setFormData({ description: "", amount: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (item: Income) => {
    setFormData({
      description: item.description,
      amount: item.amount.toString(),
    });
    setEditingId(item._id);
    setIsAdding(true);
  };

  const handleDelete = async (id: Id<"income">) => {
    if (confirm("Are you sure you want to delete this income source?")) {
      await deleteIncome({ id });
    }
  };

  const handleCancel = () => {
    setFormData({ description: "", amount: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Income Management</h1>
          <p className="text-slate-600 mt-1">
            Total Monthly Income: <span className="font-semibold text-slate-800">{sym}{totalIncome.toLocaleString()}</span>
          </p>
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="btn-primary">
            Add Income Source
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-800">
              {editingId ? "Edit Income Source" : "Add New Income Source"}
            </h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="form-label">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Primary Salary, Freelance Work, Rental Income"
                  required
                />
              </div>
              <div>
                <label className="form-label">Monthly Amount ({sym})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="form-input"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary">
                  {editingId ? "Update" : "Add"} Income Source
                </button>
                <button type="button" onClick={handleCancel} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Income List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-800">Income Sources</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {income.map((item) => (
              <div key={item._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="font-medium text-slate-800">{item.description}</div>
                  <div className="text-sm text-slate-500 mt-1">Monthly income</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-slate-800 text-lg">
                    {sym}{item.amount.toLocaleString()}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(item)} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" title="Edit">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(item._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {income.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <div className="text-lg font-medium mb-2">No income sources</div>
                <div className="text-sm">Add your first income source to get started</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
