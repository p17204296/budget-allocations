import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";

interface Account {
  _id: Id<"accounts">;
  name: string;
  type: "current" | "savings";
  balance?: number;
}

interface BudgetItem {
  _id: Id<"budgetItems">;
  name: string;
  category: "essentials" | "savings";
  amount: number;
  accountId?: Id<"accounts">;
}

interface AccountAllocationsProps {
  accounts: Account[];
  budgetItems: BudgetItem[];
  currency: string;
}

export function AccountAllocations({ accounts, budgetItems, currency }: AccountAllocationsProps) {
  const sym = getCurrencySymbol(currency);

  const accountAllocations = accounts.map(account => {
    const allocatedItems = budgetItems.filter(item => item.accountId === account._id);
    const totalAllocated = allocatedItems.reduce((sum, item) => sum + item.amount, 0);
    return { account, allocatedItems, totalAllocated };
  }).filter(allocation => allocation.totalAllocated > 0);

  const unallocatedItems = budgetItems.filter(item => !item.accountId);
  const totalUnallocated = unallocatedItems.reduce((sum, item) => sum + item.amount, 0);

  if (accountAllocations.length === 0 && totalUnallocated === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            Account Allocations
          </h2>
          <p className="text-sm text-slate-600 mt-1">Direct debit amounts needed for each account</p>
        </div>
        <EmptyAllocationsState />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          Account Allocations
        </h2>
        <p className="text-sm text-slate-600 mt-1">Direct debit amounts needed for each account</p>
      </div>
      
      <div className="p-6 space-y-6">
        {accountAllocations.map(({ account, allocatedItems, totalAllocated }) => (
          <div key={account._id} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${account.type === "current" ? "bg-blue-500" : "bg-emerald-500"}`}></div>
                  <span className="font-semibold text-slate-800">{account.name}</span>
                  <span className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded-full capitalize">{account.type}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-slate-800">{sym}{totalAllocated.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">Direct debit amount</div>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {allocatedItems.map(item => (
                  <div key={item._id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.category === "essentials" ? "bg-amber-400" : "bg-emerald-400"}`}></div>
                      <span className="text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-medium text-slate-800">{sym}{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {totalUnallocated > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
            <div className="bg-amber-100 px-4 py-3 border-b border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
                  <span className="font-semibold text-amber-800">Unallocated Items</span>
                  <span className="text-xs px-2 py-1 bg-amber-200 text-amber-700 rounded-full">Needs Account</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-amber-800">{sym}{totalUnallocated.toLocaleString()}</div>
                  <div className="text-xs text-amber-600">Assign to accounts</div>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {unallocatedItems.map(item => (
                  <div key={item._id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.category === "essentials" ? "bg-amber-400" : "bg-emerald-400"}`}></div>
                      <span className="text-amber-800">{item.name}</span>
                    </div>
                    <span className="font-medium text-amber-800">{sym}{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-amber-100 rounded-lg">
                <p className="text-sm text-amber-700">
                  💡 <strong>Tip:</strong> Assign these items to accounts to see their direct debit requirements
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">Total Monthly Allocations</span>
            <span className="font-bold text-xl text-slate-800">
              {sym}{(accountAllocations.reduce((sum, alloc) => sum + alloc.totalAllocated, 0) + totalUnallocated).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Set up direct debits from your accounts to cover these monthly expenses
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyAllocationsState() {
  return (
    <div className="p-12 text-center">
      <h3 className="text-lg font-medium text-slate-800 mb-2">No Account Allocations Yet</h3>
      <p className="text-slate-600 mb-6 max-w-md mx-auto">
        Start by adding budget items and assigning them to your accounts to see direct debit requirements.
      </p>
      <div className="space-y-2 text-sm text-slate-500">
        <p>1. Go to <strong>Overview</strong> to add essential expenses and savings</p>
        <p>2. Assign each item to a specific account</p>
        <p>3. Return here to see your allocation summary</p>
      </div>
    </div>
  );
}
