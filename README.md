# Budget Allocation Planner App
  
This is a personal budgeting application built with [Convex](https://convex.dev) and [Vite](https://vitejs.dev/).

## Try it free

Budget Allocations is live and free to use. Create your budget, organise accounts, and see every allocation in one clear place — no download or payment required.

**[Open the free live app →](https://budget-allocations.vercel.app/)**

Create a local `.env.local` file with your own Convex deployment settings before running the app. This file is intentionally excluded from version control.
  
## Project structure
  
The frontend code is in the `src` directory and is built with [Vite](https://vitejs.dev/).
  
The backend code is in the `convex` directory.
  
`npm run dev` will start the frontend and backend servers.

Run `npm start` to use the same one-command local development workflow.

## App authentication

The app uses [Convex Auth](https://auth.convex.dev/) with Anonymous auth for easy sign in. You may wish to change this before deploying your app.

## Developing and deploying your app

Check out the [Convex docs](https://docs.convex.dev/) for more information on how to develop with Convex.
* If you're new to Convex, the [Overview](https://docs.convex.dev/understanding/) is a good place to start
* Check out the [Hosting and Deployment](https://docs.convex.dev/production/) docs for how to deploy your app
* Read the [Best Practices](https://docs.convex.dev/understanding/best-practices/) guide for tips on how to improve you app further

## HTTP API

User-defined http routes are defined in the `convex/router.ts` file. We split these routes into a separate file from `convex/http.ts` to allow us to prevent the LLM from modifying the authentication routes.
