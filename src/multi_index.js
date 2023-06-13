import {api as backend} from './backend'
import {getActionVersion, newGetStamps, makeCacheKind, newAfterIndex} from './helpers'
import utils from '@eitje/utils'
import {config} from './config'
import _ from 'lodash'
import pluralize from 'pluralize'
import {mapFetchedKinds, sortFunc} from './reducer'

export const multiIndex = async (resources) => {
	let payloadObj = {}
	let localObj = {}
	resources.forEach((r) => {
		const {params, local, name} = buildResourceParams(r)
		payloadObj[name] = {params}
		localObj[name] = {name, ...local}
	})

	const params = {new_web: true, doNotLoad: true}
	const finalParams = {resources: payloadObj, ...params}
	const res = await backend.post(`multi_index`, finalParams)
	if (res.ok) {
		let {data} = res
		data = data || {}
		const {items = {}} = data
		let reduxPayload = Object.keys(items).map((k) => transformMultiResponse(items[k], localObj[k]))
		reduxPayload = reduxPayload.filter(Boolean)
		if (utils.exists(reduxPayload)) {
			config.store.dispatch({type: 'MULTI_INDEX', payload: reduxPayload.filter(Boolean)})
		}
	}
}

export const buildReduxPayload = (state, payload) => {
	const obj = {records: {}, actionVersions: {}}
	payload.forEach((resource) => {
		const items = buildReduxResource(resource, state)
		obj['records'][resource.name] = items
		obj['actionVersions'][resource.name] = resource.action_version
	})
	return obj
}

const buildReduxResource = (data, state) => {
	const {name, destroyed_ids, items, force, cacheName, removed_from_scope_ids} = data
	let oldItems = state[name] || []

	if (_.isArray(destroyed_ids)) {
		oldItems = oldItems.filter((i) => !destroyed_ids.includes(i.id))
	}

	if (_.isArray(removed_from_scope_ids)) {
		oldItems = oldItems
			.map((i) => {
				if (!removed_from_scope_ids.includes(i.id)) return i
				let {fetchedKinds = []} = i
				if (fetchedKinds.length == 0) return i // allow pushered or other items to remain if they're removed from scope, we're only interested in items that were fetched through this scope and ONLY through this scope before
				fetchedKinds = fetchedKinds.filter((k) => k != cacheName)
				return fetchedKinds.length == 0 ? null : {...i, fetchedKinds}
			})
			.filter(Boolean)
	}

	let indexItems = force
		? items
		: utils.findAndReplace({
				oldItems,
				newItems: items,
				mapFunc: mapFetchedKinds,
		  })

	indexItems = _.uniqBy(indexItems, 'id')

	return indexItems
}

const transformMultiResponse = (resp, params) => {
	// we're currently passing 'refresh' and 'cacheName' as params.. we shouldn't send em to the back, just keep em here.
	// afterIndex is skipped for now
	const {refresh, cacheName, name} = params
	let {items = [], action_version, destroyed_ids = [], removed_from_scope_ids = [], deleted_stamp} = resp

	items = newAfterIndex({items, cacheName})

	const force = resp.force || refresh

	const shouldUpdate = items.length > 0 || force || destroyed_ids.length > 0 || removed_from_scope_ids.length > 0
	if (!shouldUpdate) return null

	return {
		name: utils.snakeToCamel(name),
		items,
		force,
		destroyed_ids,
		removed_from_scope_ids,
		action_version,
		cacheName,
	}
}

const buildResourceParams = (props) => {
	const {filters = {}, inverted, refresh} = props
	const url = config.indexUrls[name] ? funcOrValue(config.indexUrls[name]) : `${name}/index`
	const name = utils.snakeToCamel(props.name)
	const cacheName = makeCacheKind(name, filters)

	const {stamps = {}, currentItems = [], allItems = []} = refresh ? {} : newGetStamps({name, inverted, cacheName})

	let currentIds = currentItems._map('id')
	const unscopedIds = allItems.filter((i) => !utils.exists(i.fetchedKinds))._map('id')
	const actionVersion = getActionVersion(name)

	let condParams = {}

	if (utils.exists(filters)) {
		condParams['filters'] = filters
	}

	if (!config.noCurrentIds && !refresh) {
		condParams['currentIds'] = currentIds
		if (utils.exists(unscopedIds)) condParams['unscopedIds'] = unscopedIds
	}

	const params = {
		...stamps,
		...condParams,
		action_version: actionVersion,
		direction: inverted && 'older',
	}

	const finalParams = {
		name: utils.camelToSnake(name),
		params,
		local: {refresh, cacheName},
	}

	return finalParams
}
