import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";
import { ConfirmDialog, EmptyState, Icon, IconButton } from "./ui";

interface BudgetItem {
  _id: Id<"budgetItems">;
  name: string;
  category: "essentials" | "savings";
  amount: number;
  accountId?: Id<"accounts">;
  targetAmount?: number;
  currentSaved?: number;
  targetDate?: number;
}
interface Account { _id: Id<"accounts">; name: string; type: "current" | "savings" }
interface Props { category: "essentials" | "savings"; items: BudgetItem[]; accounts: Account[]; currency: string }
interface BudgetItemFormData { name: string; amount: string; accountId: string; targetAmount: string; currentSaved: string; targetDate: string }

const emptyForm: BudgetItemFormData = { name: "", amount: "", accountId: "", targetAmount: "", currentSaved: "", targetDate: "" };
const MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;

function formatDateInput(timestamp?: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatMoney(value: number, symbol: string) {
  return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function goalInsight(item: BudgetItem) {
  const target = item.targetAmount ?? 0;
  const saved = item.currentSaved ?? 0;
  const remaining = Math.max(0, target - saved);
  const progress = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const now = Date.now();
  const monthsToTarget = item.targetDate ? Math.max(0, Math.ceil((item.targetDate - now) / MONTH_MS)) : null;
  const requiredMonthly = monthsToTarget === null ? null : remaining / Math.max(1, monthsToTarget);
  const monthsToFinish = item.amount > 0 ? Math.ceil(remaining / item.amount) : null;
  const estimate = monthsToFinish === null ? null : new Date(new Date().getFullYear(), new Date().getMonth() + monthsToFinish, 1);
  const complete = remaining === 0;
  const overdue = Boolean(item.targetDate && item.targetDate < now && !complete);
  const onTrack = complete || Boolean(item.targetDate && !overdue && requiredMonthly !== null && item.amount >= requiredMonthly);
  return { remaining, progress, requiredMonthly, estimate, complete, overdue, onTrack };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "That item could not be saved.";
}

export function BudgetItemManager({ category, items, accounts, currency }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"budgetItems"> | null>(null);
  const [formData, setFormData] = useState<BudgetItemFormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<BudgetItem | null>(null);
  const [saving, setSaving] = useState(false);
  const upsertBudgetItem = useMutation(api.budget.upsertBudgetItem);
  const deleteBudgetItem = useMutation(api.budget.deleteBudgetItem);
  const symbol = getCurrencySymbol(currency);

  const resetForm = () => { setFormData(emptyForm); setIsAdding(false); setEditingId(null); };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name || formData.amount === "") return;
    setSaving(true);
    try {
      await upsertBudgetItem({
        id: editingId ?? undefined,
        name: formData.name,
        category,
        amount: Number(formData.amount),
        accountId: formData.accountId ? formData.accountId as Id<"accounts"> : undefined,
        targetAmount: category === "savings" && formData.targetAmount ? Number(formData.targetAmount) : undefined,
        currentSaved: category === "savings" && formData.targetAmount ? Number(formData.currentSaved || 0) : undefined,
        targetDate: category === "savings" && formData.targetAmount && formData.targetDate ? new Date(`${formData.targetDate}T12:00:00`).getTime() : undefined,
      });
      toast.success(editingId ? "Plan updated" : category === "savings" ? "Savings goal added" : "Expense added");
      resetForm();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };
  const handleEdit = (item: BudgetItem) => {
    setFormData({
      name: item.name,
      amount: item.amount.toString(),
      accountId: item.accountId ?? "",
      targetAmount: item.targetAmount?.toString() ?? "",
      currentSaved: item.currentSaved?.toString() ?? "",
      targetDate: formatDateInput(item.targetDate),
    });
    setEditingId(item._id);
    setIsAdding(false);
  };

  return (
    <div className="manager-list">
      {items.length === 0 && !isAdding ? <EmptyState title="Nothing here yet" description={`Add your first ${category === "essentials" ? "essential expense" : "savings goal"} to start shaping this part of your budget.`} /> : null}
      {items.map((item) => {
        const account = accounts.find((candidate) => candidate._id === item.accountId);
        const isEditing = editingId === item._id;
        const insight = item.targetAmount ? goalInsight(item) : null;
        return (
          <div className={`money-item-block ${isEditing ? "editing" : ""} ${insight ? "goal-item-block" : ""}`} key={item._id}>
            <article className="money-row">
              <div className="money-row-main"><span className={`item-mark ${category}`} /> <div><h3>{item.name}</h3><p>{account?.name ?? "No account assigned"}</p></div></div>
              <div className="money-row-end"><div className="monthly-amount"><strong>{formatMoney(item.amount, symbol)}</strong><span>/ month</span></div><div className="row-actions"><IconButton label={`Edit ${item.name}`} icon="edit" onClick={() => handleEdit(item)} /><IconButton label={`Delete ${item.name}`} icon="trash" tone="danger" onClick={() => setDeleteTarget(item)} /></div></div>
            </article>
            {insight ? <div className="goal-progress-panel"><div className="goal-progress-heading"><div><span>{formatMoney(item.currentSaved ?? 0, symbol)} saved</span><strong>{insight.progress.toFixed(0)}%</strong></div><div className="goal-track" role="progressbar" aria-label={`${item.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(insight.progress)}><span style={{ width: `${insight.progress}%` }} /></div><small>Target {formatMoney(item.targetAmount ?? 0, symbol)}{item.targetDate ? ` by ${new Date(item.targetDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}</small></div><div className="goal-metrics"><div><span>Remaining</span><strong>{formatMoney(insight.remaining, symbol)}</strong></div><div><span>Needed monthly</span><strong>{insight.requiredMonthly === null || insight.complete ? "—" : formatMoney(Math.ceil(insight.requiredMonthly), symbol)}</strong></div><div><span>Forecast</span><strong>{insight.complete ? "Complete" : insight.estimate ? insight.estimate.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "No forecast"}</strong></div></div><div className={`goal-status ${insight.complete || insight.onTrack ? "on-track" : insight.overdue ? "overdue" : "behind"}`}><Icon name="target" />{insight.complete ? "Goal complete" : insight.overdue ? "Target date has passed" : insight.onTrack ? "On track for the target date" : item.targetDate ? "Increase the monthly contribution to stay on track" : "Add a target date to check your pace"}</div></div> : null}
            {isEditing ? <BudgetItemForm category={category} accounts={accounts} symbol={symbol} formData={formData} isEditing saving={saving} onChange={(field, value) => setFormData((current) => ({ ...current, [field]: value }))} onSubmit={handleSubmit} onCancel={resetForm} /> : null}
          </div>
        );
      })}

      {isAdding ? <BudgetItemForm category={category} accounts={accounts} symbol={symbol} formData={formData} isEditing={false} saving={saving} onChange={(field, value) => setFormData((current) => ({ ...current, [field]: value }))} onSubmit={handleSubmit} onCancel={resetForm} /> : null}
      {!isAdding && editingId === null ? <button type="button" onClick={() => setIsAdding(true)} className="add-row"><span><Icon name="plus" /></span>Add {category === "essentials" ? "expense" : "savings goal"}</button> : null}
      <ConfirmDialog open={deleteTarget !== null} title={`Delete ${deleteTarget?.name ?? "this item"}?`} description="This will permanently remove it from your monthly budget. This action cannot be undone." onCancel={() => setDeleteTarget(null)} onConfirm={async () => { if (!deleteTarget) return; await deleteBudgetItem({ id: deleteTarget._id }); if (editingId === deleteTarget._id) resetForm(); setDeleteTarget(null); }} />
    </div>
  );
}

function BudgetItemForm({ category, accounts, symbol, formData, isEditing, saving, onChange, onSubmit, onCancel }: {
  category: "essentials" | "savings";
  accounts: Account[];
  symbol: string;
  formData: BudgetItemFormData;
  isEditing: boolean;
  saving: boolean;
  onChange: (field: keyof BudgetItemFormData, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const hasTarget = formData.targetAmount !== "";
  return (
    <form onSubmit={onSubmit} className={`inline-form ${isEditing ? "contextual-editor" : ""}`}>
      {isEditing ? <div className="inline-form-heading"><span>Editing item</span><strong>{formData.name}</strong></div> : null}
      <div className="form-grid form-grid-name"><label><span>Item name</span><input type="text" placeholder={category === "essentials" ? "e.g. Rent" : "e.g. Emergency fund"} value={formData.name} onChange={(event) => onChange("name", event.target.value)} className="form-input" maxLength={80} required autoFocus={!isEditing} /></label></div>
      <div className="form-grid"><label><span>Monthly amount ({symbol})</span><input type="number" placeholder="0.00" min="0" step="0.01" value={formData.amount} onChange={(event) => onChange("amount", event.target.value)} className="form-input" required /></label><label><span>Paid from</span><select value={formData.accountId} onChange={(event) => onChange("accountId", event.target.value)} className="form-input"><option value="">No account yet</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}</select></label></div>
      {category === "savings" ? <fieldset className="goal-fields"><legend><Icon name="target" /><span>Goal details <small>optional</small></span></legend><div className="form-grid"><label><span>Target amount ({symbol})</span><input type="number" placeholder="e.g. 10000" min="0.01" step="0.01" value={formData.targetAmount} onChange={(event) => onChange("targetAmount", event.target.value)} className="form-input" /></label><label><span>Already saved ({symbol})</span><input type="number" placeholder="0.00" min="0" step="0.01" value={formData.currentSaved} onChange={(event) => onChange("currentSaved", event.target.value)} className="form-input" disabled={!hasTarget} /></label></div><div className="form-grid form-grid-name"><label><span>Target date</span><input type="date" value={formData.targetDate} onChange={(event) => onChange("targetDate", event.target.value)} className="form-input" disabled={!hasTarget} /></label></div></fieldset> : null}
      <div className="form-actions"><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : isEditing ? "Save changes" : "Add item"}</button><button type="button" onClick={onCancel} className="btn-secondary">Cancel</button></div>
    </form>
  );
}
