import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type PromptStatus = "dirty" | "saving" | "invalid" | "error" | "conflict";
type Prompt = {
  title: string;
  status: PromptStatus;
  actionLabel: string;
  disabled: boolean;
  onSave: () => void;
};
type Entry = Prompt & { id: string };
const Context = createContext<{
  update: (id: string, prompt: Prompt | null) => void;
  activate: (id: string) => void;
  visible: boolean;
} | null>(null);
const statusText: Record<PromptStatus, string> = {
  dirty: "Unsaved changes",
  saving: "Saving changes…",
  invalid: "Complete the required fields",
  error: "Changes not saved. Try again.",
  conflict: "Review changes before saving",
};
export function FloatingSaveProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const update = useCallback((id: string, prompt: Prompt | null) => {
    setEntries((current) => {
      const existing = current.find((entry) => entry.id === id);
      if (!prompt)
        return existing ? current.filter((entry) => entry.id !== id) : current;
      if (
        existing &&
        existing.title === prompt.title &&
        existing.status === prompt.status &&
        existing.actionLabel === prompt.actionLabel &&
        existing.disabled === prompt.disabled &&
        existing.onSave === prompt.onSave
      )
        return current;
      const next = { id, ...prompt };
      return existing
        ? current.map((entry) => (entry.id === id ? next : entry))
        : [...current, next];
    });
  }, []);
  const activate = useCallback((id: string) => {
    setEntries((current) => {
      const entry = current.find((item) => item.id === id);
      if (!entry || current[current.length - 1]?.id === id) return current;
      return [...current.filter((item) => item.id !== id), entry];
    });
  }, []);
  const active = entries[entries.length - 1];
  const [height, setHeight] = useState(88);
  const value = useMemo(
    () => ({ update, activate, visible: Boolean(active) }),
    [update, activate, active],
  );
  return (
    <Context.Provider value={value}>
      <div
        className={active ? "save-prompt-active" : undefined}
        style={{ paddingBottom: active ? height + 24 : undefined }}
      >
        {children}
      </div>
      {active
        ? createPortal(
            <FloatingSavePrompt
              prompt={active}
              otherCount={entries.length - 1}
              onHeight={setHeight}
            />,
            document.body,
          )
        : null}
    </Context.Provider>
  );
}
export function useFloatingSave({
  visible,
  title,
  status,
  actionLabel = "Save changes",
  disabled = false,
  onSave,
}: Prompt & { visible: boolean }) {
  const context = useContext(Context);
  const update = context?.update;
  const activate = context?.activate;
  const id = useId();
  const action = useRef(onSave);
  useEffect(() => {
    action.current = onSave;
  });
  const save = useCallback(() => action.current(), []);
  useEffect(() => {
    update?.(
      id,
      visible ? { title, status, actionLabel, disabled, onSave: save } : null,
    );
  }, [update, id, visible, title, status, actionLabel, disabled, save]);
  useEffect(() => () => update?.(id, null), [update, id]);
  return useCallback(() => activate?.(id), [activate, id]);
}
export function useSavePromptVisible() {
  return useContext(Context)?.visible ?? false;
}
function FloatingSavePrompt({
  prompt,
  otherCount,
  onHeight,
}: {
  prompt: Prompt;
  otherCount: number;
  onHeight: (height: number) => void;
}) {
  const element = useRef<HTMLElement>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const measure = () => onHeight(target.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [onHeight]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const measure = () => {
      // Scrollbars and browser chrome can briefly reduce the visual viewport.
      // Only a substantial, unzoomed reduction should lift the action above a keyboard.
      const offset =
        viewport.scale === 1
          ? Math.max(
              0,
              window.innerHeight - viewport.height - viewport.offsetTop,
            )
          : 0;
      setKeyboardOffset(offset > 120 ? offset : 0);
    };
    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);
  return (
    <aside
      ref={element}
      className="floating-save"
      aria-label="Unsaved changes"
      style={keyboardOffset > 0 ? { bottom: keyboardOffset + 12 } : undefined}
    >
      <div className="floating-save-copy">
        <strong>{prompt.title}</strong>
        <span role="status" aria-live="polite">
          {statusText[prompt.status]}
          {otherCount > 0
            ? ` · ${otherCount} other ${otherCount === 1 ? "form" : "forms"}`
            : ""}
        </span>
      </div>
      <button
        type="button"
        className="btn-primary"
        disabled={prompt.disabled || prompt.status === "saving"}
        onClick={prompt.onSave}
      >
        {prompt.status === "saving" ? "Saving…" : prompt.actionLabel}
      </button>
    </aside>
  );
}
