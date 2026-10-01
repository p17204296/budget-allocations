import { v } from "convex/values";
export const valueValidator = v.object({
  name: v.string(),
  amount: v.number(),
  category: v.optional(v.union(v.literal("essentials"), v.literal("savings"))),
});
export const rowValidator = v.object({
  key: v.string(),
  baseline: v.optional(valueValidator),
  projected: v.optional(valueValidator),
  removed: v.optional(valueValidator),
});
export const oneOffValidator = v.object({
  key: v.string(),
  name: v.string(),
  amount: v.number(),
});
export const draftFields = {
  name: v.string(),
  currency: v.string(),
  breathingRoomAmount: v.number(),
  selectedIncomeRowId: v.optional(v.string()),
  income: v.array(rowValidator),
  budget: v.array(rowValidator),
  oneOff: v.array(oneOffValidator),
};
export const draftValidator = v.object(draftFields);
export const scenarioFields = {
  userId: v.id("users"),
  name: v.string(),
  currency: v.string(),
  snapshotAt: v.number(),
  updatedAt: v.number(),
  revision: v.number(),
  breathingRoomAmount: v.number(),
  selectedIncomeRowId: v.optional(v.string()),
};
export const scenarioValidator = v.object({
  _id: v.id("scenarios"),
  _creationTime: v.number(),
  ...scenarioFields,
});
export const detailValidator = v.object({
  scenario: scenarioValidator,
  draft: draftValidator,
});
