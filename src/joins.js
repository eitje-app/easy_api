import _ from "lodash";
import utils from "@eitje/utils";
import { config } from "./config";
import pluralize from "pluralize";
import { filterRecord } from "./actions";

export const joins = ({ tableName, mergeTableName, ...rest }) => {
  tableName = pluralize.singular(tableName);
  mergeTableName = pluralize.singular(mergeTableName);
  const args = { ...rest, tableName, mergeTableName };
  const fieldName = figureOutFieldName(args);
  if (!fieldName) return rest.items;
  const isMultiple = checkMultiple(tableName, mergeTableName);
  const snakeTablename = utils.camelToSnake(tableName);
  const mergeItemLeading = fieldName.includes(snakeTablename);
  if (isMultiple) return extendMulti({ ...args, mergeItemLeading, fieldName });
  return extendSingular({ ...args, mergeItemLeading, fieldName });
};

export const joinsThrough = (args) => {
  const {
    mergeItems,
    nestedMergeItems,
    mergeTableName: _mergeTableName,
    nestedMergeTableName,
  } = args;
  const joinedItems = joins(args);

  const tableName = pluralize.singular(_mergeTableName);
  const mergeTableName = pluralize.singular(nestedMergeTableName);

  const fieldName = figureOutFieldName({
    items: mergeItems,
    mergeItems: nestedMergeItems,
    tableName,
    mergeTableName,
  });
  if (!fieldName) return joinedItems;
  const isMultiple = checkMultiple(tableName, mergeTableName);
  const snakeTablename = utils.camelToSnake(tableName);
  const mergeItemLeading = fieldName.includes(snakeTablename);
  const extendParams = {
    items: joinedItems,
    tableName,
    mergeTableName,
    mergeItems,
    nestedMergeItems,
    mergeItemLeading,
    fieldName,
  };

  if (isMultiple) return extendMultiThrough(extendParams);
  return extendSingularThrough(extendParams);
};

export const checkMultiple = (tableName, joinTableName) => {
  tableName = pluralize.singular(tableName);
  joinTableName = pluralize.singular(joinTableName);
  const tableConfig = config.dbConfig?.[tableName];
  if (!tableConfig) return;
  return (
    tableConfig["hasMany"] && tableConfig["hasMany"].includes(joinTableName)
  );
};

const figureOutFieldName = ({
  items = [],
  mergeItems = [],
  tableName,
  mergeTableName,
}) => {
  let fieldName;
  const sample = items[0];
  const mergeSample = mergeItems[0];

  if (!sample || !mergeSample) return null;
  fieldName = getFieldName(sample, mergeTableName);
  if (fieldName) return fieldName;
  return getFieldName(mergeSample, tableName);
};

const getFieldName = (item, tableName) => {
  tableName = utils.camelToSnake(tableName);
  const singleField = `${tableName}_id`;
  const multiField = `${tableName}_ids`;
  return [singleField, multiField].find((f) => item.hasOwnProperty(f));
};

const extendSingular = (args) => {
  const { items, mergeTableName, mergeItems, spread } = args;
  return items.map((i) => {
    const relevantItem = mergeItems.find((i2) => findItem(i, i2, args));
    const toAdd = spread ? relevantItem : { [mergeTableName]: relevantItem };
    return { ...i, ...toAdd };
  });
};

const extendSingularThrough = (args) => {
  const { items, mergeTableName, nestedMergeItems, tableName, spread } = args;
  return items.map((i) => {
    const mergedItem = i[tableName];
    const relevantItem = nestedMergeItems.find((i2) =>
      findItem(mergedItem, i2, args)
    );
    const toAdd = spread ? relevantItem : { [mergeTableName]: relevantItem };
    return { ...i, ...toAdd };
  });
};

const extendMulti = (args) => {
  const { items, mergeTableName, mergeItems } = args;
  const pluralName = pluralize.plural(mergeTableName);
  return items.map((i) => {
    const relevantItems = mergeItems.filter((i2) => findItem(i, i2, args));
    return { ...i, [pluralName]: relevantItems };
  });
};

const extendMultiThrough = (args) => {
  const { items, mergeTableName, nestedMergeItems, tableName } = args;
  const pluralTableName = pluralize.plural(tableName);
  const pluralName = pluralize.plural(mergeTableName);

  return items.map((i) => {
    const mergedItem = i[pluralTableName];
    const relevantItems = nestedMergeItems.filter((i2) =>
      findItem(mergedItem, i2, args, true)
    );
    return { ...i, [pluralName]: relevantItems };
  });
};

const findItem = (i, i2, { mergeItemLeading, fieldName }) => {
  const record = mergeItemLeading ? i2 : i;
  const otherRecord = mergeItemLeading ? i : i2;
  let recordField = record[fieldName];

  if (Array.isArray(record)) {
    const records = record.map((f) => f[fieldName]);
    recordField = [...new Set(records)].flat();
  }

  return filterRecord(otherRecord.id, recordField); // dit moet beter kunnen, eig filter je altijd mergeItems, alleen soms met query {id: 33} als !mergeItemLeading en anders {user_id: 33}
};

export default joins;

// export const newExtendSelector = createCachedSelector(
//   all,
//   (state, tableName) => tableName,
//   (state, tableName, items) => items,
//   (state, tableName, items, opts = {}) => opts,
//   (mergeItems, tableName, items, opts) => newExtend(items, tableName, mergeItems, opts),
// )
