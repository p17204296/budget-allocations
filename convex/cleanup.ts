import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const GUEST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ROW_BATCH_SIZE = 100;
const APPLICATION_TABLES = [
  "scenarioIncome",
  "scenarioBudgetItems",
  "scenarioOneOffCosts",
  "scenarios",
  "budgetItems",
  "accounts",
  "assets",
  "liabilities",
  "income",
  "userSettings",
  "feedback",
] as const;

async function deleteApplicationBatch(ctx: MutationCtx, userId: Id<"users">) {
  for (const table of APPLICATION_TABLES) {
    const docs = await ctx.db
      .query(table)
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(ROW_BATCH_SIZE);
    if (docs.length === 0) continue;
    for (const doc of docs) await ctx.db.delete(table, doc._id);
    return true;
  }
  return false;
}

async function scheduleNextGuestBatch(ctx: MutationCtx, userId: Id<"users">, cutoff: number) {
  await ctx.scheduler.runAfter(0, internal.cleanup.deleteExpiredGuestBatch, { userId, cutoff });
}

export const deleteExpiredGuestBatch = internalMutation({
  args: { userId: v.id("users"), cutoff: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const guest = await ctx.db.get("users", args.userId);
    if (!guest || guest.isAnonymous !== true || guest._creationTime >= args.cutoff) {
      await ctx.scheduler.runAfter(0, internal.cleanup.deleteExpiredGuests, {});
      return null;
    }

    if (await deleteApplicationBatch(ctx, args.userId)) {
      await scheduleNextGuestBatch(ctx, args.userId, args.cutoff);
      return null;
    }

    const session = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .first();
    if (session) {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .take(ROW_BATCH_SIZE);
      for (const token of refreshTokens) await ctx.db.delete("authRefreshTokens", token._id);
      if (refreshTokens.length === 0) await ctx.db.delete("authSessions", session._id);
      await scheduleNextGuestBatch(ctx, args.userId, args.cutoff);
      return null;
    }

    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId))
      .first();
    if (authAccount) {
      const verificationCodes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", authAccount._id))
        .take(ROW_BATCH_SIZE);
      for (const code of verificationCodes) await ctx.db.delete("authVerificationCodes", code._id);
      if (verificationCodes.length === 0) await ctx.db.delete("authAccounts", authAccount._id);
      await scheduleNextGuestBatch(ctx, args.userId, args.cutoff);
      return null;
    }

    await ctx.db.delete("users", args.userId);
    console.log(`Guest cleanup: deleted expired anonymous user ${args.userId}`);
    await ctx.scheduler.runAfter(0, internal.cleanup.deleteExpiredGuests, {});
    return null;
  },
});

export const deleteExpiredGuests = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - GUEST_MAX_AGE_MS;
    const guest = await ctx.db
      .query("users")
      .withIndex("by_anonymous", (q) =>
        q.eq("isAnonymous", true).lt("_creationTime", cutoff),
      )
      .first();
    if (guest) {
      await ctx.scheduler.runAfter(0, internal.cleanup.deleteExpiredGuestBatch, {
        userId: guest._id,
        cutoff,
      });
    }
    return null;
  },
});
