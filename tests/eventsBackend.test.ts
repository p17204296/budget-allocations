import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { MAX_EVENTS, MAX_EVENT_ITEMS } from "../shared/events";
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
