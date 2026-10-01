# Budget Allocations
A calm, practical budgeting app for planning monthly spending, assigning money to accounts, and keeping a clear view of your wider financial position.

**[Try Budget Allocations free →](https://budget-allocations.vercel.app/)**

## What you can do

- Build a monthly plan from income, essential expenses, and savings goals.
- Explore saved what-if budgets for moves, contracts, rental income, side hustles, or changes in spending.
- Compare a dated budget snapshot with projected income, spending, savings, and upfront costs.
- Work out total income needed or the contribution required from one income source.
- Assign budget items to current or savings accounts and view the resulting transfer plan.
- Track account balances, property, investments, pensions, and other assets.
- Record debts and see net worth calculated from your latest manual figures.
- Choose the currency used throughout the app.
- Start with a private seven-day guest workspace or create an account with email and password.
- Submit feedback from inside the app.

## What-if budgets

The What-if feature is implemented on the feature branch; it has not been deployed to production.

Open **What-if**, choose **New scenario**, then **Copy my budget** or **Start empty**. Enter monthly income after tax and business costs, adjust spending and savings, and set the money you want left each month.

If income is below target, **Income needed to meet your target** lets you choose which source should cover the shortfall. For example, a £5,000 total requirement with £750 from room rental means Primary Income needs £4,250. **Set Primary Income to £4,250** replaces that source's What-if amount; it does not add another £4,250. At or above target, no income change is suggested. You can still manually edit amounts to explore income loss or reduced working hours.

Edits update calculations immediately and autosave **six seconds after your last edit**. Use **Save changes** to save immediately. Successful saves show a toast; incomplete inputs and save failures stay visible. Internal navigation saves valid pending changes before leaving. If another tab changes the scenario, reload its saved version or save your edits separately.

Snapshots keep their original date and currency. Upfront costs are separate from monthly allocations, and scenarios never replace your actual budget. Guest scenarios expire with their seven-day workspace. Info icons explain the calculations on hover, keyboard focus or click.

See the [What-if user guide](./docs/user-guides/what-if-budgets.md) for calculations, save behaviour and limitations. Preserving the current tab and selected scenario on refresh is [planned](./docs/plans/feat-persistent-budget-navigation-plan.md), not yet implemented.

## Tech stack

- React and TypeScript
- Vite
- Convex for the database, backend functions, and authentication
- Convex Auth for password and anonymous sign-in

## Local development

### Prerequisites

- Node.js 18 or newer
- A Convex account and development deployment

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and add your deployment values:

   ```bash
   cp .env.example .env.local
   ```

   Keep `.env.local` private. It is excluded from version control.

3. Start the frontend and Convex development servers:

   ```bash
   npm run dev
   ```

   Or use the equivalent one-command shortcut:

   ```bash
   npm start
   ```

The Vite frontend runs alongside `convex dev`, which watches and updates backend functions as they change.

## Environment variables

`.env.example` lists the optional server-side values used by the app:

- `ADMIN_EMAILS` — comma-separated email addresses with access to the admin area.
- `RESEND_API_KEY` — enables password-reset emails through Resend.
- `AUTH_EMAIL_FROM` — verified sender address for password-reset emails.
- `APP_URL` — public app URL used by authentication-related flows.

Convex also needs the deployment variables used by the Vite client, including `VITE_CONVEX_URL` and `CONVEX_DEPLOYMENT`. These are normally supplied by the Convex CLI for the selected development deployment.

## Useful commands

```bash
npm run dev    # Start Vite and Convex in watch mode
npm test       # Run calculations, autosave, UI, and backend tests
npm run typecheck # Check frontend and backend TypeScript
npm run build  # Create a production frontend build
npm run lint   # Type-check, validate Convex, and build
```

For production deployment, follow the [Convex production documentation](https://docs.convex.dev/production/) and the [Vercel deployment documentation](https://vercel.com/docs/deployments).

## Project structure

```text
src/       React frontend and UI components
convex/    Database schema, queries, mutations, and authentication
public/    Static assets
```

## Documentation

- [Documentation index](./docs/README.md)
- [Changelog](./CHANGELOG.md)
- [What-if user guide](./docs/user-guides/what-if-budgets.md)
- [What-if implementation plan and verification](./docs/plans/feat-what-if-budget-scenarios-plan.md)
- [Navigation persistence plan](./docs/plans/feat-persistent-budget-navigation-plan.md)
- [Convex documentation](https://docs.convex.dev/)
- [Convex Auth documentation](https://labs.convex.dev/auth)
- [Vite documentation](https://vitejs.dev/)
