import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_USER_ROWS = 200;
const MAX_NAME_LENGTH = 80;

const accountType = v.union(v.literal("current"), v.literal("savings"));
const assetType = v.union(v.literal("property"), v.literal("investment"), v.literal("pension"), v.literal("other"));
const liabilityType = v.union(v.literal("credit_card"), v.literal("loan"), v.literal("mortgage"), v.literal("other"));
const budgetCategory = v.union(v.literal("essentials"), v.literal("savings"));

const accountResult = v.object({
  _id: v.id("accounts"),
  _creationTime: v.number(),
  name: v.string(),
  type: accountType,
  balance: v.optional(v.number()),
});
const assetResult = v.object({
  _id: v.id("assets"),
  _creationTime: v.number(),
  name: v.string(),
  type: assetType,
  currentValue: v.number(),
});
const liabilityResult = v.object({
  _id: v.id("liabilities"),
  _creationTime: v.number(),
  name: v.string(),
  type: liabilityType,
  outstandingBalance: v.number(),
});
const budgetItemResult = v.object({
  _id: v.id("budgetItems"),
  _creationTime: v.number(),
  name: v.string(),
  category: budgetCategory,
  amount: v.number(),
  accountId: v.optional(v.id("accounts")),
  targetAmount: v.optional(v.number()),
  currentSaved: v.optional(v.number()),
  targetDate: v.optional(v.number()),
});
const incomeResult = v.object({
  _id: v.id("income"),
  _creationTime: v.number(),
  amount: v.number(),
  description: v.string(),
});

type DatabaseCtx = QueryCtx | MutationCtx;

async function currentUser(ctx: DatabaseCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get("users", userId);
  return user ? { userId, user } : null;
}

async function requireUser(ctx: MutationCtx) {
  const auth = await currentUser(ctx);
  if (!auth) throw new ConvexError("You must be signed in.");
  return auth.userId;
}

function cleanName(value: string, label = "Name") {
  const cleaned = value.trim();
  if (!cleaned) throw new ConvexError(`${label} is required.`);
  if (cleaned.length > MAX_NAME_LENGTH) throw new ConvexError(`${label} must be ${MAX_NAME_LENGTH} characters or fewer.`);
  return cleaned;
}

function finiteAmount(value: number, label: string, allowNegative = false) {
  if (!Number.isFinite(value)) throw new ConvexError(`${label} must be a valid number.`);
  if (!allowNegative && value < 0) throw new ConvexError(`${label} cannot be negative.`);
  return value;
}

function publicAccount(account: {
  _id: Id<"accounts">;
  _creationTime: number;
  name: string;
  type: "current" | "savings";
  balance?: number;
}) {
  return { _id: account._id, _creationTime: account._creationTime, name: account.name, type: account.type, balance: account.balance };
}

function publicBudgetItem(item: {
  _id: Id<"budgetItems">;
  _creationTime: number;
  name: string;
  category: "essentials" | "savings";
  amount: number;
  accountId?: Id<"accounts">;
  targetAmount?: number;
  currentSaved?: number;
  targetDate?: number;
}) {
  return {
    _id: item._id,
    _creationTime: item._creationTime,
    name: item.name,
    category: item.category,
    amount: item.amount,
    accountId: item.accountId,
    targetAmount: item.targetAmount,
    currentSaved: item.currentSaved,
    targetDate: item.targetDate,
  };
}

async function assertOwnedAccount(ctx: MutationCtx, userId: Id<"users">, accountId: Id<"accounts">) {
  const account = await ctx.db.get("accounts", accountId);
  if (!account || account.userId !== userId) throw new ConvexError("That account is unavailable.");
}

export const getAccounts = query({
  args: {},
  returns: v.array(accountResult),
  handler: async (ctx) => {
    const auth = await currentUser(ctx);
    if (!auth) return [];
    const accounts = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", auth.userId)).take(MAX_USER_ROWS);
    return accounts.map(publicAccount);
  },
});

