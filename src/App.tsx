import { useState } from "react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { BudgetPlanner, type TabId } from "./components/BudgetPlanner";
import { Icon } from "./components/ui";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="brand-lockup"
          onClick={() => setActiveTab("overview")}
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
          <SignOutButton />
        </Authenticated>
      </header>
      <main className="app-main">
        <Content activeTab={activeTab} onTabChange={setActiveTab} />
      </main>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#fffdf8',
            border: '1px solid #d9d4c8',
            color: '#18352c',
            borderRadius: '14px',
          },
        }}
      />
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
        <BudgetPlanner activeTab={activeTab} onTabChange={onTabChange} />
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
