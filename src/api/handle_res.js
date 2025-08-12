import _ from 'lodash'
import utils from '@eitje/utils'
import { config } from '../config'
import { createLocal, createMultiLocal, destroyLocal } from "./cud_actions"

export const handleRes = (res, kind, params = {}) => {
	if (res.ok && res.data) {
		const {item, items, destroyed_ids} = res.data

		handleDestroyed(kind, destroyed_ids)

		const isMultiRes = _.isArray(items) && items.length > 1

		if (items && _.isObject(items) && !_.isArray(items)) {
			Object.keys(items).forEach(_kind => {
				const convertedKind = utils.snakeToCamel(_kind)
				createMultiLocal(convertedKind, items[_kind])
			})
			return {...res, ok: true, items}
		}

		if (item && !isMultiRes) {
			if (!kind) return {ok: true}
			createLocal(kind, item)
			return {...res, ok: true, item}
		}

		if (items && _.isArray(items)) {
			if (!kind) return {ok: true}
			items.forEach(i => config.afterAdd(kind, i, params))
			createMultiLocal(kind, items)
			return {...res, ok: true, items}
		}
	} else {
		handleFailedRes(res, kind, params)
	}

	return res
}

const handleFailedRes = (res, kind, params) => {
	if (res.status != 410) return
	const {id} = params
	if (!kind || !id) return
	destroyLocal(kind, id)
}

const handleDestroyed = (kind, ids) => {
	if (!utils.exists(ids)) return

	if (_.isArray(ids)) {
		destroyLocal(kind, ids)
		return
	}

	if (_.isPlainObject(ids)) {
		handleLayered(ids, (kind, items) => destroyLocal(kind, items))
	}
}

const handleLayered = (items, callback) => {
	Object.keys(items).forEach(_kind => {
		const convertedKind = utils.snakeToCamel(_kind)
		callback(convertedKind, items[_kind])
	})
}
