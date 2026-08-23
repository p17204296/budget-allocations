import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";
import { Card, EmptyState, Icon, IconButton, PageHeader, SectionTitle } from "./ui";

interface Account { _id: Id<"accounts">; name: string; type: "current" | "savings"; balance?: number; }
interface Props { accounts: Account[]; currency: string; }
const emptyForm = { name: "", type: "current" as const, balance: "" };

export function AccountManager({ accounts, currency }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"accounts"> | null>(null);
  const [formData, setFormData] = useState<{ name: string; type: "current" | "savings"; balance: string }>(emptyForm);
  const upsertAccount = useMutation(api.budget.upsertAccount);
  const deleteAccount = useMutation(api.budget.deleteAccount);
  const symbol = getCurrencySymbol(currency);

  const resetForm = () => { setFormData(emptyForm); setIsAdding(false); setEditingId(null); };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name) return;
    await upsertAccount({ id: editingId ?? undefined, name: formData.name, type: formData.type, balance: formData.balance ? parseFloat(formData.balance) : undefined });
    resetForm();
  };
  const editAccount = (account: Account) => { setFormData({ name: account.name, type: account.type, balance: account.balance?.toString() ?? "" }); setEditingId(account._id); setIsAdding(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const removeAccount = async (account: Account) => { if (confirm(`Remove ${account.name}? It will also be unassigned from budget items.`)) await deleteAccount({ id: account._id }); };
  const currentAccounts = accounts.filter((account) => account.type === "current");
  const savingsAccounts = accounts.filter((account) => account.type === "savings");

  const renderGroup = (title: string, subtitle: string, group: Account[], accent: "coral" | "mint") => (
    <Card>
      <SectionTitle title={title} subtitle={subtitle} accent={accent} value={`${group.length} ${group.length === 1 ? "account" : "accounts"}`} />
      <div className="surface-body manager-list">
        {group.map((account) => <article className="account-row" key={account._id}><div className={`account-avatar ${account.type}`}><Icon name="accounts" /></div><div className="account-copy"><h3>{account.name}</h3><p>{account.balance === undefined ? "Balance not added" : `${symbol}${account.balance.toLocaleString()} balance`}</p></div><div className="row-actions"><IconButton label={`Edit ${account.name}`} icon="edit" onClick={() => editAccount(account)} /><IconButton label={`Delete ${account.name}`} icon="trash" tone="danger" onClick={() => void removeAccount(account)} /></div></article>)}
        {group.length === 0 ? <EmptyState title={`No ${title.toLowerCase()}`} description="Add an account to organise your budget allocations." /> : null}
      </div>
    </Card>
  );

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Your money homes" title="Accounts" description="Keep the accounts that receive income and pay your monthly commitments in one clear view." action={!isAdding ? <button type="button" onClick={() => setIsAdding(true)} className="btn-primary"><Icon name="plus" />Add account</button> : undefined} />
      {isAdding ? <Card><SectionTitle title={editingId ? "Edit account" : "Add an account"} subtitle="Use a name you will recognise at a glance" /><form onSubmit={handleSubmit} className="surface-body inline-form"><div className="form-grid form-grid-name"><label><span>Account name</span><input className="form-input" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Everyday account" autoFocus required /></label></div><div className="form-grid"><label><span>Account type</span><select className="form-input" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as "current" | "savings" })}><option value="current">Current account</option><option value="savings">Savings account</option></select></label><label><span>Balance ({symbol}) <small>optional</small></span><input className="form-input" type="number" step="0.01" value={formData.balance} onChange={(e) => setFormData({ ...formData, balance: e.target.value })} placeholder="0.00" /></label></div><div className="form-actions"><button type="submit" className="btn-primary">{editingId ? "Save changes" : "Add account"}</button><button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button></div></form></Card> : null}
      <div className="two-column-groups">{renderGroup("Current accounts", "For everyday bills and spending", currentAccounts, "coral")}{renderGroup("Savings accounts", "For goals and money set aside", savingsAccounts, "mint")}</div>
    </div>
  );
}
