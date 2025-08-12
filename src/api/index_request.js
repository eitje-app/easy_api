import { getActionVersion, getStamps, makeCacheKind, afterIndex } from '../helpers'
import utils from '@eitje/utils'
import { backend } from './backend'
import { config } from './config'

export async function index(kind, {inverted, refresh, filters = {}, params = {}} = {},
) {
	const url = `${kind}/index`

	const camelKind = utils.snakeToCamel(kind)
	const cacheKind = makeCacheKind(camelKind, filters)

	const {
		stamps = {},
		currentItems = [],
		allItems = [],
	} = refresh ? {} : getStamps({cacheName: camelKind, inverted, cacheKind} )

	let currentIds = currentItems.map(i => i.id)
	const unscopedIds = allItems.filter(i => !utils.exists(i.fetchedKinds)).map(i => i.id) // we wanna include pushered and other non-fetched items to ensure they still exist

	const actionVersion = getActionVersion(camelKind)
	let condParams = {}

	if (utils.exists(filters)) {
		condParams['filters'] = filters
	}

	const finalParams = {
		doNotLoad: true,
		...params,
		...stamps,
		...condParams,
		action_version: actionVersion,
		direction: inverted && 'older',
	}

	if (!refresh) {
		finalParams['currentIds'] = currentIds
		if (utils.exists(unscopedIds)) finalParams['unscopedIds'] = unscopedIds
	}

	const res = await backend.post(url, finalParams)

	if (res.ok) {
		let {data} = res
		data = data || {}
		const {items = [], force, action_version, destroyed_ids = [], removed_from_scope_ids = []} = data
		let mappedItems = items
		const hasForce = force || refresh
		
		mappedItems = afterIndex({cacheName: kind, items})

		if (items.length > 0 || hasForce || destroyed_ids.length > 0 || removed_from_scope_ids.length > 0) {
			config.store.dispatch({
				type: 'INDEX_RECORDS',
				force: hasForce,
				items: mappedItems,
				kind: cacheKind,
				destroyed_ids,
				removed_from_scope_ids,
				action_version,
				cacheKind
			})
		}
		return {...res, items: mappedItems}
	} else {
		return res
	}
}
