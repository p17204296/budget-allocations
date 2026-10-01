import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
type Guard = () => Promise<boolean>;
const Context = createContext<{
  register: (guard: Guard) => () => void;
  navigate: (action: () => void | Promise<void>) => Promise<void>;
  busy: boolean;
} | null>(null);
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guard = useRef<Guard | null>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const register = useCallback((next: Guard) => {
    guard.current = next;
    return () => {
      if (guard.current === next) guard.current = null;
    };
  }, []);
  const navigate = useCallback(async (action: () => void | Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      if (!guard.current || (await guard.current())) await action();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);
  const value = useMemo(
    () => ({ register, navigate, busy }),
    [register, navigate, busy],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useNavigationGuard() {
  const context = useContext(Context);
  if (!context) throw new Error("Navigation guard provider is missing.");
  return context;
}
