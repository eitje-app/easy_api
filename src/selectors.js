import {createSelector} from 'reselect'
import createCachedSelector from 're-reselect'
import _ from 'lodash'
import moment from 'moment'
import utils from '@eitje/utils'
import {findRecord, inverseFilterRecords, filterRecords, includesRecord, filterByDate} from './actions'
import {config} from './config'
import pluralize from 'pluralize'
import joins from './joins'

const sanitizeKind = (kind) => pluralize(utils.snakeToCamel(kind))

const authUserSelector = (state) => state.auth.user
const usersSelector = (state) => state.records.users

export const all = createCachedSelector(
  (state, key, opts = {}) => findRelevantRecords(state.records, sanitizeKind(key), opts),
  (state, key) => sanitizeKind(key),
  (state, key, opts) => opts,
  (ents, key, opts) => buildRecords(ents, key, opts) || [],
)((ents, key, opts = {}) => `${key}-${JSON.stringify(opts)}`)

const buildRecords = (ents = {}, key) => {
  let final = enrichRecords(ents, key)
  const keys = Object.keys(ents).filter((k) => k != key)
  keys.forEach((k) => {
    final = joins({items: final, mergeItems: enrichRecords(ents, k), tableName: key, mergeTableName: k})
  })

  return final
}

const enrichRecords = (ents, key) => config.enrichRecords(ents, key) || ents[key]

const findRelevantRecords = (allRecords, key, {joins = []}) => {
  joins = utils.alwaysDefinedArray(joins)
  return _.pick(allRecords, [key, ...joins])
}

export const selfSelector = createSelector(
  authUserSelector,
  (state) => all(state, 'users'),
  (user, users = []) => users.find((u) => u.id === user.id) || user,
)

export const find = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => findRecord(records, query) || {},
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const includes = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => includesRecord(records, query) || [],
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const where = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => (query ? filterRecords(records, query) : records) || [],
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const whereNot = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => inverseFilterRecords(records, query) || [],
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const betweenDays = createCachedSelector(
  all,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => filterByDate(records, query),
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const afterToday = createCachedSelector(
  all,
  (state, key) => key,
  (records) => filterByDate(records, {start: moment().format('YYYY-MM-DD')}),
)((state, key) => key)
