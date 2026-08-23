import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { AccountManager } from "./AccountManager";
import { IncomeManager } from "./IncomeManager";
import { BudgetItemManager } from "./BudgetItemManager";
import { SummaryDashboard } from "./SummaryDashboard";
import { AccountAllocations } from "./AccountAllocations";
import { SettingsPage } from "./SettingsPage";
import { getCurrencySymbol } from "../lib/currency";

export function BudgetPlanner() {
  const accounts = useQuery(api.budget.getAccounts) || [];
  const budgetItems = useQuery(api.budget.getBudgetItems) || [];
  const income = useQuery(api.budget.getIncome) || [];
  const settings = useQuery(api.settings.getUserSettings);
  const initializeDefaultData = useMutation(api.budget.initializeDefaultData);

  const currency = settings?.currency ?? "GBP";

  const [activeTab, setActiveTab] = useState<"overview" | "accounts" | "income" | "allocations" | "settings">("overview");

  useEffect(() => {
    if (accounts.length === 0 && budgetItems.length === 0 && income.length === 0) {
      initializeDefaultData();
    }
  }, [accounts.length, budgetItems.length, income.length, initializeDefaultData]);

  const essentialItems = budgetItems.filter(item => item.category === "essentials");
  const savingsItems = budgetItems.filter(item => item.category === "savings");

  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalEssentials = essentialItems.reduce((sum, item) => sum + item.amount, 0);
  const totalSavings = savingsItems.reduce((sum, item) => sum + item.amount, 0);
  const totalOutgoings = totalEssentials + totalSavings;
  const netTotal = totalIncome - totalOutgoings;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "allocations", label: "Allocations" },
    { id: "accounts", label: "Accounts" },
    { id: "income", label: "Income" },
    { id: "settings", label: "⚙️ Settings" },
  ] as const;

  return (
    <div className="space-y-8">
      {/* Navigation Tabs */}
      <div className="w-full overflow-x-auto">
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit min-w-full sm:min-w-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 sm:px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Summary Dashboard */}
          <div className="lg:col-span-1">
            <SummaryDashboard
              totalIncome={totalIncome}
              totalEssentials={totalEssentials}
              totalSavings={totalSavings}
              totalOutgoings={totalOutgoings}
              netTotal={netTotal}
              currency={currency}
            />
          </div>

          {/* Budget Items */}
          <div className="lg:col-span-2 space-y-8">
            {/* Essentials Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    Essential Expenses
                  </h2>
                  <span className="text-lg font-semibold text-amber-700">
                    {getCurrencySymbol(currency)}{totalEssentials.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <BudgetItemManager
                  category="essentials"
                  items={essentialItems}
                  accounts={accounts}
                  currency={currency}
                />
              </div>
            </div>

            {/* Savings Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    Savings & Investments
                  </h2>
                  <span className="text-lg font-semibold text-emerald-700">
                    {getCurrencySymbol(currency)}{totalSavings.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <BudgetItemManager
                  category="savings"
                  items={savingsItems}
                  accounts={accounts}
                  currency={currency}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "allocations" && (
        <div className="max-w-5xl">
          <AccountAllocations accounts={accounts} budgetItems={budgetItems} currency={currency} />
        </div>
      )}

      {activeTab === "accounts" && (
        <div className="max-w-5xl">
          <AccountManager accounts={accounts} currency={currency} />
        </div>
      )}

      {activeTab === "income" && (
        <div className="max-w-5xl">
          <IncomeManager income={income} currency={currency} />
        </div>
      )}

      {activeTab === "settings" && (
        <SettingsPage />
      )}
    </div>
  );
}
