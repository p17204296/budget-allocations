# Event savings plan verification

Verified on 29 October 2026 on branch `feat/event-savings-plan`, against development Convex deployment `oceanic-mockingbird-872` and the local Vite frontend. Production was not deployed.

## Rebalance prompt follow-up

- Added highlighted rebalance actions and dismissible explanations for a shortfall or optional reduction, based on actual funding and remaining months rather than historical planned totals.
- Added tests for missed past contributions, unfinished current months, lower targets/full funding, clearing the suggestion after rebalancing, invalid-input suppression, declining without changing plans, and retaining dismissal across reopening in the same tab.
- Browser-verified the highlighted action and £300 shortfall message at 390 × 844. Clicking **Keep my plan** removed the message and returned the action to its secondary style while the January planned/actual entries stayed at £300/£150.

## PR review follow-up: legacy aggregate funding

- Reproduced the reported regression with failing input, draft-parser and backend-save tests: legacy available funding plus recorded payments can exceed the original per-field limit.
- Give starting funding an aggregate cap equal to the maximum legacy balance plus payments for all 200 items. Use that cap consistently in the input, parser and shared server validation. Keep individual budgets, legacy funding fields, item amounts and monthly entries at their original limit.
- Regression tests cover the maximum aggregate in GBP and JPY, preserving funding after item removal, rejecting invalid or excessive aggregates, and saving unrelated notes through both the editor and backend.
- Add concise JSDoc for the financial rules and draft conversion helpers highlighted by the documentation warning.

## Automated checks

- `npm run typecheck`: application, Vite configuration, Convex and all four event test files passed strict checking. The event test configuration is now part of this command.
- `npm test`: all 108 tests passed. Coverage includes legacy funding conversion, zero/partial/full funding, inclusive calendar months, minor-unit rounding and JPY, explicit rebalancing, retained out-of-schedule actuals, invalid inputs, notes persistence, ownership, conflicts, retry, navigation protection and focus after either add-item control.
- `npm run build`: passed. Existing advisories remain for outdated Browserslist data and the main JavaScript chunk exceeding 500 kB (approximately 541 kB before gzip).
- `npx convex dev --once`: development schema and functions pushed successfully; optional fields accept existing event records.
- `git diff --check`: passed.

## Browser checks

Used the Codex in-app browser with a new guest workspace against the development backend.

- Created an event with a £1,200 target and £300 starting funding. A January–March 2027 schedule initially suggested £300 in each named month.
- Entered £150 actual savings in January. Planned amounts stayed at £300 and the remaining funding became £750.
- Saved notes, added a hotel costing £600, recorded a £100 payment and verified that the payment was not subtracted from the funding gap again.
- Reloaded the app, reopened the event and verified the item, dates, monthly planned/actual amounts and notes persisted.
- Clicked the mobile floating add button from the savings section: the new item was added and its description received focus after scrolling into view.
- Reviewed the desktop ledger and mobile cards. Fixed the desktop sticky summary boundary and rendered the mobile floating action outside animated page containers. Checked the action clears the save prompt and bottom navigation.
- Measured document widths of 320, 390, 768, 1024, 1180 and 1440 pixels; none had horizontal page overflow. Visually reviewed screenshots at 320, 390, 1280 and 1440 pixels.

## Limits

Browser viewport checks are not physical-device tests. Native mobile date pickers, virtual keyboards, device safe areas and other browser engines remain unverified. Failure, conflict, date-change preservation and rebalance scenarios were verified in automated tests; the browser persistence check used the real development backend.

---

# Earlier event planning verification

Verified on 26 October 2026 against the development Convex deployment `oceanic-mockingbird-872` and the local Vite frontend. Production was not deployed.

## Automated checks

- `npm run typecheck`: application, Vite configuration and Convex type checks passed.
- Explicit strict TypeScript checking of all four new event test files passed.
- `npm test`: 75 tests passed, including event calculations, persistence, ownership isolation, record limits, currency contracts, guest cleanup, autosave/retry/conflicts, draft validation, navigation protection, and deadline defaults.
- `npm run build`: passed. Vite reports the existing large-chunk advisory; the resulting main bundle is approximately 527 kB before gzip.

## Browser checks

Headless desktop Google Chrome driven through Playwright, with real development-backend data in temporary guest workspaces.

| Viewport | Result |
| --- | --- |
| 320 × 568 | Passed layout and complete event flow |
| 375 × 812 | Passed layout and complete event flow |
| 390 × 844 | Passed layout and complete event flow |
| 430 × 932 | Passed layout and complete event flow |
| 768 × 1024 | Passed layout, menus and field visibility |
| 1024 × 768 | Passed layout, menus and field visibility |
| 1440 × 900 | Passed desktop columns and field visibility |

Also checked 699/700/701px, 899/900/901px and 1179/1180/1181px widths. Screenshots were reviewed for all seven viewports and the breakpoint transitions. No horizontal page overflow was detected. Editor controls met the 44px minimum target size; amount inputs were at least 48px high. Final fields could be scrolled above mobile navigation.

At each phone size, completed creation, item entry, deposit recording, funding-method conversion in both directions, separate deadline editing, invalid-payment validation, manual save, reopening, full funding, and confirmed deletion. Dropdown menus remained within the viewport.

Additional browser scenarios:

- Two tabs editing the same event: stale save stopped with a conflict; confirmed reload restored the saved version.
- Controlled WebSocket fault injection changed only one test mutation's currency, causing a real server rejection: saving state appeared, local edits survived, and retry saved successfully.
- Long names and £1 billion amounts: no horizontal page overflow.
- Calculation explanation: opened by touch-style click, stayed within the viewport, and dismissed with Escape.
- Keyboard focus styling and Tab order checked; reduced-motion mode exercised.
- 200% CSS zoom at 768px checked without horizontal overflow.
- Monthly What-if: created a copied scenario, edited monthly income and saved successfully.

## Limits of verification

These are desktop Chrome viewport checks, not physical-device or cross-browser tests. Native mobile date pickers, virtual keyboards, actual device safe areas, and native browser zoom remain unverified. The zoom check used CSS zoom. Network-offline queueing was not used for the failure test; a controlled server rejection exercised the failure and retry UI.
