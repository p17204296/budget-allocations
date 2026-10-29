import {
  eventError,
  MAX_STARTING_FUNDING,
  normalizeSavings,
  type EventDraft,
} from "../../shared/events";
import { parseAmount } from "./scenarioDraft";
export type EditableEvent = Omit<
  EventDraft,
  "budget" | "fundingAmount" | "items" | "savingsPlan"
> & {
  savingsPlan: {
    startDate: string;
    startingFunding: string;
    months: { month: string; planned: string; actual: string }[];
  };
  budget: string;
  fundingAmount: string;
  items: { key: string; name: string; cost: string; paid: string }[];
};
/** Prepare text inputs and normalize legacy funding without changing recorded money. */
export function editEvent(draft: EventDraft): EditableEvent {
  const plan = normalizeSavings(draft);
  return {
    ...draft,
    savingsPlan: {
      ...plan,
      startingFunding: String(plan.startingFunding),
      months: plan.months.map((row) => ({
        ...row,
        planned: String(row.planned),
        actual: String(row.actual),
      })),
    },
    budget: String(draft.budget),
    fundingAmount: String(draft.fundingAmount),
    items: draft.items.map((item) => ({
      ...item,
      cost: String(item.cost),
      paid: String(item.paid),
    })),
  };
}
/** Parse every input and apply the shared server-side event validation rules. */
export function parseEvent(
  draft: EditableEvent,
): { draft: EventDraft; error: null } | { draft: null; error: string } {
  const budget = parseAmount(draft.budget, draft.currency);
  const fundingAmount = parseAmount(draft.fundingAmount, draft.currency);
  if (budget === null || fundingAmount === null)
    return {
      draft: null,
      error:
        "Complete the budget and funding amounts. Use non-negative numbers in your currency’s smallest unit.",
    };
  const items: EventDraft["items"] = [];
  for (const item of draft.items) {
    const cost = parseAmount(item.cost, draft.currency);
    const paid = parseAmount(item.paid, draft.currency);
    if (cost === null || paid === null)
      return {
        draft: null,
        error:
          "Complete every item’s expected cost and amount paid. Blank amounts are not treated as zero.",
      };
    items.push({ ...item, cost, paid });
  }
  const startingFunding = parseAmount(
    draft.savingsPlan.startingFunding,
    draft.currency,
    MAX_STARTING_FUNDING,
  );
  if (startingFunding === null)
    return { draft: null, error: "Complete the starting funding amount." };
  const months = [];
  for (const row of draft.savingsPlan.months) {
    const planned = parseAmount(row.planned, draft.currency);
    const actual = parseAmount(row.actual, draft.currency);
    if (planned === null || actual === null)
      return {
        draft: null,
        error:
          "Complete every month’s planned and actual savings. Blank amounts are not treated as zero.",
      };
    months.push({ month: row.month, planned, actual });
  }
  const parsed: EventDraft = {
    ...draft,
    budget,
    fundingAmount,
    items,
    savingsPlan: { ...draft.savingsPlan, startingFunding, months },
  };
  const error = eventError(parsed);
  return error ? { draft: null, error } : { draft: parsed, error: null };
}
