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
  let {
    tableName,
    mergeItems,
    nestedMergeItems,
    mergeTableName,
    nestedMergeTableName,
  } = args;
  const joinedItems = joins(args);

  mergeTableName = pluralize.singular(mergeTableName);
  nestedMergeTableName = pluralize.singular(nestedMergeTableName);

  const fieldName = figureOutFieldName({
    items: mergeItems,
    mergeItems: nestedMergeItems,
    tableName: mergeTableName,
    mergeTableName: nestedMergeTableName,
  });
  if (!fieldName) return joinedItems;
  const isBaseMultiple = checkMultiple(tableName, mergeTableName);
  const isMultiple = checkMultiple(mergeTableName, nestedMergeTableName);
  const snakeTablename = utils.camelToSnake(mergeTableName);
  const mergeItemLeading = fieldName.includes(snakeTablename);

  const extendParams = {
    items: joinedItems,
    tableName: mergeTableName,
    mergeTableName: nestedMergeTableName,
    mergeItems: nestedMergeItems,
    isBaseMultiple,
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
  return items.map((item) => {
    const relevantItem = mergeItems.find((mergeItem) =>
      findItem(item, mergeItem, args)
    );
    const toAdd = spread ? relevantItem : { [mergeTableName]: relevantItem };
    return { ...item, ...toAdd };
  });
};

const extendMulti = (args) => {
  let { items, mergeTableName, mergeItems } = args;
  mergeTableName = pluralize.plural(mergeTableName);
  return items.map((item) => {
    const relevantItems = mergeItems.filter((mergeItem) =>
      findItem(item, mergeItem, args)
    );
    return { ...item, [mergeTableName]: relevantItems };
  });
};

const findItem = (item, mergeItem, { mergeItemLeading, fieldName }) => {
  const record = mergeItemLeading ? mergeItem : item;
  const otherRecord = mergeItemLeading ? item : mergeItem;
  let recordField = record[fieldName];

  return filterRecord(otherRecord.id, recordField);
};

const extendSingularThrough = (args) => {
  const { items, mergeTableName, tableName, mergeItems, spread } = args;
  return items.map((i) => {
    const item = i[tableName];
    const relevantItem = mergeItems.find((mergeItem) =>
      findItemThrough(item, mergeItem, args)
    );
    const toAdd = spread ? relevantItem : { [mergeTableName]: relevantItem };
    return { ...i, ...toAdd };
  });
};

const extendMultiThrough = (args) => {
  let { items, mergeTableName, mergeItems, tableName, isBaseMultiple } = args;
  tableName = isBaseMultiple ? pluralize.plural(tableName) : tableName;
  mergeTableName = pluralize.plural(mergeTableName);

  return items.map((i) => {
    const item = i[tableName];
    const relevantItems = mergeItems.filter((mergeItem) =>
      findItemThrough(item, mergeItem, args)
    );
    return { ...i, [mergeTableName]: relevantItems };
  });
};

const findItemThrough = (item, mergeItem, { mergeItemLeading, fieldName }) => {
  const record = mergeItemLeading ? mergeItem : item;
  const otherRecord = mergeItemLeading ? item : mergeItem;

  let recordField = record[fieldName];
  let otherField = otherRecord.id;

  if (Array.isArray(record) && !mergeItemLeading) {
    const records = record.map((f) => f[fieldName]);
    recordField = _.uniq(records.flat());
  }
  if (Array.isArray(otherRecord) && mergeItemLeading) {
    const records = otherRecord.map((f) => f.id);
    otherField = _.uniq(records.flat());
  }
  return filterRecord(otherField, recordField, {}, true);
};

export default joins;

// export const newExtendSelector = createCachedSelector(
//   all,
//   (state, tableName) => tableName,
//   (state, tableName, items) => items,
//   (state, tableName, items, opts = {}) => opts,
//   (mergeItems, tableName, items, opts) => newExtend(items, tableName, mergeItems, opts),
// )
