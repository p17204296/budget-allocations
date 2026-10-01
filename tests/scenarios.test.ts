import { describe, expect, it } from "vitest";
import { calculate, normalise, type ScenarioDraft } from "../shared/scenarios";
import {
  editable,
  serialise,
  removeRow,
  restoreRow,
  parseAmount,
} from "../src/lib/scenarioDraft";
const base = (): ScenarioDraft => ({
  name: "Leeds",
  currency: "GBP",
  breathingRoomAmount: 600,
  income: [
    {
      key: "salary",
      baseline: { name: "Income", amount: 3800 },
      projected: { name: "Income", amount: 3800 },
    },
  ],
  budget: [
    {
      key: "costs",
      baseline: { name: "Spending", amount: 2500, category: "essentials" },
      projected: { name: "Spending", amount: 2500, category: "essentials" },
    },
    {
      key: "saving",
      baseline: { name: "Saving", amount: 700, category: "savings" },
      projected: { name: "Saving", amount: 700, category: "savings" },
    },
  ],
  oneOff: [],
});
describe("scenario arithmetic", () => {
  it("preserves lifestyle for relocation", () => {
    const d = base();
    d.budget[0].projected!.amount = 3700;
    expect(calculate(d)).toMatchObject({
      required: 5000,
      gap: 1200,
      difference: -1200,
      improvement: -1200,
    });
  });
  it("accounts for spare-room income and solves the remaining source", () => {
    const d = base();
    d.income.push({ key: "rent", projected: { name: "Room", amount: 750 } });
    d.budget[0].projected!.amount += 150;
    d.selectedIncomeRowId = "salary";
    expect(calculate(d)).toMatchObject({
      selectedRequired: 3200,
      improvement: 600,
      projected: { available: 1200 },
    });
  });
  it.each(["salary", "room", "side"])(
    "solves %s against other income and reaches the exact target",
    (key) => {
      const d = base();
      d.budget[0].projected!.amount = 3700;
      d.income.push(
        { key: "room", projected: { name: "Room", amount: 750.25 } },
        { key: "side", projected: { name: "Side", amount: 300.5 } },
      );
      d.selectedIncomeRowId = key;
      const result = calculate(d);
      const selected = d.income.find((row) => row.key === key)!;
      const others = d.income
        .filter((row) => row.key !== key)
        .map((row) => row.projected!.amount);
      expect(result.selectedRequired).toBe(
        Math.round((5000 - others.reduce((a, b) => a + b, 0)) * 100) / 100,
      );
      selected.projected!.amount = result.selectedRequired!;
      expect(calculate(d)).toMatchObject({
        difference: 0,
        projected: { available: 600 },
      });
      expect(
        d.income
          .filter((row) => row.key !== key)
          .map((row) => row.projected!.amount),
      ).toEqual(others);
    },
  );
  it("replaces contracts rather than double-counting them", () => {
    const d = base();
    d.income[0].projected!.amount = 4800;
    expect(calculate(d).improvement).toBe(1000);
  });
  it("uses net side-hustle income and separates upfront costs", () => {
    const d = base();
    d.income.push({
      key: "side",
      projected: { name: "Side hustle after costs and tax", amount: 300 },
    });
    d.oneOff = [{ key: "move", name: "Move", amount: 2000 }];
    expect(calculate(d)).toMatchObject({
      improvement: 300,
      upfront: 2000,
      required: 3800,
    });
  });
  it("handles income loss and restores the last projected value", () => {
    const d = editable(base());
    d.income[0].projected!.amount = "4000";
    const removed = removeRow(d, "income", "salary");
    expect(calculate(serialise(removed)!).gap).toBe(3800);
    const restored = restoreRow(removed, "income", "salary");
    expect(restored.income[0].projected!.amount).toBe("4000");
  });
  it("uses integer minor units including JPY", () => {
    const d = base();
    d.income = [
      { key: "a", projected: { name: "A", amount: 0.1 } },
      { key: "b", projected: { name: "B", amount: 0.2 } },
    ];
    expect(calculate(d).projected.income).toBe(0.3);
    expect(normalise(10.6, "JPY")).toBe(11);
    expect(parseAmount("11.5", "JPY")).toBeNull();
    expect(normalise(1.005, "GBP")).toBe(1.01);
  });
  it("blocks blank, partial, negative and excessive inputs", () => {
    const d = editable(base());
    for (const input of [
      "",
      "1.",
      "-1",
      "Infinity",
      "1e3",
      "1.001",
      "1000000001",
    ]) {
      d.income[0].projected!.amount = input;
      expect(serialise(d)).toBeNull();
    }
  });
  it("zeroes the selected requirement when other income covers the target", () => {
    const d = base();
    d.income.push({ key: "other", projected: { name: "Other", amount: 5000 } });
    d.selectedIncomeRowId = "salary";
    expect(calculate(d)).toMatchObject({
      selectedRequired: 0,
      otherSurplus: 1200,
    });
  });
  it("distinguishes balanced allocations from meeting the target", () => {
    const d = base();
    d.income[0].projected!.amount = 3300;
    expect(calculate(d)).toMatchObject({
      projected: { available: 100 },
      gap: 500,
    });
  });
  it("handles empty and deficit baselines", () => {
    const d = base();
    d.income[0].baseline!.amount = 2000;
    expect(calculate(d).baseline.available).toBe(-1200);
    expect(
      calculate({ ...d, income: [], budget: [], breathingRoomAmount: 0 })
        .required,
    ).toBe(0);
  });
});
