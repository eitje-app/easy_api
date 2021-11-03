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

// 217 > 101
// ({[key]: records[key]}): 217
// _.pick(records, 'key'): 217
// records[key]: 41
// state.records: 101

const allowedOpts = ['joins']

const sanitizeOpts = (opts) => {
  if (!_.isObject(opts)) return null
  if (!utils.intersects(opts, allowedOpts)) return null
  return opts
}

export const all = createCachedSelector(
  (state, key, opts) => (sanitizeOpts(opts) ? state.records : state.records[key]),
  (state, key) => sanitizeKind(key), // In the current setup, we could just accept an array!
  (state, key, opts) => sanitizeOpts(opts),
  (ents, key, opts) => buildRecords(opts ? ents : {[key]: ents}, key, opts) || [],
)((ents, key, opts = {}) => {
  return `${key}-${JSON.stringify(opts)}`
})

const buildRecords = (ents = {}, key, opts = {}) => {
  if (!_.isObject(opts)) opts = {}
  const joinKeys = utils.alwaysDefinedArray(opts.joins)
  let final = enrichRecords(ents, key)
  joinKeys.forEach((k) => {
    final = joins({items: final, mergeItems: enrichRecords(ents, k), tableName: key, mergeTableName: k})
  })
  return final
}

const enrichRecords = (ents, key) => config.enrichRecords(ents, key) || ents[key]

const allExternal = (state, key) => all(state, key)

export const selfSelector = createSelector(
  authUserSelector,
  (state) => all(state, 'users'),
  (user, users = []) => users.find((u) => u.id === user.id) || user,
)

export const find = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => findRecord(records, query) || {},
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const includes = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => includesRecord(records, query) || [],
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const where = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => (query ? filterRecords(records, query) : records) || [],
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const whereNot = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => inverseFilterRecords(records, query) || [],
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const betweenDays = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => filterByDate(records, query),
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

export const afterToday = createCachedSelector(
  allExternal,
  (state, key) => key,
  (records) => filterByDate(records, {start: moment().format('YYYY-MM-DD')}),
)((state, key) => key)
