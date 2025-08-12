import { handleRes } from './handle_res'
import { sanitizeKind, getParams} from '../helpers'
import { api as backend } from '../backend'
import { config } from '../config'
import utils from '@eitje/utils'



export async function add(kind, params, {extraParams = {}, local = true, ...rest} = {}) {
	kind = sanitizeKind(kind)
	const isCreate = !params['id']
	const meth = isCreate ? backend.post : backend.put
	const url = isCreate ? `${kind}/${url}` : `${kind}/${params.id}${url}`
	const obj = getParams(kind, params)

	const finalParams = {...obj, ...extraParams}
	const res = await meth(url, finalParams, rest)
	if (!local) return res
	return handleRes(res, kind, params)
}

export const create = add
export const update = add

export async function updateMulti(kind, params, {extraParams} = {}) {
	const res = await backend.post(`${kind}/multi_update`, {
		items: params,
		...extraParams,
	})
	return handleRes(res, kind)
}
const funcOrValue = (val, arg) => (_.isFunction(val) ? val(arg) : val)

export async function destroy(kind, id, extraParams = {}) {
	const url = config.deleteUrls[kind] ? funcOrValue(config.deleteUrls[kind], id) : `${kind}/${id}`
	const res = await backend.delete(url)
	if (res.ok && res.data && !res.data.destroyed_ids && !res.data.items) {
		destroyLocal(kind, id, extraParams)
		return {ok: true}
	} else {
		return handleRes(res, kind, {id})
	}
}

export async function createMultiLocal(kind, items, {localKind} = {}) {
	if (!_.isArray(items)) items = [items].filter(Boolean)
	if (items.length === 0) return
	const actKind = localKind || kind
	config.store.dispatch({
		type: 'LOCAL_INDEX_RECORDS',
		items,
		kind: utils.snakeToCamel(actKind),
	})
}

export async function createLocal(kind, params) {
	config.store.dispatch({
		type: 'UPDATE_RECORD',
		item: params,
		kind: utils.snakeToCamel(kind),
	})
}

export async function destroyLocal(kind, id, {localKind} = {}) {
	const actKind = localKind || kind
	config.store.dispatch({
		type: 'DELETE_RECORD',
		id,
		kind: utils.snakeToCamel(actKind),
	})
}