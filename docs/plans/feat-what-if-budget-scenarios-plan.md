# What-if budgets: implementation plan

Date: 1 October 2026
Branch: `feat/what-if-budget-scenarios`
Status: implemented on the feature branch; verification results recorded below.
Branch created from `feat/signup-data-choice` at `3d4ae67`, preserving the current onboarding work.

## Purpose

Let a user copy their current monthly budget, change any combination of income, expenses and savings, and understand the financial impact before making a decision. Salary changes are one use case; the model must equally support renting a spare room, replacing a contract, starting a side hustle, losing income or changing living costs.

The main questions are:

- What would my monthly position become?
- How much better or worse is it than my starting budget?
- How much total income would I need to meet my planned spending, savings and breathing-room target?
- After my other income sources, how much would a particular source need to contribute?

## First release

- Add a `What-if` destination to the existing navigation.
- Default to `Copy my budget`: create a named scenario from a snapshot of the live budget, including currency, all income sources and monthly budget items. Offer `Start empty` as a secondary option, with an empty baseline and the current currency.
- Save, reopen, rename, duplicate and delete scenarios.
- Add, edit and remove projected income sources and spending/savings items independently of the live budget.
- Show baseline and projected figures side by side, with differences for each item and for totals.
- Allow a nonnegative monthly breathing-room target, initially the greater of zero and the baseline amount left over. If the baseline is in deficit, show the deficit explicitly rather than treating it as comfort.
- Calculate total income required and the shortfall or surplus against that target.
- Optionally select one income source to solve for its required contribution while holding all other projected income fixed. When total income is below target, an explicit `Set [source] to [amount]` action increases that source in the scenario only. At or above target, show that no increase is needed and offer no income-reduction action.
- Record named one-off costs separately and show their total as an upfront cash requirement.
- Support empty budgets, multiple income sources, existing currencies, signed-in users and temporary guest workspaces.
- Label saved scenarios with their snapshot date and currency. Later live-budget changes do not change the baseline.

All recurring values in v1 are monthly. Users enter their own estimates; there is no automatic city price adjustment or assumption that every cost increases.

## Income and expense semantics

Use general labels such as `Income source`, `Monthly amount available` and `Required monthly income`. Do not make occupation, employer, salary or location required fields.

Users enter money available after tax and business costs. Label the input `Expected monthly income after costs and tax`. For salaries this normally means take-home pay; for rental income, contracts and side hustles it means the amount remaining after relevant deductions. Do not offer a gross-receipts mode in v1. Explain that costs already deducted from income should not also appear as spending allocations. V1 does not estimate tax or determine whether particular income is taxable.

Replacing a contract or salary means editing/removing the existing source, not automatically adding the replacement on top. Multiple sources can coexist when that is the user's actual assumption.

Preserve the existing `essentials` and `savings` categories in storage. Use `Spending` as the scenario section label for essentials-backed rows, allowing leisure and other personal costs without changing the live-budget categories in this release. Both kinds of allocation count toward the required income.

Savings are editable monthly contributions. Balances, assets, debt balances and current savings progress are not new income and are not included in the scenario calculation. Debt repayments can be entered as spending rows.

## Calculation contract

Use shared pure calculation functions with money converted to integer minor units for arithmetic and rounded at input boundaries.

Let:

- `I` = projected monthly income from all sources.
- `E` = projected monthly spending allocations.
- `S` = projected monthly savings allocations.
- `B` = desired unallocated monthly breathing room.

Then:

- Available after allocations = `I - E - S`.
- Required total monthly income = `E + S + B`.
- Difference from target = `I - (E + S + B)`.
- Additional income needed = `max(0, E + S + B - I)`.
- Required contribution from selected source = `max(0, E + S + B - other projected income)`.
- Monthly-position change = projected available after allocations minus baseline available after allocations.
- Upfront cash requirement = sum of one-off costs; excluded from recurring totals.

Keep `Within budget` separate from `Meets your target`. A scenario can cover allocations while falling short of the user's breathing-room goal. Describe the result as meeting a user-defined target, not a financial recommendation.

The selected-source result replaces that source's amount; it is not an additional amount to add to its current contribution. If total income already meets or exceeds the target, acknowledge the achieved target and preserve the income amounts. Zero requirements remain valid in the pure calculation, but are not offered as an income-reduction action. Removing the selected source clears the selection.

## User flow and screen outline

1. Open What-if and choose `Copy my budget`, or the secondary `Start empty` option.
2. Enter a name, for example `Rent the spare room` or `London contract`.
3. Review the dated baseline and edit the projection.
4. Add or change net income and personal spending; adjust savings and `Money I want left each month`.
5. Review the result immediately; optionally choose an income source to calculate its required amount.
6. Enter any one-off setup costs; changes autosave after six seconds without further edits. Return later to the saved scenario.

