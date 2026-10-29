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
export type SavingsMonth = { month: string; planned: number; actual: number };
export type SavingsPlan = {
  startDate: string;
  startingFunding: number;
  months: SavingsMonth[];
};
export type EventDraft = {
  savingsPlan?: SavingsPlan;
  notes?: string;
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
  if ((draft.notes?.length ?? 0) > 5000)
    return "Event notes support up to 5,000 characters.";
  if (draft.savingsPlan) {
    const plan = draft.savingsPlan;
    if (!plan.startDate || !validDate(plan.startDate))
      return "Choose a valid saving start date.";
    if (draft.fundingDate && plan.startDate > draft.fundingDate)
      return "Start saving on or before the funding deadline.";
    if (!validAmount(plan.startingFunding))
      return "Enter a valid starting funding amount.";
    if (plan.months.length > 1200)
      return "A savings plan supports up to 1,200 months.";
    const months = new Set<string>();
    for (const row of plan.months) {
      if (
        !/^\d{4}-\d{2}$/.test(row.month) ||
        !validDate(`${row.month}-01`) ||
        months.has(row.month)
      )
        return "Savings months must be valid and unique.";
      months.add(row.month);
      if (!validAmount(row.planned) || !validAmount(row.actual))
        return "Enter valid, non-negative monthly savings amounts.";
    }
    if (savingMonthCount(plan.startDate, draft.fundingDate) > 1200)
      return "A savings plan supports up to 1,200 months.";
  }
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
    !draft.savingsPlan &&
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
  const startingFunding =
    draft.savingsPlan?.startingFunding ?? convertFunding(draft, "total");
  const actual =
    draft.savingsPlan?.months.reduce(
      (sum, row) => sum + minor(row.actual, draft.currency),
      0,
    ) ?? 0;
  const funding = minor(startingFunding, draft.currency) + actual;
  const target = Math.max(budget, total);
  const gap = Math.max(0, target - funding);
  const contributions = contributionCount(draft.fundingDate, today);
  return {
    startingFunding,
    actual: actual / factor,
    funded: funding / factor,
    paymentWarning: paid > funding,
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

function monthOrdinal(date: string): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}
function savingMonthCount(start: string, deadline: string): number {
  if (
    !start ||
    !deadline ||
    !validDate(start) ||
    !validDate(deadline) ||
    start > deadline
  )
    return 0;
  return monthOrdinal(deadline) - monthOrdinal(start) + 1;
}
/** Inclusive calendar months, independent of day-of-month and timezone. */
export function savingMonths(start: string, deadline: string): string[] {
  const count = savingMonthCount(start, deadline);
  if (count > 1200) return [];
  const first = monthOrdinal(start);
  return Array.from({ length: count }, (_, offset) => {
    const value = first + offset;
    return `${Math.floor(value / 12)
      .toString()
      .padStart(4, "0")}-${((value % 12) + 1).toString().padStart(2, "0")}`;
  });
}
export function reconcileSavings(
  plan: SavingsPlan,
  deadline: string,
): SavingsPlan {
  const months = savingMonths(plan.startDate, deadline);
  if (months.length > 1200) return plan;
  const existing = new Set(plan.months.map((row) => row.month));
  return {
    ...plan,
    months: [
      ...plan.months,
      ...months
        .filter((month) => !existing.has(month))
        .map((month) => ({ month, planned: 0, actual: 0 })),
    ].sort((a, b) => a.month.localeCompare(b.month)),
  };
}
export function normalizeSavings(
  draft: EventDraft,
  today = dateString(new Date()),
): SavingsPlan {
  if (draft.savingsPlan) return draft.savingsPlan;
  // A past deadline still needs an editable historical schedule.
  const startDate =
    draft.fundingDate && draft.fundingDate < today ? draft.fundingDate : today;
  const plan = reconcileSavings(
    { startDate, startingFunding: convertFunding(draft, "total"), months: [] },
    draft.fundingDate,
  );
  return rebalanceSavings({ ...draft, savingsPlan: plan }, startDate);
}
export function rebalanceSavings(
  draft: EventDraft,
  today = dateString(new Date()),
): SavingsPlan {
  const plan = draft.savingsPlan;
  if (!plan) throw new Error("Initialize the savings plan before rebalancing.");
  const active = new Set(savingMonths(plan.startDate, draft.fundingDate));
  const remaining = plan.months.filter(
    (row) => active.has(row.month) && row.month >= today.slice(0, 7),
  );
  if (!remaining.length || draft.fundingDate < today) return plan;
  const factor = minorFactor(draft.currency);
  const gap = minor(calculateEvent(draft).gap, draft.currency);
  const base = Math.floor(gap / remaining.length);
  let remainder = gap % remaining.length;
  return {
    ...plan,
    months: plan.months.map((row) => {
      if (!active.has(row.month) || row.month < today.slice(0, 7)) return row;
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      return {
        ...row,
        planned: (minor(row.actual, draft.currency) + base + extra) / factor,
      };
    }),
  };
}
export function plannedFunding(draft: EventDraft): number {
  if (!draft.savingsPlan) return 0;
  const active = new Set(
    savingMonths(draft.savingsPlan.startDate, draft.fundingDate),
  );
  return (
    (minor(draft.savingsPlan.startingFunding, draft.currency) +
      draft.savingsPlan.months.reduce(
        (sum, row) =>
          sum +
          (active.has(row.month)
            ? minor(row.planned, draft.currency)
            : minor(row.actual, draft.currency)),
        0,
      )) /
    minorFactor(draft.currency)
  );
}

/** Compare money still needed with the amounts left to save in eligible months. */
export function savingsRebalanceSuggestion(
  draft: EventDraft,
  today = dateString(new Date()),
): { kind: "shortfall" | "surplus"; amount: number; key: string } | null {
  const plan = draft.savingsPlan;
  if (!plan || !draft.fundingDate || draft.fundingDate < today) return null;
  const active = new Set(savingMonths(plan.startDate, draft.fundingDate));
  const remaining = plan.months.filter(
    (row) => active.has(row.month) && row.month >= today.slice(0, 7),
  );
  if (!remaining.length) return null;
  const needed = minor(calculateEvent(draft).gap, draft.currency);
  const scheduled = remaining.reduce(
    (sum, row) =>
      sum +
      Math.max(
        0,
        minor(row.planned, draft.currency) - minor(row.actual, draft.currency),
      ),
    0,
  );
  const difference = needed - scheduled;
  if (difference === 0) return null;
  return {
    kind: difference > 0 ? "shortfall" : "surplus",
    amount: Math.abs(difference) / minorFactor(draft.currency),
    key: JSON.stringify([
      plan.startDate,
      draft.fundingDate,
      today.slice(0, 7),
      draft.currency,
      needed,
      scheduled,
    ]),
  };
}
