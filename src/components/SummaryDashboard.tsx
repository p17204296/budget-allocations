import { getCurrencySymbol } from "../lib/currency";

interface SummaryDashboardProps {
  totalIncome: number;
  totalEssentials: number;
  totalSavings: number;
  totalOutgoings: number;
  netTotal: number;
  currency: string;
}

export function SummaryDashboard({
  totalIncome,
  totalEssentials,
  totalSavings,
  totalOutgoings,
  netTotal,
  currency,
}: SummaryDashboardProps) {
  const sym = getCurrencySymbol(currency);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden sticky top-28">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-xl font-semibold text-slate-800">Financial Summary</h2>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Income */}
        <div className="flex justify-between items-center py-3">
          <span className="text-slate-600 font-medium">Total Income</span>
          <span className="font-semibold text-slate-800 text-lg">
            {sym}{totalIncome.toLocaleString()}
          </span>
        </div>

        <hr className="border-slate-200" />

        {/* Outgoings */}
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-600 flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
              Essential Expenses
            </span>
            <span className="font-medium text-amber-700">
              {sym}{totalEssentials.toLocaleString()}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-600 flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
              Savings & Investments
            </span>
            <span className="font-medium text-emerald-700">
              {sym}{totalSavings.toLocaleString()}
            </span>
          </div>
        </div>

        <hr className="border-slate-200" />

        {/* Totals */}
        <div className="flex justify-between items-center py-3">
          <span className="text-slate-600 font-medium">Total Allocated</span>
          <span className="font-semibold text-slate-800">
            {sym}{totalOutgoings.toLocaleString()}
          </span>
        </div>

        <hr className="border-slate-300" />

        {/* Net Total */}
        <div className="flex justify-between items-center py-3 bg-slate-50 -mx-3 px-3 rounded-lg">
          <span className="font-semibold text-slate-800">Remaining Balance</span>
          <span className={`font-bold text-lg ${
            netTotal >= 0 ? "text-emerald-700" : "text-red-700"
          }`}>
            {sym}{netTotal.toLocaleString()}
          </span>
        </div>

        {/* Progress Bar */}
        {totalIncome > 0 && (
          <div className="mt-8">
            <div className="text-sm font-medium text-slate-700 mb-3">Budget Allocation</div>
            <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
              <div className="h-full flex">
                <div
                  className="bg-amber-500"
                  style={{ width: `${(totalEssentials / totalIncome) * 100}%` }}
                ></div>
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(totalSavings / totalIncome) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-600 mt-2">
              <span>{((totalEssentials / totalIncome) * 100).toFixed(1)}% Essential</span>
              <span>{((totalSavings / totalIncome) * 100).toFixed(1)}% Savings</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
