import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateEvent,
  MAX_STARTING_FUNDING,
  normalizeSavings,
  rebalanceSavings,
  reconcileSavings,
  savingMonths,
  plannedFunding,
  savingsRebalanceSuggestion,
  contributionCount,
  convertFunding,
  eventError,
  validDate,
  type EventDraft,
} from "../shared/events";
import { editEvent, parseEvent } from "../src/lib/eventDraft";
function draft(): EventDraft {
  return {
    name: "Anniversary",
    currency: "GBP",
    budget: 1000,
    eventDate: "2027-02-28",
    fundingDate: "2027-02-28",
    fundingDateIndependent: false,
    fundingMode: "available",
    fundingAmount: 200,
    items: [{ key: "hotel", name: "Hotel", cost: 800, paid: 100 }],
  };
}
describe("event calculations", () => {
  it("funds the full budget and distinguishes savings from a budget overrun", () => {
    const plan = draft();
    expect(calculateEvent(plan, new Date(2026, 9, 26))).toMatchObject({
      total: 800,
      budgetDifference: 200,
      paid: 100,
      unpaid: 700,
      target: 1000,
      gap: 700,
      contributions: 5,
      monthly: 140,
    });
    plan.items[0].cost = 1200;
    expect(calculateEvent(plan)).toMatchObject({
      budgetDifference: -200,
      target: 1200,
      gap: 900,
    });
  });
  it("does not net one item’s overpayment against another item’s unpaid cost", () => {
    const value = {
      ...draft(),
      items: [
        { key: "overpaid", name: "Overpaid item", cost: 100, paid: 150 },
        { key: "unpaid", name: "Unpaid item", cost: 100, paid: 0 },
      ],
    };
    expect(calculateEvent(value)).toMatchObject({
      total: 200,
      paid: 150,
      unpaid: 100,
      overpaid: 50,
    });
  });
  it("converts funding modes without changing the gap", () => {
    const plan = draft();
    const total = {
      ...plan,
      fundingMode: "total",
      fundingAmount: convertFunding(plan, "total"),
    } satisfies EventDraft;
    expect(total.fundingAmount).toBe(300);
    expect(calculateEvent(total).gap).toBe(calculateEvent(plan).gap);
    expect(convertFunding(total, "available")).toBe(200);
    total.fundingAmount = 1000;
    expect(calculateEvent(total).gap).toBe(0);
  });
  it("uses minor units, rounds up savings, and supports JPY", () => {
    const plan = {
      ...draft(),
      budget: 1,
      fundingAmount: 0,
      items: [],
      fundingDate: "2026-12-26",
    };
    expect(calculateEvent(plan, new Date(2026, 9, 26)).monthly).toBe(0.34);
    expect(
      calculateEvent(
        { ...plan, currency: "JPY", budget: 100 },
        new Date(2026, 9, 26),
      ).monthly,
    ).toBe(34);
    expect(
      calculateEvent({
        ...plan,
        budget: 0,
        items: [
          { key: "a", name: "a", cost: 0.1, paid: 0 },
          { key: "b", name: "b", cost: 0.2, paid: 0 },
        ],
      }).total,
    ).toBe(0.3);
  });
  it("counts today and anchored month-end contributions, including leap years", () => {
    expect(contributionCount("2027-03-30", new Date(2027, 0, 31))).toBe(2);
    expect(contributionCount("2027-03-31", new Date(2027, 0, 31))).toBe(3);
    expect(contributionCount("2028-02-29", new Date(2028, 0, 31))).toBe(2);
    expect(contributionCount("2026-10-26", new Date(2026, 9, 26))).toBe(1);
    expect(contributionCount("2026-10-25", new Date(2026, 9, 26))).toBe(0);
    expect(contributionCount("", new Date(2026, 9, 26))).toBeNull();
  });
  it("keeps recorded payments independent from funding and rejects invalid dates, duplicates and amounts", () => {
    expect(validDate("2027-02-29")).toBe(false);
    expect(validDate("2028-02-29")).toBe(true);
    const plan = draft();
    expect(eventError(plan)).toBeNull();
    expect(
      eventError({ ...plan, fundingMode: "total", fundingAmount: 0 }),
    ).toBeNull();
    const tracked = {
      ...plan,
      fundingMode: "total",
      fundingAmount: 0,
      trackPaymentsAgainstSavings: true,
    } satisfies EventDraft;
    expect(eventError(tracked)).toBeNull();
    expect(calculateEvent(tracked).paymentWarning).toBe(true);
    expect(
      calculateEvent({ ...tracked, trackPaymentsAgainstSavings: false })
        .paymentWarning,
    ).toBe(false);
    expect(
      eventError({ ...plan, items: [{ ...plan.items[0], paid: 801 }] }),
    ).toBeNull();
    expect(
      eventError({ ...plan, items: [...plan.items, ...plan.items] }),
    ).toContain("unique");
    for (const budget of [-1, NaN, Infinity, 0.001, 1_000_000_001])
      expect(eventError({ ...plan, budget })).not.toBeNull();
  });
  it("preserves incomplete inputs without treating blanks as zero", () => {
    const editable = editEvent(draft());
    expect(parseEvent(editable).draft).toEqual({
      ...draft(),
      savingsPlan: normalizeSavings(draft()),
    });
    const parsed = parseEvent(editable).draft;
    if (!parsed) throw new Error("Expected a valid converted draft");
    expect(calculateEvent(parsed).gap).toBe(calculateEvent(draft()).gap);
    expect(parseEvent({ ...editable, budget: "" }).draft).toBeNull();
    editable.items[0].paid = "";
    expect(parseEvent(editable).draft).toBeNull();
  });
});

