import { Id } from "../../convex/_generated/dataModel";
import { getCurrencySymbol } from "../lib/currency";
import { Card, EmptyState, Icon, PageHeader } from "./ui";

interface Account { _id: Id<"accounts">; name: string; type: "current" | "savings"; balance?: number; }
interface BudgetItem { _id: Id<"budgetItems">; name: string; category: "essentials" | "savings"; amount: number; accountId?: Id<"accounts">; }
interface Props { accounts: Account[]; budgetItems: BudgetItem[]; currency: string; }

export function AccountAllocations({ accounts, budgetItems, currency }: Props) {
  const symbol = getCurrencySymbol(currency);
  const allocations = accounts.map((account) => {
    const items = budgetItems.filter((item) => item.accountId === account._id);
    return { account, items, total: items.reduce((sum, item) => sum + item.amount, 0) };
  }).filter(({ total }) => total > 0);
  const unallocated = budgetItems.filter((item) => !item.accountId);
  const unallocatedTotal = unallocated.reduce((sum, item) => sum + item.amount, 0);
  const grandTotal = allocations.reduce((sum, item) => sum + item.total, 0) + unallocatedTotal;

  return (
    <div className="page-stack allocations-page">
      <PageHeader eyebrow="Move money with confidence" title="Allocation plan" description="See how much each account needs to cover the commitments assigned to it every month." />
      {allocations.length === 0 && unallocated.length === 0 ? <Card><EmptyState title="No allocations yet" description="Assign budget items to accounts from the overview, then your monthly transfer plan will appear here." /></Card> : null}
      <div className="allocation-grid">
        {allocations.map(({ account, items, total }, index) => (
          <Card className="allocation-card" key={account._id}>
            <header><div className={`allocation-number ${account.type}`}>{String(index + 1).padStart(2, "0")}</div><div><p>{account.type} account</p><h2>{account.name}</h2></div><div className="allocation-total"><span>Move monthly</span><strong>{symbol}{total.toLocaleString()}</strong></div></header>
            <div className="allocation-items">{items.map((item) => <div key={item._id}><span className={`item-mark ${item.category}`} /><p>{item.name}</p><strong>{symbol}{item.amount.toLocaleString()}</strong></div>)}</div>
          </Card>
        ))}
        {unallocated.length > 0 ? <Card className="allocation-card unallocated-card"><header><div className="allocation-number warning">!</div><div><p>Needs attention</p><h2>Not assigned yet</h2></div><div className="allocation-total"><span>Unassigned</span><strong>{symbol}{unallocatedTotal.toLocaleString()}</strong></div></header><div className="allocation-items">{unallocated.map((item) => <div key={item._id}><span className={`item-mark ${item.category}`} /><p>{item.name}</p><strong>{symbol}{item.amount.toLocaleString()}</strong></div>)}</div><footer><Icon name="spark" /><span>Assign these from the overview to complete your transfer plan.</span></footer></Card> : null}
      </div>
      {grandTotal > 0 ? <div className="allocation-footer"><div><span><Icon name="allocations" /></span><p>Total monthly plan</p></div><strong>{symbol}{grandTotal.toLocaleString()}</strong></div> : null}
    </div>
  );
}
