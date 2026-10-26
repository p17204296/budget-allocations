import { eventError, type EventDraft } from "../../shared/events";
import { parseAmount } from "./scenarioDraft";
export type EditableEvent = Omit<
  EventDraft,
  "budget" | "fundingAmount" | "items"
> & {
  budget: string;
  fundingAmount: string;
  items: { key: string; name: string; cost: string; paid: string }[];
};
export function editEvent(draft: EventDraft): EditableEvent {
  return {
    ...draft,
    budget: String(draft.budget),
    fundingAmount: String(draft.fundingAmount),
    items: draft.items.map((item) => ({
      ...item,
      cost: String(item.cost),
      paid: String(item.paid),
    })),
  };
}
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
  const parsed: EventDraft = { ...draft, budget, fundingAmount, items };
  const error = eventError(parsed);
  return error ? { draft: null, error } : { draft: parsed, error: null };
}
