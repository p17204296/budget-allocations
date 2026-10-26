// @vitest-environment jsdom
import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FloatingSaveProvider,
  useFloatingSave,
} from "../src/components/FloatingSave";
import { SaveForm } from "../src/components/SaveForm";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Form({ title, save }: { title: string; save: () => void }) {
  const [value, setValue] = useState("Original");
  const [complete, setComplete] = useState(false);
  return complete ? (
    <p>{title} saved</p>
  ) : (
    <SaveForm
      saveTitle={title}
      saveLabel="Save changes"
      saving={false}
      onSubmit={(event) => {
        event.preventDefault();
        save();
        setComplete(true);
      }}
    >
      <label>
        {title} name
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />
      </label>
      <button type="submit">Save changes</button>
    </SaveForm>
  );
}
function Controlled({
  status,
  save,
  disabled = false,
}: {
  status: "dirty" | "saving" | "invalid" | "error" | "conflict";
  save: () => void;
  disabled?: boolean;
}) {
  useFloatingSave({
    visible: true,
    title: "Event plan",
    status,
    actionLabel: status === "error" ? "Retry save" : "Save now",
    disabled,
    onSave: save,
  });
  return null;
}
describe("floating save prompt", () => {
  it("appears after an edit, preserves focus, submits its form and disappears after success", () => {
    const save = vi.fn();
    render(
      <FloatingSaveProvider>
        <Form title="Income" save={save} />
      </FloatingSaveProvider>,
    );
    expect(
      screen.queryByRole("complementary", { name: "Unsaved changes" }),
    ).toBeNull();
    const input = screen.getByLabelText("Income name");
    input.focus();
    fireEvent.change(input, { target: { value: "Salary" } });
    expect(document.activeElement).toBe(input);
    const prompt = screen.getByRole("complementary", {
      name: "Unsaved changes",
    });
    expect(within(prompt).getByText("Income")).toBeTruthy();
    fireEvent.click(
      within(prompt).getByRole("button", { name: "Save changes" }),
    );
    expect(save).toHaveBeenCalledOnce();
    expect(screen.queryByRole("complementary")).toBeNull();
  });
  it("disappears on reverting the edit and respects native validation", () => {
    const save = vi.fn();
    render(
      <FloatingSaveProvider>
        <Form title="Account" save={save} />
      </FloatingSaveProvider>,
    );
    const input = screen.getByLabelText("Account name");
    fireEvent.change(input, { target: { value: "" } });
    const prompt = screen.getByRole("complementary");
    expect(
      within(prompt).getByText("Complete the required fields"),
    ).toBeTruthy();
    fireEvent.click(within(prompt).getByRole("button"));
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Original" } });
    expect(screen.queryByRole("complementary")).toBeNull();
  });
  it("targets the most recently edited form without saving another draft", () => {
    const income = vi.fn();
    const savings = vi.fn();
    render(
      <FloatingSaveProvider>
        <Form title="Income" save={income} />
        <Form title="Savings" save={savings} />
      </FloatingSaveProvider>,
    );
    fireEvent.change(screen.getByLabelText("Income name"), {
      target: { value: "Salary" },
    });
    fireEvent.change(screen.getByLabelText("Savings name"), {
      target: { value: "Birthday" },
    });
    let prompt = screen.getByRole("complementary");
    expect(within(prompt).getByText("Savings")).toBeTruthy();
    expect(within(prompt).getByText(/1 other form/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Income name"), {
      target: { value: "Updated salary" },
    });
    prompt = screen.getByRole("complementary");
    expect(within(prompt).getByText("Income")).toBeTruthy();
    fireEvent.click(within(prompt).getByRole("button"));
    expect(income).toHaveBeenCalledOnce();
    expect(savings).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("complementary")).getByText("Savings"),
    ).toBeTruthy();
  });
  it("uses the latest action and disables duplicate saves while saving", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const view = render(
      <FloatingSaveProvider>
        <Controlled status="dirty" save={first} />
      </FloatingSaveProvider>,
    );
    view.rerender(
      <FloatingSaveProvider>
        <Controlled status="saving" save={latest} />
      </FloatingSaveProvider>,
    );
    fireEvent.click(
      within(screen.getByRole("complementary")).getByRole("button", {
        name: "Saving…",
      }),
    );
    expect(latest).not.toHaveBeenCalled();
    view.rerender(
      <FloatingSaveProvider>
        <Controlled status="error" save={latest} />
      </FloatingSaveProvider>,
    );
    fireEvent.click(
      within(screen.getByRole("complementary")).getByRole("button", {
        name: "Retry save",
      }),
    );
    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    view.unmount();
    expect(screen.queryByRole("complementary")).toBeNull();
  });
  it("retains a failed form draft and retries through native submission", async () => {
    const save = vi.fn();
    function FailedForm() {
      const [saving, setSaving] = useState(false);
      return (
        <SaveForm
          saveTitle="Expense"
          saveLabel="Save changes"
          saving={saving}
          onSubmit={(event) => {
            event.preventDefault();
            save();
            setSaving(true);
          }}
        >
          <label>
            Expense name
            <input defaultValue="Rent" required />
          </label>
          <button type="button" onClick={() => setSaving(false)}>
            Fail request
          </button>
        </SaveForm>
      );
    }
    render(
      <FloatingSaveProvider>
        <FailedForm />
      </FloatingSaveProvider>,
    );
    fireEvent.change(screen.getByLabelText("Expense name"), {
      target: { value: "New rent" },
    });
    fireEvent.click(
      within(screen.getByRole("complementary")).getByRole("button"),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fail request" }));
    });
    expect(
      within(screen.getByRole("complementary")).getByText(
        "Changes not saved. Try again.",
      ),
    ).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("complementary")).getByRole("button", {
        name: "Retry save",
      }),
    );
    expect(save).toHaveBeenCalledTimes(2);
  });
  it("ignores small viewport changes and only lifts above an unzoomed keyboard", () => {
    class Viewport extends EventTarget {
      height = 832;
      offsetTop = 0;
      scale = 1;
    }
    const viewport = new Viewport();
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", 844);
    render(
      <FloatingSaveProvider>
        <Controlled status="dirty" save={() => {}} />
      </FloatingSaveProvider>,
    );
    expect(screen.getByRole("complementary").style.bottom).toBe("");
    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByRole("complementary").style.bottom).toBe("356px");
    act(() => {
      viewport.scale = 2;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByRole("complementary").style.bottom).toBe("");
  });
});
