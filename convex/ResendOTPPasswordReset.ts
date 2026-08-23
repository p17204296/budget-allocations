import Resend from "@auth/core/providers/resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { Resend as ResendAPI } from "resend";

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-password-reset",
  apiKey: process.env.RESEND_API_KEY,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 8);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const from = process.env.AUTH_EMAIL_FROM;
    if (!provider.apiKey || !from) {
      throw new Error("Password reset email is not configured.");
    }

    const appUrl = process.env.APP_URL ?? "https://budget-allocations.vercel.app";
    const resend = new ResendAPI(provider.apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: "Reset your Budget Allocations password",
      text: [
        "We received a request to reset your Budget Allocations password.",
        "",
        `Your reset code is: ${token}`,
        "",
        `Open ${appUrl}, choose “Forgot password?”, and enter this code with your new password.`,
        "",
        "If you did not request this, you can safely ignore this email.",
      ].join("\n"),
    });

    if (error) throw new Error("Could not send the password reset email.");
  },
});
