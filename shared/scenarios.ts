export type Value = {
  name: string;
  amount: number;
  category?: "essentials" | "savings";
};
export type ScenarioRow = {
  key: string;
  baseline?: Value;
  projected?: Value;
  removed?: Value;
};
export type ScenarioDraft = {
  name: string;
  currency: string;
  breathingRoomAmount: number;
  selectedIncomeRowId?: string;
  income: ScenarioRow[];
  budget: ScenarioRow[];
  oneOff: { key: string; name: string; amount: number }[];
};
export const MAX_SCENARIOS = 20;
export const MAX_ROWS = 200;
export const MAX_ONE_OFF = 50;
export function minorFactor(currency: string) {
  return currency === "JPY" ? 1 : 100;
}
export function minor(amount: number, currency: string) {
  const result = Math.round((amount + Number.EPSILON) * minorFactor(currency));
  if (!Number.isSafeInteger(result)) throw new Error("Amount is too large.");
  return result;
}
export function normalise(amount: number, currency: string) {
  return minor(amount, currency) / minorFactor(currency);
}
export function calculate(draft: ScenarioDraft) {
  const f = minorFactor(draft.currency);
  const sum = (values: (Value | undefined)[]) =>
    values.reduce(
      (total, value) =>
        total + (value ? minor(value.amount, draft.currency) : 0),
      0,
    );
  const totals = (kind: "baseline" | "projected") => {
    const income = sum(draft.income.map((row) => row[kind]));
    const spending = sum(
      draft.budget
        .map((row) => row[kind])
        .filter((value) => value?.category !== "savings"),
    );
    const savings = sum(
      draft.budget
        .map((row) => row[kind])
        .filter((value) => value?.category === "savings"),
    );
    return {
      income: income / f,
      spending: spending / f,
      savings: savings / f,
      available: (income - spending - savings) / f,
    };
  };
  const baseline = totals("baseline");
  const projected = totals("projected");
  const requiredMinor =
    minor(projected.spending, draft.currency) +
    minor(projected.savings, draft.currency) +
    minor(draft.breathingRoomAmount, draft.currency);
  const incomeMinor = minor(projected.income, draft.currency);
  const selected = draft.income.find(
    (row) => row.key === draft.selectedIncomeRowId && row.projected,
  );
  const otherIncome =
    incomeMinor -
    (selected?.projected
      ? minor(selected.projected.amount, draft.currency)
      : 0);
  return {
    baseline,
    projected,
    required: requiredMinor / f,
    difference: (incomeMinor - requiredMinor) / f,
    gap: Math.max(0, requiredMinor - incomeMinor) / f,
    improvement:
      (minor(projected.available, draft.currency) -
        minor(baseline.available, draft.currency)) /
      f,
    selectedRequired: selected
      ? Math.max(0, requiredMinor - otherIncome) / f
      : null,
    otherSurplus: Math.max(0, otherIncome - requiredMinor) / f,
    upfront: sum(draft.oneOff) / f,
  };
}
