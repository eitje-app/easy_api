import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'
import createCachedSelector from 're-reselect'
import _ from 'lodash'
import moment from 'moment'
import utils from '@eitje/utils'
import {findRecord, inverseFilterRecords, filterRecords, includesRecord, filterByDate} from './actions'
import {config} from './config'
import pluralize from 'pluralize'
import joins, {checkMultiple} from './joins'

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
  if (!utils.intersects(Object.keys(opts), allowedOpts)) return null
  return opts
}

const getModel = (key) => {
  const model = config.models[key]
  return {model, defaultJoins: model?.defaultJoins}
}

const findRecords = (state, kind, opts = {}) => {
  const {model, defaultJoins} = getModel(kind)
  if (defaultJoins) {
    opts = {...opts, joins: utils.composeArray(opts.joins, defaultJoins)}
  }

  kind = sanitizeKind(kind)
  return sanitizeOpts(opts) ? state.records : state.records[kind]
}

export const all = createCachedSelector(
  findRecords,
  (state, key) => sanitizeKind(key),
  (state, key, opts) => sanitizeOpts(opts),
  (ents, key, opts) => _buildRecords(ents, key, opts),
)((ents, key, opts = {}) => {
  return `${key}-${JSON.stringify(opts)}`
})

const _buildRecords = (ents, key, opts) => {
  const records = ents && ents['deletedStamps'] ? ents : {[key]: ents} // deletedStamps is always present, tells us if we hae all ents or just a slice. This is needed for findRecords' performance
  return buildRecords(records, key, opts) || []
}

const buildRecords = (ents = {}, key, opts = {}) => {
  if (!_.isObject(opts)) opts = {}
  const {model, defaultJoins} = getModel(key)
  const joinKeys = utils.composeArray(opts.joins, defaultJoins)
  let final = enrichRecords(ents, key) || []

  joinKeys.forEach((k) => {
    final = joins({items: final, mergeItems: enrichRecords(ents, k), tableName: key, mergeTableName: k})
  })
  return config.createAssociation(final.map((i) => buildFullRecord(i, key, joinKeys)))
}

const buildFullRecord = (item, key, joinKeys) => {
  const record = buildClassRecord(item, key)
  joinKeys.forEach((joinKey) => {
    const isMultiple = checkMultiple(key, joinKey)
    const actualJoinKey = isMultiple ? pluralize.plural(joinKey) : pluralize.singular(joinKey)
    if (record[actualJoinKey]) {
      record[actualJoinKey] = isMultiple
        ? config.createAssociation(record[actualJoinKey].map((i) => buildClassRecord(i, actualJoinKey)))
        : buildClassRecord(record[actualJoinKey], actualJoinKey)
    }
  })

  return record
}

const buildClassRecord = (item, key) => {
  key = pluralize.plural(key)
  const {model} = getModel(key)
  return model ? new model(item) : item
}

const enrichRecords = (ents, key) => config.enrichRecords(ents, key) || ents[key]

const allExternal = (state, key, query, opts) => (opts ? all(state, key, opts) : all(state, key))

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

const createDeepEqualSelector = createSelectorCreator(defaultMemoize, _.isEqual)

export const where = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (state, key, query, opts) => opts || '',
  (records, key, query, opts) => {
    return (query ? filterRecords(records, query, opts) : records) || []
  },
)({keySelector: (state, key, query, opts) => `${key}-${JSON.stringify(query)}-${opts}`, selectorCreator: createDeepEqualSelector})

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
