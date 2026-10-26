import { afterEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { ScenarioAutosave } from "../src/lib/scenarioAutosave";
afterEach(() => vi.useRealTimers());
describe("event save lifecycle", () => {
  it("stops after event revision conflicts and preserves the draft", async () => {
    const save = vi.fn(async () => {
      throw new ConvexError({
        code: "EVENT_CONFLICT",
        message: "This event changed in another tab.",
      });
    });
    const auto = new ScenarioAutosave(
      "saved",
      0,
      () => true,
      save,
      () => {},
    );
    auto.edit("local event");
    expect(await auto.flush()).toBe(false);
    expect(auto.status).toBe("conflict");
    expect(auto.error).toContain("event changed");
    expect(auto.draft).toBe("local event");
    expect(await auto.retry()).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    auto.dispose();
  });
  it("retries failed event saves and blocks navigation until saved", async () => {
    const save = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(1);
    const auto = new ScenarioAutosave(
      "saved",
      0,
      (value) => value !== "",
      save,
      () => {},
    );
    auto.edit("hotel deposit");
    expect(await auto.flush()).toBe(false);
    expect(auto.status).toBe("error");
    expect(auto.draft).toBe("hotel deposit");
    expect(await auto.retry()).toBe(true);
    expect(await auto.flush()).toBe(true);
    auto.dispose();
  });
  it("resets the six-second debounce and never saves incomplete inputs", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => 1);
    const auto = new ScenarioAutosave(
      "saved",
      0,
      (value) => value !== "",
      save,
      () => {},
    );
    auto.edit("first");
    await vi.advanceTimersByTimeAsync(5000);
    auto.edit("second");
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledWith("second", 0);
    auto.edit("");
    await vi.advanceTimersByTimeAsync(7000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(await auto.flush()).toBe(false);
    auto.dispose();
  });
});
