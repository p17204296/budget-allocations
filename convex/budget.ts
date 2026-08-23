import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get all accounts for the current user
export const getAccounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    return await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Get all budget items for the current user
export const getBudgetItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    return await ctx.db
      .query("budgetItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Get income for the current user
export const getIncome = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    return await ctx.db
      .query("income")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Create or update account
export const upsertAccount = mutation({
  args: {
    id: v.optional(v.id("accounts")),
    name: v.string(),
    type: v.union(v.literal("current"), v.literal("savings")),
    balance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.id) {
      await ctx.db.patch(args.id, {
        name: args.name,
        type: args.type,
        balance: args.balance,
      });
      return args.id;
    } else {
      return await ctx.db.insert("accounts", {
        userId,
        name: args.name,
        type: args.type,
        balance: args.balance,
      });
    }
  },
});

// Delete account
export const deleteAccount = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const account = await ctx.db.get(args.id);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found or unauthorized");
    }

    // Remove account reference from budget items
    const budgetItems = await ctx.db
      .query("budgetItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    for (const item of budgetItems) {
      if (item.accountId === args.id) {
        await ctx.db.patch(item._id, { accountId: undefined });
      }
    }

    await ctx.db.delete(args.id);
  },
});

// Create or update budget item
export const upsertBudgetItem = mutation({
  args: {
    id: v.optional(v.id("budgetItems")),
    name: v.string(),
    category: v.union(v.literal("essentials"), v.literal("savings")),
    amount: v.number(),
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.id) {
      await ctx.db.patch(args.id, {
        name: args.name,
        category: args.category,
        amount: args.amount,
        accountId: args.accountId,
      });
      return args.id;
    } else {
      return await ctx.db.insert("budgetItems", {
        userId,
        name: args.name,
        category: args.category,
        amount: args.amount,
        accountId: args.accountId,
      });
    }
  },
});

// Delete budget item
export const deleteBudgetItem = mutation({
  args: { id: v.id("budgetItems") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Budget item not found or unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

// Create or update income
export const upsertIncome = mutation({
  args: {
    id: v.optional(v.id("income")),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.id) {
      await ctx.db.patch(args.id, {
        amount: args.amount,
        description: args.description,
      });
      return args.id;
    } else {
      return await ctx.db.insert("income", {
        userId,
        amount: args.amount,
        description: args.description,
      });
    }
  },
});

// Delete income
export const deleteIncome = mutation({
  args: { id: v.id("income") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const income = await ctx.db.get(args.id);
    if (!income || income.userId !== userId) {
      throw new Error("Income not found or unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

// Initialize default data for new users
export const initializeDefaultData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user already has data
    const existingAccounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (existingAccounts.length > 0) return;

    // Create default accounts
    const halifax = await ctx.db.insert("accounts", {
      userId,
      name: "Halifax",
      type: "current",
    });

    const chase = await ctx.db.insert("accounts", {
      userId,
      name: "Chase",
      type: "current",
    });

    const chaseSavings = await ctx.db.insert("accounts", {
      userId,
      name: "Chase Savings Pot",
      type: "savings",
    });

    const monzo = await ctx.db.insert("accounts", {
      userId,
      name: "Monzo",
      type: "current",
    });

    // Create default income
    await ctx.db.insert("income", {
      userId,
      amount: 3000,
      description: "Primary Income",
    });

    // Create default budget items
    await ctx.db.insert("budgetItems", {
      userId,
      name: "Rent",
      category: "essentials",
      amount: 1200,
      accountId: halifax,
    });

    await ctx.db.insert("budgetItems", {
      userId,
      name: "Utilities",
      category: "essentials",
      amount: 150,
      accountId: halifax,
    });

    await ctx.db.insert("budgetItems", {
      userId,
      name: "Wi-Fi",
      category: "essentials",
      amount: 30,
      accountId: chase,
    });

    await ctx.db.insert("budgetItems", {
      userId,
      name: "Emergency Fund",
      category: "savings",
      amount: 500,
      accountId: chaseSavings,
    });

    await ctx.db.insert("budgetItems", {
      userId,
      name: "Holiday Fund",
      category: "savings",
      amount: 200,
      accountId: chaseSavings,
    });
  },
});
