import _ from 'lodash'
import utils from '@eitje/utils'
import {config} from './config'
import pluralize from 'pluralize'
import joins, {checkMultiple} from './joins'
import {getModel} from './helpers'

export const _buildRecords = (ents, key, opts) => {
	const records = ents && _.isPlainObject(ents) ? ents : {[key]: ents}
	const finalRecords = buildRecords(records, key, opts) || []

	return finalRecords
}

const makeNestedJoins = ({children, records, allRecords}) => {
	return children.reduce((acc = [], child) => {
		const parentRecords = acc.length ? acc : records
		const childRecords = enrichRecords(allRecords, child.key)
		return joins({
			items: parentRecords,
			mergeItems: childRecords,
			tableName: child.parent,
			mergeTableName: child.key,
		})
	}, [])
}

const buildNestedFullRecords = ({joinKey, children, nestedJoins = []}) => {
	return nestedJoins.map(record =>
		buildFullRecord(
			record,
			joinKey,
			children.map(c => c.key),
		),
	)
}

const defaultArr = []

const joinsMapper = ({joinKeys, allRecords, key}) => {
	let finalRecords = enrichRecords(allRecords, key) || defaultArr

	joinKeys.forEach(({key: joinKey, children}) => {
		const records = enrichRecords(allRecords, joinKey)
		const nestedJoins = makeNestedJoins({children, records, allRecords})
		const fullRecords = buildNestedFullRecords({
			joinKey,
			children,
			nestedJoins,
		})

		const hasJoinsThrough = fullRecords.length

		finalRecords = joins({
			items: finalRecords,
			mergeItems: hasJoinsThrough ? fullRecords : enrichRecords(allRecords, joinKey),
			tableName: key,
			mergeTableName: joinKey,
		})
	})

	return finalRecords
}

const buildRecords = (allRecords = {}, key, opts = {}) => {
	opts = _.isObject(opts) ? opts : {}
	const {defaultJoins = []} = getModel(key) || {}
	const joinsArray = utils.composeArray(defaultJoins, opts.joins)
	const joinKeys = buildNestedStructure(joinsArray, key)
	const finalRecords = joinsMapper({joinKeys, allRecords, key})

	const associatedRecords = config.createAssociation(
		finalRecords.map(record =>
			buildFullRecord(
				record,
				key,
				joinKeys.map(({key}) => key),
			),
		),
	)

	return associatedRecords
}

function buildNestedStructure(input, parentKey = null) {
	let nodes = []

	if (_.isString(input)) {
		return [{key: input, parent: parentKey, children: []}]
	} else if (_.isArray(input)) {
		input.forEach(item => {
			nodes = nodes.concat(buildNestedStructure(item, parentKey))
		})
	} else if (_.isObject(input)) {
		_.forOwn(input, (value, key) => {
			const children = buildNestedStructure(value, key)
			const node = {
				key,
				parent: parentKey,
				children,
			}
			nodes.push(node)
		})
	}

	return nodes
}

const buildFullRecord = (item, key, joinKeys) => {
	const record = buildClassRecord(item, key)
	joinKeys.forEach(joinKey => {
		const isMultiple = checkMultiple(key, joinKey)
		const actualJoinKey = isMultiple ? pluralize.plural(joinKey) : pluralize.singular(joinKey)
		if (record[actualJoinKey]) {
			record[actualJoinKey] = isMultiple
				? config.createAssociation(record[actualJoinKey].map(i => buildClassRecord(i, actualJoinKey)))
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

const enrichRecords = (ents, key) => {
	const val = config.enrichRecords(ents, key) || ents[key]
	return val
}
