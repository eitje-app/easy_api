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
const createDeepEqualSelector = createSelectorCreator(defaultMemoize, _.isEqual)

// 217 > 101
// ({[key]: records[key]}): 217
// _.pick(records, 'key'): 217
// records[key]: 41
// state.records: 101

const allowedOpts = ['joins']

window.findRecordCalls = 0
window.buildRecordCalls = 0
window.whereCalls = 0

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
  window.findRecordCalls += 1
  const {model, defaultJoins} = getModel(kind)
  if (!opts) opts = {}
  if (defaultJoins) {
    opts = {...opts, joins: utils.composeArray(opts.joins, defaultJoins)}
  }
  kind = sanitizeKind(kind)

  if (utils.exists(opts.joins)) {
    return _.pick(state.records, [kind, ...opts.joins])
  }

  return state.records[kind]
}

window.allSecs = 0
window.allSecsSpecific = {}

export const all = createCachedSelector(
  findRecords,
  (state, key) => sanitizeKind(key),
  (state, key, opts) => sanitizeOpts(opts),
  (ents, key, opts) => _buildRecords(ents, key, opts),
)({keySelector: (state, key, opts = {}) => `${key}-${JSON.stringify(opts)}`, selectorCreator: createDeepEqualSelector})

const _buildRecords = (ents, key, opts) => {
  const startTime = performance.now()
  window.buildRecordCalls += 1
  const records = ents && _.isPlainObject(ents) ? ents : {[key]: ents} // deletedStamps is always present, tells us if we hae all ents or just a slice. This is needed for findRecords' performance
  const finalRecords = buildRecords(records, key, opts) || []

  const endTime = performance.now()
  const elapsedTimeInSeconds = (endTime - startTime) / 1000
  window.allSecs += elapsedTimeInSeconds
  if (!window.allSecsSpecific[key]) window.allSecsSpecific[key] = 0
  window.allSecsSpecific[key] += elapsedTimeInSeconds

  return finalRecords
}

const defaultArr = []

window.joinSecs = 0
window.assocSecs = 0

const buildRecords = (ents = {}, key, opts = {}) => {
  // console.log(`All. key: ${key}`, ents, opts)
  if (!_.isObject(opts)) opts = {}
  const {model, defaultJoins} = getModel(key)
  const joinKeys = utils.composeArray(opts.joins, defaultJoins)
  let final = enrichRecords(ents, key) || defaultArr

  joinKeys.forEach((k) => {
    const mergeItems = enrichRecords(ents, k)
    const startTime = performance.now()
    final = joins({items: final, mergeItems, tableName: key, mergeTableName: k})
    window.joinSecs += secsElapsed(startTime)
  })

  const startTime = performance.now()
  const assoc = config.createAssociation(final.map((i) => buildFullRecord(i, key, joinKeys)))
  window.assocSecs += secsElapsed(startTime)
  return assoc
}

window.fullRecordSecs = 0

const buildFullRecord = (item, key, joinKeys) => {
  const startTime = performance.now()
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

  const endTime = performance.now()
  const elapsedTimeInSeconds = (endTime - startTime) / 1000
  window.fullRecordSecs += elapsedTimeInSeconds
  return record
}

const secsElapsed = (startTime) => {
  const endTime = performance.now()
  const elapsedTimeInSeconds = (endTime - startTime) / 1000
  return elapsedTimeInSeconds
}

const buildClassRecord = (item, key) => {
  key = pluralize.plural(key)
  const {model} = getModel(key)
  return model ? new model(item) : item
}

window.enrichSecs = 0

const enrichRecords = (ents, key) => {
  const startTime = performance.now()
  const val = config.enrichRecords(ents, key) || ents[key]
  window.enrichSecs += secsElapsed(startTime)
  return val
}

const allExternal = (state, key, query, opts) => (utils.exists(opts) ? all(state, key, opts) : all(state, key))

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
)({keySelector: (state, key, query) => `${key}-${JSON.stringify(query)}`, selectorCreator: createDeepEqualSelector})

export const includes = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (records, key, query) => includesRecord(records, query) || [],
)((state, key, query) => `${key}-${JSON.stringify(query)}`)

window.whereSecs = 0
export const where = createCachedSelector(
  allExternal,
  (state, key) => key,
  (state, key, query) => query,
  (state, key, query, opts) => opts || '',
  (records, key, query, opts) => {
    window.whereCalls += 1
    const startTime = performance.now()

    // console.log(`running where. Model: ${key}, query: ${JSON.stringify(query)}, opts: ${JSON.stringify(opts)}`)
    const val = query ? filterRecords(records, query, opts) : records || []

    const endTime = performance.now()
    const elapsedTimeInSeconds = (endTime - startTime) / 1000
    window.whereSecs += elapsedTimeInSeconds

    return val
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
