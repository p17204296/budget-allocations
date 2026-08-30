import { useEffect, useRef, useState, type ReactNode } from "react";

export type IconName =
  | "overview"
  | "allocations"
  | "accounts"
  | "income"
  | "settings"
  | "plus"
  | "edit"
  | "trash"
  | "arrow"
  | "wallet"
  | "shield"
  | "mail"
  | "lock"
  | "currency"
  | "property"
  | "investment"
  | "pension"
  | "debt"
  | "target"
  | "spark"
  | "feedback"
  | "close"
  | "logout";

const paths: Record<IconName, ReactNode> = {
  overview: <><path d="M4 13h6V4H4v9Z"/><path d="M14 20h6v-9h-6v9Z"/><path d="M4 20h6v-3H4v3Z"/><path d="M14 7h6V4h-6v3Z"/></>,
  allocations: <><path d="M4 6h16"/><path d="M7 6v12"/><path d="M17 6v12"/><path d="M4 18h16"/><circle cx="7" cy="11" r="2"/><circle cx="17" cy="14" r="2"/></>,
  accounts: <><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z"/><path d="M6 6V5a2 2 0 0 1 2-2h9"/></>,
  income: <><path d="M12 3v18"/><path d="m17 8-5-5-5 5"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.09A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3h4v.09A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 21 10h.09v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"/></>,
  trash: <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v5M14 11v5"/></>,
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  wallet: <><path d="M4 7h15a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12v4"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/></>,
  shield: <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  currency: <><circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.7-1-1.8-1.5-3.2-1.5-2 0-3.3 1-3.3 2.5 0 3.8 7 1.7 7 5.2 0 1.5-1.4 2.5-3.5 2.5-1.6 0-3-.6-3.8-1.8"/><path d="M13 5v14"/></>,
  property: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
  investment: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M2 19h22"/></>,
  pension: <><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/><path d="M12 13v8"/></>,
  debt: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  spark: <><path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>,
  feedback: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 9h8M8 13h5"/></>,
  close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
  logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></>,
};

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`surface ${className}`}>{children}</section>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <div className="page-heading-copy">{description}</div>
      </div>
      {action ? <div className="page-heading-action">{action}</div> : null}
    </header>
  );
}

export function IconButton({ label, icon, tone = "default", onClick }: { label: string; icon: "edit" | "trash"; tone?: "default" | "danger"; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`icon-button ${tone === "danger" ? "icon-button-danger" : ""}`} aria-label={label} title={label}><Icon name={icon} className="h-4 w-4" /></button>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-state-mark"><Icon name="spark" /></span><h3>{title}</h3><p>{description}</p></div>;
}

export function SectionTitle({ title, subtitle, accent = "ink", value }: { title: string; subtitle?: string; accent?: "ink" | "amber" | "mint" | "coral"; value?: string }) {
  return <div className="section-title"><div className="section-title-copy"><span className={`section-dot dot-${accent}`} /><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div></div>{value ? <strong>{value}</strong> : null}</div>;
}

export function ConfirmDialog({ open, title, description, confirmLabel = "Delete", onConfirm, onCancel }: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) {
      setError("");
      dialog.showModal();
    }
  }, [open]);

  if (!open) return null;

  const confirm = async () => {
    setIsPending(true);
    setError("");
    try {
      await onConfirm();
    } catch {
      setError("That item could not be deleted. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" onCancel={(event) => { event.preventDefault(); if (!isPending) onCancel(); }} onClick={(event) => { if (event.target === event.currentTarget && !isPending) onCancel(); }}>
      <div className="confirm-dialog-panel">
        <span className="confirm-dialog-icon"><Icon name="trash" /></span>
        <p className="eyebrow">Please confirm</p>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
        {error ? <p className="confirm-dialog-error" role="alert">{error}</p> : null}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={isPending} autoFocus>Cancel</button>
          <button type="button" className="btn-danger" onClick={() => void confirm()} disabled={isPending}>{isPending ? "Deleting…" : confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
