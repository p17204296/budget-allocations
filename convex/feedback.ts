import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

export const submit = mutation({
  args: {
    type: v.union(v.literal("idea"), v.literal("problem"), v.literal("other")),
    message: v.string(),
    page: v.union(
      v.literal("overview"),
      v.literal("allocations"),
      v.literal("accounts"),
      v.literal("income"),
      v.literal("settings"),
    ),
  },
  returns: v.id("feedback"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("You must be signed in to send feedback.");

    const message = args.message.trim();
    if (message.length < 5) {
      throw new ConvexError("Please add a little more detail.");
    }
    if (message.length > 1500) {
      throw new ConvexError("Feedback must be 1,500 characters or fewer.");
    }

    return await ctx.db.insert("feedback", {
      userId,
      type: args.type,
      message,
      page: args.page,
      createdAt: Date.now(),
    });
  },
});
