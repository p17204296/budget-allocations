import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const GUEST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 25;

async function deleteByUserIndex(
  ctx: MutationCtx,
  table:
    | "accounts"
    | "assets"
    | "liabilities"
    | "budgetItems"
    | "income"
    | "userSettings"
    | "feedback",
  userId: Id<"users">,
) {
  const docs = await ctx.db
    .query(table)
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(200);
  for (const doc of docs) {
    await ctx.db.delete(table, doc._id);
  }
  return docs.length === 200;
}

async function deleteGuestUser(ctx: MutationCtx, userId: Id<"users">) {
  // Keep deleting app data until the per-user sets are empty.
  while (await deleteByUserIndex(ctx, "budgetItems", userId)) {}
  while (await deleteByUserIndex(ctx, "accounts", userId)) {}
  while (await deleteByUserIndex(ctx, "assets", userId)) {}
  while (await deleteByUserIndex(ctx, "liabilities", userId)) {}
  while (await deleteByUserIndex(ctx, "income", userId)) {}
  while (await deleteByUserIndex(ctx, "userSettings", userId)) {}
  while (await deleteByUserIndex(ctx, "feedback", userId)) {}

  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of refreshTokens) {
      await ctx.db.delete("authRefreshTokens", token._id);
    }
    await ctx.db.delete("authSessions", session._id);
  }

  const authAccounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  for (const account of authAccounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) {
      await ctx.db.delete("authVerificationCodes", code._id);
    }
    await ctx.db.delete("authAccounts", account._id);
  }

  await ctx.db.delete("users", userId);
}

export const deleteExpiredGuests = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const cutoff = Date.now() - GUEST_MAX_AGE_MS;
    const guests = await ctx.db
      .query("users")
      .withIndex("by_anonymous", (q) =>
        q.eq("isAnonymous", true).lt("_creationTime", cutoff),
      )
      .take(BATCH_SIZE);

    for (const guest of guests) {
      await deleteGuestUser(ctx, guest._id);
    }

    const hasMore = guests.length === BATCH_SIZE;
    if (hasMore) {
      await ctx.scheduler.runAfter(0, internal.cleanup.deleteExpiredGuests, {});
    }

    console.log(
      `Guest cleanup: deleted ${guests.length} anonymous user(s) older than 7 days`,
    );
    return { deleted: guests.length, hasMore };
  },
});