export const getMoneyPicture = query({
  args: {},
  returns: v.union(v.null(), v.object({
    accounts: v.array(accountResult),
    assets: v.array(assetResult),
    liabilities: v.array(liabilityResult),
    totals: v.object({ cash: v.number(), assets: v.number(), liabilities: v.number(), netWorth: v.number() }),
  })),
  handler: async (ctx) => {
    const auth = await currentUser(ctx);
    if (!auth) return null;
    const [accounts, assets, liabilities] = await Promise.all([
      ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", auth.userId)).take(MAX_USER_ROWS),
      ctx.db.query("assets").withIndex("by_user", (q) => q.eq("userId", auth.userId)).take(MAX_USER_ROWS),
      ctx.db.query("liabilities").withIndex("by_user", (q) => q.eq("userId", auth.userId)).take(MAX_USER_ROWS),
    ]);
    const cash = accounts.reduce((sum, account) => sum + (account.balance ?? 0), 0);
    const assetTotal = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
    const liabilityTotal = liabilities.reduce((sum, liability) => sum + liability.outstandingBalance, 0);
    return {
      accounts: accounts.map(publicAccount),
      assets: assets.map(({ userId: _userId, ...asset }) => asset),
      liabilities: liabilities.map(({ userId: _userId, ...liability }) => liability),
      totals: { cash, assets: assetTotal, liabilities: liabilityTotal, netWorth: cash + assetTotal - liabilityTotal },
    };
  },
});

export const getBudgetItems = query({
  args: {},
  returns: v.array(budgetItemResult),
  handler: async (ctx) => {
    const auth = await currentUser(ctx);
    if (!auth) return [];
    const items = await ctx.db.query("budgetItems").withIndex("by_user", (q) => q.eq("userId", auth.userId)).take(MAX_USER_ROWS);
    return items.map(publicBudgetItem);
  },
});

export const getIncome = query({
  args: {},
  returns: v.array(incomeResult),
  handler: async (ctx) => {
    const auth = await currentUser(ctx);
    if (!auth) return [];
    const income = await ctx.db.query("income").withIndex("by_user", (q) => q.eq("userId", auth.userId)).take(MAX_USER_ROWS);
    return income.map(({ userId: _userId, ...item }) => item);
  },
});

export const upsertAccount = mutation({
  args: { id: v.optional(v.id("accounts")), name: v.string(), type: accountType, balance: v.optional(v.number()) },
  returns: v.id("accounts"),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const name = cleanName(args.name, "Account name");
    const balance = args.balance === undefined ? undefined : finiteAmount(args.balance, "Balance", true);
    if (args.id) {
      await assertOwnedAccount(ctx, userId, args.id);
      await ctx.db.patch(args.id, { name, type: args.type, balance });
      return args.id;
    }
    const existing = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_USER_ROWS);
    if (existing.length >= MAX_USER_ROWS) throw new ConvexError("Account limit reached.");
    return await ctx.db.insert("accounts", { userId, name, type: args.type, balance });
  },
});

export const deleteAccount = mutation({
  args: { id: v.id("accounts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await assertOwnedAccount(ctx, userId, args.id);
    const budgetItems = await ctx.db.query("budgetItems").withIndex("by_user_and_account", (q) => q.eq("userId", userId).eq("accountId", args.id)).take(MAX_USER_ROWS);
    for (const item of budgetItems) await ctx.db.patch(item._id, { accountId: undefined });
    await ctx.db.delete(args.id);
    return null;
  },
});

export const upsertAsset = mutation({
  args: { id: v.optional(v.id("assets")), name: v.string(), type: assetType, currentValue: v.number() },
  returns: v.id("assets"),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const name = cleanName(args.name, "Asset name");
    const currentValue = finiteAmount(args.currentValue, "Current value");
    if (args.id) {
      const asset = await ctx.db.get("assets", args.id);
      if (!asset || asset.userId !== userId) throw new ConvexError("Asset not found.");
      await ctx.db.patch(args.id, { name, type: args.type, currentValue });
      return args.id;
    }
    const existing = await ctx.db.query("assets").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_USER_ROWS);
    if (existing.length >= MAX_USER_ROWS) throw new ConvexError("Asset limit reached.");
    return await ctx.db.insert("assets", { userId, name, type: args.type, currentValue });
  },
});

