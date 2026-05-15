/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as tables_botEvents from "../tables/botEvents.js";
import type * as tables_entries from "../tables/entries.js";
import type * as tables_entryTags from "../tables/entryTags.js";
import type * as tables_flows from "../tables/flows.js";
import type * as tables_tags from "../tables/tags.js";
import type * as tables_users from "../tables/users.js";
import type * as tables_waitlist from "../tables/waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "tables/botEvents": typeof tables_botEvents;
  "tables/entries": typeof tables_entries;
  "tables/entryTags": typeof tables_entryTags;
  "tables/flows": typeof tables_flows;
  "tables/tags": typeof tables_tags;
  "tables/users": typeof tables_users;
  "tables/waitlist": typeof tables_waitlist;
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
