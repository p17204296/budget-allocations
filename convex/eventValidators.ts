import { v } from "convex/values";
export const eventItemFields = {
  key: v.string(),
  name: v.string(),
  cost: v.number(),
  paid: v.number(),
};
export const savingsPlanValidator = v.object({
  startDate: v.string(),
  startingFunding: v.number(),
  months: v.array(
    v.object({ month: v.string(), planned: v.number(), actual: v.number() }),
  ),
});
export const eventFields = {
  savingsPlan: v.optional(savingsPlanValidator),
  notes: v.optional(v.string()),
  name: v.string(),
  currency: v.string(),
  budget: v.number(),
  eventDate: v.string(),
  fundingDate: v.string(),
  fundingDateIndependent: v.boolean(),
  fundingMode: v.union(v.literal("available"), v.literal("total")),
  fundingAmount: v.number(),
};
export const eventDraftValidator = v.object({
  ...eventFields,
  items: v.array(v.object(eventItemFields)),
});
export const eventValidator = v.object({
  ...eventFields,
  _id: v.id("events"),
  _creationTime: v.number(),
  userId: v.id("users"),
  revision: v.number(),
  updatedAt: v.number(),
});
