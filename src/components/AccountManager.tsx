import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";
import { Card, ConfirmDialog, EmptyState, Icon, IconButton, PageHeader, SectionTitle, type IconName } from "./ui";

type Account = { _id: Id<"accounts">; name: string; type: "current" | "savings"; balance?: number };
type AssetType = "property" | "investment" | "pension" | "vehicle" | "business" | "valuables" | "crypto" | "other";
type Asset = { _id: Id<"assets">; name: string; type: AssetType; customType?: string; currentValue: number };
type LiabilityType = "credit_card" | "loan" | "mortgage" | "other";
type Liability = { _id: Id<"liabilities">; name: string; type: LiabilityType; outstandingBalance: number };
type DeleteTarget = { kind: "account"; item: Account } | { kind: "asset"; item: Asset } | { kind: "liability"; item: Liability };
type Editor = "account" | "asset" | "liability" | null;

const emptyAccount = { name: "", type: "current" as const, balance: "" };
const emptyAsset = { name: "", type: "property" as AssetType, customType: "", currentValue: "" };
const emptyLiability = { name: "", type: "mortgage" as LiabilityType, outstandingBalance: "" };

const assetLabels: Record<AssetType, string> = {
  property: "Property",
  investment: "Investment",
  pension: "Pension",
  vehicle: "Vehicle",
  business: "Business ownership",
  valuables: "Valuables",
  crypto: "Crypto",
  other: "Other asset",
};
const assetIcons: Record<AssetType, IconName> = {
  property: "property",
  investment: "investment",
  pension: "pension",
  vehicle: "vehicle",
  business: "business",
  valuables: "valuables",
  crypto: "crypto",
  other: "spark",
};
const liabilityLabels: Record<LiabilityType, string> = { credit_card: "Credit card", loan: "Loan", mortgage: "Mortgage", other: "Other debt" };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "That change could not be saved.";
}

