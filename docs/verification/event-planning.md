# Event planning verification

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
