# What-if budgets

What-if budgets let you explore a move, a new contract, spare-room income, a side hustle, income loss or different spending. Each scenario is separate from your actual budget.

## Create and compare

Open What-if and select New scenario. Copy my budget preserves a dated snapshot of your income, spending and savings. Start empty creates a blank baseline. Give the scenario a name, then edit its What-if amounts. All figures are monthly and use the scenario's currency.

Income should be the money available after tax and business costs. Do not deduct those costs again in scenario spending. Savings are monthly allocations, not account balances. Upfront costs, such as moving or setup costs, are recorded separately.

Current shows the original snapshot; What-if shows your projection; Change shows the difference. Removing an item keeps its baseline visible, and Restore brings back its last projected values. Duplicating a scenario preserves its baseline for another comparison.

## Understand your target

Money I want left each month is the amount you want available after spending and planned savings. A copied scenario starts with the baseline's leftover amount, with a minimum target of zero.

| Result | Calculation |
| --- | --- |
| Required monthly income | Projected spending + planned savings + leftover-money target |
| Projected monthly income | Sum of active projected income sources |
| Shortfall or money above target | Projected income − required income |
| Available after allocations | Projected income − spending − savings |
| Monthly improvement | Projected available money − baseline available money |

Upfront costs do not enter these monthly calculations. Hover, focus or click an info icon to see an explanation. Click outside, press Escape or move focus away to dismiss it.

### Cover a shortfall with one income source

When your scenario is below target, choose a source in Income needed to meet your target. Its required amount is the total required income minus income from your other active sources.

For example, spending of £3,700, savings of £700 and a £600 leftover target require £5,000 income. With £750 from room rental, Primary Income needs £4,250. If Primary Income currently provides £3,800, the remaining shortfall is £450.

Set Primary Income to £4,250 replaces its What-if monthly amount with £4,250; it does not add £4,250 to the existing figure. Other income sources, the snapshot and your actual budget stay unchanged. A confirmation toast identifies the changed source and amount.

At or above target, the app confirms no increase is needed and offers no Set button. It does not suggest lowering your income. To explore reduced hours or income loss, manually edit or remove a source.

## Save and recover

Calculations change immediately. Autosave waits six seconds after the last edit; every edit restarts the timer. Save changes saves valid edits immediately through the same controller. A successful save shows a toast. An older response cannot mark newer edits as saved.

Incomplete names or amounts block saving until corrected. Failed saves preserve your edits and offer Retry save. Internal navigation waits for a successful save before leaving the editor. Unsaved edits trigger the browser's close/refresh warning where supported.

If another tab saves the same scenario first, autosave stops. Reload saved version requires confirmation before discarding your edits. Save as a new scenario preserves your local projection and original baseline separately.

If another tab deletes the scenario, your local draft stays visible and autosave stops. Complete any incomplete inputs, then choose Save as a new scenario to preserve the projection and original snapshot. Discard edits and return requires confirmation.

## Limits and current boundaries

- Up to 20 scenarios per user; each scenario supports up to 200 income rows, 200 allocation rows and 50 upfront-cost rows. Copies of over-limit budgets are rejected rather than silently truncated.
- Calculations respect currency minor units; JPY uses whole yen.
- Guest scenarios are deleted with their seven-day guest workspace.
- Tax calculations, forecasts and applying a scenario to the actual budget are not included.
- Refresh currently returns to Overview. Returning to the same tab and saved scenario is covered by the [navigation persistence plan](../plans/feat-persistent-budget-navigation-plan.md), which has not been implemented.
- The feature is implemented on the development branch and has not been deployed to production.