function formatMoney(value: number, symbol: string) {
  return `${value < 0 ? "−" : ""}${symbol}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function AccountManager({ currency }: { currency: string }) {
  const picture = useQuery(api.budget.getMoneyPicture);
  const upsertAccount = useMutation(api.budget.upsertAccount);
  const deleteAccount = useMutation(api.budget.deleteAccount);
  const upsertAsset = useMutation(api.budget.upsertAsset);
  const deleteAsset = useMutation(api.budget.deleteAsset);
  const upsertLiability = useMutation(api.budget.upsertLiability);
  const deleteLiability = useMutation(api.budget.deleteLiability);
  const [editor, setEditor] = useState<Editor>(null);
  const [accountId, setAccountId] = useState<Id<"accounts"> | null>(null);
  const [assetId, setAssetId] = useState<Id<"assets"> | null>(null);
  const [liabilityId, setLiabilityId] = useState<Id<"liabilities"> | null>(null);
  const [accountForm, setAccountForm] = useState<{ name: string; type: "current" | "savings"; balance: string }>(emptyAccount);
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [liabilityForm, setLiabilityForm] = useState(emptyLiability);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const symbol = getCurrencySymbol(currency);

  const resetEditor = () => {
    setEditor(null);
    setAccountId(null);
    setAssetId(null);
    setLiabilityId(null);
    setAccountForm(emptyAccount);
    setAssetForm(emptyAsset);
    setLiabilityForm(emptyLiability);
  };

  const openEditor = (next: Exclude<Editor, null>) => {
    resetEditor();
    setEditor(next);
  };

  if (picture === undefined || picture === null) {
    return <div className="planner-skeleton"><div /><div /><div /></div>;
  }

  const currentAccounts = picture.accounts.filter((account) => account.type === "current");
  const savingsAccounts = picture.accounts.filter((account) => account.type === "savings");

  const editAccount = (account: Account) => {
    resetEditor();
    setAccountId(account._id);
    setAccountForm({ name: account.name, type: account.type, balance: account.balance?.toString() ?? "" });
    setEditor("account");
  };
  const editAsset = (asset: Asset) => {
    resetEditor();
    setAssetId(asset._id);
    setAssetForm({ name: asset.name, type: asset.type, customType: asset.customType ?? "", currentValue: asset.currentValue.toString() });
    setEditor("asset");
  };
  const editLiability = (liability: Liability) => {
    resetEditor();
    setLiabilityId(liability._id);
    setLiabilityForm({ name: liability.name, type: liability.type, outstandingBalance: liability.outstandingBalance.toString() });
    setEditor("liability");
  };

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await upsertAccount({ id: accountId ?? undefined, name: accountForm.name, type: accountForm.type, balance: accountForm.balance === "" ? undefined : Number(accountForm.balance) });
      toast.success(accountId ? "Account updated" : "Account added");
      resetEditor();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };
  const saveAsset = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await upsertAsset({
        id: assetId ?? undefined,
        name: assetForm.name,
        type: assetForm.type,
        customType: assetForm.type === "other" ? assetForm.customType : undefined,
        currentValue: Number(assetForm.currentValue),
      });
      toast.success(assetId ? "Asset updated" : "Asset added");
      resetEditor();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };
  const saveLiability = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await upsertLiability({ id: liabilityId ?? undefined, name: liabilityForm.name, type: liabilityForm.type, outstandingBalance: Number(liabilityForm.outstandingBalance) });
      toast.success(liabilityId ? "Debt updated" : "Debt added");
      resetEditor();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const accountFormView = (isEditing: boolean) => <form onSubmit={saveAccount} className={`${isEditing ? "contextual-editor inline-record-editor" : "surface-body"} inline-form`}>{isEditing ? <div className="inline-form-heading"><span>Editing account</span><strong>{accountForm.name}</strong></div> : null}<div className="form-grid"><label><span>Account name</span><input className="form-input" value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} placeholder="e.g. Everyday account" maxLength={80} autoFocus required /></label><label><span>Account type</span><select className="form-input" value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value as Account["type"] })}><option value="current">Current account</option><option value="savings">Savings account</option></select></label></div><div className="form-grid form-grid-name"><label><span>Current balance ({symbol}) <small>optional</small></span><input className="form-input" type="number" step="0.01" value={accountForm.balance} onChange={(event) => setAccountForm({ ...accountForm, balance: event.target.value })} placeholder="0.00" /></label></div><div className="form-actions"><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : isEditing ? "Save changes" : "Add account"}</button><button type="button" className="btn-secondary" onClick={resetEditor} disabled={saving}>Cancel</button></div></form>;

  const assetFormView = (isEditing: boolean) => <form onSubmit={saveAsset} className={`${isEditing ? "contextual-editor inline-record-editor" : "surface-body"} inline-form`}>{isEditing ? <div className="inline-form-heading"><span>Editing asset</span><strong>{assetForm.name}</strong></div> : null}<div className="form-grid"><label><span>Asset name</span><input className="form-input" value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} placeholder="e.g. Workplace pension" maxLength={80} autoFocus required /></label><label><span>Asset type</span><select className="form-input" value={assetForm.type} onChange={(event) => { const type = event.target.value as AssetType; setAssetForm({ ...assetForm, type, customType: type === "other" ? assetForm.customType : "" }); }}>{Object.entries(assetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{assetForm.type === "other" ? <div className="form-grid form-grid-name"><label><span>Custom asset type <small>optional</small></span><input className="form-input" value={assetForm.customType} onChange={(event) => setAssetForm({ ...assetForm, customType: event.target.value })} placeholder="e.g. Collectibles or trust" maxLength={40} /></label></div> : null}<div className="form-grid form-grid-name"><label><span>Current value ({symbol})</span><input className="form-input" type="number" min="0" step="0.01" value={assetForm.currentValue} onChange={(event) => setAssetForm({ ...assetForm, currentValue: event.target.value })} placeholder="0.00" required /></label></div><div className="form-actions"><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : isEditing ? "Save changes" : "Add asset"}</button><button type="button" className="btn-secondary" onClick={resetEditor} disabled={saving}>Cancel</button></div></form>;

  const liabilityFormView = (isEditing: boolean) => <form onSubmit={saveLiability} className={`${isEditing ? "contextual-editor inline-record-editor" : "surface-body"} inline-form`}>{isEditing ? <div className="inline-form-heading"><span>Editing debt</span><strong>{liabilityForm.name}</strong></div> : null}<div className="form-grid"><label><span>Debt name</span><input className="form-input" value={liabilityForm.name} onChange={(event) => setLiabilityForm({ ...liabilityForm, name: event.target.value })} placeholder="e.g. Mortgage" maxLength={80} autoFocus required /></label><label><span>Debt type</span><select className="form-input" value={liabilityForm.type} onChange={(event) => setLiabilityForm({ ...liabilityForm, type: event.target.value as LiabilityType })}>{Object.entries(liabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="form-grid form-grid-name"><label><span>Outstanding balance ({symbol})</span><input className="form-input" type="number" min="0" step="0.01" value={liabilityForm.outstandingBalance} onChange={(event) => setLiabilityForm({ ...liabilityForm, outstandingBalance: event.target.value })} placeholder="0.00" required /></label></div><div className="form-actions"><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : isEditing ? "Save changes" : "Add debt"}</button><button type="button" className="btn-secondary" onClick={resetEditor} disabled={saving}>Cancel</button></div></form>;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "account") await deleteAccount({ id: deleteTarget.item._id });
    if (deleteTarget.kind === "asset") await deleteAsset({ id: deleteTarget.item._id });
    if (deleteTarget.kind === "liability") await deleteLiability({ id: deleteTarget.item._id });
    setDeleteTarget(null);
  };

  const accountGroup = (title: string, subtitle: string, accounts: Account[], accent: "coral" | "mint") => (
    <Card>
      <SectionTitle title={title} subtitle={subtitle} accent={accent} value={formatMoney(accounts.reduce((sum, account) => sum + (account.balance ?? 0), 0), symbol)} />
      <div className="surface-body manager-list">
        {accounts.map((account) => {
          const isEditing = editor === "account" && accountId === account._id;
          return <div className={`editable-row-block ${isEditing ? "editing" : ""}`} key={account._id}><article className="account-row"><div className={`account-avatar ${account.type}`}><Icon name="accounts" /></div><div className="account-copy"><h3>{account.name}</h3><p>{account.balance === undefined ? "Balance not added" : `${formatMoney(account.balance, symbol)} balance`}</p></div><div className="row-actions"><IconButton label={`Edit ${account.name}`} icon="edit" onClick={() => editAccount(account)} /><IconButton label={`Delete ${account.name}`} icon="trash" tone="danger" onClick={() => setDeleteTarget({ kind: "account", item: account })} /></div></article>{isEditing ? accountFormView(true) : null}</div>;
        })}
        {accounts.length === 0 ? <EmptyState title={`No ${title.toLowerCase()}`} description="Add an account to complete your cash picture." /> : null}
      </div>
    </Card>
  );

  return (
    <div className="page-stack money-picture-page">
      <PageHeader eyebrow="Your full financial picture" title="Money" description="Bring cash, long-term assets and debts into one calm, manually updated view." />

      <div className="net-worth-stack">
        <Card className="net-worth-card"><div className="net-worth-hero"><div className="summary-kicker"><span><Icon name="investment" /></span>Net worth today</div><p>Everything you own, minus everything you owe</p><h2 className={picture.totals.netWorth < 0 ? "negative" : ""}>{formatMoney(picture.totals.netWorth, symbol)}</h2><small>Manual snapshot · update whenever things change</small></div><div className="net-worth-ledger"><div><span>Cash</span><strong>{formatMoney(picture.totals.cash, symbol)}</strong></div><div><span>Other assets</span><strong>{formatMoney(picture.totals.assets, symbol)}</strong></div><div className="liability-total"><span>Debts</span><strong>−{formatMoney(picture.totals.liabilities, symbol)}</strong></div></div></Card>
        {editor === null ? <div className="net-worth-actions page-heading-actions"><button type="button" onClick={() => openEditor("account")} className="btn-primary"><Icon name="plus" />Account</button><button type="button" onClick={() => openEditor("asset")} className="btn-secondary"><Icon name="plus" />Asset</button><button type="button" onClick={() => openEditor("liability")} className="btn-secondary"><Icon name="plus" />Debt</button></div> : null}
        {editor === "account" && accountId === null ? <Card><SectionTitle title="Add an account" subtitle="Cash balances can include an overdraft" />{accountFormView(false)}</Card> : null}
        {editor === "asset" && assetId === null ? <Card><SectionTitle title="Add an asset" subtitle="Use the best current value you have" />{assetFormView(false)}</Card> : null}
        {editor === "liability" && liabilityId === null ? <Card><SectionTitle title="Add a debt" subtitle="Enter the amount currently outstanding" />{liabilityFormView(false)}</Card> : null}
      </div>

      <div className="two-column-groups">{accountGroup("Current accounts", "Everyday cash and bills", currentAccounts, "coral")}{accountGroup("Savings accounts", "Cash set aside for the future", savingsAccounts, "mint")}</div>

      <div className="two-column-groups balance-sheet-groups">
        <Card><SectionTitle title="Assets" subtitle="Everything you own beyond cash" accent="mint" value={formatMoney(picture.totals.assets, symbol)} /><div className="surface-body manager-list">{picture.assets.map((asset) => { const isEditing = editor === "asset" && assetId === asset._id; return <div className={`editable-row-block ${isEditing ? "editing" : ""}`} key={asset._id}><article className="account-row"><div className="account-avatar asset-avatar"><Icon name={assetIcons[asset.type]} /></div><div className="account-copy"><h3>{asset.name}</h3><p>{asset.type === "other" && asset.customType ? asset.customType : assetLabels[asset.type]}</p></div><strong className="row-value">{formatMoney(asset.currentValue, symbol)}</strong><div className="row-actions"><IconButton label={`Edit ${asset.name}`} icon="edit" onClick={() => editAsset(asset)} /><IconButton label={`Delete ${asset.name}`} icon="trash" tone="danger" onClick={() => setDeleteTarget({ kind: "asset", item: asset })} /></div></article>{isEditing ? assetFormView(true) : null}</div>; })}{picture.assets.length === 0 ? <EmptyState title="No assets added" description="Add property, pensions, vehicles or other assets to complete your net worth." /> : null}</div></Card>
        <Card><SectionTitle title="Debts" subtitle="What is still outstanding" accent="coral" value={formatMoney(picture.totals.liabilities, symbol)} /><div className="surface-body manager-list">{picture.liabilities.map((liability) => { const isEditing = editor === "liability" && liabilityId === liability._id; return <div className={`editable-row-block ${isEditing ? "editing" : ""}`} key={liability._id}><article className="account-row"><div className="account-avatar debt-avatar"><Icon name="debt" /></div><div className="account-copy"><h3>{liability.name}</h3><p>{liabilityLabels[liability.type]}</p></div><strong className="row-value debt-value">{formatMoney(liability.outstandingBalance, symbol)}</strong><div className="row-actions"><IconButton label={`Edit ${liability.name}`} icon="edit" onClick={() => editLiability(liability)} /><IconButton label={`Delete ${liability.name}`} icon="trash" tone="danger" onClick={() => setDeleteTarget({ kind: "liability", item: liability })} /></div></article>{isEditing ? liabilityFormView(true) : null}</div>; })}{picture.liabilities.length === 0 ? <EmptyState title="No debts added" description="Add loans, credit cards or a mortgage for an accurate net worth." /> : null}</div></Card>
      </div>

      <ConfirmDialog open={deleteTarget !== null} title={`Delete ${deleteTarget?.item.name ?? "this item"}?`} description={deleteTarget?.kind === "account" ? "The account will be removed and budget items assigned to it will become unassigned." : "This will permanently remove the item from your money picture."} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
