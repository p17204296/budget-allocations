import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { minor, minorFactor } from "../shared/scenarios";
import type { Id } from "./_generated/dataModel";
import { eventDraftValidator, eventValidator } from "./eventValidators";
import {
  eventError,
  MAX_EVENTS,
  MAX_EVENT_ITEMS,
  type EventDraft,
} from "../shared/events";

type Ctx = QueryCtx | MutationCtx;
async function user(ctx: Ctx) {
  const id = await getAuthUserId(ctx);
  if (!id || !(await ctx.db.get(id)))
    throw new ConvexError("You must be signed in.");
  return id;
}
async function owned(ctx: Ctx, id: Id<"events">) {
  const userId = await user(ctx);
  const event = await ctx.db.get(id);
  if (!event || event.userId !== userId)
    throw new ConvexError("Event not found.");
  return event;
}
async function items(ctx: Ctx, id: Id<"events">) {
  const rows = await ctx.db
    .query("eventItems")
    .withIndex("by_event", (q) => q.eq("eventId", id))
    .take(MAX_EVENT_ITEMS + 1);
  if (rows.length > MAX_EVENT_ITEMS)
    throw new ConvexError("Event exceeds the item limit.");
  return rows.sort((a, b) => a.position - b.position);
}
export const list = query({
  args: {},
  returns: v.array(v.object({ event: eventValidator, total: v.number() })),
  handler: async (ctx) => {
    const userId = await user(ctx);
    const events = await ctx.db
      .query("events")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_EVENTS + 1);
    if (events.length > MAX_EVENTS)
      throw new ConvexError("Event limit exceeded.");
    return Promise.all(
      events.map(async (event) => ({
        event,
        total:
          (await items(ctx, event._id)).reduce(
            (sum, item) => sum + minor(item.cost, event.currency),
            0,
          ) / minorFactor(event.currency),
      })),
    );
  },
});
export const get = query({
  args: { id: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({ event: eventValidator, draft: eventDraftValidator }),
  ),
  handler: async (ctx, { id }) => {
    const userId = await user(ctx);
    const event = await ctx.db.get(id);
    if (!event || event.userId !== userId) return null;
    const {
      name,
      currency,
      budget,
      eventDate,
      fundingDate,
      fundingDateIndependent,
      fundingMode,
      fundingAmount,
    } = event;
    return {
      event,
      draft: {
        name,
        currency,
        budget,
        eventDate,
        fundingDate,
        fundingDateIndependent,
        fundingMode,
        fundingAmount,
        items: (await items(ctx, id)).map(({ key, name, cost, paid }) => ({
          key,
          name,
          cost,
          paid,
        })),
      },
    };
  },
});
export const create = mutation({
  args: { name: v.string() },
  returns: v.id("events"),
  handler: async (ctx, { name }) => {
    const userId = await user(ctx);
    const existing = await ctx.db
      .query("events")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_EVENTS);
    if (existing.length >= MAX_EVENTS)
      throw new ConvexError(
        "You can save up to 20 events. Delete one before creating another.",
      );
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const draft: EventDraft = {
      name: name.trim(),
      currency: settings?.currency ?? "GBP",
      budget: 0,
      eventDate: "",
      fundingDate: "",
      fundingDateIndependent: false,
      fundingMode: "available",
      fundingAmount: 0,
      items: [],
    };
    const error = eventError(draft);
    if (error) throw new ConvexError(error);
    const { items: unused, ...fields } = draft;
    return ctx.db.insert("events", {
      ...fields,
      userId,
      revision: 0,
      updatedAt: Date.now(),
    });
  },
});
export const save = mutation({
  args: {
    id: v.id("events"),
    expectedRevision: v.number(),
    draft: eventDraftValidator,
  },
  returns: v.number(),
  handler: async (ctx, { id, expectedRevision, draft }) => {
    const event = await owned(ctx, id);
    if (event.revision !== expectedRevision)
      throw new ConvexError({
        code: "EVENT_CONFLICT",
        message:
          "This event changed in another tab. Reload the saved version before continuing.",
      });
    if (draft.currency !== event.currency)
      throw new ConvexError("An event keeps its original currency.");
    const error = eventError(draft);
    if (error) throw new ConvexError(error);
    if (!draft.fundingDateIndependent && draft.fundingDate !== draft.eventDate)
      throw new ConvexError(
        "The funding deadline must follow the event date unless set independently.",
      );
    const existing = await items(ctx, id);
    for (const item of existing) await ctx.db.delete(item._id);
    for (const [position, item] of draft.items.entries())
      await ctx.db.insert("eventItems", {
        ...item,
        name: item.name.trim(),
        userId: event.userId,
        eventId: id,
        position,
      });
    const { items: unused, ...fields } = draft;
    const revision = event.revision + 1;
    await ctx.db.patch(id, {
      ...fields,
      name: fields.name.trim(),
      revision,
      updatedAt: Date.now(),
    });
    return revision;
  },
});
export const remove = mutation({
  args: { id: v.id("events"), expectedRevision: v.number() },
  returns: v.null(),
  handler: async (ctx, { id, expectedRevision }) => {
    const event = await owned(ctx, id);
    if (event.revision !== expectedRevision)
      throw new ConvexError("This event changed. Reload before deleting it.");
    for (const item of await items(ctx, id)) await ctx.db.delete(item._id);
    await ctx.db.delete(id);
    return null;
  },
});
