import { useEffect, useState } from "react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, type ToasterProps } from "sonner";
import { BudgetPlanner, type TabId } from "./components/BudgetPlanner";
import { FeedbackDialog } from "./components/FeedbackDialog";
import { Icon } from "./components/ui";

import { NavigationGuardProvider, useNavigationGuard } from "./hooks/NavigationGuard";

type ToastPosition = NonNullable<ToasterProps["position"]>;

const MOBILE_TOAST_OFFSET = { top: 80, right: 14, left: 14 };
const TABLET_TOAST_OFFSET = { top: 92, right: 28 };
const DESKTOP_TOAST_OFFSET = { right: 34, bottom: 28 };
const APP_TOAST_OPTIONS: NonNullable<ToasterProps["toastOptions"]> = {
  style: {
    background: "#fffdf8",
    border: "1px solid #d9d4c8",
    color: "#18352c",
    borderRadius: "14px",
  },
};

function getToastPosition(): ToastPosition {
  if (typeof window === "undefined") return "top-center";
  if (window.matchMedia("(min-width: 900px)").matches) return "bottom-right";
  if (window.matchMedia("(min-width: 600px)").matches) return "top-right";
  return "top-center";
}

function ResponsiveToaster() {
  const [position, setPosition] = useState<ToastPosition>(getToastPosition);

  useEffect(() => {
    const tablet = window.matchMedia("(min-width: 600px)");
    const desktop = window.matchMedia("(min-width: 900px)");
    const updatePosition = () => setPosition(desktop.matches ? "bottom-right" : tablet.matches ? "top-right" : "top-center");

    tablet.addEventListener("change", updatePosition);
    desktop.addEventListener("change", updatePosition);
    return () => {
      tablet.removeEventListener("change", updatePosition);
      desktop.removeEventListener("change", updatePosition);
    };
  }, []);

  const offset = position === "bottom-right" ? DESKTOP_TOAST_OFFSET : TABLET_TOAST_OFFSET;

  return <Toaster position={position} offset={offset} mobileOffset={MOBILE_TOAST_OFFSET} toastOptions={APP_TOAST_OPTIONS} />;
}

export default function App() {
  return <NavigationGuardProvider><AppShell /></NavigationGuardProvider>;
}

function AppShell() {
  const { navigate } = useNavigationGuard();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="brand-lockup"
          onClick={() => void navigate(() => setActiveTab("overview"))}
          aria-label="Go to overview"
        >
          <img
            src="/budget-allocations-logo.png"
            alt=""
            className="brand-logo"
          />
          <div><p>Budget</p><strong>Allocations</strong></div>
        </button>
        <Authenticated>
          <div className="topbar-actions">
            <button type="button" className="feedback-button" onClick={() => setIsFeedbackOpen(true)} aria-label="Give feedback" title="Give feedback"><Icon name="feedback" /><span>Feedback</span></button>
            <SignOutButton />
          </div>
          <FeedbackDialog open={isFeedbackOpen} page={activeTab} onClose={() => setIsFeedbackOpen(false)} />
        </Authenticated>
      </header>
      <main className="app-main">
        <Content activeTab={activeTab} onTabChange={(tab) => { if (tab !== activeTab) void navigate(() => setActiveTab(tab)); }} />
      </main>
      <ResponsiveToaster />
    </div>
  );
}

function Content({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="loading-state" role="status" aria-label="Loading your budget">
        <span className="loading-mark"><Icon name="wallet" /></span>
        <p>Opening your budget…</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Authenticated>
        <BudgetPlanner activeTab={activeTab} onTabChange={onTabChange} isGuest={loggedInUser?.isAnonymous === true} />
      </Authenticated>
      <Unauthenticated>
        <div className="auth-layout">
          <div className="auth-intro">
            <p className="eyebrow">A calmer way to manage money</p>
            <h1>Your money,<br/><em>mapped clearly.</em></h1>
            <p className="auth-lead">Plan your monthly budget, give every pound a purpose, and know exactly what each account needs.</p>
            <div className="auth-points">
              <span><Icon name="overview" /> See the whole month at a glance</span>
              <span><Icon name="allocations" /> Turn plans into account transfers</span>
              <span><Icon name="shield" /> Private, simple and free to use</span>
            </div>
          </div>
          <div className="auth-card">
            <div className="auth-card-heading"><span><Icon name="spark" /></span><div><p>Welcome</p><h2>Make a plan that sticks.</h2></div></div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}