Screen structure:

- Scenario header: name, snapshot date, save status and scenario actions.
- Comparison: income, spending, savings and available balance, each with baseline/projected/difference values.
- Editors: income sources, spending and savings, with baseline amounts beside existing rows; new and removed rows visibly identified.
- Target: breathing room, total required income, gap/surplus and optional selected-source requirement.
- Upfront costs: a separate editable list and total.

Use the save behaviour and visual direction below. Existing baseline rows remain visible when removed, with a `Removed` label and `Restore` action. Newly added rows have no baseline and can be deleted outright. Restoring returns the last projected values from before removal; retain those values separately if necessary. Removing the selected income source clears its selection.

## Autosave contract: critical acceptance requirement

- Use a trailing debounce of **6,000 ms after the last user edit**. Each edit cancels and restarts the timer, including name, amounts, selection, removal, restoration and `Set [source] to [amount]`. No per-keystroke writes or periodic saves during uninterrupted typing.
- Calculations and comparisons update locally immediately. Display `Unsaved changes` during the debounce, `Saving` during a request, a success toast only when the latest draft is acknowledged, and an actionable failure or conflict state when needed.
- Capture a draft version with each request. Allow at most one save in flight per scenario. An acknowledgement for an older draft must never replace newer local edits or mark them saved. Edits during a request start their own six-second quiet period; once both that period and the in-flight request complete, save the latest draft once.
- Clear stale timers on scenario changes and unmount. Reactive query updates must not trigger saves or overwrite dirty drafts. Do not send unchanged payloads.
- Internal navigation, switching scenarios and sign-out explicitly flush pending valid edits once before leaving, rather than waiting for the debounce. If the flush fails or a field is invalid, keep the draft and stop navigation with retry/correction guidance. If edits occur during the flush, retain them and do not navigate while they are unsaved.
- Browser close/refresh uses a standard unsaved-changes warning while a draft or request remains pending. Do not depend on an asynchronous save during page unload. Browser-controlled warnings are best effort; v1 does not promise recovery after a forced close.
- Invalid or incomplete input remains editable locally and blocks saving until corrected; never silently convert a blank or partial amount to zero. An edit followed by correction starts a new six-second debounce.
- On network or server failure, keep local edits and offer an explicit `Retry save`. No tight retry loop. Subsequent valid edits can schedule a new debounced attempt.
- Save with an expected server revision. A stale revision is a conflict, not a network retry: stop autosave, preserve local edits, and offer `Reload saved version` or `Save as a new scenario`. Reload requires a clear discard confirmation; saving separately retains the original baseline and local projection, without changing the conflicting original.
- Creation, duplication, confirmed deletion, explicit retry and conflict recovery are discrete actions; the six-second delay applies to editing an existing scenario. Cancellation/deletion must invalidate pending timers so a deleted scenario cannot be recreated by a late save.

## Frontend design direction

Apply Anthropic's installed frontend-design skill while retaining Budget Allocations' established identity. The comparison itself is the memorable element: aligned `Current / What-if / Change` columns with editable projected amounts, rather than a collection of generic stat cards.

- Reuse the existing palette: paper `#f3efe5`, surface `#fffdf8`, ink `#17382f`, line `#d9d4c8`, coral `#ed6a4d` and mint `#72b49a`. Use existing danger styling for deficits and accessible text alongside colour.
- Retain Avenir Next/Avenir/Segoe UI for controls and body copy, and Georgia for headings. Use tabular numerals and right-aligned amounts for comparisons.
- Keep labels in sentence case, align content left, and reserve emphasis for the budget change and target result. Reuse established controls without introducing decorative gradients, new typefaces or repeated card animations.
- On desktop, use one comparison workspace with grouped income, spending and savings rows and a quieter target area. On mobile, keep each item's baseline, editable amount and difference together; avoid horizontal scrolling.
- Show the snapshot date beside `Current` so users understand that it is the original captured budget, not a live comparison.
- Before implementation, draw a compact desktop/mobile wireframe and review it against the actual content and existing identity. During implementation, inspect screenshots and adjust density, alignment and visual hierarchy.
- Ensure keyboard access, visible focus, labelled inputs, reduced-motion support and status text that does not depend on colour. Review the existing mobile navigation layout when adding the destination.

## Proposed Convex model

Use additive tables rather than attaching scenario identifiers to live-budget tables:

- `scenarios`: userId, name, currency, snapshotAt, updatedAt, revision, breathingRoomAmount and optional selectedIncomeRowId. Index by user and updated time.
- `scenarioIncome`: userId, scenarioId, stable row identifier, optional source income ID, optional baseline value object and optional projected value object (description and monthly amount).
- `scenarioBudgetItems`: userId, scenarioId, stable row identifier, optional source budget-item ID, optional baseline value object and optional projected value object (name, category and monthly amount).
- `scenarioOneOffCosts`: userId, scenarioId, name and amount.

