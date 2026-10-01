# Changelog

All notable changes to Budget Allocations are documented here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The version history is currently maintained by feature milestone rather than published package releases.

## [Unreleased] — What-if budgets

### Added

- Independent saved scenarios copied from a dated budget snapshot or started empty.
- Editable net income sources, spending and savings, with comparisons, removal and restoration.
- Required-income targets, selected-source calculations and separate upfront costs.
- Six-second debounced autosave with a manual Save changes button, success toasts, navigation guards, draft preservation and revision conflict recovery.
- Compact responsive What-if workspace with grouped scenario controls and item-by-item mobile comparisons.
- Scenario ownership checks, record limits and guest cleanup.
- Calculation, deterministic autosave, editor integration and Convex backend tests.
- Calculation explanations available through compact info icons on hover, keyboard focus or click.

### Changed

- Income suggestions now only offer an increase when a scenario is below its target. Scenarios at or above target keep their income amounts and show that no increase is needed.
- The income action names the source and new amount, explains which What-if field changes, and confirms the update. Other income sources and the actual budget stay unchanged.
- Mobile income, spending and savings items use full-width projected amounts with Current and Change below, alongside clearer totals and upfront-cost layouts.
- What-if dropdown menus now anchor to their fields, match their widths and stay within the viewport, with keyboard selection and Escape dismissal.
- Successful saves use toasts instead of a persistent Saved label; manual saves share the autosave controller to avoid duplicate writes.

### Fixed

- Recover local edits as a new scenario after another tab deletes the original; stop autosave and remove the ineffective retry action.
- Scenario saves reuse a single bounded child-row read and skip patches for unchanged income, allocation and upfront-cost rows.

- Removed suggestions to reduce income when the monthly target is already met or exceeded.
- Moved the selected-source calculation info icon beside its section label.
- Corrected detached native option-menu positioning in What-if fields by using anchored dropdown menus.
- Convert the password-reset form code to a string before passing it to authentication.

## [2026-08-30] — Financial picture and UX update

### Added

- Asset tracking for property, investments, pensions, and other holdings.
- Debt tracking for credit cards, loans, mortgages, and other liabilities.
- Net worth summary calculated from account balances, assets, and outstanding debts.
- Savings goal details including target amounts, current progress, target dates, and monthly guidance.
- Editing and deletion flows for accounts, assets, and debts with ownership checks.
- Currency selection across budget and financial picture views.

### Changed

- Moved the Account, Asset, and Debt actions to the bottom of the net worth card so the summary remains the primary focus.

## [2026-08-23] — Workspace improvements

### Added

- Overview, allocation plan, money, income, settings, and admin sections.
- Private email/password accounts alongside seven-day guest workspaces.
- Password reset emails through Resend when configured.
- In-app feedback submission and an admin review area.
- Automatic cleanup for guest workspaces older than seven days.

### Changed

- Added clearer confirmation dialogs for destructive actions.
- Improved metadata and Open Graph information for sharing.
