import { minor, minorFactor } from "./scenarios";

export const MAX_EVENTS = 20;
export const MAX_EVENT_ITEMS = 200;
export type FundingMode = "available" | "total";
export type EventItem = {
  key: string;
  name: string;
  cost: number;
  paid: number;
};
export type EventDraft = {
  name: string;
  currency: string;
  budget: number;
  eventDate: string;
  fundingDate: string;
  fundingDateIndependent: boolean;
  fundingMode: FundingMode;
  fundingAmount: number;
  items: EventItem[];
};
export function validDate(value: string): boolean {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function eventError(draft: EventDraft): string | null {
  if (!draft.name.trim() || draft.name.trim().length > 80)
    return "Give your event a name of 1–80 characters.";
  if (!validDate(draft.eventDate) || !validDate(draft.fundingDate))
    return "Enter a valid date.";
  const validAmount = (value: number) =>
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000_000 &&
    minor(value, draft.currency) / minorFactor(draft.currency) === value;
  if (!validAmount(draft.budget) || !validAmount(draft.fundingAmount))
    return "Enter valid, non-negative budget and funding amounts in your currency’s smallest unit.";
  if (draft.items.length > MAX_EVENT_ITEMS)
    return "An event supports up to 200 items.";
  const keys = new Set<string>();
  for (const item of draft.items) {
    if (!item.key || item.key.length > 100 || keys.has(item.key))
      return "Item identifiers must be unique.";
    keys.add(item.key);
    if (!item.name.trim() || item.name.trim().length > 120)
      return "Give every item a name of 1–120 characters.";
    if (!validAmount(item.cost) || !validAmount(item.paid))
      return "Enter valid, non-negative item costs and payments.";
    if (item.paid > item.cost)
      return "Amount paid cannot exceed the item’s expected cost.";
  }
  const paid = draft.items.reduce(
    (sum, item) => sum + minor(item.paid, draft.currency),
    0,
  );
  if (
    draft.fundingMode === "total" &&
    minor(draft.fundingAmount, draft.currency) < paid
  )
    return "Total funded so far must cover the payments already recorded.";
  return null;
}
export function dateString(date: Date): string {
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}
export function contributionCount(
  deadline: string,
  today = new Date(),
): number | null {
  if (!deadline || !validDate(deadline)) return null;
  if (deadline < dateString(today)) return 0;
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  const endYear = Number(deadline.slice(0, 4));
  const endMonth = Number(deadline.slice(5, 7)) - 1;
  const monthDifference = (endYear - year) * 12 + endMonth - month;
  const lastDay = new Date(endYear, endMonth + 1, 0).getDate();
  const lastContribution = new Date(endYear, endMonth, Math.min(day, lastDay));
  return monthDifference + (dateString(lastContribution) <= deadline ? 1 : 0);
}
export function calculateEvent(draft: EventDraft, today = new Date()) {
  const factor = minorFactor(draft.currency);
  const total = draft.items.reduce(
    (sum, item) => sum + minor(item.cost, draft.currency),
    0,
  );
  const paid = draft.items.reduce(
    (sum, item) => sum + minor(item.paid, draft.currency),
    0,
  );
  const budget = minor(draft.budget, draft.currency);
  const funding = minor(draft.fundingAmount, draft.currency);
  const target = Math.max(budget, total);
  const gap = Math.max(
    0,
    target - funding - (draft.fundingMode === "available" ? paid : 0),
  );
  const contributions = contributionCount(draft.fundingDate, today);
  return {
    budget: budget / factor,
    total: total / factor,
    paid: paid / factor,
    unpaid: (total - paid) / factor,
    budgetDifference: (budget - total) / factor,
    target: target / factor,
    gap: gap / factor,
    contributions,
    monthly:
      contributions !== null && contributions > 0
        ? Math.ceil(gap / contributions) / factor
        : null,
  };
}
export function convertFunding(draft: EventDraft, next: FundingMode): number {
  if (next === draft.fundingMode) return draft.fundingAmount;
  const paid = draft.items.reduce(
    (sum, item) => sum + minor(item.paid, draft.currency),
    0,
  );
  return (
    (minor(draft.fundingAmount, draft.currency) +
      (next === "total" ? paid : -paid)) /
    minorFactor(draft.currency)
  );
}
