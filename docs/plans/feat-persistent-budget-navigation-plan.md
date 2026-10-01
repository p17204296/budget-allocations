# Preserve budget navigation on refresh

Status: proposed; implementation has not started.
Suggested feature branch: `feat/persistent-budget-navigation`.

## Problem and outcome

`src/App.tsx` initializes `activeTab` with `useState("overview")`. Tabs currently change local state; the URL never records the user's location. Refresh therefore returns users to Overview. `WhatIfWorkspace` also stores its selected scenario only in local state.

Refreshing should reopen the same budget section and, on What-if, the same saved scenario. Browser Back and Forward should restore previous locations. The highlighted navigation item, displayed content and URL must agree. Existing save protection must continue to work.

## Navigation contract

Use URL query parameters as the source of navigation state. This keeps the existing root entry point and avoids requiring server rewrites for new paths. A small centralized navigation layer can support the current tab structure; a routing library is not required solely for this change.

| Section | URL |
| --- | --- |
| Overview | `/?tab=overview` |
| Plan | `/?tab=allocations` |
| Money | `/?tab=accounts` |
| Income | `/?tab=income` |
| What-if | `/?tab=whatif` |
| Saved scenario | `/?tab=whatif&scenario=<id>` |
| Settings | `/?tab=settings` |
| Admin, authorized users only | `/?tab=admin` |

- Opening `/` defaults to Overview. No localStorage fallback or persisted location shared across accounts.
- Missing or unknown tabs fall back to Overview. Normalize invalid application parameters with history replacement, not an extra Back entry.
- Scenario parameters only apply to What-if. Treat IDs as untrusted input and validate them before querying. Backend ownership checks remain authoritative.
- Preserve unrelated query parameters and fragments; do not interfere with authentication callbacks.
- Preserve a valid requested location through initial auth/data loading. Show the sign-in screen when unauthenticated; resume that location after sign-in, subject to access checks.
- On explicit sign-out, reset the location to Overview after the guarded sign-out succeeds, removing scenario identifiers. Do not reset navigation on transient authentication loading.
- Wait for the admin-access query before deciding whether an Admin route is permitted. Unauthorized users return to Overview with history replacement; never render admin content prematurely.
- Missing, deleted or inaccessible scenario links show a neutral “This scenario is unavailable” message and the scenario chooser. Do not disclose ownership. Remove the stale scenario parameter with history replacement.

## Implementation sequence

1. Add one typed parser/serializer for tab and scenario URL state. Reuse the existing `TabId` mapping and whitelist supported values.
2. Add a central navigation hook/provider that reads the initial URL synchronously, subscribes to browser history changes and owns URL updates. Replace the local tab initialization in `AppShell`. Keep feedback page identification and mobile/desktop active states derived from the same resolved location.
3. Route desktop tabs, mobile tabs and the logo through the centralized navigation action and existing `NavigationGuardProvider`. Push a history entry only after a successful guard. Clicking the current location is a no-op.
4. Make `WhatIfWorkspace` consume the selected scenario from navigation state. Scenario selection, successful creation, duplication and conflict copies update the URL only after their existing guarded actions succeed. Confirmed deletion returns to the chooser with replacement so Back cannot reopen the just-deleted scenario. The unsaved creation form is not restored on refresh.
5. Integrate Back/Forward with the save guard. Browser traversal changes the address before asynchronous saves can finish: keep the current editor mounted while validating/saving; on failure restore its previous URL/history position without adding duplicate entries. Serialize traversals and suppress compensating history events so repeated Back clicks cannot bypass the guard or cause loops. Track app history entries to distinguish internal traversal from leaving the document. Preserve native unload warnings for cross-document navigation, refresh and close.
6. Handle auth, unavailable scenarios and unauthorized Admin locations as described above. Preserve existing Convex Auth and backend ownership validation.
7. Update user documentation with refresh and browser-history behavior.

## Save behavior

- Six-second trailing autosave stays unchanged; URL updates are navigation state, not budget writes.
- A valid pending draft flushes before tab or scenario navigation, including Back/Forward.
- Failed saves, invalid inputs and revision conflicts leave the editor and its URL at the original location, with the existing actionable error.
- Refresh retains the location of the last saved scenario; it does not persist an unsaved local draft. Keep the existing beforeunload warning while edits remain unsaved. Browsers control whether this warning is displayed.
- No unsaved financial values are placed in the URL or browser storage.

## Verification and acceptance

Automated coverage:

- Parse/serialize every section, empty URLs, unsupported values, unrelated query parameters and invalid scenario IDs.
- Direct load and refresh initialization do not briefly mount Overview instead of the intended tab.
- Approved tab/scenario transitions update URL and content once; duplicate navigation does not add history entries.
- Successful navigation saves commit the latest draft; failed, invalid and conflicting saves preserve the editor and restore the URL.
- Back/Forward, repeated traversal during a save and compensating events cannot produce loops, mismatched routes or dropped edits.
- Creation, duplication, conflict copy and deletion update the selected scenario route correctly.
- Auth loading, sign-in, sign-out, unauthorized Admin and unavailable scenario routes behave correctly.

Actual browser checks, using isolated development accounts:

- Visit every available tab, refresh and confirm the same content and active navigation state at desktop and mobile widths.
- Select a saved scenario, refresh and verify its identity and saved amounts. Open its URL in a fresh tab and confirm ownership/auth checks.
- Click the logo; use Back/Forward across tabs and scenarios, including rapid repeated clicks.
- Edit a scenario and navigate before six seconds: confirm one valid save finishes before transition, then reload to verify persistence.
- Simulate offline save failure, blank inputs and a two-tab revision conflict; verify navigation is blocked and the address matches the visible editor.
- Check unavailable/deleted scenarios, guest expiry and Admin access restrictions.
- Inspect screenshots for navigation highlighting, loading states and mobile layout. Check browser errors and real save requests.
- Run Vitest, frontend/backend TypeScript checks and the production build. Test direct query URLs against the built local preview as well as the development server.

## Boundaries

This work changes location/navigation persistence only. Restoring modal state, scroll position, unsaved creation forms or unsaved financial drafts is outside scope. Production deployment and publishing a PR are outside scope.
