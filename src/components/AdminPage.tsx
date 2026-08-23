import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Card, EmptyState, Icon, PageHeader } from "./ui";

type AdminSection = "feedback" | "users";
type FeedbackStatus = "new" | "reviewed" | "archived";
type ResetTarget = { email: string; name: string | null };

const statusLabels: Record<FeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  archived: "Archived",
};

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function ResetPasswordDialog({ target, onClose }: { target: ResetTarget | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { signIn } = useAuthActions();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (target && dialogRef.current && !dialogRef.current.open) {
      setError("");
      dialogRef.current.showModal();
    }
  }, [target]);

  if (!target) return null;

  const sendResetCode = async () => {
    setIsSending(true);
    setError("");
    try {
      await signIn("password", { email: target.email, flow: "reset" });
      toast.success(`A password reset code was sent to ${target.email}.`);
      onClose();
    } catch {
      setError("The reset code could not be sent. Check the email configuration and try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="reset-dialog-title"
      aria-describedby="reset-dialog-description"
      onCancel={(event) => { event.preventDefault(); if (!isSending) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !isSending) onClose(); }}
    >
      <div className="confirm-dialog-panel reset-dialog-panel">
        <span className="confirm-dialog-icon reset-dialog-icon"><Icon name="mail" /></span>
        <p className="eyebrow">Account recovery</p>
        <h2 id="reset-dialog-title">Send a reset code?</h2>
        <p id="reset-dialog-description">
          We’ll email a one-time code to <strong>{target.email}</strong>. The user will choose their own new password; you won’t see or set it.
        </p>
        {error ? <p className="confirm-dialog-error" role="alert">{error}</p> : null}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSending} autoFocus>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => void sendResetCode()} disabled={isSending}>{isSending ? "Sending…" : "Send reset code"}</button>
        </div>
      </div>
    </dialog>
  );
}

export function AdminPage({ passwordResetEnabled }: { passwordResetEnabled: boolean }) {
  const feedback = useQuery(api.admin.listFeedback);
  const users = useQuery(api.admin.listUsers);
  const updateFeedbackStatus = useMutation(api.admin.updateFeedbackStatus);
  const [section, setSection] = useState<AdminSection>("feedback");
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackStatus | "all">("new");
  const [search, setSearch] = useState("");
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);

  const filteredFeedback = useMemo(() => {
    if (!feedback) return [];
    return feedbackFilter === "all" ? feedback : feedback.filter((item) => item.status === feedbackFilter);
  }, [feedback, feedbackFilter]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const value = search.trim().toLowerCase();
    if (!value) return users;
    return users.filter((user) => `${user.name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(value));
  }, [search, users]);

  const newFeedbackCount = feedback?.filter((item) => item.status === "new").length ?? 0;
  const registeredUserCount = users?.filter((user) => !user.isAnonymous).length ?? 0;

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Private workspace"
        title="Admin centre"
        description="Review user feedback and help people regain access without handling their passwords."
      />

      <div className="admin-stats" aria-label="Admin overview">
        <Card className="admin-stat"><span>New feedback</span><strong>{feedback ? newFeedbackCount : "—"}</strong></Card>
        <Card className="admin-stat"><span>Registered users</span><strong>{users ? registeredUserCount : "—"}</strong></Card>
        <Card className="admin-stat"><span>Reset email</span><strong className={passwordResetEnabled ? "status-ok" : "status-off"}>{passwordResetEnabled ? "Ready" : "Setup needed"}</strong></Card>
      </div>

      <div className="admin-section-tabs" role="tablist" aria-label="Admin sections">
        <button type="button" role="tab" aria-selected={section === "feedback"} className={section === "feedback" ? "active" : ""} onClick={() => setSection("feedback")}><Icon name="feedback" />Feedback{newFeedbackCount ? <span>{newFeedbackCount}</span> : null}</button>
        <button type="button" role="tab" aria-selected={section === "users"} className={section === "users" ? "active" : ""} onClick={() => setSection("users")}><Icon name="accounts" />Users</button>
      </div>

      {section === "feedback" ? (
        <Card className="admin-panel">
          <header className="admin-panel-header">
            <div><p className="eyebrow">Inbox</p><h2>User feedback</h2></div>
            <label className="admin-filter-label">Show
              <select className="admin-select" value={feedbackFilter} onChange={(event) => setFeedbackFilter(event.target.value as FeedbackStatus | "all")}>
                <option value="new">New</option><option value="reviewed">Reviewed</option><option value="archived">Archived</option><option value="all">All feedback</option>
              </select>
            </label>
          </header>
          {feedback === undefined ? <div className="admin-loading" aria-live="polite">Loading feedback…</div> : filteredFeedback.length === 0 ? <EmptyState title="Nothing in this view" description="Feedback will appear here as users send it." /> : (
            <div className="admin-feedback-list">
              {filteredFeedback.map((item) => (
                <article className="admin-feedback-card" key={item.id}>
                  <div className="admin-feedback-meta">
                    <span className={`feedback-type-badge type-${item.type}`}>{item.type}</span>
                    <time dateTime={new Date(item.createdAt).toISOString()}>{formatDate(item.createdAt)}</time>
                  </div>
                  <p className="admin-feedback-message">{item.message}</p>
                  <div className="admin-feedback-footer">
                    <span><strong>{item.userEmail ?? "Guest user"}</strong> · {item.page}</span>
                    <label>Status<span className="sr-only"> for feedback from {item.userEmail ?? "guest user"}</span>
                      <select className={`admin-select status-${item.status}`} value={item.status} onChange={(event) => void updateFeedbackStatus({ id: item.id, status: event.target.value as FeedbackStatus }).catch(() => toast.error("Feedback status could not be updated."))}>
                        {(Object.keys(statusLabels) as FeedbackStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="admin-panel">
          <header className="admin-panel-header admin-users-header">
            <div><p className="eyebrow">Accounts</p><h2>Users</h2></div>
            <label className="admin-search"><span className="sr-only">Search users</span><input className="form-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" /></label>
          </header>
          {!passwordResetEnabled ? <div className="admin-setup-note"><Icon name="mail" /><div><strong>Password reset email needs setup</strong><p>Add the Resend key and sender address to this deployment before reset codes can be sent.</p></div></div> : null}
          {users === undefined ? <div className="admin-loading" aria-live="polite">Loading users…</div> : filteredUsers.length === 0 ? <EmptyState title="No users found" description="Try a different name or email address." /> : (
            <div className="admin-user-list">
              {filteredUsers.map((user) => (
                <article className="admin-user-row" key={user.id}>
                  <span className="admin-user-avatar" aria-hidden="true">{(user.name ?? user.email ?? "G").slice(0, 1).toUpperCase()}</span>
                  <div className="admin-user-details"><strong>{user.name ?? (user.isAnonymous ? "Guest user" : "Unnamed user")}</strong><span>{user.email ?? "Anonymous session"}</span><small>Joined {formatDate(user.createdAt)}</small></div>
                  {user.email && !user.isAnonymous ? <button type="button" className="btn-secondary admin-reset-button" disabled={!passwordResetEnabled} onClick={() => setResetTarget({ email: user.email!, name: user.name })}><Icon name="lock" />Send reset code</button> : <span className="admin-user-kind">Guest</span>}
                </article>
              ))}
            </div>
          )}
        </Card>
      )}

      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />
    </div>
  );
}
