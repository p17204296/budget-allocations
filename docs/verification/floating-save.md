# Floating save verification

Verified on 26 October 2026 using the local frontend and temporary guest data on the existing development Convex deployment. No backend changes or production deployment were needed for this change.

## Checks

- Application and Convex type checks: passed.
- Explicit strict TypeScript check of `tests/floatingSave.test.tsx`: passed.
- Full suite: 81 tests passed, including six new floating-save tests.
- Production build: passed; Vite retains its large-bundle advisory (main JavaScript approximately 533 kB before gzip).

New tests cover appearance after edits, focus preservation, form submission, disappearance after success or reverting, native validation, independent pending forms, selecting the most recently edited form, current callback usage, disabled saving actions, retry, cleanup, and visual-viewport handling for keyboards versus small resizes and pinch zoom.

## Browser verification

Real development-backend flows were exercised in headless desktop Google Chrome through Playwright.

- Screenshots and geometry checks at 320×568, 375×812, 390×844, 430×932, 768×1024, 1024×768, and 1440×900.
- Navigation transition checked at 899px, 900px, and 901px.
- Floating prompt remained within each viewport while scrolled down, with no horizontal page overflow. At mobile navigation sizes, its bottom edge stayed above the navigation.
- Found and fixed a transition issue: small transient visual-viewport reductions could apply an inline bottom offset intended for a keyboard. Only substantial unzoomed reductions now lift the prompt.
- Event: floating creation and save, invalid-field review, and disappearance after automatic saving.
- Monthly what-if: floating creation and saving after editing monthly income.
- Income: saved an edited income amount from the floating prompt.
- Money: created an account, an asset using conditional custom-type fields, and a debt from the floating prompt.
- Overview: edited an expense and savings goal simultaneously; saving the latest draft left the other pending and then saved it independently.
- Settings: saved a changed display currency from the floating prompt.

No runtime page errors occurred in the completed flows. Account credential changes were not submitted in browser testing; they use the tested native-form submission component. Keyboard lifting is covered by a simulated visual viewport in component tests. Physical mobile keyboards, physical device safe areas, and other browsers remain unverified.
