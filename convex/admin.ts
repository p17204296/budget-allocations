import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAdminUser, passwordResetEmailConfigured, requireAdmin } from "./lib/admin";

const feedbackStatus = v.union(v.literal("new"), v.literal("reviewed"), v.literal("archived"));

export const getAccess = query({
  args: {},
  returns: v.object({
    isAdmin: v.boolean(),
    passwordResetEnabled: v.boolean(),
  }),
  handler: async (ctx) => ({
    isAdmin: (await getAdminUser(ctx)) !== null,
    passwordResetEnabled: passwordResetEmailConfigured(),
  }),
});

export const listFeedback = query({
  args: {},
  returns: v.array(v.object({
    id: v.id("feedback"),
    createdAt: v.number(),
    type: v.union(v.literal("idea"), v.literal("problem"), v.literal("other")),
    message: v.string(),
    page: v.union(
      v.literal("overview"),
      v.literal("whatif"),
      v.literal("allocations"),
      v.literal("accounts"),
      v.literal("income"),
      v.literal("settings"),
      v.literal("admin"),
    ),
    status: feedbackStatus,
    userEmail: v.union(v.string(), v.null()),
  })),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const items = await ctx.db.query("feedback").order("desc").take(200);

    return await Promise.all(items.map(async (item) => {
      const user = await ctx.db.get("users", item.userId);
      return {
        id: item._id,
        createdAt: item.createdAt,
        type: item.type,
        message: item.message,
        page: item.page,
        status: item.status ?? "new" as const,
        userEmail: user?.email ?? null,
      };
    }));
  },
});

export const updateFeedbackStatus = mutation({
  args: {
    id: v.id("feedback"),
    status: feedbackStatus,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const item = await ctx.db.get("feedback", args.id);
    if (!item) throw new ConvexError("Feedback not found.");
    await ctx.db.patch("feedback", args.id, { status: args.status });
    return null;
  },
});

export const listUsers = query({
  args: {},
  returns: v.array(v.object({
    id: v.id("users"),
    createdAt: v.number(),
    email: v.union(v.string(), v.null()),
    name: v.union(v.string(), v.null()),
    isAnonymous: v.boolean(),
  })),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").take(200);
    return users.map((user) => ({
      id: user._id,
      createdAt: user._creationTime,
      email: user.email ?? null,
      name: user.name ?? null,
      isAnonymous: user.isAnonymous ?? false,
    }));
  },
});
