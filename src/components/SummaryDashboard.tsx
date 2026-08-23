import { getCurrencySymbol } from "../lib/currency";
import { Card, Icon } from "./ui";

interface SummaryDashboardProps {
  totalIncome: number;
  totalEssentials: number;
  totalSavings: number;
  totalOutgoings: number;
  netTotal: number;
  currency: string;
}

export function SummaryDashboard({ totalIncome, totalEssentials, totalSavings, totalOutgoings, netTotal, currency }: SummaryDashboardProps) {
  const symbol = getCurrencySymbol(currency);
  const essentialPercent = totalIncome > 0 ? (totalEssentials / totalIncome) * 100 : 0;
  const savingsPercent = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;
  const usedPercent = Math.min(100, essentialPercent + savingsPercent);

  return (
    <Card className="summary-card">
      <div className="summary-hero">
        <div className="summary-kicker"><span><Icon name="wallet" /></span> Monthly position</div>
        <p>Available after your plan</p>
        <h1 className={netTotal < 0 ? "negative" : ""}>{netTotal < 0 ? "−" : ""}{symbol}{Math.abs(netTotal).toLocaleString()}</h1>
        <div className={`balance-status ${netTotal < 0 ? "over" : "on-track"}`}><span />{netTotal < 0 ? "Budget needs attention" : "You’re within budget"}</div>
      </div>
      <div className="summary-breakdown">
        <div className="summary-row"><span>Monthly income</span><strong>{symbol}{totalIncome.toLocaleString()}</strong></div>
        <div className="summary-row"><span>Total allocated</span><strong>{symbol}{totalOutgoings.toLocaleString()}</strong></div>
        <div className="allocation-meter" aria-label={`${usedPercent.toFixed(0)} percent of income allocated`}>
          <div className="meter-track"><span className="meter-essential" style={{ width: `${Math.min(100, essentialPercent)}%` }} /><span className="meter-saving" style={{ width: `${Math.min(100 - Math.min(100, essentialPercent), savingsPercent)}%` }} /></div>
          <div className="meter-label"><span>{usedPercent.toFixed(0)}% allocated</span><span>{Math.max(0, 100 - usedPercent).toFixed(0)}% free</span></div>
        </div>
        <div className="summary-legend">
          <div><span className="legend-dot essential"/><p>Essentials</p><strong>{symbol}{totalEssentials.toLocaleString()}</strong></div>
          <div><span className="legend-dot saving"/><p>Savings</p><strong>{symbol}{totalSavings.toLocaleString()}</strong></div>
        </div>
      </div>
    </Card>
  );
}
