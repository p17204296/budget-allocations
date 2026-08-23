import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AdminContext = QueryCtx | MutationCtx;

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getAdminUser(ctx: AdminContext) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const user = await ctx.db.get("users", userId);
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email || !configuredAdminEmails().has(email)) return null;

  return { user, email };
}

export async function requireAdmin(ctx: AdminContext) {
  const admin = await getAdminUser(ctx);
  if (!admin) {
    throw new ConvexError("Admin access required.");
  }
  return admin;
}

export function passwordResetEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM);
}