describe("monthly savings plans", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 1));
  });
  afterEach(() => vi.useRealTimers());
  function plan(startingFunding = 0): EventDraft {
    return {
      ...draft(),
      budget: 900,
      eventDate: "2027-03-01",
      fundingDate: "2027-03-01",
      items: [],
      savingsPlan: { startDate: "2027-01-31", startingFunding, months: [] },
    };
  }
  it("includes boundary months regardless of day, year and leap day", () => {
    expect(savingMonths("2027-01-31", "2027-03-01")).toEqual([
      "2027-01",
      "2027-02",
      "2027-03",
    ]);
    expect(savingMonths("2027-12-31", "2028-02-29")).toEqual([
      "2027-12",
      "2028-01",
      "2028-02",
    ]);
    expect(savingMonths("2028-02-20", "2028-02-29")).toEqual(["2028-02"]);
    expect(savingMonths("2027-02-01", "")).toEqual([]);
    expect(savingMonths("2027-03-02", "2027-03-01")).toEqual([]);
  });
  it.each([0, 10, 900, 1200])(
    "keeps savings targets independent from payments with starting funding of %s",
    (starting) => {
      const value = plan(starting);
      value.items = [{ key: "deposit", name: "Deposit", cost: 100, paid: 100 }];
      expect(eventError(value)).toBeNull();
      expect(calculateEvent(value).gap).toBe(Math.max(0, 900 - starting));
      expect(calculateEvent(value).paymentWarning).toBe(false);
    },
  );
  it("splits the initial target exactly, including smallest-unit remainders and JPY", () => {
    for (const [currency, budget, expected] of [
      ["GBP", 1, [0.34, 0.33, 0.33]],
      ["JPY", 100, [34, 33, 33]],
    ] as const) {
      const value = { ...plan(), currency, budget };
      const savingsPlan = normalizeSavings(value);
      const scheduled = {
        ...value,
        savingsPlan: reconcileSavings(savingsPlan, value.fundingDate),
      };
      const balanced = rebalanceSavings(scheduled, "2027-01-31");
      expect(balanced.months.map((row) => row.planned)).toEqual(expected);
      expect(plannedFunding({ ...value, savingsPlan: balanced })).toBe(budget);
    }
  });
  it("accepts savings above plan and suggests zero once fully funded", () => {
    const value = {
      ...plan(100),
      savingsPlan: {
        startDate: "2027-01-01",
        startingFunding: 100,
        months: [
          { month: "2027-01", planned: 100, actual: 1000 },
          { month: "2027-02", planned: 100, actual: 0 },
          { month: "2027-03", planned: 100, actual: 0 },
        ],
      },
    };
    expect(eventError(value)).toBeNull();
    expect(calculateEvent(value).gap).toBe(0);
    expect(rebalanceSavings(value, "2027-02-01").months).toEqual([
      { month: "2027-01", planned: 100, actual: 1000 },
      { month: "2027-02", planned: 0, actual: 0 },
      { month: "2027-03", planned: 0, actual: 0 },
    ]);
  });
  it("keeps a completed month's target and spreads its variance over later months", () => {
    for (const [saved, later] of [
      [700, 400],
      [300, 600],
    ]) {
      const value: EventDraft = {
        ...draft(),
        budget: 1500,
        fundingDate: "2026-12-18",
        items: [],
        savingsPlan: {
          startDate: "2026-10-21",
          startingFunding: 0,
          months: [
            { month: "2026-10", planned: 500, actual: saved },
            { month: "2026-11", planned: 500, actual: 0 },
            { month: "2026-12", planned: 500, actual: 0 },
          ],
        },
      };
      const balanced = rebalanceSavings(value, "2026-10-21", "2026-10-21");
      expect(balanced.months.map((row) => row.planned)).toEqual([
        500,
        later,
        later,
      ]);
      expect(
        plannedFunding({ ...value, savingsPlan: balanced }, "2026-10-21"),
      ).toBe(1500);
    }
  });
  it("preserves history and actuals while rebalancing only remaining months", () => {
    const value = {
      ...plan(100),
      savingsPlan: {
        startDate: "2027-01-01",
        startingFunding: 100,
        months: [
          { month: "2027-01", planned: 300, actual: 100 },
          { month: "2027-02", planned: 300, actual: 50 },
          { month: "2027-03", planned: 200, actual: 0 },
        ],
      },
    };
    expect(calculateEvent(value).gap).toBe(650);
    expect(value.savingsPlan.months.map((row) => row.planned)).toEqual([
      300, 300, 200,
    ]);
    const balanced = rebalanceSavings(value, "2027-02-15");
    expect(balanced.months).toEqual([
      { month: "2027-01", planned: 300, actual: 100 },
      { month: "2027-02", planned: 300, actual: 50 },
      { month: "2027-03", planned: 650, actual: 0 },
    ]);
    expect(rebalanceSavings(value, "2027-03-02")).toEqual(value.savingsPlan);
    const moved = reconcileSavings(
      { ...balanced, startDate: "2027-02-01" },
      "2027-04-01",
    );
    expect(moved.months).toContainEqual({
      month: "2027-01",
      planned: 300,
      actual: 100,
    });
    expect(moved.months).toContainEqual({
      month: "2027-04",
      planned: 0,
      actual: 0,
    });
    const changed = { ...value, fundingDate: "2027-04-01", savingsPlan: moved };
    expect(calculateEvent(changed).actual).toBe(150);
    expect(plannedFunding(changed)).toBe(900);
  });
  it("preserves legacy gaps in both funding modes, including historical deadlines", () => {
    for (const fundingMode of ["available", "total"] as const) {
      const value = { ...draft(), fundingMode };
      const savingsPlan = normalizeSavings(value, "2028-01-01");
      expect(calculateEvent({ ...value, savingsPlan }).gap).toBe(
        calculateEvent(value).gap,
      );
      expect(savingsPlan.startDate).toBe(value.fundingDate);
    }
  });
  it("rejects invalid dates, duplicate months, excessive ranges, notes and invalid amounts", () => {
    const value = plan();
    const base = value.savingsPlan;
    if (!base) throw new Error("Missing savings plan");
    expect(
      eventError({
        ...value,
        savingsPlan: { ...base, startDate: "2027-03-02" },
      }),
    ).toContain("before");
    expect(
      eventError({ ...value, savingsPlan: { ...base, startDate: "" } }),
    ).toContain("start");
    expect(eventError({ ...value, notes: "x".repeat(5001) })).toContain(
      "5,000",
    );
    for (const row of [
      { month: "2027-13", planned: 0, actual: 0 },
      { month: "2027-01", planned: -1, actual: 0 },
      { month: "2027-01", planned: 0, actual: 0.001 },
    ]) {
      expect(
        eventError({ ...value, savingsPlan: { ...base, months: [row] } }),
      ).not.toBeNull();
    }
    const row = { month: "2027-01", planned: 0, actual: 0 };
    expect(
      eventError({ ...value, savingsPlan: { ...base, months: [row, row] } }),
    ).toContain("unique");
    expect(eventError({ ...value, fundingDate: "2200-01-01" })).toContain(
      "1,200",
    );
    expect(savingMonths("2027-01-01", "9999-12-31")).toEqual([]);
  });
  it("rejects blank monthly fields without losing editable text", () => {
    const value = plan();
    const editable = editEvent(value);
    editable.savingsPlan.months = [
      { month: "2027-01", planned: "100", actual: "" },
    ];
    expect(parseEvent(editable).error).toContain("Blank");
    expect(editable.savingsPlan.months[0].actual).toBe("");
  });
});

