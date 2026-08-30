import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  accounts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.union(v.literal("current"), v.literal("savings")),
    balance: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  assets: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.union(
      v.literal("property"),
      v.literal("investment"),
      v.literal("pension"),
      v.literal("other"),
    ),
    currentValue: v.number(),
  }).index("by_user", ["userId"]),

  liabilities: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.union(
      v.literal("credit_card"),
      v.literal("loan"),
      v.literal("mortgage"),
      v.literal("other"),
    ),
    outstandingBalance: v.number(),
  }).index("by_user", ["userId"]),

  budgetItems: defineTable({
    userId: v.id("users"),
    name: v.string(),
    category: v.union(v.literal("essentials"), v.literal("savings")),
    amount: v.number(),
    accountId: v.optional(v.id("accounts")),
    targetAmount: v.optional(v.number()),
    currentSaved: v.optional(v.number()),
    targetDate: v.optional(v.number()),
  }).index("by_user", ["userId"])
   .index("by_user_and_category", ["userId", "category"])
   .index("by_user_and_account", ["userId", "accountId"]),

  income: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    description: v.string(),
  }).index("by_user", ["userId"]),

  userSettings: defineTable({
    userId: v.id("users"),
    currency: v.string(),
  }).index("by_user", ["userId"]),

  feedback: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("idea"), v.literal("problem"), v.literal("other")),
    message: v.string(),
    page: v.union(
      v.literal("overview"),
      v.literal("allocations"),
      v.literal("accounts"),
      v.literal("income"),
      v.literal("settings"),
      v.literal("admin"),
    ),
    status: v.optional(v.union(v.literal("new"), v.literal("reviewed"), v.literal("archived"))),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),
};

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_anonymous", ["isAnonymous"]),
  ...applicationTables,
});
