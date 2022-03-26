import {createSelector} from 'reselect'
import createCachedSelector from 're-reselect'
import _ from 'lodash'
import moment from 'moment'
import utils from '@eitje/utils'
import {findRecord, inverseFilterRecords, filterRecords, includesRecord, filterByDate} from './actions'
import {config} from './config'
import pluralize from 'pluralize'
import {filterRecord} from './actions'

const dbConfig = {
  user: {
    hasMany: ['userEmploymentType', 'workSchedule', 'contractHolder'],
  },
  outreach: {
    hasMany: ['campaigns'],
  },
}

export const joins = ({tableName, mergeTableName, ...rest}) => {
  tableName = pluralize.singular(tableName)
  mergeTableName = pluralize.singular(mergeTableName)
  const args = {...rest, tableName, mergeTableName}
  const fieldName = figureOutFieldName(args)
  if (!fieldName) return rest.items
  const isMultiple = checkMultiple(tableName, mergeTableName)
  const mergeItemLeading = fieldName.includes(tableName)

  if (isMultiple) return extendMulti({...args, mergeItemLeading, fieldName})
  return extendSingular({...args, mergeItemLeading, fieldName})
}

const checkMultiple = (tableName, joinTableName) => {
  const tableConfig = dbConfig[tableName]
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
  return [singleField, multiField].find((f) => item[f])
}

const extendSingular = (args) => {
  const {items, mergeTableName, mergeItems, mergeItemLeading, spread} = args
  return items.map((i) => {
    const relevantItem = mergeItems.find((i2) => findItem(i, i2, args))
    const toAdd = spread ? relevantItem : {[mergeTableName]: relevantItem}
    return {...i, ...toAdd}
  })
}

const findItem = (i, i2, {mergeItemLeading, fieldName}) => {
  const record = mergeItemLeading ? i2 : i
  const otherRecord = mergeItemLeading ? i : i2
  return filterRecord(otherRecord.id, record[fieldName]) // dit moet beter kunnen, eig filter je altijd mergeItems, alleen soms met query {id: 33} als !mergeItemLeading en anders {user_id: 33}
}

const extendMulti = (args) => {
  const {items, mergeItemLeading, mergeTableName, mergeItems} = args
  const pluralName = pluralize.plural(mergeTableName)
  return items.map((i) => {
    const relevantItems = mergeItems.filter((i2) => findItem(i, i2, args))
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
