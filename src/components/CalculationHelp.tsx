import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
export function CalculationHelp({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });
  const show = () => {
    clearTimeout(timer.current);
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, window.innerWidth - 24);
    setPosition({
      width,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: Math.min(rect.bottom + 8, window.innerHeight - 180),
    });
    setOpen(true);
  };
  const hideSoon = () => {
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !popup.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearTimeout(timer.current);
        setOpen(false);
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      clearTimeout(timer.current);
    };
  }, [open]);
  return (
    <span className="scenario-calculation-help">
      <button
        ref={trigger}
        type="button"
        aria-label={`How ${label} is calculated`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={show}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            className="scenario-calculation-tooltip"
            style={position}
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={hideSoon}
          >
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
}
