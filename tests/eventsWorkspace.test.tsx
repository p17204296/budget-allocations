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
      screen.getByRole("button", { name: "Rebalance remaining months" }),
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
      name: "Rebalance remaining months",
    });
    expect(rebalance.className).toBe("btn-primary");
    expect(screen.getByText(/fall £300.00 short/)).toBeTruthy();
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
    expect(screen.getByText(/fall £600.00 short/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Rebalance remaining months" }),
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
        .getByRole("button", { name: "Rebalance remaining months" })
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
  it("keeps migrated starting funding valid and can save unrelated notes", async () => {
    if (!mock.state.detail) throw new Error("Missing legacy fixture");
    mock.state.detail.draft.fundingAmount = 1_000_000_000;
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