describe("rebalance suggestions", () => {
  function value(): EventDraft {
    return {
      ...draft(),
      budget: 900,
      eventDate: "2027-03-10",
      fundingDate: "2027-03-10",
      items: [],
      savingsPlan: {
        startDate: "2027-01-01",
        startingFunding: 0,
        months: [
          { month: "2027-01", planned: 300, actual: 100 },
          { month: "2027-02", planned: 300, actual: 0 },
          { month: "2027-03", planned: 300, actual: 0 },
        ],
      },
    };
  }
  it("uses the selected start month for suggestions and clears after rebalancing", () => {
    const draft = value();
    if (!draft.savingsPlan) throw new Error("Expected a savings plan.");
    draft.savingsPlan.months[1] = {
      ...draft.savingsPlan.months[1],
      planned: 250,
    };
    draft.savingsPlan.months[2] = {
      ...draft.savingsPlan.months[2],
      planned: 250,
    };
    expect(savingsRebalanceSuggestion(draft, "2027-02-01")).toMatchObject({
      kind: "shortfall",
      amount: 300,
    });
    const rebalanced = rebalanceSavings(
      draft,
      draft.savingsPlan.startDate,
      "2027-02-01",
    );
    expect(
      savingsRebalanceSuggestion(
        { ...draft, savingsPlan: rebalanced },
        "2027-02-01",
      ),
    ).toBeNull();
  });
  it("uses recorded savings to adjust the remaining plan", () => {
    expect(savingsRebalanceSuggestion(value(), "2027-01-20")).toMatchObject({
      kind: "shortfall",
      amount: 200,
    });
  });
  it("offers a reduction when the target is lower, including fully funded events", () => {
    const draft = value();
    expect(
      savingsRebalanceSuggestion({ ...draft, budget: 300 }, "2027-01-20"),
    ).toMatchObject({ kind: "surplus", amount: 400 });
    expect(
      savingsRebalanceSuggestion({ ...draft, budget: 100 }, "2027-01-20"),
    ).toMatchObject({ kind: "surplus", amount: 600 });
  });
  it("clears after rebalancing, ignores unrelated edits, and stops after the deadline", () => {
    const draft = value();
    if (!draft.savingsPlan) throw new Error("Expected a savings plan.");
    draft.savingsPlan.months[1] = {
      ...draft.savingsPlan.months[1],
      planned: 250,
    };
    const recommendation = savingsRebalanceSuggestion(draft, "2027-02-01");
    expect(
      savingsRebalanceSuggestion(
        { ...draft, notes: "New reminder" },
        "2027-02-01",
      ),
    ).toEqual(recommendation);
    expect(
      savingsRebalanceSuggestion(
        {
          ...draft,
          savingsPlan: rebalanceSavings(
            draft,
            draft.savingsPlan.startDate,
            "2027-02-01",
          ),
        },
        "2027-02-01",
      ),
    ).toBeNull();
    expect(savingsRebalanceSuggestion(draft, "2027-03-11")).toBeNull();
    expect(
      savingsRebalanceSuggestion({ ...draft, fundingDate: "" }, "2027-02-01"),
    ).toBeNull();
  });
});

