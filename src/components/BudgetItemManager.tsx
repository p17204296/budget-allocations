import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";
import { EmptyState, Icon, IconButton } from "./ui";

interface BudgetItem { _id: Id<"budgetItems">; name: string; category: "essentials" | "savings"; amount: number; accountId?: Id<"accounts">; }
interface Account { _id: Id<"accounts">; name: string; type: "current" | "savings"; }
interface Props { category: "essentials" | "savings"; items: BudgetItem[]; accounts: Account[]; currency: string; }
interface BudgetItemFormData { name: string; amount: string; accountId: string; }

const emptyForm = { name: "", amount: "", accountId: "" };

export function BudgetItemManager({ category, items, accounts, currency }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"budgetItems"> | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const upsertBudgetItem = useMutation(api.budget.upsertBudgetItem);
  const deleteBudgetItem = useMutation(api.budget.deleteBudgetItem);
  const symbol = getCurrencySymbol(currency);

  const resetForm = () => { setFormData(emptyForm); setIsAdding(false); setEditingId(null); };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name || !formData.amount) return;
    await upsertBudgetItem({ id: editingId ?? undefined, name: formData.name, category, amount: parseFloat(formData.amount), accountId: formData.accountId ? formData.accountId as Id<"accounts"> : undefined });
    resetForm();
  };
  const handleEdit = (item: BudgetItem) => {
    setFormData({ name: item.name, amount: item.amount.toString(), accountId: item.accountId ?? "" });
    setEditingId(item._id);
    setIsAdding(false);
  };

  return (
    <div className="manager-list">
      {items.length === 0 && !isAdding ? <EmptyState title="Nothing here yet" description={`Add your first ${category === "essentials" ? "essential expense" : "savings goal"} to start shaping this part of your budget.`} /> : null}
      {items.map((item) => {
        const account = accounts.find((candidate) => candidate._id === item.accountId);
        const isEditing = editingId === item._id;
        return (
          <div className={`money-item-block ${isEditing ? "editing" : ""}`} key={item._id}>
            <article className="money-row">
              <div className="money-row-main"><span className={`item-mark ${category}`} /> <div><h3>{item.name}</h3><p>{account?.name ?? "No account assigned"}</p></div></div>
              <div className="money-row-end"><strong>{symbol}{item.amount.toLocaleString()}</strong><div className="row-actions"><IconButton label={`Edit ${item.name}`} icon="edit" onClick={() => handleEdit(item)} /><IconButton label={`Delete ${item.name}`} icon="trash" tone="danger" onClick={() => void deleteBudgetItem({ id: item._id })} /></div></div>
            </article>
            {isEditing ? <BudgetItemForm category={category} accounts={accounts} symbol={symbol} formData={formData} isEditing onChange={(field, value) => setFormData((current) => ({ ...current, [field]: value }))} onSubmit={handleSubmit} onCancel={resetForm} /> : null}
          </div>
        );
      })}

      {isAdding ? <BudgetItemForm category={category} accounts={accounts} symbol={symbol} formData={formData} isEditing={false} onChange={(field, value) => setFormData((current) => ({ ...current, [field]: value }))} onSubmit={handleSubmit} onCancel={resetForm} /> : null}
      {!isAdding && editingId === null ? (
        <button type="button" onClick={() => setIsAdding(true)} className="add-row"><span><Icon name="plus" /></span>Add {category === "essentials" ? "expense" : "savings goal"}</button>
      ) : null}
    </div>
  );
}

function BudgetItemForm({ category, accounts, symbol, formData, isEditing, onChange, onSubmit, onCancel }: {
  category: "essentials" | "savings";
  accounts: Account[];
  symbol: string;
  formData: BudgetItemFormData;
  isEditing: boolean;
  onChange: (field: keyof BudgetItemFormData, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className={`inline-form ${isEditing ? "contextual-editor" : ""}`}>
      {isEditing ? <div className="inline-form-heading"><span>Editing item</span><strong>{formData.name}</strong></div> : null}
      <div className="form-grid form-grid-name"><label><span>Item name</span><input type="text" placeholder={category === "essentials" ? "e.g. Rent" : "e.g. Emergency fund"} value={formData.name} onChange={(event) => onChange("name", event.target.value)} className="form-input" required autoFocus={!isEditing} /></label></div>
      <div className="form-grid"><label><span>Monthly amount ({symbol})</span><input type="number" placeholder="0.00" min="0" step="0.01" value={formData.amount} onChange={(event) => onChange("amount", event.target.value)} className="form-input" required /></label><label><span>Paid from</span><select value={formData.accountId} onChange={(event) => onChange("accountId", event.target.value)} className="form-input"><option value="">No account yet</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}</select></label></div>
      <div className="form-actions"><button type="submit" className="btn-primary">{isEditing ? "Save changes" : "Add item"}</button><button type="button" onClick={onCancel} className="btn-secondary">Cancel</button></div>
    </form>
  );
}
