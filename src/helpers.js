import utils from '@eitje/utils'
import {config} from './config'
import _ from 'lodash'


export const filterRelevant = (kind, items, extraParams = {}) => {
  items = items.filter(i => i.indexed && i.fetchedKinds && i.fetchedKinds.includes(kind))
  return config.filterStampItems ? config.filterStampItems(kind, items, extraParams) : items
}

export const getDelStamp = kind => {
  const state = config.store.getState()
  return state.records.deletedStamps[kind]
}

export const getStamp = (kind, localKind, extraParams, inverted) => {
  const func = inverted ? 'getMin' : 'getMax'
  const state = config.store.getState()
  const field = config.stampFields[kind] || 'updated_at'
  let items = state.records[localKind]
  if(!items || items.length === 0) return;
  items = filterRelevant(kind, items.filter(i => i.indexed), extraParams)
  const item = utils[func](items, field)
  return item ? item[field] : null
}

export const getStamps = (kind, localKind, extraParams, inverted) => {
  const customStampField = config.stampFields[kind]
  let obj = {}
  const state = config.store.getState()
  let items = state.records[localKind]
  if(!items || items.length === 0) return {};
  items = filterRelevant(kind, items, extraParams)
  obj["lastUpdatedStamp"] = findStamp(items, 'updated_at', inverted)
  
  if(customStampField) {
    obj['lastCreatedStamp'] = findStamp(items, customStampField, inverted)
  }
  
  return obj;
  
}

const findStamp = (items, field, inverted = false) => {
  const func = inverted ? 'getMin' : 'getMax'
  const item = utils[func](items, field)
  return item ? item[field] : null
}

// {updatedStamp: .., createdStamp: ..}

export const afterIndex = (kind, items = [], {localKind}) => {
  const state = config.store.getState();
  if(!items || !_.isArray(items)) return [];

  items = items.map(i => ({...i, fetchedKinds: [...(i.fetchedKinds || []), localKind] }))

  return config.afterIndex ? config.afterIndex(kind, items, {localKind}) : items

}