export const deleteAsset = mutation({
  args: { id: v.id("assets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const asset = await ctx.db.get("assets", args.id);
    if (!asset || asset.userId !== userId) throw new ConvexError("Asset not found.");
    await ctx.db.delete(args.id);
    return null;
  },
});

export const upsertLiability = mutation({
  args: { id: v.optional(v.id("liabilities")), name: v.string(), type: liabilityType, outstandingBalance: v.number() },
  returns: v.id("liabilities"),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const name = cleanName(args.name, "Liability name");
    const outstandingBalance = finiteAmount(args.outstandingBalance, "Outstanding balance");
    if (args.id) {
      const liability = await ctx.db.get("liabilities", args.id);
      if (!liability || liability.userId !== userId) throw new ConvexError("Liability not found.");
      await ctx.db.patch(args.id, { name, type: args.type, outstandingBalance });
      return args.id;
    }
    const existing = await ctx.db.query("liabilities").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_USER_ROWS);
    if (existing.length >= MAX_USER_ROWS) throw new ConvexError("Liability limit reached.");
    return await ctx.db.insert("liabilities", { userId, name, type: args.type, outstandingBalance });
  },
});

export const deleteLiability = mutation({
  args: { id: v.id("liabilities") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const liability = await ctx.db.get("liabilities", args.id);
    if (!liability || liability.userId !== userId) throw new ConvexError("Liability not found.");
    await ctx.db.delete(args.id);
    return null;
  },
});

export const upsertBudgetItem = mutation({
  args: {
    id: v.optional(v.id("budgetItems")),
    name: v.string(),
    category: budgetCategory,
    amount: v.number(),
    accountId: v.optional(v.id("accounts")),
    targetAmount: v.optional(v.number()),
    currentSaved: v.optional(v.number()),
    targetDate: v.optional(v.number()),
  },
  returns: v.id("budgetItems"),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const name = cleanName(args.name, "Item name");
    const amount = finiteAmount(args.amount, "Monthly amount");
    if (args.accountId) await assertOwnedAccount(ctx, userId, args.accountId);
    let targetAmount: number | undefined;
    let currentSaved: number | undefined;
    let targetDate: number | undefined;
    if (args.category === "savings" && args.targetAmount !== undefined) {
      targetAmount = finiteAmount(args.targetAmount, "Goal target");
      if (targetAmount <= 0) throw new ConvexError("Goal target must be greater than zero.");
      currentSaved = finiteAmount(args.currentSaved ?? 0, "Amount saved");
      if (args.targetDate !== undefined) {
        targetDate = finiteAmount(args.targetDate, "Target date");
        if (targetDate <= 0) throw new ConvexError("Target date is invalid.");
      }
    } else if (args.currentSaved !== undefined || args.targetDate !== undefined) {
      throw new ConvexError("Add a goal target before progress or a target date.");
    }
    const values = { name, category: args.category, amount, accountId: args.accountId, targetAmount, currentSaved, targetDate };
    if (args.id) {
      const item = await ctx.db.get("budgetItems", args.id);
      if (!item || item.userId !== userId) throw new ConvexError("Budget item not found.");
      await ctx.db.patch(args.id, values);
      return args.id;
    }
    const existing = await ctx.db.query("budgetItems").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_USER_ROWS);
    if (existing.length >= MAX_USER_ROWS) throw new ConvexError("Budget item limit reached.");
    return await ctx.db.insert("budgetItems", { userId, ...values });
  },
});

