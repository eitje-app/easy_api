import {
  createSelector,
  createSelectorCreator,
  defaultMemoize,
} from "reselect";
import createCachedSelector from "re-reselect";
import moment from "moment";
import _ from "lodash";
import {
  findRecord,
  inverseFilterRecords,
  filterRecords,
  includesRecord,
  filterByDate,
} from "./actions";
import { all, allExternal } from "./all_selector";

const authUserSelector = (state) => state.auth.user;

const createDeepEqualSelector = createSelectorCreator(
  defaultMemoize,
  _.isEqual
);

export const selfSelector = createSelector(
  authUserSelector,
  (state) => all(state, "users"),
  (user, users = []) => users.find((u) => u.id === user.id) || user
);

export const find = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => findRecord(records, query) || {}
)({
  keySelector: (state, key, query) => `${key}-${JSON.stringify(query)}`,
  selectorCreator: createDeepEqualSelector,
});

export const includes = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => includesRecord(records, query) || []
)((state, key, query) => `${key}-${JSON.stringify(query)}`);

export const where = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (state, key, query, opts) => opts || "",
  (records, key, query, opts) => {
    const val = query ? filterRecords(records, query, opts) : records || [];
    return val;
  }
)({
  keySelector: (state, key, query, opts) =>
    `${key}-${JSON.stringify(query)}-${opts}`,
  selectorCreator: createDeepEqualSelector,
});

export const whereNot = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => inverseFilterRecords(records, query) || []
)((state, key, query) => `${key}-${JSON.stringify(query)}`);

export const betweenDays = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => filterByDate(records, query)
)((state, key, query) => `${key}-${JSON.stringify(query)}`);

export const afterToday = createCachedSelector(
  allExternal,
  (state, key) => key,
  (records) => filterByDate(records, { start: moment().format("YYYY-MM-DD") })
)((state, key) => key);