Store removed projected values separately where required for Restore; these values never count toward projected totals. For income and budget rows, absent baseline means added; absent projection means removed. Never allow both to be absent. Baseline objects are immutable after creation. Source IDs are provenance only: deleting a live-budget item must not invalidate a scenario. Clone names and amounts, not savings balances, account balances or operational transfer instructions.

Index child tables by user and by scenario. Query a compact paginated scenario list, then load rows only for the selected scenario. Validate ownership of the scenario and every supplied child ID on the server. Derive userId from Convex Auth, never from caller input.

Create the baseline and projection in one transaction. Save projected changes atomically with an expected revision to avoid silently overwriting edits made in another tab. Duplicate copies the original baseline and current projection; it does not take a fresh live snapshot. Delete the scenario and all children together within the enforced limits.

Proposed v1 limits: 20 scenarios per user, 200 income rows and 200 budget rows per scenario, and 50 one-off costs. Reject oversize writes clearly. Check baseline reads using limit-plus-one and refuse to clone an incomplete budget: current live queries truncate at 200 rows. Confirm transaction and document-size limits during implementation before finalising these caps.

No migration of existing budget data is required. Register every new table in expired-guest cleanup with a by-user index. Extend feedback page validators and admin result validators to accept the new destination. Authentication continues to use existing Convex Auth; this feature does not require Clerk.

## Implementation sequence

1. **Calculation foundation:** define scenario types and pure calculations; test target, gap, selected-source and baseline comparison behaviour.
2. **Persistence:** add schema, authenticated queries/mutations, atomic snapshot/save/duplicate/delete, limits and revision checks; integrate guest cleanup and feedback validators.
3. **Scenario workspace:** review desktop/mobile wireframes using Anthropic frontend-design; add navigation and scenario list; build the editor, baseline comparison, target panel, Restore and one-off costs. Implement and verify six-second debounced autosave, navigation flush, revision conflicts and draft preservation.
4. **Verification and documentation:** exercise representative scenarios in the browser, validate isolation and ownership, run frontend/backend type checks and build, and update README/changelog.

Keep implementation in small reviewable commits on this branch. No deployment or pull request is part of this planning step.

## Acceptance examples

These are arithmetic fixtures, not estimates of real costs or tax.

- **Relocation:** income £3,800; spending £2,500; savings £700; breathing room £600. Increasing spending by £1,200 makes the required income £5,000 and the gap £1,200.
- **Spare room:** add £750 income and £150 spending to the same baseline. Available after allocations rises from £600 to £1,200; monthly improvement is £600. With spending now £2,650, the minimum contribution from the original income source is mathematically £3,200 after accounting for the £750 source. Because the existing income is above target, the UI confirms no increase is needed and offers no Set action.
- **Replacement contract:** edit an existing £3,000 source to £4,000. Total income rises by £1,000, not £4,000.
- **Side hustle:** receipts of £500 less £100 operating costs and £100 tax reserve leave £300 available. Enter £300 as income; improvement is £300, with no duplicate deduction rows.
- **Income loss:** remove a source and see the resulting gap without affecting the live budget.
- **Setup costs:** add £2,000 one-off costs. Monthly results stay the same; upfront cash required becomes £2,000.

Autosave must have deterministic timer tests: repeated keystrokes produce zero writes; 5,999 ms after the last edit produces zero writes; 6,000 ms produces one write containing the latest draft. Also test timer resets, edits during in-flight saves, stale acknowledgements, invalid drafts, navigation flush, failed flush, scenario switching, unmount, deletion, revision conflicts and saving a conflict as a new scenario. Confirm in the browser that typing does not issue per-keystroke save requests.

Also verify: empty scenario creation; Restore preserves the prior projection; `Set [source] to [amount]` replaces rather than adds income; zero income; no spending; deficit baseline; other income exceeding the target; penny rounding; source/category changes; removed rows; duplicated scenarios; live item/account deletion; live currency changes; invalid/negative/non-finite inputs; over-limit snapshots; guest expiry; cross-user access; stale saves; mobile and keyboard navigation. Signed differences must never be clamped to zero.

Run `npm run build` and the frontend/backend TypeScript checks. The existing `npm run lint` additionally invokes `convex dev --once`, which can update a configured deployment: use it only against an appropriate development deployment during implementation.

## Deferred work

- Gross salary conversion and automatic tax calculations for any income type.
- Automatic rent/cost-of-living estimates or external data feeds.
- Income frequency conversion, contract end dates, seasonal forecasts and multi-month cash-flow timelines.
- Probability-weighted income, best/worst-case automation and percentage savings targets.
- Automatically applying scenarios to the live budget or executing account transfers.
- Export, sharing and comparing multiple scenarios on one screen.
- Automated relocation support, benefits valuation or recruiter salary recommendations.