describe("legacy aggregate funding limits", () => {
  it("keeps aggregate limits bounded without raising individual amount limits", () => {
    const value = {
      ...draft(),
      savingsPlan: {
        startDate: "2026-10-29",
        startingFunding: MAX_STARTING_FUNDING,
        months: [],
      },
    };
    expect(eventError(value)).toBeNull();
    for (const startingFunding of [
      MAX_STARTING_FUNDING + 1,
      -1,
      NaN,
      Infinity,
      0.001,
    ]) {
      expect(
        eventError({
          ...value,
          savingsPlan: { ...value.savingsPlan, startingFunding },
        }),
      ).not.toBeNull();
      expect(
        parseEvent(
          editEvent({
            ...value,
            savingsPlan: { ...value.savingsPlan, startingFunding },
          }),
        ).draft,
      ).toBeNull();
    }
    expect(eventError({ ...value, budget: 1_000_000_001 })).not.toBeNull();
    expect(
      eventError({ ...value, fundingAmount: 1_000_000_001 }),
    ).not.toBeNull();
    expect(
      eventError({
        ...value,
        items: [
          { key: "too-much", name: "Too much", cost: 1_000_000_001, paid: 0 },
        ],
      }),
    ).not.toBeNull();
    expect(
      eventError({
        ...value,
        savingsPlan: {
          ...value.savingsPlan,
          months: [{ month: "2026-10", planned: 1_000_000_001, actual: 0 }],
        },
      }),
    ).not.toBeNull();
  });

  it.each(["GBP", "JPY"])(
    "preserves the largest valid legacy aggregate in %s",
    (currency) => {
      const legacy = {
        ...draft(),
        currency,
        fundingAmount: 1_000_000_000,
        items: Array.from({ length: 200 }, (_, index) => ({
          key: String(index),
          name: `Payment ${index}`,
          cost: 1_000_000_000,
          paid: 1_000_000_000,
        })),
      };
      expect(eventError(legacy)).toBeNull();
      const editable = editEvent(legacy);
      expect(editable.savingsPlan.startingFunding).toBe("201000000000");
      const parsed = parseEvent({ ...editable, notes: "An unrelated note" });
      expect(parsed.error).toBeNull();
      if (!parsed.draft)
        throw new Error("Expected migrated aggregate to remain valid");
      expect(eventError(parsed.draft)).toBeNull();
      expect(calculateEvent(parsed.draft).funded).toBe(201_000_000_000);
      expect(calculateEvent(parsed.draft).gap).toBe(calculateEvent(legacy).gap);
      expect(
        parseEvent(editEvent({ ...parsed.draft, items: [] })).error,
      ).toBeNull();
    },
  );
});
