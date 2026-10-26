# Laptop planning layout verification

Verified on 26 October 2026 using desktop Google Chrome and the local frontend with temporary development-backend guest data.

## Changes

- Planning uses a maximum workspace width of 1480px on laptop and desktop screens, giving the editing column more space.
- At 1180px and wider, the summary spans both the details and item-list rows. The item list starts exactly 24px below the details card instead of waiting for the taller summary to end.
- The summary stays visible alongside the list while scrolling. Funding controls span the full width underneath, with their inputs arranged in two columns.
- At 1360px and wider, event name, budget and date share one row.
- Mobile DOM and visual order remain details, summary, items, funding. No fields are duplicated or moved in the DOM.

## Checks

- Type checking, all 81 tests and production build passed.
- Browser geometry and screenshot checks passed at 1180×900, 1280×800, 1366×768, 1440×900, 1536×960, 1600×1000, 1825×1000, 1920×1080 and 2660×1958.
- Checked transitions at 1179/1180px and 1359/1360px.
- Rechecked 320×568, 390×844, 430×932, 768×1024 and 1024×768 for mobile order and horizontal overflow.
- Confirmed the summary remains below the sticky header while scrolling, and funding edits can be saved through the floating action.
- Checked empty and invalid event layouts and monthly scenario widths for regressions.

## Branch

All current work was moved, without discarding changes, from the uncommitted `main` workspace onto `codex/event-planning`. The branch was created at `14a89d56705f30251a0d2e3483ed44034edb83a8`, matching both local `main` and the remote `main` reference when checked. No production deployment was made for this layout change.
