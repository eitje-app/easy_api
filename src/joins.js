import {createSelector} from 'reselect'
import createCachedSelector from 're-reselect'
import _ from 'lodash'
import moment from 'moment'
import utils from '@eitje/utils'
import {findRecord, inverseFilterRecords, filterRecords, includesRecord, filterByDate} from './actions'
import {config} from './config'
import pluralize from 'pluralize'
import {filterRecord} from './actions'

export const joins = ({tableName, mergeTableName, ...rest}) => {
  tableName = pluralize.singular(tableName)
  mergeTableName = pluralize.singular(mergeTableName)
  const args = {...rest, tableName, mergeTableName}
  const fieldName = figureOutFieldName(args)

  if (!fieldName) return rest.items
  const isMultiple = checkMultiple(tableName, mergeTableName)
  const snakeTablename = utils.camelToSnake(tableName)
  const mergeItemLeading = fieldName.includes(snakeTablename)
  if (isMultiple) return extendMulti({...args, mergeItemLeading, fieldName})
  return extendSingular({...args, mergeItemLeading, fieldName})
}

export const checkMultiple = (tableName, joinTableName) => {
  tableName = pluralize.singular(tableName)
  joinTableName = pluralize.singular(joinTableName)
  const tableConfig = config.dbConfig?.[tableName]
  if (!tableConfig) return
  return tableConfig['hasMany'] && tableConfig['hasMany'].includes(joinTableName)
}

const figureOutFieldName = ({items = [], mergeItems = [], tableName, mergeTableName}) => {
  let fieldName
  const sample = items[0]
  const mergeSample = mergeItems[0]
  if (!sample || !mergeSample) return null
  fieldName = getFieldName(sample, mergeTableName)
  if (fieldName) return fieldName
  return getFieldName(mergeSample, tableName)
}

const getFieldName = (item, tableName) => {
  tableName = utils.camelToSnake(tableName)
  const singleField = `${tableName}_id`
  const multiField = `${tableName}_ids`
  return [singleField, multiField].find(f => item.hasOwnProperty(f))
}

const extendSingular = ({items, mergeTableName, mergeItems, mergeItemLeading, spread, fieldName}) => {
  // {team_id: env, team_id: env}
  const mergeItemsIndex = mergeItems.reduce((index, item) => {
    index[item.id] = item
    return index
  }, {})

  const res = items.map(item => {
    const relevantItem = mergeItemsIndex[item[fieldName]]
    const toAdd = spread ? relevantItem : {[mergeTableName]: relevantItem}
    return {...item, ...toAdd}
  })
  return res
}

const extendMulti = args => {
  const {items, mergeItemLeading, fieldName, mergeTableName, mergeItems} = args
  const res = mergeItemLeading ? extendMultiMergeLeading(args) : extendMultiMainLeading(args)
  return res
}

const extendMultiMainLeading = ({items, mergeItemLeading, fieldName, mergeTableName, mergeItems}) => {
  const mergeItemsIndex = mergeItems.reduce((index, item) => {
    index[item.id] = item
    return index
  }, {})

  const pluralName = pluralize.plural(mergeTableName)
  return items.map(i => {
    let relevantItems = i[fieldName]
    if (!relevantItems.map) relevantItems = []
    relevantItems = relevantItems.map(i2 => mergeItemsIndex[i2]).filter(Boolean)
    return {...i, [pluralName]: relevantItems}
  })
}

const extendMultiMergeLeading = ({items, fieldName, mergeItemLeading, mergeTableName, mergeItems}) => {
  const isMultiple = fieldName.endsWith('s')
  const mergeItemsIndex = mergeItems.reduce((index, item) => {
    const val = item[fieldName]
    if (isMultiple) {
      val.forEach(i => {
        if (!index[i]) index[i] = []
        index[i].push(item)
      })
    } else {
      if (!index[val]) index[val] = []
      index[val].push(item)
    }
    return index
  }, {})

  const pluralName = pluralize.plural(mergeTableName)

  return items.map(i => {
    const relevantItems = mergeItemsIndex[i.id] || []
    return {...i, [pluralName]: relevantItems}
  })
}

export default joins

// export const newExtendSelector = createCachedSelector(
//   all,
//   (state, tableName) => tableName,
//   (state, tableName, items) => items,
//   (state, tableName, items, opts = {}) => opts,
//   (mergeItems, tableName, items, opts) => newExtend(items, tableName, mergeItems, opts),
// )
