/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as budget from "../budget.js";
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as lib_admin from "../lib/admin.js";
import type * as router from "../router.js";
import type * as scenarioValidators from "../scenarioValidators.js";
import type * as scenarios from "../scenarios.js";
import type * as settings from "../settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  admin: typeof admin;
  auth: typeof auth;
  budget: typeof budget;
  cleanup: typeof cleanup;
  crons: typeof crons;
  feedback: typeof feedback;
  http: typeof http;
  "lib/admin": typeof lib_admin;
  router: typeof router;
  scenarioValidators: typeof scenarioValidators;
  scenarios: typeof scenarios;
  settings: typeof settings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
