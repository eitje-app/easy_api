import pluralize from 'pluralize'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import createCachedSelector from 're-reselect'
import _ from 'lodash'
import utils from '@eitje/utils'
import {_buildRecords} from './build_records'
import {getModel} from './helpers'

const allowedOpts = ['joins']

const createDeepEqualSelector = createSelectorCreator(defaultMemoize, _.isEqual)

const sanitizeKind = kind => pluralize(utils.snakeToCamel(kind))

const sanitizeOpts = opts => {
	if (!_.isObject(opts)) return null
	if (!utils.intersects(Object.keys(opts), allowedOpts)) return null
	return opts
}

const flattenJoins = joins => {
	let result = []

	function traverse(current) {
		if (_.isString(current)) {
			result.push(current)
		} else if (Array.isArray(current) || _.isPlainObject(current)) {
			_.forEach(current, (value, key) => {
				if (_.isPlainObject(current)) result.push(key)
				traverse(value)
			})
		}
	}

	traverse(joins)

	return _.uniq(result)
}

const findRecords = (state, kind, opts = {}) => {
	kind = sanitizeKind(kind)
	const {defaultJoins} = getModel(kind)
	if (!opts) opts = {}
	if (defaultJoins) {
		opts = {...opts, joins: utils.composeArray(opts.joins, defaultJoins)}
	}

	if (utils.exists(opts.joins)) {
		const joins = flattenJoins(opts.joins)
		return _.pick(state.records, [kind, ...joins])
	}

	return state.records[kind]
}

export const all = createCachedSelector(
	findRecords,
	(state, key) => sanitizeKind(key),
	(state, key, opts) => sanitizeOpts(opts),
	(ents, key, opts) => _buildRecords(ents, key, opts),
)({
	keySelector: (state, key, opts = {}) => `${key}-${JSON.stringify(opts)}`,
	selectorCreator: createDeepEqualSelector,
})

export const allExternal = (state, key, query, opts) => (utils.exists(opts) ? all(state, key, opts) : all(state, key))
