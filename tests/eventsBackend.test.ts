import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import {
  MAX_EVENTS,
  MAX_EVENT_ITEMS,
  normalizeSavings,
  calculateEvent,
} from "../shared/events";
const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const [first, second] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { name: "Owner" }),
    await ctx.db.insert("users", { name: "Other" }),
  ]);
  const owner = t.withIdentity({ subject: `${first}|session` });
  const other = t.withIdentity({ subject: `${second}|session` });
  const id = await owner.mutation(api.events.create, { name: "Anniversary" });
  const detail = await owner.query(api.events.get, { id });
  if (!detail) throw new Error("Missing event fixture");
  return { t, owner, other, id, detail, first };
}
describe("event persistence", () => {
  it("saves a full plan atomically and rejects stale revisions", async () => {
    const { owner, id, detail } = await setup();
    const draft = {
      ...detail.draft,
      budget: 1000,
      items: [{ key: "hotel", name: "Hotel", cost: 800, paid: 200 }],
    };
    await expect(
      owner.mutation(api.events.save, { id, expectedRevision: 0, draft }),
    ).resolves.toBe(1);
    await expect(
      owner.mutation(api.events.save, { id, expectedRevision: 0, draft }),
    ).rejects.toThrow("EVENT_CONFLICT");
    expect((await owner.query(api.events.get, { id }))?.draft).toEqual(draft);
    await expect(
      owner.mutation(api.events.save, {
        id,
        expectedRevision: 1,
        draft: {
          ...draft,
          items: [{ key: "bad", name: "Bad", cost: 10, paid: 11 }],
        },
      }),
    ).rejects.toThrow("exceed");
    expect((await owner.query(api.events.get, { id }))?.draft).toEqual(draft);
    await owner.mutation(api.events.remove, { id, expectedRevision: 1 });
    expect(await owner.query(api.events.get, { id })).toBeNull();
  });
  it("isolates users for every endpoint and rejects anonymous requests", async () => {
    const { t, owner, other, id, detail } = await setup();
    expect(await other.query(api.events.list, {})).toEqual([]);
    expect(await other.query(api.events.get, { id })).toBeNull();
    await expect(
      other.mutation(api.events.save, {
        id,
        expectedRevision: 0,
        draft: detail.draft,
      }),
    ).rejects.toThrow("not found");
    await expect(
      other.mutation(api.events.remove, { id, expectedRevision: 0 }),
    ).rejects.toThrow("not found");
    await expect(
      t.mutation(api.events.create, { name: "No identity" }),
    ).rejects.toThrow("signed in");
    await expect(t.query(api.events.list, {})).rejects.toThrow("signed in");
    expect(await owner.query(api.events.list, {})).toHaveLength(1);
  });
  it("enforces currency, funding and date contracts, and cascades item deletion", async () => {
    const { t, owner, id, detail } = await setup();
    await expect(
      owner.mutation(api.events.save, {
        id,
        expectedRevision: 0,
        draft: { ...detail.draft, currency: "USD" },
      }),
    ).rejects.toThrow("currency");
    await expect(
      owner.mutation(api.events.save, {
        id,
        expectedRevision: 0,
        draft: { ...detail.draft, eventDate: "2027-03-01" },
      }),
    ).rejects.toThrow("follow");
    await owner.mutation(api.events.save, {
      id,
      expectedRevision: 0,
      draft: {
        ...detail.draft,
        items: [{ key: "hotel", name: "Hotel", cost: 200, paid: 50 }],
      },
    });
    await expect(
      owner.mutation(api.events.remove, { id, expectedRevision: 0 }),
    ).rejects.toThrow("changed");
    await owner.mutation(api.events.remove, { id, expectedRevision: 1 });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("eventItems")
          .withIndex("by_event", (q) => q.eq("eventId", id))
          .take(201),
      ),
    ).toEqual([]);
  });
  it("round-trips monthly savings and notes with owner-only access and validation", async () => {
    const { t, owner, other, id, detail } = await setup();
    const draft = {
      ...detail.draft,
      budget: 900,
      eventDate: "2027-03-10",
      fundingDate: "2027-03-10",
      notes: "Hotel deposit due in February.\nAsk about cancellation.",
      savingsPlan: {
        startDate: "2027-01-01",
        startingFunding: 100,
        months: [
          { month: "2027-01", planned: 300, actual: 50 },
          { month: "2027-02", planned: 250, actual: 0 },
          { month: "2027-03", planned: 250, actual: 0 },
        ],
      },
    };
    await owner.mutation(api.events.save, { id, expectedRevision: 0, draft });
    expect((await owner.query(api.events.get, { id }))?.draft).toEqual(draft);
    await expect(
      other.mutation(api.events.save, { id, expectedRevision: 1, draft }),
    ).rejects.toThrow("not found");
    await expect(
      t.mutation(api.events.save, { id, expectedRevision: 1, draft }),
    ).rejects.toThrow("signed in");
    await expect(
      owner.mutation(api.events.save, {
        id,
        expectedRevision: 1,
        draft: { ...draft, notes: "x".repeat(5001) },
      }),
    ).rejects.toThrow("5,000");
    await expect(
      owner.mutation(api.events.save, {
        id,
        expectedRevision: 1,
        draft: {
          ...draft,
          savingsPlan: {
            ...draft.savingsPlan,
            months: [...draft.savingsPlan.months, ...draft.savingsPlan.months],
          },
        },
      }),
    ).rejects.toThrow("unique");
    await expect(
      owner.mutation(api.events.save, {
        id,
        expectedRevision: 1,
        draft: { ...draft, savingsPlan: undefined },
      }),
    ).rejects.toThrow("Reload");
    expect((await owner.query(api.events.get, { id }))?.draft).toEqual(draft);
  });
  it("loads legacy events and preserves their funding gap when the new schedule is saved", async () => {
    const { t, owner, id, detail } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(id, { budget: 1000, fundingAmount: 200 }),
    );
    const legacy = await owner.query(api.events.get, { id });
    if (!legacy) throw new Error("Missing event");
    expect(legacy.draft.savingsPlan).toBeUndefined();
    const draft = {
      ...legacy.draft,
      savingsPlan: normalizeSavings(legacy.draft, "2027-01-01"),
    };
    await owner.mutation(api.events.save, {
      id,
      expectedRevision: detail.event.revision,
      draft,
    });
    const updated = await owner.query(api.events.get, { id });
    if (!updated) throw new Error("Missing saved event");
    expect(calculateEvent(updated.draft).gap).toBe(
      calculateEvent(legacy.draft).gap,
    );
    expect(updated.draft.savingsPlan?.startingFunding).toBe(200);
  });
  it("saves a migrated aggregate above the legacy field cap without reducing funding", async () => {
    const { owner, id, detail } = await setup();
    const legacy = {
      ...detail.draft,
      fundingAmount: 1_000_000_000,
      items: [{ key: "deposit", name: "Deposit", cost: 100, paid: 100 }],
    };
    await owner.mutation(api.events.save, {
      id,
      expectedRevision: 0,
      draft: legacy,
    });
    const stored = await owner.query(api.events.get, { id });
    if (!stored) throw new Error("Missing legacy event");
    const draft = {
      ...stored.draft,
      notes: "No funding edits",
      savingsPlan: normalizeSavings(stored.draft, "2027-01-01"),
    };
    expect(draft.savingsPlan.startingFunding).toBe(1_000_000_100);
    await owner.mutation(api.events.save, { id, expectedRevision: 1, draft });
    await owner.mutation(api.events.save, {
      id,
      expectedRevision: 2,
      draft: { ...draft, items: [] },
    });
    const updated = await owner.query(api.events.get, { id });
    expect(updated?.draft.savingsPlan?.startingFunding).toBe(1_000_000_100);
    expect(updated?.draft.notes).toBe("No funding edits");
  });
  it("enforces event and item limits", async () => {
    const { owner, id, detail } = await setup();
    for (let i = 1; i < MAX_EVENTS; i++)
      await owner.mutation(api.events.create, { name: `Event ${i}` });
    await expect(
      owner.mutation(api.events.create, { name: "Too many" }),
    ).rejects.toThrow("20");
    const items = Array.from({ length: MAX_EVENT_ITEMS + 1 }, (_, i) => ({
      key: String(i),
      name: `Item ${i}`,
      cost: 1,
      paid: 0,
    }));
    await expect(
      owner.mutation(api.events.save, {
        id,
        expectedRevision: 0,
        draft: { ...detail.draft, items },
      }),
    ).rejects.toThrow("200");
  });
  it("removes expired guest events and items", async () => {
    vi.useFakeTimers();
    try {
      const { t, owner, id, detail, first } = await setup();
      await t.run((ctx) => ctx.db.patch(first, { isAnonymous: true }));
      await owner.mutation(api.events.save, {
        id,
        expectedRevision: 0,
        draft: {
          ...detail.draft,
          items: [{ key: "gift", name: "Gift", cost: 30, paid: 0 }],
        },
      });
      vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
      await t.mutation(internal.cleanup.deleteExpiredGuests, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
      expect(
        await t.run((ctx) =>
          ctx.db
            .query("eventItems")
            .withIndex("by_user", (q) => q.eq("userId", first))
            .take(201),
        ),
      ).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
