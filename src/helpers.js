import utils from '@eitje/utils'
import {config} from './config'
import _ from 'lodash'
import {deepTransformValues, sanitizeMoment} from './backend'

export const filterRelevant = (kind, items, extraParams = {}, cacheKind) => {
  items = items.filter((i) => i.fetchedKinds && i.fetchedKinds.includes(cacheKind))
  return config.filterStampItems ? config.filterStampItems(kind, items, extraParams) : items
}

export const getDelStamp = (kind) => {
  const state = config.store.getState()
  return state.records.deletedStamps?.[kind]
}

export const getActionVersion = (kind) => {
  const state = config.store.getState()
  return state.records.actionVersions?.[kind]
}

export const makeCacheKind = (kind, filters) => {
  if (!utils.exists(filters)) return kind
  const sanitizedFilters = deepTransformValues(filters, sanitizeMoment)
  const sortedStringified = JSON.stringify(sanitizedFilters, Object.keys(filters).sort()) // we sort to ensure order of keys doesn't matter
  return `${kind}-${sortedStringified}`
}

export const newGetStamps = ({name, inverted, cacheName}) => {
  const customStampField = config.stampFields[name]
  let obj = {}
  const state = config.store.getState()
  const allItems = state.records[name]
  if (!utils.exists(allItems)) return {}
  let items = allItems.filter((i) => i.fetchedKinds && i.fetchedKinds.includes(cacheName))
  obj['lastUpdatedStamp'] = findStamp(items, 'updated_at', inverted)

  if (customStampField) {
    obj['lastCreatedStamp'] = findStamp(items, customStampField, inverted)
  }

  return {stamps: obj, currentItems: items, allItems}
}

export const getStamps = (kind, localKind, extraParams, inverted, cacheKind) => {
  const customStampField = config.stampFields[kind]
  let obj = {}
  const state = config.store.getState()
  const allItems = state.records[localKind]
  if (!allItems || allItems.length === 0) return {}
  let items = filterRelevant(kind, allItems, extraParams, cacheKind)
  obj['lastUpdatedStamp'] = findStamp(items, 'updated_at', inverted)

  if (customStampField) {
    obj['lastCreatedStamp'] = findStamp(items, customStampField, inverted)
  }

  return {stamps: obj, currentItems: items, allItems}
}

const findStamp = (items, field, inverted = false) => {
  const func = inverted ? 'getMin' : 'getMax'
  const item = utils[func](items, field)
  return item ? item[field] : null
}

export const newAfterIndex = ({cacheName, items = []}) => {
  if (!items || !_.isArray(items)) return []
  items = items.map((i) => ({...i, fetchedKinds: _.uniq([...(i.fetchedKinds || []), cacheName])}))
  return items
}

export const afterIndex = (kind, items = [], {localKind}) => {
  if (!items || !_.isArray(items)) return []
  items = items.map((i) => ({...i, fetchedKinds: _.uniq([...(i.fetchedKinds || []), localKind])}))

  return config.afterIndex ? config.afterIndex(kind, items, {localKind}) : items
}
