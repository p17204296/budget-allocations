"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [resetStep, setResetStep] = useState<"none" | "request" | "verify">("none");
  const [resetEmail, setResetEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordResetAvailable = useQuery(api.auth.passwordResetAvailable);

  if (resetStep !== "none") {
    return (
      <div className="w-full">
        <div className="auth-reset-heading">
          <p className="eyebrow">Account recovery</p>
          <h3>{resetStep === "request" ? "Reset your password" : "Check your email"}</h3>
          <p>{resetStep === "request" ? "We’ll send a one-time code to your email address." : `Enter the code sent to ${resetEmail} and choose a new password.`}</p>
        </div>
        {resetStep === "request" ? (
          <form className="auth-form" onSubmit={(event) => {
            event.preventDefault();
            const email = new FormData(event.currentTarget).get("email")?.toString().trim() ?? "";
            setSubmitting(true);
            void signIn("password", { email, flow: "reset" }).then(() => { setResetEmail(email); setResetStep("verify"); }).catch(() => toast.error("We couldn’t send a reset code. Check the email and try again.")).finally(() => setSubmitting(false));
          }}>
            <input className="auth-input-field" type="email" name="email" placeholder="you@example.com" aria-label="Email address" autoComplete="email" required />
            <button className="auth-button" type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send reset code"}</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const newPassword = formData.get("newPassword")?.toString() ?? "";
            const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
            if (newPassword.length < 8) { toast.error("Use at least 8 characters for your new password."); return; }
            if (newPassword !== confirmPassword) { toast.error("The passwords don’t match."); return; }
            setSubmitting(true);
            void signIn("password", { email: resetEmail, code: formData.get("code")?.toString() ?? "", newPassword, flow: "reset-verification" }).catch(() => { toast.error("That code is invalid or has expired. Request a new one and try again."); setSubmitting(false); });
          }}>
            <input className="auth-input-field auth-code-input" type="text" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} placeholder="8-digit code" aria-label="Reset code" required />
            <input className="auth-input-field" type="password" name="newPassword" autoComplete="new-password" minLength={8} placeholder="New password" aria-label="New password" required />
            <input className="auth-input-field" type="password" name="confirmPassword" autoComplete="new-password" minLength={8} placeholder="Confirm new password" aria-label="Confirm new password" required />
            <button className="auth-button" type="submit" disabled={submitting}>{submitting ? "Updating…" : "Update password"}</button>
            <button type="button" className="auth-link auth-link-centered" onClick={() => setResetStep("request")} disabled={submitting}>Request a new code</button>
          </form>
        )}
        <button type="button" className="auth-back-button" onClick={() => { setResetStep("none"); setSubmitting(false); }}>← Back to sign in</button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Invalid password. Please try again.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Could not sign in, did you mean to sign up?"
                  : "Could not sign up, did you mean to sign in?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="you@example.com"
          aria-label="Email address"
          required
        />
        {flow === "signIn" && passwordResetAvailable ? <button type="button" className="auth-link auth-forgot-link" onClick={() => setResetStep("request")}>Forgot password?</button> : null}
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Your password"
          aria-label="Password"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        <div className="auth-switch">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="auth-link"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
      <div className="auth-divider">
        <span>or continue without an account</span>
      </div>
      <button className="auth-button auth-button-secondary" onClick={() => void signIn("anonymous")}>
        Try the app as a guest
      </button>
      <p className="auth-guest-note">
        Try every feature without signing up. Guest data is private to this session and deleted after 7 days.
      </p>
    </div>
  );
}
