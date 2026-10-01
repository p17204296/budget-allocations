import {
  minorFactor,
  type ScenarioDraft,
  type Value,
  type ScenarioRow,
} from "../../shared/scenarios";
export type EditableValue = Omit<Value, "amount"> & { amount: string };
export type EditableRow = Omit<ScenarioRow, "projected" | "removed"> & {
  projected?: EditableValue;
  removed?: EditableValue;
};
export type EditableDraft = Omit<
  ScenarioDraft,
  "income" | "budget" | "oneOff" | "breathingRoomAmount"
> & {
  breathingRoomAmount: string;
  income: EditableRow[];
  budget: EditableRow[];
  oneOff: { key: string; name: string; amount: string }[];
};
export function editable(draft: ScenarioDraft): EditableDraft {
  const rows = (data: ScenarioRow[]) =>
    data.map((row) => ({
      ...row,
      projected: row.projected
        ? { ...row.projected, amount: String(row.projected.amount) }
        : undefined,
      removed: row.removed
        ? { ...row.removed, amount: String(row.removed.amount) }
        : undefined,
    }));
  return {
    ...draft,
    breathingRoomAmount: String(draft.breathingRoomAmount),
    income: rows(draft.income),
    budget: rows(draft.budget),
    oneOff: draft.oneOff.map((row) => ({ ...row, amount: String(row.amount) })),
  };
}
export function parseAmount(value: string, currency: string): number | null {
  const pattern = minorFactor(currency) === 1 ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/;
  if (!pattern.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) && number <= 1_000_000_000 ? number : null;
}
export function serialise(draft: EditableDraft): ScenarioDraft | null {
  const cleanName = (name: string) =>
    name.trim().length > 0 && name.trim().length <= 80;
  if (!cleanName(draft.name)) return null;
  const breathing = parseAmount(draft.breathingRoomAmount, draft.currency);
  if (breathing === null) return null;
  let valid = true;
  const value = (item: EditableValue | undefined): Value | undefined => {
    if (!item) return undefined;
    const amount = parseAmount(item.amount, draft.currency);
    if (!cleanName(item.name) || amount === null) valid = false;
    return { ...item, name: item.name.trim(), amount: amount ?? 0 };
  };
  const rows = (items: EditableRow[]): ScenarioRow[] =>
    items.map((row) => ({
      key: row.key,
      ...(row.baseline ? { baseline: row.baseline } : {}),
      ...(row.projected ? { projected: value(row.projected) } : {}),
      ...(row.removed ? { removed: value(row.removed) } : {}),
    }));
  const result: ScenarioDraft = {
    name: draft.name.trim(),
    currency: draft.currency,
    breathingRoomAmount: breathing,
    ...(draft.selectedIncomeRowId
      ? { selectedIncomeRowId: draft.selectedIncomeRowId }
      : {}),
    income: rows(draft.income),
    budget: rows(draft.budget),
    oneOff: draft.oneOff.map((row) => {
      const amount = parseAmount(row.amount, draft.currency);
      if (!cleanName(row.name) || amount === null) valid = false;
      return { ...row, name: row.name.trim(), amount: amount ?? 0 };
    }),
  };
  return valid ? result : null;
}
export function removeRow(
  draft: EditableDraft,
  group: "income" | "budget",
  key: string,
): EditableDraft {
  return {
    ...draft,
    selectedIncomeRowId:
      group === "income" && draft.selectedIncomeRowId === key
        ? undefined
        : draft.selectedIncomeRowId,
    [group]: draft[group].flatMap((row) =>
      row.key !== key
        ? [row]
        : row.baseline
          ? [{ ...row, projected: undefined, removed: row.projected }]
          : [],
    ),
  };
}
export function restoreRow(
  draft: EditableDraft,
  group: "income" | "budget",
  key: string,
): EditableDraft {
  return {
    ...draft,
    [group]: draft[group].map((row) =>
      row.key === key
        ? { ...row, projected: row.removed, removed: undefined }
        : row,
    ),
  };
}
