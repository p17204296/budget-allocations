import { useEffect } from "react";
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
  { id: "accounts", label: "Accounts", icon: "accounts" },
  { id: "income", label: "Income", icon: "income" },
  { id: "settings", label: "Settings", icon: "settings" },
];

type BudgetPlannerProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
};

export function BudgetPlanner({ activeTab, onTabChange }: BudgetPlannerProps) {
  const accountsQuery = useQuery(api.budget.getAccounts);
  const budgetItemsQuery = useQuery(api.budget.getBudgetItems);
  const incomeQuery = useQuery(api.budget.getIncome);
  const settings = useQuery(api.settings.getUserSettings);
  const adminAccess = useQuery(api.admin.getAccess);
  const initializeDefaultData = useMutation(api.budget.initializeDefaultData);
  const accounts = accountsQuery ?? [];
  const budgetItems = budgetItemsQuery ?? [];
  const income = incomeQuery ?? [];
  const currency = settings?.currency ?? "GBP";
  const isLoading = accountsQuery === undefined || budgetItemsQuery === undefined || incomeQuery === undefined;

  useEffect(() => {
    if (!isLoading && accounts.length === 0 && budgetItems.length === 0 && income.length === 0) {
      void initializeDefaultData();
    }
  }, [accounts.length, budgetItems.length, income.length, initializeDefaultData, isLoading]);

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

  useEffect(() => {
    if (adminAccess !== undefined && !adminAccess.isAdmin && activeTab === "admin") onTabChange("overview");
  }, [activeTab, adminAccess, onTabChange]);

  if (isLoading) {
    return <div className="planner-skeleton"><div /><div /><div /></div>;
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
        {activeTab === "accounts" ? <AccountManager accounts={accounts} currency={currency} /> : null}
        {activeTab === "income" ? <IncomeManager income={income} currency={currency} /> : null}
        {activeTab === "settings" ? <SettingsPage /> : null}
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
