import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";
import { Card, ConfirmDialog, EmptyState, Icon, IconButton, PageHeader, SectionTitle } from "./ui";

interface Income { _id: Id<"income">; amount: number; description: string; }
interface Props { income: Income[]; currency: string; }
const emptyForm = { description: "", amount: "" };

export function IncomeManager({ income, currency }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"income"> | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Income | null>(null);
  const upsertIncome = useMutation(api.budget.upsertIncome);
  const deleteIncome = useMutation(api.budget.deleteIncome);
  const symbol = getCurrencySymbol(currency);
  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);

  const resetForm = () => { setFormData(emptyForm); setIsAdding(false); setEditingId(null); };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!formData.description || !formData.amount) return; await upsertIncome({ id: editingId ?? undefined, description: formData.description, amount: parseFloat(formData.amount) }); resetForm(); };
  const edit = (item: Income) => { setFormData({ description: item.description, amount: item.amount.toString() }); setEditingId(item._id); setIsAdding(true); };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="What comes in" title="Monthly income" description={<>Your current income plan totals <strong className="inline-total">{symbol}{totalIncome.toLocaleString()}</strong> each month.</>} action={!isAdding ? <button className="btn-primary" type="button" onClick={() => setIsAdding(true)}><Icon name="plus" />Add income</button> : undefined} />
      {isAdding ? <Card><SectionTitle title={editingId ? "Edit income" : "Add income"} subtitle="Enter the amount you can reliably plan with each month" /><form className="surface-body inline-form" onSubmit={submit}><div className="form-grid"><label><span>Income source</span><input type="text" className="form-input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="e.g. Main salary" autoFocus required /></label><label><span>Monthly amount ({symbol})</span><input type="number" className="form-input" step="0.01" min="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" required /></label></div><div className="form-actions"><button type="submit" className="btn-primary">{editingId ? "Save changes" : "Add income"}</button><button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button></div></form></Card> : null}
      <Card><SectionTitle title="Income sources" subtitle="Money available to fund your monthly plan" accent="mint" value={`${symbol}${totalIncome.toLocaleString()}`} /><div className="surface-body manager-list">{income.map((item) => <article className="money-row income-row" key={item._id}><div className="money-row-main"><span className="income-icon"><Icon name="income" /></span><div><h3>{item.description}</h3><p>Recurring monthly income</p></div></div><div className="money-row-end"><strong>{symbol}{item.amount.toLocaleString()}</strong><div className="row-actions"><IconButton label={`Edit ${item.description}`} icon="edit" onClick={() => edit(item)} /><IconButton label={`Delete ${item.description}`} icon="trash" tone="danger" onClick={() => setDeleteTarget(item)} /></div></div></article>)}{income.length === 0 ? <EmptyState title="No income added" description="Add your first income source to see what is available for your monthly plan." /> : null}</div></Card>
      <ConfirmDialog open={deleteTarget !== null} title={`Delete ${deleteTarget?.description ?? "this income source"}?`} description="This income source will be permanently removed from your monthly total. This action cannot be undone." onCancel={() => setDeleteTarget(null)} onConfirm={async () => { if (!deleteTarget) return; await deleteIncome({ id: deleteTarget._id }); setDeleteTarget(null); }} />
    </div>
  );
}
