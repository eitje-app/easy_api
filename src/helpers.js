import utils from '@eitje/utils'
import {config} from './config'
import _ from 'lodash'

const {store, stampFields, filterStampItems} = config
const after = config.afterIndex

export const filterRelevant = (kind, items, extraParams = {}) => {
  items = items.filter(i => i.fetchedKinds && i.fetchedKinds.includes(kind))
  return filterStampItems ? filterStampItems(kind, items, extraParams) : items
}

export const getDelStamp = kind => {
  const state = store.getState()
  return state.newEntities.deletedStamps[kind]
}

export const getStamp = (kind, localKind, extraParams, inverted) => {
  const func = inverted ? 'getMin' : 'getMax'
  const state = store.getState()
  const field = stampFields[kind] || 'updated_at'
  let items = state.newEntities[localKind]
  if(!items || items.length === 0) return;
  items = filterRelevant(kind, items.filter(i => i.indexed), extraParams, state.auth.user.id)
  const item = utils[func](items, field)
  return item ? item[field] : null
}

export const afterIndex = (kind, items = [], {laocalKind}) => {
  const state = store.getState();
  if(!items || !_.isArray(items)) return [];
  items = items.map(i => ({...i, fetchedKinds: [...(i.fetchedKinds || []), localKind] }))
  return after ? after(kind, items, {localKind}) : items

}

