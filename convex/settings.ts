import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getUserSettings = query({
  args: {},
  returns: v.union(v.null(), v.object({ currency: v.string() })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return { currency: settings?.currency ?? "GBP" };
  },
});

export const updateCurrency = mutation({
  args: { currency: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { currency: args.currency });
    } else {
      await ctx.db.insert("userSettings", { userId, currency: args.currency });
    }
    return null;
  },
});

export const updateEmail = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.isAnonymous) throw new ConvexError("Create an account before changing sign-in details.");

    // Check if email is already taken
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();

    if (existing && existing._id !== userId) {
      throw new Error("Email already in use");
    }

    await ctx.db.patch(userId, { email: args.email });
    return null;
  },
});
