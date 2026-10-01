import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  detailValidator,
  draftValidator,
  scenarioValidator,
} from "./scenarioValidators";
import {
  calculate,
  normalise,
  MAX_ROWS,
  MAX_SCENARIOS,
  MAX_ONE_OFF,
  type ScenarioDraft,
  type ScenarioRow,
  type Value,
} from "../shared/scenarios";

type Ctx = QueryCtx | MutationCtx;
async function user(ctx: Ctx) {
  const id = await getAuthUserId(ctx);
  if (!id || !(await ctx.db.get(id)))
    throw new ConvexError("You must be signed in.");
  return id;
}
async function owned(ctx: Ctx, id: Id<"scenarios">) {
  const userId = await user(ctx);
  const scenario = await ctx.db.get(id);
  if (!scenario || scenario.userId !== userId)
    throw new ConvexError("Scenario not found.");
  return scenario;
}
async function rows(ctx: Ctx, id: Id<"scenarios">) {
  const [income, budget, oneOff] = await Promise.all([
    ctx.db
      .query("scenarioIncome")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", id))
      .take(MAX_ROWS + 1),
    ctx.db
      .query("scenarioBudgetItems")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", id))
      .take(MAX_ROWS + 1),
    ctx.db
      .query("scenarioOneOffCosts")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", id))
      .take(MAX_ONE_OFF + 1),
  ]);
  if (
    income.length > MAX_ROWS ||
    budget.length > MAX_ROWS ||
    oneOff.length > MAX_ONE_OFF
  )
    throw new ConvexError("Scenario exceeds the supported limits.");
  return { income, budget, oneOff };
}
function publicRows<T extends { key: string }>(docs: T[]): ScenarioRow[] {
  return docs.map((doc) => {
    const row = doc as T & ScenarioRow;
    return {
      key: row.key,
      ...(row.baseline ? { baseline: row.baseline } : {}),
      ...(row.projected ? { projected: row.projected } : {}),
      ...(row.removed ? { removed: row.removed } : {}),
    };
  });
}
async function detail(ctx: Ctx, id: Id<"scenarios">) {
  const scenario = await owned(ctx, id);
  const data = await rows(ctx, id);
  const draft: ScenarioDraft = {
    name: scenario.name,
    currency: scenario.currency,
    breathingRoomAmount: scenario.breathingRoomAmount,
    ...(scenario.selectedIncomeRowId
      ? { selectedIncomeRowId: scenario.selectedIncomeRowId }
      : {}),
    income: publicRows(data.income),
    budget: publicRows(data.budget),
    oneOff: data.oneOff.map(({ key, name, amount }) => ({ key, name, amount })),
  };
  return { scenario, draft };
}
function name(value: string) {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 80)
    throw new ConvexError("Names must contain 1–80 characters.");
  return cleaned;
}
function amount(value: number, currency: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000)
    throw new ConvexError("Amounts must be between zero and 1,000,000,000.");
  return normalise(value, currency);
}
function cleanValue(value: Value, currency: string, budget: boolean): Value {
  if ((budget && !value.category) || (!budget && value.category))
    throw new ConvexError("Invalid allocation category.");
  return {
    name: name(value.name),
    amount: amount(value.amount, currency),
    ...(budget ? { category: value.category } : {}),
  };
}
function equal(a?: Value, b?: Value) {
  return (
    a?.name === b?.name &&
    a?.amount === b?.amount &&
    a?.category === b?.category
  );
}
function cleanDraft(
  input: ScenarioDraft,
  original: ScenarioDraft,
): ScenarioDraft {
  if (input.currency !== original.currency)
    throw new ConvexError("A scenario keeps its original currency.");
  const cleanRows = (
    incoming: ScenarioRow[],
    before: ScenarioRow[],
    budget: boolean,
  ) => {
    if (incoming.length > MAX_ROWS)
      throw new ConvexError("A scenario supports up to 200 rows per group.");
    const keys = new Set<string>();
    const result = incoming.map((row) => {
      if (!row.key || row.key.length > 80 || keys.has(row.key))
        throw new ConvexError("Invalid or duplicate row identifier.");
      keys.add(row.key);
      const old = before.find((item) => item.key === row.key);
      if (!equal(row.baseline, old?.baseline))
        throw new ConvexError("The original budget cannot be changed.");
      if (
        (!row.baseline && !row.projected) ||
        (row.projected && row.removed) ||
        (!row.projected && !row.removed)
      )
        throw new ConvexError("Invalid removed row.");
      return {
        key: row.key,
        ...(old?.baseline ? { baseline: old.baseline } : {}),
        ...(row.projected
          ? { projected: cleanValue(row.projected, input.currency, budget) }
          : {}),
        ...(row.removed
          ? { removed: cleanValue(row.removed, input.currency, budget) }
          : {}),
      };
    });
    if (before.some((row) => row.baseline && !keys.has(row.key)))
      throw new ConvexError("Original rows must remain in the comparison.");
    return result;
  };
  if (input.oneOff.length > MAX_ONE_OFF)
    throw new ConvexError("A scenario supports up to 50 upfront costs.");
  const oneOffKeys = new Set<string>();
  const result: ScenarioDraft = {
    name: name(input.name),
    currency: original.currency,
    breathingRoomAmount: amount(input.breathingRoomAmount, input.currency),
    income: cleanRows(input.income, original.income, false),
    budget: cleanRows(input.budget, original.budget, true),
    oneOff: input.oneOff.map((row) => {
      if (!row.key || row.key.length > 80 || oneOffKeys.has(row.key))
        throw new ConvexError("Invalid upfront cost identifier.");
      oneOffKeys.add(row.key);
      return {
        key: row.key,
        name: name(row.name),
        amount: amount(row.amount, input.currency),
      };
    }),
    ...(input.selectedIncomeRowId
      ? { selectedIncomeRowId: input.selectedIncomeRowId }
      : {}),
  };
  if (
    result.selectedIncomeRowId &&
    !result.income.some(
      (row) => row.key === result.selectedIncomeRowId && row.projected,
    )
  )
    throw new ConvexError("Select an active income source.");
  return result;
}
async function capacity(ctx: MutationCtx, userId: Id<"users">) {
  const current = await ctx.db
    .query("scenarios")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_SCENARIOS);
  if (current.length >= MAX_SCENARIOS)
    throw new ConvexError(
      "You can save up to 20 scenarios. Delete one before creating another.",
    );
}
async function insertRows(
  ctx: MutationCtx,
  userId: Id<"users">,
  scenarioId: Id<"scenarios">,
  draft: ScenarioDraft,
) {
  for (const row of draft.income)
    await ctx.db.insert("scenarioIncome", { userId, scenarioId, ...row });
  for (const row of draft.budget)
    await ctx.db.insert("scenarioBudgetItems", { userId, scenarioId, ...row });
  for (const row of draft.oneOff)
    await ctx.db.insert("scenarioOneOffCosts", { userId, scenarioId, ...row });
}
async function insert(
  ctx: MutationCtx,
  userId: Id<"users">,
  draft: ScenarioDraft,
  snapshotAt: number,
) {
  await capacity(ctx, userId);
  const id = await ctx.db.insert("scenarios", {
    userId,
    name: draft.name,
    currency: draft.currency,
    snapshotAt,
    updatedAt: Date.now(),
    revision: 0,
    breathingRoomAmount: draft.breathingRoomAmount,
    ...(draft.selectedIncomeRowId
      ? { selectedIncomeRowId: draft.selectedIncomeRowId }
      : {}),
  });
  await insertRows(ctx, userId, id, draft);
  return id;
}
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(scenarioValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await user(ctx);
    const result = await ctx.db
      .query("scenarios")
      .withIndex("by_user_and_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(20, args.paginationOpts.numItems),
      });
    return {
      page: result.page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
export const get = query({
  args: { id: v.id("scenarios") },
  returns: v.union(detailValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await user(ctx);
    const scenario = await ctx.db.get(args.id);
    if (!scenario) return null;
    if (scenario.userId !== userId)
      throw new ConvexError("Scenario not found.");
    return detail(ctx, args.id);
  },
});
export const create = mutation({
  args: {
    name: v.string(),
    mode: v.union(v.literal("copy"), v.literal("empty")),
  },
  returns: v.id("scenarios"),
  handler: async (ctx, args) => {
    const userId = await user(ctx);
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const currency = settings?.currency ?? "GBP";
    const draft: ScenarioDraft = {
      name: name(args.name),
      currency,
      breathingRoomAmount: 0,
      income: [],
      budget: [],
      oneOff: [],
    };
    if (args.mode === "copy") {
      const [income, budget] = await Promise.all([
        ctx.db
          .query("income")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(MAX_ROWS + 1),
        ctx.db
          .query("budgetItems")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(MAX_ROWS + 1),
      ]);
      if (income.length > MAX_ROWS || budget.length > MAX_ROWS)
        throw new ConvexError(
          "Your budget exceeds 200 rows. Reduce it before copying so no items are omitted.",
        );
      draft.income = income.map((row) => {
        const value = {
          name: row.description,
          amount: amount(row.amount, currency),
        };
        return { key: row._id, baseline: value, projected: value };
      });
      draft.budget = budget.map((row) => {
        const value = {
          name: row.name,
          amount: amount(row.amount, currency),
          category: row.category,
        };
        return { key: row._id, baseline: value, projected: value };
      });
      draft.breathingRoomAmount = Math.max(
        0,
        calculate(draft).baseline.available,
      );
    }
    return insert(ctx, userId, draft, Date.now());
  },
});
export const save = mutation({
  args: {
    id: v.id("scenarios"),
    expectedRevision: v.number(),
    draft: draftValidator,
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const original = await detail(ctx, args.id);
    if (original.scenario.revision !== args.expectedRevision)
      throw new ConvexError({
        code: "SCENARIO_CONFLICT",
        message:
          "This scenario changed in another tab. Reload it or save your edits separately.",
      });
    const draft = cleanDraft(args.draft, original.draft);
    const data = await rows(ctx, args.id);
    // Only update projected data; never accept or rewrite a baseline from the caller.
    for (const [table, incoming, existing] of [
      ["scenarioIncome", draft.income, data.income],
      ["scenarioBudgetItems", draft.budget, data.budget],
    ] as const) {
      for (const old of existing)
        if (!incoming.some((row) => row.key === old.key))
          await ctx.db.delete(old._id);
      for (const row of incoming) {
        const old = existing.find((item) => item.key === row.key);
        if (old)
          await ctx.db.patch(table, old._id, {
            projected: row.projected,
            removed: row.removed,
          });
        else
          await ctx.db.insert(table, {
            userId: original.scenario.userId,
            scenarioId: args.id,
            ...row,
          });
      }
    }
    for (const old of data.oneOff)
      if (!draft.oneOff.some((row) => row.key === old.key))
        await ctx.db.delete(old._id);
    for (const row of draft.oneOff) {
      const old = data.oneOff.find((item) => item.key === row.key);
      if (old)
        await ctx.db.patch(old._id, { name: row.name, amount: row.amount });
      else
        await ctx.db.insert("scenarioOneOffCosts", {
          userId: original.scenario.userId,
          scenarioId: args.id,
          ...row,
        });
    }
    const revision = original.scenario.revision + 1;
    await ctx.db.patch(args.id, {
      name: draft.name,
      breathingRoomAmount: draft.breathingRoomAmount,
      selectedIncomeRowId: draft.selectedIncomeRowId,
      revision,
      updatedAt: Date.now(),
    });
    return revision;
  },
});
export const duplicate = mutation({
  args: { id: v.id("scenarios"), name: v.string() },
  returns: v.id("scenarios"),
  handler: async (ctx, args) => {
    const original = await detail(ctx, args.id);
    return insert(
      ctx,
      original.scenario.userId,
      { ...original.draft, name: name(args.name) },
      original.scenario.snapshotAt,
    );
  },
});
export const copyConflict = mutation({
  args: { id: v.id("scenarios"), draft: draftValidator },
  returns: v.id("scenarios"),
  handler: async (ctx, args) => {
    const original = await detail(ctx, args.id);
    const draft = cleanDraft(args.draft, original.draft);
    return insert(
      ctx,
      original.scenario.userId,
      draft,
      original.scenario.snapshotAt,
    );
  },
});
export const remove = mutation({
  args: { id: v.id("scenarios") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await owned(ctx, args.id);
    const data = await rows(ctx, args.id);
    for (const doc of [...data.income, ...data.budget, ...data.oneOff])
      await ctx.db.delete(doc._id);
    await ctx.db.delete(args.id);
    return null;
  },
});