export const deleteBudgetItem = mutation({
  args: { id: v.id("budgetItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const item = await ctx.db.get("budgetItems", args.id);
    if (!item || item.userId !== userId) throw new ConvexError("Budget item not found.");
    await ctx.db.delete(args.id);
    return null;
  },
});

export const upsertIncome = mutation({
  args: { id: v.optional(v.id("income")), amount: v.number(), description: v.string() },
  returns: v.id("income"),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const description = cleanName(args.description, "Income source");
    const amount = finiteAmount(args.amount, "Monthly income");
    if (args.id) {
      const income = await ctx.db.get("income", args.id);
      if (!income || income.userId !== userId) throw new ConvexError("Income source not found.");
      await ctx.db.patch(args.id, { amount, description });
      return args.id;
    }
    const existing = await ctx.db.query("income").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_USER_ROWS);
    if (existing.length >= MAX_USER_ROWS) throw new ConvexError("Income source limit reached.");
    return await ctx.db.insert("income", { userId, amount, description });
  },
});

export const deleteIncome = mutation({
  args: { id: v.id("income") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const income = await ctx.db.get("income", args.id);
    if (!income || income.userId !== userId) throw new ConvexError("Income source not found.");
    await ctx.db.delete(args.id);
    return null;
  },
});

export const initializeDefaultData = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const auth = await currentUser(ctx);
    if (!auth) throw new ConvexError("You must be signed in.");
    const existingAccounts = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", auth.userId)).take(1);
    if (existingAccounts.length > 0) return null;
    const isGuest = auth.user.isAnonymous === true;
    const halifax = await ctx.db.insert("accounts", { userId: auth.userId, name: "Halifax", type: "current", balance: isGuest ? 2350 : undefined });
    const chase = await ctx.db.insert("accounts", { userId: auth.userId, name: "Chase", type: "current", balance: isGuest ? 780 : undefined });
    const chaseSavings = await ctx.db.insert("accounts", { userId: auth.userId, name: "Chase Savings Pot", type: "savings", balance: isGuest ? 6500 : undefined });
    await ctx.db.insert("accounts", { userId: auth.userId, name: "Monzo", type: "current", balance: isGuest ? 420 : undefined });
    await ctx.db.insert("income", { userId: auth.userId, amount: 3000, description: "Primary Income" });
    await ctx.db.insert("budgetItems", { userId: auth.userId, name: "Rent", category: "essentials", amount: 1200, accountId: halifax });
    await ctx.db.insert("budgetItems", { userId: auth.userId, name: "Utilities", category: "essentials", amount: 150, accountId: halifax });
    await ctx.db.insert("budgetItems", { userId: auth.userId, name: "Wi-Fi", category: "essentials", amount: 30, accountId: chase });
    const now = new Date();
    const oneYear = new Date(now.getFullYear(), now.getMonth() + 12, now.getDate()).getTime();
    const eightMonths = new Date(now.getFullYear(), now.getMonth() + 8, now.getDate()).getTime();
    await ctx.db.insert("budgetItems", { userId: auth.userId, name: "Emergency Fund", category: "savings", amount: 500, accountId: chaseSavings, targetAmount: isGuest ? 10000 : undefined, currentSaved: isGuest ? 5000 : undefined, targetDate: isGuest ? oneYear : undefined });
    await ctx.db.insert("budgetItems", { userId: auth.userId, name: "Holiday Fund", category: "savings", amount: 200, accountId: chaseSavings, targetAmount: isGuest ? 2400 : undefined, currentSaved: isGuest ? 800 : undefined, targetDate: isGuest ? eightMonths : undefined });
    if (isGuest) {
      await ctx.db.insert("assets", { userId: auth.userId, name: "Home", type: "property", currentValue: 285000 });
      await ctx.db.insert("assets", { userId: auth.userId, name: "Workplace pension", type: "pension", currentValue: 42750 });
      await ctx.db.insert("assets", { userId: auth.userId, name: "Investment ISA", type: "investment", currentValue: 18400 });
      await ctx.db.insert("liabilities", { userId: auth.userId, name: "Mortgage", type: "mortgage", outstandingBalance: 192000 });
      await ctx.db.insert("liabilities", { userId: auth.userId, name: "Credit card", type: "credit_card", outstandingBalance: 850 });
    }
    return null;
  },
});
