import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CURRENCIES } from "../lib/currency";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";

export function SettingsPage() {
  const settings = useQuery(api.settings.getUserSettings);
  const user = useQuery(api.auth.loggedInUser);
  const updateCurrency = useMutation(api.settings.updateCurrency);
  const updateEmail = useMutation(api.settings.updateEmail);
  const { signIn } = useAuthActions();

  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [currencySaving, setCurrencySaving] = useState(false);

  // Email form
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const activeCurrency = selectedCurrency ?? settings?.currency ?? "GBP";

  const handleCurrencySave = async () => {
    if (!selectedCurrency) return;
    setCurrencySaving(true);
    try {
      await updateCurrency({ currency: selectedCurrency });
      toast.success("Currency updated successfully");
      setSelectedCurrency(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update currency");
    } finally {
      setCurrencySaving(false);
    }
  };

  const handleEmailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setEmailSaving(true);
    try {
      await updateEmail({ email: newEmail });
      toast.success("Email updated successfully");
      setNewEmail("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update email");
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPasswordSaving(true);
    try {
      // Re-authenticate with current password then set new one
      await signIn("password", {
        email: user?.email ?? "",
        password: currentPassword,
        flow: "signIn",
      });
      await signIn("password", {
        email: user?.email ?? "",
        password: newPassword,
        flow: "signUp",
      });
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error("Current password is incorrect or update failed");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-600 mt-1">Manage your preferences and account details</p>
      </div>

      {/* Currency Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-xl">💱</span> Currency
          </h2>
          <p className="text-sm text-slate-500 mt-1">Choose the currency used across your budget</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setSelectedCurrency(c.code)}
                className={`flex items-center gap-2 px-3 py-3 rounded-lg border-2 text-left transition-all ${
                  activeCurrency === c.code
                    ? "border-slate-700 bg-slate-50 text-slate-800"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <span className="text-lg font-bold w-8 text-center">{c.symbol}</span>
                <div>
                  <div className="text-xs font-semibold">{c.code}</div>
                  <div className="text-xs text-slate-500 truncate">{c.name}</div>
                </div>
              </button>
            ))}
          </div>
          {selectedCurrency && selectedCurrency !== settings?.currency && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCurrencySave}
                disabled={currencySaving}
                className="btn-primary disabled:opacity-50"
              >
                {currencySaving ? "Saving..." : "Save Currency"}
              </button>
              <button
                onClick={() => setSelectedCurrency(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Email Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-xl">✉️</span> Email Address
          </h2>
          {user?.email && (
            <p className="text-sm text-slate-500 mt-1">
              Current: <span className="font-medium text-slate-700">{user.email}</span>
            </p>
          )}
        </div>
        <div className="p-6">
          <form onSubmit={handleEmailSave} className="space-y-4">
            <div>
              <label className="form-label">New Email Address</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="form-input"
                placeholder="Enter new email address"
                required
              />
            </div>
            <button
              type="submit"
              disabled={emailSaving || !newEmail}
              className="btn-primary disabled:opacity-50"
            >
              {emailSaving ? "Updating..." : "Update Email"}
            </button>
          </form>
        </div>
      </div>

      {/* Password Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-xl">🔒</span> Change Password
          </h2>
          <p className="text-sm text-slate-500 mt-1">Update your account password</p>
        </div>
        <div className="p-6">
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div>
              <label className="form-label">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="form-input"
                placeholder="Enter current password"
                required
              />
            </div>
            <div>
              <label className="form-label">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div>
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="Repeat new password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="btn-primary disabled:opacity-50"
            >
              {passwordSaving ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
