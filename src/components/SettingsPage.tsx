import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { CURRENCIES } from "../lib/currency";
import { Card, Icon, PageHeader } from "./ui";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function SettingsPage({ isGuest }: { isGuest: boolean }) {
  const settings = useQuery(api.settings.getUserSettings);
  const user = useQuery(api.auth.loggedInUser);
  const updateCurrency = useMutation(api.settings.updateCurrency);
  const updateEmail = useMutation(api.settings.updateEmail);
  const { signIn } = useAuthActions();
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [currencySaving, setCurrencySaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const activeCurrency = selectedCurrency ?? settings?.currency ?? "GBP";

  const saveCurrency = async () => {
    if (!selectedCurrency) return;
    setCurrencySaving(true);
    try { await updateCurrency({ currency: selectedCurrency }); toast.success("Currency updated"); setSelectedCurrency(null); }
    catch (error) { toast.error(errorMessage(error, "Could not update currency")); }
    finally { setCurrencySaving(false); }
  };
  const saveEmail = async (event: React.FormEvent) => {
    event.preventDefault(); if (!newEmail) return; setEmailSaving(true);
    try { await updateEmail({ email: newEmail }); toast.success("Email updated"); setNewEmail(""); }
    catch (error) { toast.error(errorMessage(error, "Could not update email")); }
    finally { setEmailSaving(false); }
  };
  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match"); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setPasswordSaving(true);
    try {
      await signIn("password", { email: user?.email ?? "", password: currentPassword, flow: "signIn" });
      await signIn("password", { email: user?.email ?? "", password: newPassword, flow: "signUp" });
      toast.success("Password updated"); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch { toast.error("Current password is incorrect or the update failed"); }
    finally { setPasswordSaving(false); }
  };

  return (
    <div className="page-stack settings-page">
      <PageHeader eyebrow="Make it yours" title="Settings" description="Choose how your budget is displayed and keep your account details up to date." />
      <Card className="settings-card"><div className="settings-intro"><span><Icon name="currency" /></span><div><h2>Display currency</h2><p>Used for every amount across your budget.</p></div></div><div className="settings-body"><div className="currency-grid">{CURRENCIES.map((currency) => <button type="button" key={currency.code} onClick={() => setSelectedCurrency(currency.code)} className={activeCurrency === currency.code ? "active" : ""} aria-pressed={activeCurrency === currency.code}><strong>{currency.symbol}</strong><span><b>{currency.code}</b><small>{currency.name}</small></span></button>)}</div>{selectedCurrency && selectedCurrency !== settings?.currency ? <div className="form-actions"><button type="button" className="btn-primary" onClick={() => void saveCurrency()} disabled={currencySaving}>{currencySaving ? "Saving…" : "Save currency"}</button><button type="button" className="btn-secondary" onClick={() => setSelectedCurrency(null)}>Cancel</button></div> : null}</div></Card>
      {!isGuest ? <div className="settings-grid">
        <Card className="settings-card"><div className="settings-intro"><span><Icon name="mail" /></span><div><h2>Email address</h2><p>{user?.email ? `Currently ${user.email}` : "Update your sign-in email."}</p></div></div><form className="settings-body settings-form" onSubmit={saveEmail}><label><span>New email address</span><input type="email" className="form-input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" required /></label><button type="submit" className="btn-primary" disabled={emailSaving || !newEmail}>{emailSaving ? "Updating…" : "Update email"}</button></form></Card>
        <Card className="settings-card"><div className="settings-intro"><span><Icon name="lock" /></span><div><h2>Change password</h2><p>Use at least 8 characters.</p></div></div><form className="settings-body settings-form" onSubmit={savePassword}><label><span>Current password</span><input type="password" className="form-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></label><label><span>New password</span><input type="password" className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label><label><span>Confirm new password</span><input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label><button type="submit" className="btn-primary" disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}>{passwordSaving ? "Updating…" : "Update password"}</button></form></Card>
      </div> : <Card><div className="guest-settings-note"><Icon name="shield" /><div><h2>Temporary guest account</h2><p>Your budget and currency choices are fully editable for seven days. Create an account when you want permanent sign-in details.</p></div></div></Card>}
    </div>
  );
}
