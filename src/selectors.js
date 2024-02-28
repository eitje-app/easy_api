import {
  createSelector,
  createSelectorCreator,
  defaultMemoize,
} from "reselect";
import createCachedSelector from "re-reselect";
import _ from "lodash";
import moment from "moment";
import utils from "@eitje/utils";
import {
  findRecord,
  inverseFilterRecords,
  filterRecords,
  includesRecord,
  filterByDate,
} from "./actions";
import { config } from "./config";
import pluralize from "pluralize";
import joins, { checkMultiple } from "./joins";

const sanitizeKind = (kind) => pluralize(utils.snakeToCamel(kind));

const authUserSelector = (state) => state.auth.user;
const usersSelector = (state) => state.records.users;
const createDeepEqualSelector = createSelectorCreator(
  defaultMemoize,
  _.isEqual
);

const allowedOpts = ["joins"];

const sanitizeOpts = (opts) => {
  if (!_.isObject(opts)) return null;
  if (!utils.intersects(Object.keys(opts), allowedOpts)) return null;
  return opts;
};

const getModel = (key) => {
  const model = config.models[key];
  return { model, defaultJoins: model?.defaultJoins };
};

const flattenJoins = (joins) => {
  let result = [];

  function traverse(current) {
    if (_.isString(current)) {
      result.push(current);
    } else if (Array.isArray(current) || _.isPlainObject(current)) {
      _.forEach(current, (value, key) => {
        if (_.isPlainObject(current)) result.push(key);
        traverse(value);
      });
    }
  }

  traverse(joins);

  return _.uniq(result);
};

const findRecords = (state, kind, opts = {}) => {
  kind = sanitizeKind(kind);
  const { model, defaultJoins } = getModel(kind);
  if (!opts) opts = {};
  if (defaultJoins) {
    opts = { ...opts, joins: utils.composeArray(opts.joins, defaultJoins) };
  }

  if (utils.exists(opts.joins)) {
    const joins = flattenJoins(opts.joins);
    return _.pick(state.records, [kind, ...joins]);
  }

  return state.records[kind];
};

export const all = createCachedSelector(
  findRecords,
  (state, key) => sanitizeKind(key),
  (state, key, opts) => sanitizeOpts(opts),
  (ents, key, opts) => _buildRecords(ents, key, opts)
)({
  keySelector: (state, key, opts = {}) => `${key}-${JSON.stringify(opts)}`,
  selectorCreator: createDeepEqualSelector,
});

const _buildRecords = (ents, key, opts) => {
  const records = ents && _.isPlainObject(ents) ? ents : { [key]: ents };
  const finalRecords = buildRecords(records, key, opts) || [];

  return finalRecords;
};

const makeNestedJoins = ({ children, records, allRecords }) => {
  return children.reduce((acc, child) => {
    const parentRecords = acc.length ? acc : records;
    const childRecords = enrichRecords(allRecords, child.key);
    return joins({
      items: parentRecords,
      mergeItems: childRecords,
      tableName: child.parent,
      mergeTableName: child.key,
    });
  }, []);
};

const buildNestedFullRecords = ({ joinKey, children, nestedJoins }) => {
  return nestedJoins.map((record) =>
    buildFullRecord(
      record,
      joinKey,
      children.map((c) => c.key)
    )
  );
};

const defaultArr = [];

const joinsMapper = ({ joinKeys, allRecords, key }) => {
  let finalRecords = enrichRecords(allRecords, key) || defaultArr;

  joinKeys.forEach(({ key: joinKey, children }) => {
    const records = enrichRecords(allRecords, joinKey);
    const nestedJoins = makeNestedJoins({ children, records, allRecords });
    const fullRecords = buildNestedFullRecords({
      joinKey,
      children,
      nestedJoins,
    });

    const hasJoinsThrough = fullRecords.length;

    finalRecords = joins({
      items: finalRecords,
      mergeItems: hasJoinsThrough
        ? fullRecords
        : enrichRecords(allRecords, joinKey),
      tableName: key,
      mergeTableName: joinKey,
    });
  });

  return finalRecords;
};

const buildRecords = (allRecords = {}, key, opts = {}) => {
  opts = _.isObject(opts) ? opts : {};
  const { defaultJoins = [] } = getModel(key) || {};
  const joinsArray = utils.composeArray(defaultJoins, opts.joins);
  const joinKeys = buildNestedStructure(joinsArray, key);
  const finalRecords = joinsMapper({ joinKeys, allRecords, key });

  const associatedRecords = config.createAssociation(
    finalRecords.map((record) =>
      buildFullRecord(
        record,
        key,
        joinKeys.map(({ key }) => key)
      )
    )
  );

  return associatedRecords;
};

function buildNestedStructure(input, parentKey = null) {
  let nodes = [];

  if (_.isString(input)) {
    return [{ key: input, parent: parentKey, children: [] }];
  } else if (_.isArray(input)) {
    input.forEach((item) => {
      nodes = nodes.concat(buildNestedStructure(item, parentKey));
    });
  } else if (_.isObject(input)) {
    _.forOwn(input, (value, key) => {
      const children = buildNestedStructure(value, key);
      const node = {
        key,
        parent: parentKey,
        children,
      };
      nodes.push(node);
    });
  }

  return nodes;
}

const buildFullRecord = (item, key, joinKeys) => {
  const record = buildClassRecord(item, key);
  joinKeys.forEach((joinKey) => {
    const isMultiple = checkMultiple(key, joinKey);
    const actualJoinKey = isMultiple
      ? pluralize.plural(joinKey)
      : pluralize.singular(joinKey);
    if (record[actualJoinKey]) {
      record[actualJoinKey] = isMultiple
        ? config.createAssociation(
            record[actualJoinKey].map((i) => buildClassRecord(i, actualJoinKey))
          )
        : buildClassRecord(record[actualJoinKey], actualJoinKey);
    }
  });

  return record;
};

const buildClassRecord = (item, key) => {
  key = pluralize.plural(key);
  const { model } = getModel(key);
  return model ? new model(item) : item;
};

const enrichRecords = (ents, key) => {
  const val = config.enrichRecords(ents, key) || ents[key];
  return val;
};

const allExternal = (state, key, query, opts) =>
  utils.exists(opts) ? all(state, key, opts) : all(state, key);

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
