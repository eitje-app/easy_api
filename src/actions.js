import _ from 'lodash'
import moment from 'moment'


export const findRecord = (entities, query) => {
	return entities.find(e => {
		if (!_.isObject(query)) return e.id == Number(query)
		const keys = Object.keys(query)
		return filterKeys(keys, query, e)
	})
}

export const filterRecords = (entities, query, options) => {
	return entities.filter(e => {
		if (_.isArray(query)) return query.includes(e.id)
		if (_.isNumber(query)) return Number(query) == e.id
		const keys = Object.keys(query)
		return filterKeys(keys, query, e, options)
	})
}

export const inverseFilterRecords = (entities, query) => {
	return entities.filter(e => {
		const keys = Object.keys(query)
		return !filterKeys(keys, query, e)
	})
}

const filterKeys = (keys, query, record, options) => {
	return keys.every(k => {
		const queryVal = query[k]
		const recordVal = record[k]
		return filterRecord(queryVal, recordVal, options)
	})
}

const isRange = i => _.isObject(i) && i.start && i.start instanceof moment
const hasRange = arr => arr.some(i => isRange(i))
const hasArray = arr => arr.some(i => _.isArray(i))

export const filterRecord = (queryVal, recordVal, {exact} = {}) => {
	const args = [queryVal, recordVal]
	queryVal = sanitizeVal(queryVal)
	recordVal = sanitizeVal(recordVal)
	if (!exact && hasArray(args)) return filterArrays(queryVal, recordVal)
	if (hasRange(args)) return filterRanges(queryVal, recordVal)
	return _.isEqual(queryVal, recordVal)
}

const filterRanges = (queryVal, recordVal) => {
	if (_.isFunction(recordVal)) recordVal = recordVal()

	const args = [queryVal, recordVal]

	if (isRange(queryVal) && isRange(recordVal)) {
		return queryVal.overlaps(recordVal)
	}

	const stringVal = args.find(a => _.isString(a)) // dates are always sent to us as strings
	const rangeVal = args.find(a => isRange(a))
	if (!rangeVal || !stringVal) return
	const momentized = moment(stringVal)

	if (rangeVal.isSingleDay()) {
		return rangeVal.start.format() == stringVal || rangeVal.end.format() == stringVal
	}

	return rangeVal.contains(momentized)
}

const sanitizeVal = val => {
	if (val instanceof moment) return val.format('YYYY-MM-DD')
	if (_.isString(val)) return sanitizeString(val)
	return val
}

const sanitizeString = val => {
	if (!isNaN(val)) return Number(val)
	return val
}

function filterArrays(arr1, arr2) {
	if (_.isArray(arr1) && _.isArray(arr2)) return _.intersection(arr1, arr2).length > 0
	if (_.isArray(arr1)) return arr1.includes(arr2)
	if (_.isArray(arr2)) return arr2.includes(arr1)
}

