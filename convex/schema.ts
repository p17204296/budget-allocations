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

  budgetItems: defineTable({
    userId: v.id("users"),
    name: v.string(),
    category: v.union(v.literal("essentials"), v.literal("savings")),
    amount: v.number(),
    accountId: v.optional(v.id("accounts")),
  }).index("by_user", ["userId"])
   .index("by_user_and_category", ["userId", "category"]),

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
    ),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
