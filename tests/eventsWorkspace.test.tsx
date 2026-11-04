// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { EventsWorkspace } from "../src/components/EventsWorkspace";
import { NavigationGuardProvider } from "../src/hooks/NavigationGuard";
import { ConvexError } from "convex/values";
import { octoberJanuaryEvent } from "./fixtures/octoberJanuaryEvent";
type Detail = NonNullable<FunctionReturnType<typeof api.events.get>>;
const mock = vi.hoisted(() => {
  const state: {
    detail: Detail | null;
    list: FunctionReturnType<typeof api.events.list>;
  } = { detail: null, list: [] };
  return {
    state,
    save: vi.fn<
      (args: FunctionArgs<typeof api.events.save>) => Promise<number>
    >(),
    remove: vi.fn(),
    create: vi.fn(),
    query: vi.fn(),
    saved: vi.fn(),
  };
});
vi.mock("sonner", () => ({ toast: { success: mock.saved } }));
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">) =>
    getFunctionName(ref).endsWith(":list")
      ? mock.state.list
      : mock.state.detail,
  useMutation: (ref: FunctionReference<"mutation">) =>
    getFunctionName(ref).endsWith(":save")
      ? mock.save
      : getFunctionName(ref).endsWith(":remove")
        ? mock.remove
        : mock.create,
  useConvex: () => ({ query: mock.query }),
}));
const modules = import.meta.glob("../convex/**/*.ts");
beforeEach(async () => {
  sessionStorage.clear();
  const t = convexTest({ schema, modules });
  const id = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Event owner" }),
  );
  const owner = t.withIdentity({ subject: `${id}|session` });
  const eventId = await owner.mutation(api.events.create, {
    name: "Anniversary",
  });
  const detail = await owner.query(api.events.get, { id: eventId });
  if (!detail) throw new Error("Missing fixture");
  detail.draft.budget = 1000;
  detail.draft.fundingAmount = 200;
  detail.draft.items = [{ key: "hotel", name: "Hotel", cost: 800, paid: 100 }];
  mock.state.detail = detail;
  mock.state.list = [{ event: detail.event, total: 800 }];
  mock.save.mockReset().mockResolvedValue(1);
  mock.query.mockReset().mockResolvedValue(detail);
  mock.remove.mockReset().mockResolvedValue(null);
  mock.saved.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
async function open() {
  render(
    <NavigationGuardProvider>
      <EventsWorkspace />
    </NavigationGuardProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Anniversary/ }));
  });
}
describe("event editor", () => {
  it("autosaves valid edits and blocks saving and navigation for incomplete amounts", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Expected cost"), {
      target: { value: "1200" },
    });
    expect(screen.getByText("Extra budget needed")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(mock.save).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Expected cost"), {
      target: { value: "" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Back to events" }));
    });
    expect(screen.getByLabelText("Expected cost")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByText(/Totals will return/)).toBeTruthy();
  });
  it("keeps edits after a failed save and supports retry", async () => {
    mock.save
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(1);
    await open();
    fireEvent.change(screen.getByLabelText("Total budget"), {
      target: { value: "1200" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(screen.getByDisplayValue("1200")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    });
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });
  it("requires confirmation to reload after a conflict", async () => {
    mock.save.mockRejectedValueOnce(
      new ConvexError({
        code: "EVENT_CONFLICT",
        message: "This event changed in another tab.",
      }),
    );
    await open();
    fireEvent.change(screen.getByLabelText("Total budget"), {
      target: { value: "1200" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Reload saved version" }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => {
      fireEvent.click(
        screen.getAllByRole("button", { name: "Reload saved version" })[1],
      );
    });
    expect(screen.getByDisplayValue("1000")).toBeTruthy();
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });
  it("focuses and scrolls to the new item from both add controls", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    let inputs = screen.getAllByLabelText("Item description");
    expect(document.activeElement).toBe(inputs[inputs.length - 1]);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      behavior: "instant",
    });
    fireEvent.click(screen.getByRole("button", { name: "Add item to event" }));
    inputs = screen.getAllByLabelText("Item description");
    expect(inputs).toHaveLength(3);
    expect(document.activeElement).toBe(inputs[2]);
  });
  it("shows editable named months, keeps plans fixed, rebalances explicitly, and saves notes", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Already funded before this plan"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Start saving from"), {
      target: { value: "2027-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2027-03-10" },
    });
    expect(
      screen
        .getByLabelText("Planned savings — January 2027")
        .getAttribute("value"),
    ).toBe("300");
    fireEvent.change(screen.getByLabelText("Actually saved — January 2027"), {
      target: { value: "50" },
    });
    expect(
      screen
        .getByLabelText("Planned savings — January 2027")
        .getAttribute("value"),
    ).toBe("300");
    fireEvent.change(screen.getByLabelText("Planned savings — February 2027"), {
      target: { value: "400" },
    });
    fireEvent.change(screen.getByLabelText("Event notes"), {
      target: { value: "Remember the hotel deposit." },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(mock.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          notes: "Remember the hotel deposit.",
          savingsPlan: expect.objectContaining({
            startingFunding: 100,
            months: expect.arrayContaining([
              { month: "2027-01", planned: 300, actual: 50 },
              { month: "2027-02", planned: 400, actual: 0 },
            ]),
          }),
        }),
      }),
    );
    fireEvent.change(screen.getByLabelText("Start saving from"), {
      target: { value: "2027-02-01" },
    });
    expect(screen.getByText("Outside current schedule")).toBeTruthy();
    expect(
      screen
        .getByLabelText("Actually saved — January 2027")
        .getAttribute("value"),
    ).toBe("50");
    fireEvent.click(
      screen.getByRole("button", { name: "Rebalance savings plan" }),
    );
    expect(
      screen
        .getByLabelText("Planned savings — February 2027")
        .getAttribute("value"),
    ).toBe("425");
    expect(
      screen
        .getByLabelText("Planned savings — March 2027")
        .getAttribute("value"),
    ).toBe("425");
    expect(
      screen
        .getByLabelText("Actually saved — January 2027")
        .getAttribute("value"),
    ).toBe("50");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete January 2027 from outside current schedule",
      }),
    );
    expect(screen.getByRole("dialog").textContent).toContain(
      "This removes both planned and actual savings for this month.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen
        .getByLabelText("Actually saved — January 2027")
        .getAttribute("value"),
    ).toBe("50");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete January 2027 from outside current schedule",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete month" }));
    expect(screen.queryByLabelText("Actually saved — January 2027")).toBeNull();
    fireEvent.change(screen.getByLabelText("Start saving from"), {
      target: { value: "2027-01-01" },
    });
    expect(
      screen
        .getByLabelText("Actually saved — January 2027")
        .getAttribute("value"),
    ).toBe("0");
  });
  it("balances all selected months, including historical months, within one target", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Start saving from"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2027-03-10" },
    });
    fireEvent.change(screen.getByLabelText("Total budget"), {
      target: { value: "1300" },
    });
    expect(
      screen.getByText(
        /Rebalance spreads what’s still needed across all selected months/,
      ),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Rebalance savings plan" }),
    );

    expect(
      Number(
        screen
          .getByLabelText("Planned savings — January 2026")
          .getAttribute("value"),
      ),
    ).toBeGreaterThan(0);
    expect(
      Number(
        screen
          .getByLabelText("Planned savings — September 2026")
          .getAttribute("value"),
      ),
    ).toBeGreaterThan(0);
    expect(
      Number(
        screen
          .getByLabelText("Planned savings — October 2026")
          .getAttribute("value"),
      ),
    ).toBeGreaterThan(0);
    expect(
      Number(
        screen
          .getByLabelText("Planned savings — November 2026")
          .getAttribute("value"),
      ),
    ).toBeGreaterThan(0);
  });
  it("highlights a needed rebalance, lets the user decline, and prompts again for a changed shortfall", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Start saving from"), {
      target: { value: "2027-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2027-03-10" },
    });
    expect(
      screen.queryByText("Your savings plan needs a little more"),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Total budget"), {
      target: { value: "1300" },
    });
    expect(
      screen.getByText("Your savings plan needs a little more"),
    ).toBeTruthy();
    const rebalance = screen.getByRole("button", {
      name: "Rebalance savings plan",
    });
    expect(rebalance.className).toBe("btn-primary");
    expect(screen.getByText(/falls £300.00 short/)).toBeTruthy();
    const before = screen
      .getByLabelText("Planned savings — January 2027")
      .getAttribute("value");
    fireEvent.click(screen.getByRole("button", { name: "Keep my plan" }));
    expect(
      screen.queryByText("Your savings plan needs a little more"),
    ).toBeNull();
    expect(rebalance.className).toBe("btn-secondary");
    expect(
      screen
        .getByLabelText("Planned savings — January 2027")
        .getAttribute("value"),
    ).toBe(before);
    fireEvent.change(screen.getByLabelText("Event notes"), {
      target: { value: "A reminder" },
    });
    expect(
      screen.queryByText("Your savings plan needs a little more"),
    ).toBeNull();
    // Reopening the same event preserves the declined suggestion in this tab.
    cleanup();
    await open();
    fireEvent.change(screen.getByLabelText("Start saving from"), {
      target: { value: "2027-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2027-03-10" },
    });
    fireEvent.change(screen.getByLabelText("Total budget"), {
      target: { value: "1300" },
    });
    expect(
      screen.queryByText("Your savings plan needs a little more"),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Total budget"), {
      target: { value: "1600" },
    });
    expect(screen.getByText(/falls £600.00 short/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Rebalance savings plan" }),
    );
    expect(
      screen.queryByText("Your savings plan needs a little more"),
    ).toBeNull();
  });
  it("offers an optional reduction and suppresses suggestions during invalid edits", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2027-03-10" },
    });
    fireEvent.change(screen.getByLabelText("Total budget"), {
      target: { value: "800" },
    });
    expect(
      screen.getByText("You could reduce your planned savings"),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Expected cost"), {
      target: { value: "" },
    });
    expect(
      screen.queryByText("You could reduce your planned savings"),
    ).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Rebalance savings plan" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
  it("recognises full funding and blocks saving incomplete monthly amounts", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Already funded before this plan"), {
      target: { value: "1000" },
    });
    expect(screen.getAllByText("Fully funded").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2027-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Actually saved — January 2027"), {
      target: { value: "" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(mock.save).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
  it("blocks rebalance and saving for negative planned or actual savings", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2027-01-01" },
    });
    for (const field of [
      "Planned savings — January 2027",
      "Actually saved — January 2027",
    ]) {
      fireEvent.change(screen.getByLabelText(field), {
        target: { value: "-1" },
      });
      expect(
        screen
          .getByRole("button", { name: "Rebalance savings plan" })
          .hasAttribute("disabled"),
      ).toBe(true);
      expect(
        screen
          .getByRole("button", { name: "Save changes" })
          .hasAttribute("disabled"),
      ).toBe(true);
      fireEvent.change(screen.getByLabelText(field), {
        target: { value: "0" },
      });
    }
    expect(
      screen
        .getByRole("button", { name: "Rebalance savings plan" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });
  it("allows payments above expected cost without requiring matching funding", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Expected cost"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Amount paid"), {
      target: { value: "150" },
    });
    expect(screen.getByText("Over expected cost")).toBeTruthy();
    expect(screen.getAllByText("£50.00").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/payments exceed the funding entered/i),
    ).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(mock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          items: [expect.objectContaining({ cost: 100, paid: 150 })],
        }),
      }),
    );
  });
  it("shows a non-blocking payment warning only when tracking against savings is enabled", async () => {
    if (!mock.state.detail) throw new Error("Missing event fixture");
    mock.state.detail.draft.savingsPlan = {
      startDate: "2026-11-03",
      startingFunding: 0,
      months: [],
    };
    mock.state.detail.draft.fundingMode = "total";
    mock.state.detail.draft.fundingAmount = 0;
    await open();
    expect(
      screen.queryByText(/Recorded payments exceed savings tracked/i),
    ).toBeNull();
    fireEvent.click(
      screen.getByLabelText("Track payments against these savings"),
    );
    expect(
      screen.getByText(
        "Recorded payments exceed savings tracked for this event by £100.00. Check your starting funding and actual savings. You can still save this plan.",
      ),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(mock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ trackPaymentsAgainstSavings: true }),
      }),
    );
  });
  it("keeps migrated starting funding valid and can save unrelated notes", async () => {
    if (!mock.state.detail) throw new Error("Missing legacy fixture");
    mock.state.detail.draft.fundingAmount = 1_000_000_000;
    mock.state.detail.draft.savingsPlan = undefined;
    await open();
    const funding = screen.getByLabelText("Already funded before this plan");
    expect(funding.getAttribute("value")).toBe("1000000100");
    expect(funding.getAttribute("aria-invalid")).toBe("false");
    fireEvent.change(screen.getByLabelText("Event notes"), {
      target: { value: "Notes still save" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(mock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          savingsPlan: expect.objectContaining({
            startingFunding: 1_000_000_100,
          }),
          notes: "Notes still save",
        }),
      }),
    );
  });
  it("follows event dates until a separate deadline is set", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2027-02-28" },
    });
    expect(
      screen
        .getByLabelText("Have money ready by (optional)")
        .getAttribute("value"),
    ).toBe("2027-02-28");
    fireEvent.change(screen.getByLabelText("Have money ready by (optional)"), {
      target: { value: "2027-01-31" },
    });
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2027-03-20" },
    });
    expect(
      screen
        .getByLabelText("Have money ready by (optional)")
        .getAttribute("value"),
    ).toBe("2027-01-31");
    fireEvent.click(screen.getByRole("button", { name: "Use event date" }));
    expect(
      screen
        .getByLabelText("Have money ready by (optional)")
        .getAttribute("value"),
    ).toBe("2027-03-20");
  });
});

