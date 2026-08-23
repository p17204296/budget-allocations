import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";

interface Account {
  _id: Id<"accounts">;
  name: string;
  type: "current" | "savings";
  balance?: number;
}

interface AccountManagerProps {
  accounts: Account[];
  currency: string;
}

export function AccountManager({ accounts, currency }: AccountManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"accounts"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "current" as "current" | "savings",
    balance: "",
  });

  const upsertAccount = useMutation(api.budget.upsertAccount);
  const deleteAccount = useMutation(api.budget.deleteAccount);
  const sym = getCurrencySymbol(currency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    await upsertAccount({
      id: editingId || undefined,
      name: formData.name,
      type: formData.type,
      balance: formData.balance ? parseFloat(formData.balance) : undefined,
    });

    setFormData({ name: "", type: "current", balance: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (account: Account) => {
    setFormData({
      name: account.name,
      type: account.type,
      balance: account.balance?.toString() || "",
    });
    setEditingId(account._id);
    setIsAdding(true);
  };

  const handleDelete = async (id: Id<"accounts">) => {
    if (confirm("Are you sure? This will remove the account from all budget items.")) {
      await deleteAccount({ id });
    }
  };

  const handleCancel = () => {
    setFormData({ name: "", type: "current", balance: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const currentAccounts = accounts.filter(acc => acc.type === "current");
  const savingsAccounts = accounts.filter(acc => acc.type === "savings");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Account Management</h1>
          <p className="text-slate-600 mt-1">Manage your financial accounts and balances</p>
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="btn-primary">
            Add Account
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-800">
              {editingId ? "Edit Account" : "Add New Account"}
            </h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="form-label">Account Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Halifax Current Account"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Account Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as "current" | "savings" })}
                    className="form-input"
                  >
                    <option value="current">Current Account</option>
                    <option value="savings">Savings Account</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Current Balance (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    className="form-input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary">
                  {editingId ? "Update" : "Add"} Account
                </button>
                <button type="button" onClick={handleCancel} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Current Accounts */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-800">Current Accounts</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {currentAccounts.map((account) => (
              <div key={account._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="font-medium text-slate-800">{account.name}</div>
                  {account.balance !== undefined && (
                    <div className="text-sm text-slate-500 mt-1">
                      Balance: {sym}{account.balance.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(account)} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(account._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {currentAccounts.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <div className="text-lg font-medium mb-2">No current accounts</div>
                <div className="text-sm">Add your first current account to get started</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Savings Accounts */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-800">Savings Accounts</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {savingsAccounts.map((account) => (
              <div key={account._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="font-medium text-slate-800">{account.name}</div>
                  {account.balance !== undefined && (
                    <div className="text-sm text-slate-500 mt-1">
                      Balance: {sym}{account.balance.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(account)} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(account._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {savingsAccounts.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <div className="text-lg font-medium mb-2">No savings accounts</div>
                <div className="text-sm">Add your first savings account to get started</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
