import { api as backend } from '../backend'
import { config } from '../config'
import { multiIndex } from './multi_index'
import { index } from './index'
import { createLocal, createMultiLocal } from './cud_actions'
import { handleRes } from './handle_res'
import { sanitizeKind, getParams } from '../helpers'
export * from './add'
export * from './handle_res'

export {multiIndex, index}

const {store} = config


export async function show(kind, id, {extraParams = {}, localKind} = {}) {
	const res = await backend.get(`${kind}/${id}`, extraParams)
	if (res.ok && res.data && res.data.item) {
		const {item} = res.data
		const createKind = localKind || kind
		createLocal(createKind, addFetchedKind(item, 'show'))
		return {ok: true, item}
	}
}

const addFetchedKind = (item, newKind) => {
	const {fetchedKinds = []} = item
	return {...item, fetchedKinds: [...fetchedKinds, newKind].uniq()}
}


export async function resourceReq(kind, url, config = {}) {
	let {params, method} = makeArbDefault(config, {defaultMethod: 'put'})

	const backendKind = sanitizeKind(kind)
	const isCreate = !params['id']
	const defaultMethod = isCreate ? 'post' : 'put'
	if (!method) method = defaultMethod
	method = method.toLowerCase()
	const fullUrl = isCreate ? `${backendKind}/${url}` : `${backendKind}/${params['id']}/${url}`
	const resourceParams = getParams(kind, params)

	const res = await backend[method](fullUrl, resourceParams)
	return handleRes(res, kind, params)
}

const makeArbDefault = (config, {defaultMethod = 'post'} = {}) => {
	let method = defaultMethod
	let params = config

	if (config.extraParams) params = {}

	if (config.params || config.method) {
		// this means the argument is a settings object instead of just params
		params = config.params
		method = config.method || method
	}

	return {method, params}
}

export async function getByIds(kind, ids, extraParams = {}) {
	const url = `${kind}/by_ids`
	const res = await backend.post(url, {ids, doNotLoad: true})
	if (res.ok && res.data) {
		const {items} = res.data
		createMultiLocal(kind, items, extraParams)
	}
}


