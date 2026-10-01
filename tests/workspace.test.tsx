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
import { getFunctionName } from "convex/server";
import { WhatIfWorkspace } from "../src/components/WhatIfWorkspace";
import {
  NavigationGuardProvider,
  useNavigationGuard,
} from "../src/hooks/NavigationGuard";
const mock = vi.hoisted(() => ({
  saved: vi.fn(),
  save: vi.fn(),
  create: vi.fn(),
  copy: vi.fn(),
  detail: null as any,
}));
vi.mock("sonner", () => ({ toast: { success: mock.saved } }));
vi.mock("convex/react", () => ({
  useConvex: () => ({ query: async () => mock.detail }),
  usePaginatedQuery: () => ({
    results: [{ _id: "scenario", name: "London", currency: "GBP" }],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
  useQuery: () => mock.detail,
  useMutation: (ref: any) => {
    const name = getFunctionName(ref);
    return name.endsWith(":save")
      ? mock.save
      : name.endsWith(":create")
        ? mock.create
        : mock.copy;
  },
}));
function Host() {
  const { navigate } = useNavigationGuard();
  const [away, setAway] = React.useState(false);
  return (
    <>
      <button onClick={() => void navigate(() => setAway(true))}>
        Leave workspace
      </button>
      {away ? <p>Other page</p> : <WhatIfWorkspace />}
    </>
  );
}
async function choose(label: string, option: string) {
  await act(async () =>
    fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown" }),
  );
  await act(async () =>
    fireEvent.keyDown(
      screen
        .getAllByRole("option", { hidden: true })
        .find(
          (item) => item.textContent?.replace(/\s+/g, " ").trim() === option,
        )!,
      { key: "Enter" },
    ),
  );
}
async function open() {
  const view = render(
    <NavigationGuardProvider>
      <Host />
    </NavigationGuardProvider>,
  );
  await choose("Saved scenarios", "London (GBP)");
  return view;
}
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  vi.useFakeTimers();
  mock.saved.mockReset();
  mock.save.mockReset().mockResolvedValue(1);
  mock.copy.mockReset().mockResolvedValue("copy");
  mock.detail = {
    scenario: { _id: "scenario", snapshotAt: Date.now(), revision: 0 },
    draft: {
      name: "London",
      currency: "GBP",
      breathingRoomAmount: 600,
      income: [
        {
          key: "income",
          baseline: { name: "Contract", amount: 3800 },
          projected: { name: "Contract", amount: 3800 },
        },
      ],
      budget: [
        {
          key: "spend",
          baseline: { name: "Spending", amount: 2500, category: "essentials" },
          projected: { name: "Spending", amount: 2500, category: "essentials" },
        },
        {
          key: "save",
          baseline: { name: "Savings", amount: 700, category: "savings" },
          projected: { name: "Savings", amount: 700, category: "savings" },
        },
      ],
      oneOff: [],
    },
  };
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("workspace integration", () => {
  it("reloads the latest saved version after a conflict with explicit confirmation", async () => {
    mock.save.mockRejectedValue({ data: { code: "SCENARIO_CONFLICT" } });
    await open();
    fireEvent.change(screen.getByLabelText("Contract monthly amount"), {
      target: { value: "5000" },
    });
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    mock.detail = structuredClone(mock.detail);
    mock.detail.scenario.revision = 1;
    mock.detail.draft.income[0].projected.amount = 4800;
    fireEvent.click(screen.getByText("Reload saved version"));
    expect(
      (screen.getByLabelText("Contract monthly amount") as HTMLInputElement)
        .value,
    ).toBe("5000");
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Reload", exact: true }),
      ),
    );
    expect(
      (screen.getByLabelText("Contract monthly amount") as HTMLInputElement)
        .value,
    ).toBe("4800");
    expect(screen.queryByText("Saved")).toBeNull();
  });
  it("moves projected allocations between spending and savings while keeping the baseline", async () => {
    await open();
    await choose("Category for Spending", "Savings");
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    const row = mock.save.mock.calls[0][0].draft.budget[0];
    expect(row.baseline.category).toBe("essentials");
    expect(row.projected.category).toBe("savings");
  });
  it("can delete a scenario with incomplete local inputs without saving them", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Contract monthly amount"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByLabelText("Delete scenario"));
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Delete", exact: true }),
      ),
    );
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.copy).toHaveBeenCalledWith({ id: "scenario" });
    expect(
      screen.getByText("Explore a decision before you make it."),
    ).toBeDefined();
  });
  it("updates local calculations while only saving six seconds after typing stops", async () => {
    await open();
    const input = screen.getByLabelText("Contract monthly amount");
    fireEvent.change(input, { target: { value: "4000" } });
    expect(screen.getByText("Above your target")).toBeDefined();
    expect(mock.save).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    fireEvent.change(input, { target: { value: "5000" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5999);
    });
    expect(mock.save).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mock.save).toHaveBeenCalledTimes(1);
    expect(mock.save.mock.calls[0][0].draft.income[0].projected.amount).toBe(
      5000,
    );
    expect(mock.saved).toHaveBeenCalledWith("Scenario saved", {
      id: "scenario-save-scenario",
    });
  });
  it("manually saves immediately and cancels the delayed write", async () => {
    await open();
    const button = screen.getByRole("button", {
      name: "Save changes",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(mock.saved).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Contract monthly amount"), {
      target: { value: "5100" },
    });
    expect(button.disabled).toBe(false);
    await act(async () => fireEvent.click(button));
    expect(mock.save).toHaveBeenCalledTimes(1);
    expect(mock.saved).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(mock.save).toHaveBeenCalledTimes(1);
  });
  it("blocks manual saving incomplete inputs and preserves failed drafts", async () => {
    await open();
    const input = screen.getByLabelText("Contract monthly amount");
    fireEvent.change(input, { target: { value: "" } });
    expect(
      (
        screen.getByRole("button", {
          name: "Save changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(input, { target: { value: "5100" } });
    mock.save.mockRejectedValueOnce(new Error("offline"));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Save changes" })),
    );
    expect(mock.saved).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("5100");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Retry save" })),
    );
    expect(mock.saved).toHaveBeenCalledTimes(1);
  });
  it("flushes a pending edit before app navigation", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Contract monthly amount"), {
      target: { value: "5000" },
    });
    await act(async () => fireEvent.click(screen.getByText("Leave workspace")));
    expect(mock.save).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Other page")).toBeDefined();
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(mock.save).toHaveBeenCalledTimes(1);
  });
  it("keeps the editor mounted on a failed navigation flush", async () => {
    mock.save.mockRejectedValue(new Error("offline"));
    await open();
    fireEvent.change(screen.getByLabelText("Contract monthly amount"), {
      target: { value: "5000" },
    });
    await act(async () => fireEvent.click(screen.getByText("Leave workspace")));
    expect(screen.queryByText("Other page")).toBeNull();
    expect(
      (screen.getByLabelText("Contract monthly amount") as HTMLInputElement)
        .value,
    ).toBe("5000");
    expect(screen.getByText("Retry save")).toBeDefined();
  });
  it("blocks blank inputs and warns before browser unload", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Contract monthly amount"), {
      target: { value: "" },
    });
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(mock.save).not.toHaveBeenCalled();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await act(async () => fireEvent.click(screen.getByText("Leave workspace")));
    expect(screen.queryByText("Other page")).toBeNull();
  });
  it("restores edited rows and applies a required amount by replacing income", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Contract monthly amount"), {
      target: { value: "3100" },
    });
    fireEvent.click(screen.getByLabelText("Remove Contract"));
    expect(screen.getByText("Removed")).toBeDefined();
    fireEvent.click(screen.getByText("Restore"));
    expect(
      (screen.getByLabelText("Contract monthly amount") as HTMLInputElement)
        .value,
    ).toBe("3100");
    await choose("Income needed to meet your target", "Contract");
    fireEvent.click(screen.getByRole("button", { name: /Set Contract to/ }));
    expect(
      (screen.getByLabelText("Contract monthly amount") as HTMLInputElement)
        .value,
    ).toBe("3800");
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("shows and applies the remaining income after other sources without changing them", async () => {
    mock.detail.draft.income.push({
      key: "room",
      projected: { name: "Room rent", amount: 750 },
    });
    mock.detail.draft.income[0].projected.amount = 2800;
    await open();
    await choose("Income needed to meet your target", "Contract");
    const button = screen.getByRole("button", {
      name: "Set Contract to £3,050.00",
    });
    expect(
      screen.getByText(/This replaces Contract’s What-if monthly amount/)
        .textContent,
    ).toContain("£2,800.00 to £3,050.00");
    fireEvent.click(button);
    expect(
      (screen.getByLabelText("Contract monthly amount") as HTMLInputElement)
        .value,
    ).toBe("3050");
    expect(
      (screen.getByLabelText("Room rent monthly amount") as HTMLInputElement)
        .value,
    ).toBe("750");
    expect(
      screen.queryByRole("button", { name: "Set Contract to £3,050.00" }),
    ).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(mock.save.mock.calls[0][0].draft.income[0].baseline.amount).toBe(
      3800,
    );
    expect(mock.save.mock.calls[0][0].draft.income[0].projected.amount).toBe(
      3050,
    );
  });
  it.each([0, 300, 5000])(
    "never suggests reducing income when extra income is %s",
    async (extra) => {
      if (extra)
        mock.detail.draft.income.push({
          key: "other",
          projected: { name: "Other", amount: extra },
        });
      await open();
      await choose("Income needed to meet your target", "Contract");
      expect(
        screen.queryByRole("button", { name: /Set Contract to/ }),
      ).toBeNull();
      expect(screen.getByText(/No increase is needed/)).toBeDefined();
      expect(
        (screen.getByLabelText("Contract monthly amount") as HTMLInputElement)
          .value,
      ).toBe("3800");
    },
  );
  it("preserves edits as a detached copy when another tab deletes the scenario", async () => {
    const view = await open();
    fireEvent.change(screen.getByLabelText("Contract monthly amount"), {
      target: { value: "5000" },
    });
    const snapshotAt = mock.detail.scenario.snapshotAt;
    mock.detail = null;
    view.rerender(
      <NavigationGuardProvider>
        <Host />
      </NavigationGuardProvider>,
    );
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(mock.save).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Retry save" })).toBeNull();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Save as a new scenario" }),
      ),
    );
    expect(mock.copy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "scenario",
        snapshotAt,
        draft: expect.objectContaining({
          income: [
            expect.objectContaining({
              baseline: expect.objectContaining({ amount: 3800 }),
              projected: expect.objectContaining({ amount: 5000 }),
            }),
          ],
        }),
      }),
    );
  });
  it("offers conflict recovery without discarding the local draft", async () => {
    mock.save.mockRejectedValue({ data: { code: "SCENARIO_CONFLICT" } });
    await open();
    fireEvent.change(screen.getByLabelText("Contract monthly amount"), {
      target: { value: "5000" },
    });
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(screen.getByText("Reload saved version")).toBeDefined();
    expect(screen.getByText("Save as a new scenario")).toBeDefined();
    expect(
      (screen.getByLabelText("Contract monthly amount") as HTMLInputElement)
        .value,
    ).toBe("5000");
  });
});
