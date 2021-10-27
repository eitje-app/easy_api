import _ from 'lodash'
import moment from 'moment'

export const includesRecord = (entities, query) => {
  return entities.filter((e) => {
    const keys = Object.keys(query) // [1,2,3,4]
    return keys.every((k) => query[k].some((id) => e[k] && e[k].includes(id)))
  })
}

export const filterByDate = (entities, {start, end}, {dateField = 'date'} = {}) => {
  return entities.filter((e) => {
    if (start && end) return e[dateField] >= start && e[dateField] <= end
    if (start) return e[dateField] >= start
    return e[dateField] <= end
  })
}

export const findRecord = (entities, query) => {
  return entities.find((e) => {
    if (!_.isObject(query)) return e.id == Number(query)
    const keys = Object.keys(query)
    return filterKeys(keys, query, e)
  })
}

export const filterRecords = (entities, query) => {
  return entities.filter((e) => {
    if (_.isArray(query)) return query.includes(e.id)
    if (_.isNumber(query)) return Number(query) == e.id
    const keys = Object.keys(query)
    return filterKeys(keys, query, e)
  })
}

export const inverseFilterRecords = (entities, query) => {
  return entities.filter((e) => {
    const keys = Object.keys(query)
    return !filterKeys(keys, query, e)
  })
}

const filterKeys = (keys, query, record) => {
  return keys.every((k) => {
    const queryVal = query[k]
    const recordVal = record[k]
    return filterRecord(queryVal, recordVal)
  })
}

const filterRecord = (queryVal, recordVal) => {
  const args = [queryVal, recordVal]
  queryVal = sanitizeVal(queryVal)
  recordVal = sanitizeVal(recordVal)
  if (hasArray(args)) return filterArrays(queryVal, recordVal)
  if (hasRange(args)) return filterRanges(queryVal, recordVal)
  return queryVal === recordVal
}

const hasRange = (arr) => arr.some((i) => isRange(i))
const isRange = (i) => _.isObject(i) && i.start && i.start instanceof moment
const hasArray = (arr) => arr.some((i) => _.isArray(i))

const filterRanges = (queryVal, recordVal) => {
  const args = [queryVal, recordVal]
  if (isRange(queryVal) && isRange(recordVal)) return queryVal.overlaps(recordVal)
  const stringVal = args.find((a) => _.isString(a)) // dates are always sent to us as strings
  const rangeVal = args.find((a) => isRange(a))
  return rangeVal.contains(moment(stringVal))
}

const sanitizeVal = (val) => {
  if (_.isString(val)) return sanitizeString(val)
  return val
}

const sanitizeString = (val) => {
  if (!isNaN(val)) return Number(val)
  return val
}

function filterArrays(arr1, arr2) {
  if (_.isArray(arr1) && _.isArray(arr2)) return _.intersection(arr1, arr2).length > 0
  if (_.isArray(arr1)) return arr1.includes(arr2)
  if (_.isArray(arr2)) return arr2.includes(arr1)
}

const numberOrString = (val) => _.isNumber(val) || _.isString(val)
