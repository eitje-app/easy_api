import utils from '@eitje/utils'
import {config} from './config'
import _ from 'lodash'

export const filterRelevant = (kind, items, extraParams = {}, cacheKind) => {
  items = items.filter((i) => i.fetchedKinds && i.fetchedKinds.includes(cacheKind))
  return config.filterStampItems ? config.filterStampItems(kind, items, extraParams) : items
}

export const getDelStamp = (kind) => {
  const state = config.store.getState()
  return state.records.deletedStamps[kind]
}

export const getStamps = (kind, localKind, extraParams, inverted, cacheKind) => {
  const customStampField = config.stampFields[kind]
  let obj = {}
  const state = config.store.getState()
  let items = state.records[localKind]
  if (!items || items.length === 0) return {}
  items = filterRelevant(kind, items, extraParams, cacheKind)
  obj['lastUpdatedStamp'] = findStamp(items, 'updated_at', inverted)

  if (customStampField) {
    obj['lastCreatedStamp'] = findStamp(items, customStampField, inverted)
  }

  return {stamps: obj, currentItems: items}
}

const findStamp = (items, field, inverted = false) => {
  const func = inverted ? 'getMin' : 'getMax'
  const item = utils[func](items, field)
  return item ? item[field] : null
}

export const afterIndex = (kind, items = [], {localKind}) => {
  if (!items || !_.isArray(items)) return []
  items = items.map((i) => ({...i, fetchedKinds: _.uniq([...(i.fetchedKinds || []), localKind])}))

  return config.afterIndex ? config.afterIndex(kind, items, {localKind}) : items
}
