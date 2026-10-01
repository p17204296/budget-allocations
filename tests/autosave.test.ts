import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScenarioAutosave } from "../src/lib/scenarioAutosave";
const settle = () => Promise.resolve();
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe("six-second autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("does not save per keystroke or during uninterrupted typing", async () => {
    const save = vi.fn(async () => 1);
    const c = new ScenarioAutosave("", 0, Boolean, save, vi.fn());
    for (let i = 0; i < 20; i++) {
      c.edit(`text-${i}`);
      await vi.advanceTimersByTimeAsync(1000);
      expect(save).not.toHaveBeenCalled();
    }
    await vi.advanceTimersByTimeAsync(4999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith("text-19", 0);
    expect(c.status).toBe("saved");
    c.dispose();
  });
  it("resets the timer on each edit", async () => {
    const save = vi.fn(async () => 1);
    const c = new ScenarioAutosave("", 0, Boolean, save, vi.fn());
    c.edit("a");
    await vi.advanceTimersByTimeAsync(5000);
    c.edit("b");
    await vi.advanceTimersByTimeAsync(5999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith("b", 0);
  });
  it("keeps newer edits when an older request completes and respects their debounce", async () => {
    const first = deferred<number>();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(2);
    const c = new ScenarioAutosave("", 0, Boolean, save, vi.fn());
    c.edit("first");
    await vi.advanceTimersByTimeAsync(6000);
    c.edit("second");
    await vi.advanceTimersByTimeAsync(1000);
    first.resolve(1);
    await settle();
    await settle();
    expect(c.draft).toBe("second");
    expect(c.status).toBe("dirty");
    await vi.advanceTimersByTimeAsync(4999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenLastCalledWith("second", 1);
  });
  it("announces only successful latest-draft writes, not stale responses or no-op flushes", async () => {
    const first = deferred<number>();
    const saved = vi.fn();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(2);
    const c = new ScenarioAutosave(
      "original",
      0,
      Boolean,
      save,
      vi.fn(),
      JSON.stringify,
      saved,
    );
    await c.flush();
    expect(saved).not.toHaveBeenCalled();
    c.edit("first");
    await vi.advanceTimersByTimeAsync(6000);
    c.edit("second");
    first.resolve(1);
    await settle();
    await settle();
    expect(saved).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6000);
    expect(saved).toHaveBeenCalledTimes(1);
    await c.flush();
    c.receive("remote", 3);
    expect(saved).toHaveBeenCalledTimes(1);
    c.dispose();
  });
  it("serialises requests when the pause expires while a save is in flight", async () => {
    const first = deferred<number>();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(2);
    const c = new ScenarioAutosave("", 0, Boolean, save, vi.fn());
    c.edit("one");
    await vi.advanceTimersByTimeAsync(6000);
    c.edit("two");
    await vi.advanceTimersByTimeAsync(6000);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("two", 1);
  });
  it("blocks incomplete drafts without converting them to zero", async () => {
    const save = vi.fn(async () => 1);
    const c = new ScenarioAutosave(
      "1",
      0,
      (value) => /^\d+$/.test(value),
      save,
      vi.fn(),
    );
    c.edit("");
    await vi.advanceTimersByTimeAsync(10000);
    expect(save).not.toHaveBeenCalled();
    expect(await c.flush()).toBe(false);
    c.edit("2");
    await vi.advanceTimersByTimeAsync(6000);
    expect(save).toHaveBeenCalledExactlyOnceWith("2", 0);
  });
  it("flushes once for navigation and cancels the old timer", async () => {
    const save = vi.fn(async () => 1);
    const c = new ScenarioAutosave("", 0, Boolean, save, vi.fn());
    c.edit("one");
    expect(await c.flush()).toBe(true);
    await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("blocks navigation on failure and preserves edits for retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(1);
    const c = new ScenarioAutosave("", 0, Boolean, save, vi.fn());
    c.edit("local");
    expect(await c.flush()).toBe(false);
    expect(c.draft).toBe("local");
    expect(c.status).toBe("error");
    await vi.advanceTimersByTimeAsync(20000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(await c.retry()).toBe(true);
  });
  it("does not navigate if typing occurs during a flush", async () => {
    const first = deferred<number>();
    const c = new ScenarioAutosave(
      "",
      0,
      Boolean,
      () => first.promise,
      vi.fn(),
    );
    c.edit("one");
    const navigation = c.flush();
    c.edit("two");
    first.resolve(1);
    expect(await navigation).toBe(false);
    expect(c.pending).toBe(true);
    c.dispose();
  });
  it("stops on revision conflicts and ignores reactive updates while dirty", async () => {
    const save = vi
      .fn()
      .mockRejectedValue({ data: { code: "SCENARIO_CONFLICT" } });
    const c = new ScenarioAutosave("original", 0, Boolean, save, vi.fn());
    c.edit("local");
    c.receive("remote", 1);
    expect(c.draft).toBe("local");
    await vi.advanceTimersByTimeAsync(6000);
    expect(c.status).toBe("conflict");
    c.edit("more");
    await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(await c.retry()).toBe(false);
  });
  it("cancels timers on unmount/deletion and ignores late acknowledgements", async () => {
    const save = vi.fn(async () => 1);
    const c = new ScenarioAutosave("", 0, Boolean, save, vi.fn());
    c.edit("local");
    c.dispose();
    await vi.advanceTimersByTimeAsync(10000);
    expect(save).not.toHaveBeenCalled();
    expect(await c.flush()).toBe(false);
  });
  it("does not write an edit reverted to the saved draft", async () => {
    const save = vi.fn(async () => 1);
    const c = new ScenarioAutosave("original", 0, Boolean, save, vi.fn());
    c.edit("edited");
    c.edit("original");
    await vi.advanceTimersByTimeAsync(6000);
    expect(save).not.toHaveBeenCalled();
    expect(c.status).toBe("saved");
  });
  it("does not let a late response resurrect a suspended/deleted editor", async () => {
    const flight = deferred<number>();
    const notify = vi.fn();
    const c = new ScenarioAutosave(
      "",
      0,
      Boolean,
      () => flight.promise,
      notify,
    );
    c.edit("one");
    await vi.advanceTimersByTimeAsync(6000);
    c.dispose();
    flight.resolve(1);
    await settle();
    await settle();
    expect(c.status).not.toBe("saved");
    expect(c.pending).toBe(true);
  });
  it("stops writes after remote deletion while allowing draft corrections for recovery", async () => {
    const flight = deferred<number>();
    const saved = vi.fn();
    const save = vi.fn(() => flight.promise);
    const c = new ScenarioAutosave(
      "original",
      0,
      Boolean,
      save,
      vi.fn(),
      JSON.stringify,
      saved,
    );
    c.edit("local");
    await vi.advanceTimersByTimeAsync(6000);
    c.stopSaving();
    c.edit("corrected");
    flight.resolve(1);
    await vi.advanceTimersByTimeAsync(12000);
    expect(c.draft).toBe("corrected");
    expect(c.pending).toBe(true);
    expect(saved).not.toHaveBeenCalled();
    expect(await c.flush()).toBe(false);
    expect(await c.retry()).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    c.dispose();
  });
  it("adopts clean remote updates without writing them back or regressing revisions", () => {
    const save = vi.fn();
    const c = new ScenarioAutosave("old", 2, Boolean, save, vi.fn());
    c.receive("new", 3);
    c.receive("stale", 2);
    expect(c.draft).toBe("new");
    expect(c.revision).toBe(3);
    expect(save).not.toHaveBeenCalled();
  });
});
