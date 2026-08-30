import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AccountAllocations } from "./AccountAllocations";
import { AccountManager } from "./AccountManager";
import { BudgetItemManager } from "./BudgetItemManager";
import { IncomeManager } from "./IncomeManager";
import { SettingsPage } from "./SettingsPage";
import { SummaryDashboard } from "./SummaryDashboard";
import { AdminPage } from "./AdminPage";
import { Card, Icon, type IconName, SectionTitle } from "./ui";
import { getCurrencySymbol } from "../lib/currency";

export type TabId = "overview" | "allocations" | "accounts" | "income" | "settings" | "admin";

const primaryTabs: { id: TabId; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "allocations", label: "Plan", icon: "allocations" },
  { id: "accounts", label: "Money", icon: "accounts" },
  { id: "income", label: "Income", icon: "income" },
  { id: "settings", label: "Settings", icon: "settings" },
];

type BudgetPlannerProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isGuest: boolean;
};

export function BudgetPlanner({ activeTab, onTabChange, isGuest }: BudgetPlannerProps) {
  const accountsQuery = useQuery(api.budget.getAccounts);
  const budgetItemsQuery = useQuery(api.budget.getBudgetItems);
  const incomeQuery = useQuery(api.budget.getIncome);
  const dataLimitStatus = useQuery(api.budget.getDataLimitStatus);
  const settings = useQuery(api.settings.getUserSettings);
  const adminAccess = useQuery(api.admin.getAccess);
  const onboardingStatus = useQuery(api.budget.getOnboardingStatus);
  const initializeDefaultData = useMutation(api.budget.initializeDefaultData);
  const [onboardingChoice, setOnboardingChoice] = useState<"empty" | "template" | null>(null);
  const [onboardingError, setOnboardingError] = useState("");
  const accounts = accountsQuery ?? [];
  const budgetItems = budgetItemsQuery ?? [];
  const income = incomeQuery ?? [];
  const currency = settings?.currency ?? "GBP";
  const isLoading = accountsQuery === undefined || budgetItemsQuery === undefined || incomeQuery === undefined;

  useEffect(() => {
    if (!isLoading && isGuest && onboardingStatus === "pending") {
      void initializeDefaultData({ choice: "template" });
    }
  }, [initializeDefaultData, isGuest, isLoading, onboardingStatus]);

  const essentialItems = budgetItems.filter((item) => item.category === "essentials");
  const savingsItems = budgetItems.filter((item) => item.category === "savings");
  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalEssentials = essentialItems.reduce((sum, item) => sum + item.amount, 0);
  const totalSavings = savingsItems.reduce((sum, item) => sum + item.amount, 0);
  const totalOutgoings = totalEssentials + totalSavings;
  const netTotal = totalIncome - totalOutgoings;
  const symbol = getCurrencySymbol(currency);
  const isAdmin = adminAccess?.isAdmin ?? false;
  const tabs = isAdmin ? [...primaryTabs, { id: "admin" as const, label: "Admin", icon: "shield" as const }] : primaryTabs;
  const overLimitLabels = dataLimitStatus ? [
    dataLimitStatus.accounts ? "accounts" : null,
    dataLimitStatus.budgetItems ? "budget items" : null,
    dataLimitStatus.income ? "income sources" : null,
  ].filter((label): label is string => label !== null) : [];

  useEffect(() => {
    if (adminAccess !== undefined && !adminAccess.isAdmin && activeTab === "admin") onTabChange("overview");
  }, [activeTab, adminAccess, onTabChange]);

  if (isLoading || onboardingStatus === undefined || (isGuest && onboardingStatus === "pending")) {
    return <div className="planner-skeleton"><div /><div /><div /></div>;
  }

  if (!isGuest && onboardingStatus === "pending") {
    const finishOnboarding = async (choice: "empty" | "template") => {
      setOnboardingChoice(choice);
      setOnboardingError("");
      try {
        await initializeDefaultData({ choice });
      } catch {
        setOnboardingError("We couldn’t prepare your workspace. Please try again.");
        setOnboardingChoice(null);
      }
    };

    return (
      <section className="onboarding" aria-labelledby="onboarding-title">
        <p className="eyebrow">Set up your workspace</p>
        <h1 id="onboarding-title">How would you like to begin?</h1>
        <p className="onboarding-lead">Choose a clean slate for your real numbers, or explore a ready-made budget you can edit.</p>
        <div className="onboarding-options">
          <button type="button" className="onboarding-option" onClick={() => void finishOnboarding("empty")} disabled={onboardingChoice !== null}>
            <span className="onboarding-option-icon"><Icon name="plus" /></span>
            <strong>Start from scratch</strong>
            <span>Begin with an empty budget and add your accounts, income, and expenses yourself.</span>
            <em>{onboardingChoice === "empty" ? "Preparing…" : "Choose empty workspace"}</em>
          </button>
          <button type="button" className="onboarding-option onboarding-option-featured" onClick={() => void finishOnboarding("template")} disabled={onboardingChoice !== null}>
            <span className="onboarding-option-icon"><Icon name="spark" /></span>
            <strong>Use a starter template</strong>
            <span>See a sample monthly plan with accounts, income, essentials, and savings goals.</span>
            <em>{onboardingChoice === "template" ? "Preparing…" : "Choose starter template"}</em>
          </button>
        </div>
        {onboardingError ? <p className="onboarding-error" role="alert">{onboardingError}</p> : null}
      </section>
    );
  }

  return (
    <div className="planner-shell">
      <nav className="desktop-nav" aria-label="Budget sections">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)} className={activeTab === tab.id ? "active" : ""} aria-current={activeTab === tab.id ? "page" : undefined}>
            <Icon name={tab.icon} /><span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="planner-content" key={activeTab}>
        {isGuest ? <div className="guest-demo-banner"><span><Icon name="shield" /></span><div><strong>Your seven-day guest workspace</strong><p>Try every feature with your own figures. This temporary workspace is automatically deleted after seven days.</p></div></div> : null}
        {overLimitLabels.length > 0 ? <div className="guest-demo-banner"><span><Icon name="shield" /></span><div><strong>Older workspace over the record limit</strong><p>You have more than 200 {overLimitLabels.join(", ")}. Delete records you no longer need; hidden records will appear as space becomes available.</p></div></div> : null}
        {activeTab === "overview" ? (
          <div className="overview-layout">
            <SummaryDashboard totalIncome={totalIncome} totalEssentials={totalEssentials} totalSavings={totalSavings} totalOutgoings={totalOutgoings} netTotal={netTotal} currency={currency} />
            <div className="budget-groups">
              <Card>
                <SectionTitle title="Essential expenses" subtitle="The monthly costs that keep life moving" accent="amber" value={`${symbol}${totalEssentials.toLocaleString()}`} />
                <div className="surface-body"><BudgetItemManager category="essentials" items={essentialItems} accounts={accounts} currency={currency} /></div>
              </Card>
              <Card>
                <SectionTitle title="Savings & goals" subtitle="Money set aside for your future" accent="mint" value={`${symbol}${totalSavings.toLocaleString()}`} />
                <div className="surface-body"><BudgetItemManager category="savings" items={savingsItems} accounts={accounts} currency={currency} /></div>
              </Card>
            </div>
          </div>
        ) : null}
        {activeTab === "allocations" ? <AccountAllocations accounts={accounts} budgetItems={budgetItems} currency={currency} /> : null}
        {activeTab === "accounts" ? <AccountManager currency={currency} /> : null}
        {activeTab === "income" ? <IncomeManager income={income} currency={currency} /> : null}
        {activeTab === "settings" ? <SettingsPage isGuest={isGuest} /> : null}
        {activeTab === "admin" && adminAccess?.isAdmin ? <AdminPage passwordResetEnabled={adminAccess.passwordResetEnabled} /> : null}
      </div>

      <nav className={`mobile-nav${isAdmin ? " has-admin" : ""}`} aria-label="Budget sections">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)} className={activeTab === tab.id ? "active" : ""} aria-current={activeTab === tab.id ? "page" : undefined}>
            <Icon name={tab.icon} /><span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
