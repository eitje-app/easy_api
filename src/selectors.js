import { createSelector } from 'reselect'
import createCachedSelector from 're-reselect'
import _ from 'lodash'
import moment from 'moment'
import utils from '@eitje/utils'
import {findRecord, inverseFilterRecord, filterRecord, includesRecord, filterByDate} from './actions'
import {config} from './config'
import pluralize from 'pluralize'

const authUserSelector = state => state.auth.user
const usersSelector = state => state.records.users


export const all = createCachedSelector(
  state => state.records,
  (state, key) => pluralize(key),
  (ents, key) => config.enrichRecords(ents, key) || ents[key] || []
)(
  (ents, key) => key
)


export const selfSelector = createSelector(
    authUserSelector,
    usersSelector,
    (user, users = []) => users.find(u => u.id === user.id) || user
  )

export const lastUpdated = createCachedSelector(
  all,
  (state, kind) => kind,
  (state, kind, params) => params,
  (items, kind, params) => {
    const filtered = filterRecord(items, params)
    return utils.getMax(filtered)?.updated_at
  }
  )(
  (state, kind, params = {}) => `${kind}-${JSON.stringify(params)}`
  ) 

export const find = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => findRecord(records, query) || {}
)(
  (state, key, query) => `${key}-${JSON.stringify(query)}`
)


export const includes = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => includesRecord(records, query) || []
)(
  (state, key, query) => `${key}-${JSON.stringify(query)}`
)


export const where = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => filterRecord(records, query) || []
)(
  (state, key, query) => `${key}-${JSON.stringify(query)}`
)

export const whereNot = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => inverseFilterRecord(records, query) || []
)(
  (state, key, query) => `${key}-${JSON.stringify(query)}`
)

export const betweenDays = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => filterByDate(records, query)
)(
  (state, key, query) => `${key}-${JSON.stringify(query)}`
)

export const afterToday = createCachedSelector(
  all,
  (state, key) => key,
  (records) => filterByDate(records, {start: moment().format("YYYY-MM-DD")})
)(
  (state, key) => key
)