it("repairs the live four-month plan explicitly and saves £735 per month", async () => {
  if (!mock.state.detail) throw new Error("Missing fixture");
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
  const reproduction = octoberJanuaryEvent();
  mock.state.detail.draft = {
    ...reproduction,
    name: "Anniversary",
    savingsPlan: reproduction.savingsPlan,
    trackPaymentsAgainstSavings: reproduction.trackPaymentsAgainstSavings,
    notes: reproduction.notes,
  };
  await open();
  expect(screen.getByText("Planned funding: £3,675.00")).toBeTruthy();
  expect(screen.getByText("Expected funding: £3,675.00")).toBeTruthy();
  expect(screen.getByText("£735.00 above the target.")).toBeTruthy();
  expect(mock.save).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Rebalance savings plan" }),
  );
  for (const month of [
    "October 2026",
    "November 2026",
    "December 2026",
    "January 2027",
  ]) {
    expect(
      screen.getByLabelText(`Planned savings — ${month}`).getAttribute("value"),
    ).toBe("735");
    expect(
      screen.getByLabelText(`Actually saved — ${month}`).getAttribute("value"),
    ).toBe("0");
  }
  expect(screen.getByText("Planned funding: £2,940.00")).toBeTruthy();
  expect(screen.getByText("Expected funding: £2,940.00")).toBeTruthy();
  expect(screen.getByText("Your plan covers the target exactly.")).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  });
  expect(mock.save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      draft: expect.objectContaining({
        savingsPlan: {
          startDate: "2026-10-15",
          startingFunding: 0,
          months: ["2026-10", "2026-11", "2026-12", "2027-01"].map((month) => ({
            month,
            planned: 735,
            actual: 0,
          })),
        },
      }),
    }),
  );
});
