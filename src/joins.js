import {createSelector} from 'reselect'
import createCachedSelector from 're-reselect'
import _ from 'lodash'
import moment from 'moment'
import utils from '@eitje/utils'
import {findRecord, inverseFilterRecords, filterRecords, includesRecord, filterByDate} from './actions'
import {config} from './config'
import pluralize from 'pluralize'
import {filterRecord} from './actions'

const secsElapsed = (startTime) => {
  const endTime = performance.now()
  const elapsedTimeInSeconds = (endTime - startTime) / 1000
  return elapsedTimeInSeconds
}

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
  return [singleField, multiField].find((f) => item.hasOwnProperty(f))
}

const extendSingular = (args) => {
  const {items, mergeTableName, fieldName, mergeItems, mergeItemLeading, spread} = args
  return items.map((i) => {
    const relevantItem = mergeItems.find((i2) => findItem(i, i2, args))
    const toAdd = spread ? relevantItem : {[mergeTableName]: relevantItem}
    return {...i, ...toAdd}
  })
}

// const extendSingular = ({items, mergeTableName, mergeItems, mergeItemLeading, spread, fieldName}) => {
//   const map = {}

//   if (mergeItemLeading) {
//     mergeItems.forEach((mergeItem) => {
//       if (Array.isArray(mergeItem[fieldName])) {
//         mergeItem[fieldName].forEach((id) => {
//           if (!map[id]) {
//             map[id] = mergeItem
//           }
//         })
//       } else if (!map[mergeItem[fieldName]]) {
//         map[mergeItem[fieldName]] = mergeItem
//       }
//     })
//   } else {
//     items.forEach((item) => {
//       if (!map[item[fieldName]]) {
//         map[item[fieldName]] = item
//       }
//     })
//   }

//   const res = items.map((item) => {
//     const relevantItem = map[item.id]
//     const toAdd = spread ? relevantItem : {[mergeTableName]: relevantItem}
//     return {...item, ...toAdd}
//   })
//   debugger
//   return res
// }

// window.findItemSecs = 0
window.findItemCalls = 0

const findItem = (i, i2, {mergeItemLeading, fieldName}) => {
  // const startTime = performance.now()
  window.findItemCalls += 1
  const record = mergeItemLeading ? i2 : i
  const otherRecord = mergeItemLeading ? i : i2
  const res = filterRecord(otherRecord.id, record[fieldName]) // dit moet beter kunnen, eig filter je altijd mergeItems, alleen soms met query {id: 33} als !mergeItemLeading en anders {user_id: 33}
  // window.findItemSecs += secsElapsed(startTime)
  return res
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
