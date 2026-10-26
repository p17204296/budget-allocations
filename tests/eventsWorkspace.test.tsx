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