Users can manually duplicate scenarios to explore optimistic or cautious assumptions in v1. These deferred features do not block a general-purpose monthly what-if calculator.

## Agreed product decisions

All recommendations across the three interview rounds were accepted, with the explicit refinement that income is entered after tax and business costs and autosave waits six seconds after the last edit.

- Budget editing is the main entry point, with required-income calculation inside the scenario.
- Fixed dated baseline; editable target initially preserving current leftover money.
- Preserve the app identity and make the comparison visually central.
- Selected-source calculation and explicit `Set [source] to [amount]` action.
- Debounced autosave, navigation flush and no silent multi-tab overwrites.
- Separate one-off costs; no promotion to the live budget in v1.
- Monthly estimates for variable income; manually duplicate cautious/optimistic scenarios.
- Removed baseline rows remain visible and restorable.
- Copy the current budget by default; empty scenarios as a secondary option.

## Reference

Reviewed the existing schema, planner, monthly summary, budget validation and guest cleanup. Consulted the Convex MCP `get_convex_scaling_guidance` for indexed per-user reads, server-side ownership checks, bounded data access and transactional writes. No deployment data was accessed or modified for this plan.


## Implementation and verification

- Added isolated scenario tables and authenticated transactional APIs; existing live budgets remain unchanged.
- Added desktop/mobile comparison workspace following Anthropic frontend-design, with existing colours and typefaces.
- Implemented six-second trailing autosave, app-wide navigation and sign-out guards, restored rows, target application and revision conflict recovery.
- Used integer minor-unit calculations; JPY inputs use whole yen.
- Added 52 passing Vitest calculation/controller/editor and convex-test backend tests, with transaction limits enabled.
- TypeScript checks and production build passed. Functions pushed successfully to the development deployment `oceanic-mockingbird-872`; production was not deployed.
- Browser verification used a temporary guest workspace: scenario creation and real saves succeeded; rapid edits issued no additional save during a five-second observation, then one after the quiet period. The mobile layout fit a 390-pixel viewport without horizontal overflow or a Vite error overlay.

Desktop layout:

```text
Scenario name                         Save changes / Duplicate / Delete
Snapshot date                         Pending/error status; saved toast
Monthly plan | Current | What-if | Change    Required income
Income sources                              Leftover-money target
Spending                                    Gap / surplus
Savings                                     Selected-source amount
Totals
Upfront costs (separate)
```

Mobile gives each item a full-width editable What-if amount, with Current and Change beneath it; the target follows the comparison and the existing bottom navigation remains.

- Reopened the saved scenario in the finished build: the projected rent persisted while live income and remaining balance stayed at £3,000 and £920. Added net spare-room income and applied the selected-source requirement through the real development backend.
- Fresh-browser verification of the finished build reported zero browser errors. Navigation flushed pending rent changes, reopening showed the saved amount, and the comparison fit a 320-pixel viewport without overflow.

### UI refinement

- Added an immediate Save changes action alongside the unchanged six-second debounce. Both use the same controller and one-request limit.
- Successful latest-draft writes show a toast; initial loads, no-op saves and stale acknowledgements do not. Errors and incomplete input stay visible.
- Tightened the page heading, grouped scenario selection and creation, and consolidated editor actions. Checked layouts at 320, 390, 768, 1024 and 1440 pixels.

### Final refinements and verification (1 October 2026)

- Income actions only increase the selected source to cover a shortfall. Meeting or exceeding the target removes the Set action and preserves higher income. Users may still model reductions by manually editing income.
- Shows the required-total minus other-income calculation when below target, with explicit before/after amounts and a confirmation toast on applying the change.
- Replaced native What-if option menus with Radix Select menus anchored to the field. Checked all three types (scenario selection, allocation category and target income source) open on desktop and mobile, including 320 pixels; keyboard selection and Escape dismissal worked.
- Compact info icons sit beside calculation labels. Floating explanations open on hover, focus and click without expanding the layout.
- Browser checks covered a £5,000 total target: £750 other income leaves £4,250 required from Primary Income; £3,800 Primary Income leaves £1,200 required from room rental. Applying either changed only the selected source, and saved values persisted on reopening. Actual live income remained £3,000.
- Final policy checks covered below-target, exactly-on-target and above-target scenarios: the increase action disappears after meeting the target; higher income is preserved.
- 52 tests passed, covering calculations, autosave, editor integration and backend isolation. Frontend/backend TypeScript checks and the production frontend build passed. Development-browser checks reported no runtime errors.
- Build reports an advisory that the main JavaScript chunk exceeds 500 kB after adding the accessible dropdown primitive. Bundle splitting is not part of these UI refinements.
- Refresh still defaults to Overview and clears local scenario selection; the separate navigation persistence plan remains proposed. No production deployment or PR publication has occurred.
