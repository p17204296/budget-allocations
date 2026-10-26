import { describe, expect, it } from "vitest";
import {
  calculateEvent,
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
  it("rejects invalid dates, payments, duplicates, amounts and underfunded total mode", () => {
    expect(validDate("2027-02-29")).toBe(false);
    expect(validDate("2028-02-29")).toBe(true);
    const plan = draft();
    expect(eventError(plan)).toBeNull();
    expect(
      eventError({ ...plan, fundingMode: "total", fundingAmount: 99 }),
    ).toContain("cover");
    expect(
      eventError({ ...plan, items: [{ ...plan.items[0], paid: 801 }] }),
    ).toContain("exceed");
    expect(
      eventError({ ...plan, items: [...plan.items, ...plan.items] }),
    ).toContain("unique");
    for (const budget of [-1, NaN, Infinity, 0.001, 1_000_000_001])
      expect(eventError({ ...plan, budget })).not.toBeNull();
  });
  it("preserves incomplete inputs without treating blanks as zero", () => {
    const editable = editEvent(draft());
    expect(parseEvent(editable).draft).toEqual(draft());
    expect(parseEvent({ ...editable, budget: "" }).draft).toBeNull();
    editable.items[0].paid = "";
    expect(parseEvent(editable).draft).toBeNull();
  });
});
