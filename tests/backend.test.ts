import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { save } from "../convex/scenarios";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const [first, second] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { name: "First" }),
    await ctx.db.insert("users", { name: "Second" }),
  ]);
  const owner = t.withIdentity({ subject: `${first}|session` });
  const stranger = t.withIdentity({ subject: `${second}|session` });
  await t.run(async (ctx) => {
    await ctx.db.insert("income", {
      userId: first,
      description: "Contract",
      amount: 3800,
    });
    await ctx.db.insert("budgetItems", {
      userId: first,
      name: "Spending",
      amount: 2500,
      category: "essentials",
    });
    await ctx.db.insert("budgetItems", {
      userId: first,
      name: "Savings",
      amount: 700,
      category: "savings",
    });
  });
  const id = await owner.mutation(api.scenarios.create, {
    name: "What-if",
    mode: "copy",
  });
  return { t, owner, stranger, id, first };
}
describe("scenario persistence", () => {
  it("recovers a deleted local snapshot without recreating its source", async () => {
    const { owner, id, stranger } = await setup();
    const original = await owner.query(api.scenarios.get, { id });
    const draft = structuredClone(original.draft);
    draft.income[0].projected!.amount = 5000;
    await owner.mutation(api.scenarios.remove, { id });
    const copyId = await owner.mutation(api.scenarios.recoverDeleted, {
      id,
      draft,
      snapshotAt: original.scenario.snapshotAt,
    });
    expect(copyId).not.toBe(id);
    expect(await owner.query(api.scenarios.get, { id })).toBeNull();
    const copy = await owner.query(api.scenarios.get, { id: copyId });
    expect(copy.scenario.snapshotAt).toBe(original.scenario.snapshotAt);
    expect(copy.draft.income[0]).toMatchObject({
      baseline: { amount: 3800 },
      projected: { amount: 5000 },
    });
    await expect(
      stranger.query(api.scenarios.get, { id: copyId }),
    ).rejects.toThrow();
    copy.draft.income[0].baseline!.amount = 1;
    await expect(
      owner.mutation(api.scenarios.save, {
        id: copyId,
        draft: copy.draft,
        expectedRevision: 0,
      }),
    ).rejects.toThrow("original budget");
  });
  it("validates detached recovery and does not bypass ownership or existing baselines", async () => {
    const { t, owner, stranger, id } = await setup();
    const original = await owner.query(api.scenarios.get, { id });
    const args = {
      id,
      draft: original.draft,
      snapshotAt: original.scenario.snapshotAt,
    };
    await expect(
      t.mutation(api.scenarios.recoverDeleted, args),
    ).rejects.toThrow();
    await expect(
      stranger.mutation(api.scenarios.recoverDeleted, args),
    ).rejects.toThrow("Scenario not found");
    await expect(
      owner.mutation(api.scenarios.recoverDeleted, args),
    ).rejects.toThrow("still exists");
    await owner.mutation(api.scenarios.remove, { id });
    const bad = structuredClone(args);
    bad.draft.income[0].baseline!.amount = -1;
    await expect(
      owner.mutation(api.scenarios.recoverDeleted, bad),
    ).rejects.toThrow("Amounts");
    await expect(
      owner.mutation(api.scenarios.recoverDeleted, { ...args, snapshotAt: -1 }),
    ).rejects.toThrow("snapshot date");
    const oversized = structuredClone(args);
    oversized.draft.income = Array.from({ length: 201 }, (_, i) => ({
      key: String(i),
      projected: { name: "Income", amount: 1 },
    }));
    await expect(
      owner.mutation(api.scenarios.recoverDeleted, oversized),
    ).rejects.toThrow("200 rows");
  });
  it("patches only changed child documents and reads each child table once", async () => {
    const { owner, id } = await setup();
    const { draft } = await owner.query(api.scenarios.get, { id });
    draft.oneOff.push({ key: "move", name: "Move", amount: 200 });
    await owner.mutation(api.scenarios.save, {
      id,
      draft,
      expectedRevision: 0,
    });
    await owner.run(async (ctx) => {
      const patch = vi.spyOn(ctx.db, "patch");
      const query = vi.spyOn(ctx.db, "query");
      draft.name = "Name only";
      await save._handler(ctx, { id, draft, expectedRevision: 1 });
      expect(patch).toHaveBeenCalledTimes(1);
      expect(query.mock.calls.map((call) => call[0])).toEqual([
        "scenarioIncome",
        "scenarioBudgetItems",
        "scenarioOneOffCosts",
      ]);
      patch.mockClear();
      draft.income[0].projected!.amount = 4500;
      draft.oneOff[0].amount = 300;
      await save._handler(ctx, { id, draft, expectedRevision: 2 });
      expect(patch).toHaveBeenCalledTimes(3); // Income, upfront cost, parent revision.
    });
  });
  it("returns a missing scenario safely and cannot save a deleted scenario", async () => {
    const { owner, id } = await setup();
    const detail = await owner.query(api.scenarios.get, { id });
    await owner.mutation(api.scenarios.remove, { id });
    expect(await owner.query(api.scenarios.get, { id })).toBeNull();
    await expect(
      owner.mutation(api.scenarios.save, {
        id,
        expectedRevision: 0,
        draft: detail!.draft,
      }),
    ).rejects.toThrow("Scenario not found");
  });
  it("creates a snapshot and preserves the live budget through saves", async () => {
    const { t, owner, id, first } = await setup();
    const detail = await owner.query(api.scenarios.get, { id });
    expect(detail.draft.breathingRoomAmount).toBe(600);
    detail.draft.income[0].projected!.amount = 5000;
    await owner.mutation(api.scenarios.save, {
      id,
      expectedRevision: 0,
      draft: detail.draft,
    });
    const live = await t.run((ctx) =>
      ctx.db
        .query("income")
        .withIndex("by_user", (q) => q.eq("userId", first))
        .first(),
    );
    expect(live?.amount).toBe(3800);
    expect(
      (await owner.query(api.scenarios.get, { id })).draft.income[0].baseline!
        .amount,
    ).toBe(3800);
  });
  it("rejects unauthenticated and cross-user access to every operation", async () => {
    const { t, owner, stranger, id } = await setup();
    const { draft } = await owner.query(api.scenarios.get, { id });
    await expect(t.query(api.scenarios.get, { id })).rejects.toThrow();
    await expect(stranger.query(api.scenarios.get, { id })).rejects.toThrow(
      "Scenario not found",
    );
    await expect(
      stranger.mutation(api.scenarios.save, { id, expectedRevision: 0, draft }),
    ).rejects.toThrow();
    await expect(
      stranger.mutation(api.scenarios.duplicate, { id, name: "Copy" }),
    ).rejects.toThrow();
    await expect(
      stranger.mutation(api.scenarios.copyConflict, { id, draft }),
    ).rejects.toThrow();
    await expect(
      stranger.mutation(api.scenarios.remove, { id }),
    ).rejects.toThrow();
    expect(
      (
        await stranger.query(api.scenarios.list, {
          paginationOpts: { cursor: null, numItems: 20 },
        })
      ).page,
    ).toHaveLength(0);
  });
  it("does not let callers change or omit baseline rows", async () => {
    const { owner, id } = await setup();
    const { draft } = await owner.query(api.scenarios.get, { id });
    draft.income[0].baseline!.amount = 1;
    await expect(
      owner.mutation(api.scenarios.save, { id, expectedRevision: 0, draft }),
    ).rejects.toThrow("original budget");
    const fresh = (await owner.query(api.scenarios.get, { id })).draft;
    fresh.budget = [];
    await expect(
      owner.mutation(api.scenarios.save, {
        id,
        expectedRevision: 0,
        draft: fresh,
      }),
    ).rejects.toThrow("Original rows");
  });
  it("rejects stale revisions and copies conflicts with their local projection", async () => {
    const { owner, id } = await setup();
    const first = await owner.query(api.scenarios.get, { id });
    const stale = structuredClone(first.draft);
    first.draft.income[0].projected!.amount = 4000;
    await owner.mutation(api.scenarios.save, {
      id,
      expectedRevision: 0,
      draft: first.draft,
    });
    stale.income[0].projected!.amount = 5000;
    await expect(
      owner.mutation(api.scenarios.save, {
        id,
        expectedRevision: 0,
        draft: stale,
      }),
    ).rejects.toThrow("SCENARIO_CONFLICT");
    const copyId = await owner.mutation(api.scenarios.copyConflict, {
      id,
      draft: stale,
    });
    const copy = await owner.query(api.scenarios.get, { id: copyId });
    expect(copy.draft.income[0].projected!.amount).toBe(5000);
    expect(copy.draft.income[0].baseline!.amount).toBe(3800);
    expect(copy.scenario.snapshotAt).toBe(first.scenario.snapshotAt);
  });
  it("stores removed values, duplicates them and deletes all child rows", async () => {
    const { t, owner, id } = await setup();
    const { draft } = await owner.query(api.scenarios.get, { id });
    draft.income[0].removed = draft.income[0].projected;
    delete draft.income[0].projected;
    await owner.mutation(api.scenarios.save, {
      id,
      expectedRevision: 0,
      draft,
    });
    const copy = await owner.mutation(api.scenarios.duplicate, {
      id,
      name: "Removed copy",
    });
    expect(
      (await owner.query(api.scenarios.get, { id: copy })).draft.income[0]
        .removed?.amount,
    ).toBe(3800);
    await owner.mutation(api.scenarios.remove, { id });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("scenarioIncome")
          .withIndex("by_scenario", (q) => q.eq("scenarioId", id))
          .take(1),
      ),
    ).toHaveLength(0);
  });
  it("starts empty and keeps snapshots after live rows are deleted", async () => {
    const { t, owner, id, first } = await setup();
    const empty = await owner.mutation(api.scenarios.create, {
      name: "Empty",
      mode: "empty",
    });
    expect(
      (await owner.query(api.scenarios.get, { id: empty })).draft.income,
    ).toHaveLength(0);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("income")
        .withIndex("by_user", (q) => q.eq("userId", first))
        .first();
      await ctx.db.delete(row!._id);
    });
    expect(
      (await owner.query(api.scenarios.get, { id })).draft.income[0].baseline
        ?.amount,
    ).toBe(3800);
  });
  it("refuses over-limit copies and invalid amounts", async () => {
    const { t, owner, id, first } = await setup();
    const { draft } = await owner.query(api.scenarios.get, { id });
    draft.breathingRoomAmount = -1;
    await expect(
      owner.mutation(api.scenarios.save, { id, expectedRevision: 0, draft }),
    ).rejects.toThrow("Amounts");
    await t.run(async (ctx) => {
      for (let i = 0; i < 200; i++)
        await ctx.db.insert("income", {
          userId: first,
          description: "Extra",
          amount: 1,
        });
    });
    await expect(
      owner.mutation(api.scenarios.create, { name: "Too large", mode: "copy" }),
    ).rejects.toThrow("exceeds 200");
  });
  it("enforces the scenario cap", async () => {
    const { owner } = await setup();
    for (let i = 1; i < 20; i++)
      await owner.mutation(api.scenarios.create, {
        name: `Empty ${i}`,
        mode: "empty",
      });
    await expect(
      owner.mutation(api.scenarios.create, { name: "Too many", mode: "empty" }),
    ).rejects.toThrow("20 scenarios");
  });
  it("includes scenario tables in expired guest cleanup", async () => {
    const { t, owner, id, first } = await setup();
    await t.run((ctx) => ctx.db.patch(first, { isAnonymous: true })); // A future cutoff models an expired guest deterministically.
    await t.mutation(internal.cleanup.deleteExpiredGuestBatch, {
      userId: first,
      cutoff: Date.now() + 1000,
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("scenarioIncome")
          .withIndex("by_scenario", (q) => q.eq("scenarioId", id))
          .take(1),
      ),
    ).toHaveLength(0);
    vi.useFakeTimers();
    try {
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    } finally {
      vi.useRealTimers();
    }
    expect(await t.run((ctx) => ctx.db.get(first))).toBeNull();
    for (const table of [
      "scenarios",
      "scenarioIncome",
      "scenarioBudgetItems",
      "scenarioOneOffCosts",
    ] as const) {
      expect(
        await t.run((ctx) =>
          ctx.db
            .query(table)
            .withIndex("by_user", (q) => q.eq("userId", first))
            .take(1),
        ),
      ).toHaveLength(0);
    }
    expect(owner).toBeDefined();
  });
});
