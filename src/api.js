import {api as backend} from './backend'
import utils from '@eitje/utils'
import {config} from './config'
import _ from 'lodash'
import pluralize from 'pluralize'
import {getDelStamp, getActionVersion, getStamps, afterIndex} from './helpers'
import {upload} from './files'

const {store, indexUrls, createUrls, updateUrls, deleteUrls, afterAdd} = config

const handleErrors = (data) => {
  return null
}

const funcOrValue = (val, arg) => (_.isFunction(val) ? val(arg) : val)

export async function add(kind, params, {localKind, url = '', extraParams = {}, local = true, ...rest} = {}) {
  kind = sanitizeKind(kind)
  const isCreate = !params['id']
  const meth = isCreate ? backend.post : backend.put
  const standardUrl = isCreate ? `${kind}/${url}` : `${kind}/${params.id}${url}`
  const obj = getParams(kind, params)

  const urls = isCreate ? config.createUrls : config.updateUrls
  const _url = urls[kind] ? funcOrValue(urls[kind], params['id']) : standardUrl
  const finalParams = {...obj, ...extraParams}
  const res = await meth(_url, finalParams, rest)
  if (!local) return res
  return handleRes(res, localKind || kind, params)
}

const handleRes = (res, kind, params = {}) => {
  if (res.ok && res.data) {
    const {item, items, destroyed_ids} = res.data

    handleDestroyed(kind, destroyed_ids)

    const isMultiRes = _.isArray(items) && items.length > 1

    if (items && _.isObject(items) && !_.isArray(items)) {
      Object.keys(items).forEach((_kind) => {
        const convertedKind = utils.snakeToCamel(_kind)
        createMultiLocal(convertedKind, items[_kind])
      })
      return {...res, ok: true, items}
    }

    if (item && !isMultiRes) {
      if (!kind) return {ok: true}
      config.afterAdd(kind, item, params)
      createLocal(kind, item)
      return {...res, ok: true, item}
    }

    if (items && _.isArray(items)) {
      createMultiLocal(kind, items)
      return {...res, ok: true, items}
    }
  } else {
    handleFailedRes(res, kind, params)
  }

  return res
}

const handleFailedRes = (res, kind, params) => {
  const {t, alert} = config
  if (res.status != 410) return
  const {id} = params
  if (!kind || !id) return
  alert(t('oops'), t('recordNotFound'))
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
  Object.keys(items).forEach((_kind) => {
    const convertedKind = utils.snakeToCamel(_kind)
    callback(convertedKind, items[_kind])
  })
}

const makeCacheKind = (kind, filters) => {
  if (!utils.exists(filters)) return kind
  const sortedStringified = JSON.stringify(filters, Object.keys(filters).sort()) // we sort to ensure order of keys doesn't matter
  return `${kind}-${sortedStringified}`
}

export async function index(
  kind,
  {ignoreStamp, inverted, localKind, refresh, overrideCacheKind, localForce, ignoreDelStamp, userFilter, filters = {}, params = {}} = {},
) {
  const url = config.indexUrls[kind] ? funcOrValue(config.indexUrls[kind]) : `${kind}/index`

  const camelKind = utils.snakeToCamel(kind)
  const createKind = localKind || camelKind
  const cacheKind = makeCacheKind(createKind, filters)

  const {
    stamps = {},
    currentItems = [],
    allItems = [],
  } = ignoreStamp || refresh ? {} : getStamps(camelKind, createKind, params, inverted, overrideCacheKind || cacheKind)

  let currentIds = currentItems.map((i) => i.id)
  const nonFetchedIds = allItems.filter((i) => !utils.exists(i.fetchedKinds)).map((i) => i.id) // we wanna include pushered and other non-fetched items to ensure they still exist
  currentIds = [...currentIds, ...nonFetchedIds]
  const deletedStamp = ignoreDelStamp || refresh ? null : getDelStamp(camelKind)
  const actionVersion = getActionVersion(camelKind)
  let condParams = {}

  if (utils.exists(filters)) {
    condParams['filters'] = filters
  }

  const finalParams = {
    new_web: true,
    ...params,
    ...stamps,
    ...condParams,
    deletedStamp,
    action_version: actionVersion,
    doNotLoad: true,
    direction: inverted && 'older',
  }

  if (!config.noCurrentIds) {
    finalParams['currentIds'] = currentIds
  }

  const res = await backend.post(url, finalParams)

  if (res.ok) {
    let {data} = res
    data = data || {}
    const {items = [], force, action_version, destroyed_ids = [], removed_from_scope_ids = [], deleted_stamp} = data
    let mappedItems = items
    const hasForce = force || localForce || refresh
    mappedItems = afterIndex(kind, items, {localKind: overrideCacheKind || cacheKind})
    if (items.length > 0 || hasForce || destroyed_ids.length > 0 || removed_from_scope_ids.length > 0) {
      config.store.dispatch({
        type: 'INDEX_RECORDS',
        force: hasForce,
        items: mappedItems,
        deletedStamp: deleted_stamp,
        kind: createKind,
        delKind: camelKind,
        destroyed_ids,
        removed_from_scope_ids,
        action_version,
        cacheKind: overrideCacheKind || cacheKind,
      })
    }
    return {...res, items: mappedItems}
  } else {
  }
  return res
}

export async function updateMulti(kind, params, {localKind, extraParams, saveLocal = true} = {}) {
  const res = await backend.post(`${kind}/multi_update`, {items: params, ...extraParams})
  return handleRes(res, kind)
}

export async function show(kind, id, {extraParams = {}, localKind} = {}) {
  const res = await backend.get(`${kind}/${id}`, extraParams)
  if (res.ok && res.data && res.data.item) {
    const {item} = res.data
    const createKind = localKind || kind
    createLocal(createKind, item)
    return {ok: true, item}
  }
}

export const create = add
export const update = add

const sanitizeKind = (kind) => (kind ? pluralize(utils.camelToSnake(kind)) : kind)

export async function destroyMutation(kind, id) {
  kind = sanitizeKind(kind)
  const res = await backend.delete(`${kind}/${id}/mutation`)
  return handleRes(res, kind)
}

export async function destroy(kind, id, extraParams = {}) {
  const url = config.deleteUrls[kind] ? funcOrValue(config.deleteUrls[kind], id) : `${kind}/${id}`
  const res = await backend.delete(url)
  if (res.ok && res.data && !res.data.destroyed_ids && !res.data.items) {
    destroyLocal(kind, id, extraParams)
    return {ok: true}
  } else {
    return handleRes(res, kind, {id})
  }
  return res
}

export const getAssocDiff = (newIds = [], oldIds = []) => {
  const removed = oldIds.filter((id) => !newIds.includes(id))
  const added = newIds.filter((id) => !oldIds.includes(id))
  return {added, removed}
}

export const makeAssocParams = (newAssocs, oldAssocs) => {
  const obj = {}
  const updateKeys = Object.keys(newAssocs)
  updateKeys.forEach((key) => {
    obj[key] = getAssocDiff(newAssocs[key], oldAssocs[key])
  })
  return obj
}

export async function addRemoveAssoc(kind, newAssocs, oldAssocs, id) {
  const params = makeAssocParams(newAssocs, oldAssocs)
  const obj = getParams(kind, params)
  const res = await backend.put(`${kind}/${id}/add_remove_assoc`, obj)
  return handleRes(res, kind, params)
}

export async function addRemoveAssocMulti(kind, params) {
  const obj = getParams(kind, params)
  const res = await backend.put(`${kind}/add_remove_assoc_multi`, obj)
  return handleRes(res, kind, params)
}

export async function updateAssoc(kind, params = {}, {extraParams = {}, add = true} = {}) {
  const obj = getParams(kind, params)
  const endPoint = add ? 'assoc' : 'remove_assoc'
  const url = `${kind}/${params.id}/${endPoint}`
  const res = await backend.put(url, obj)
  return handleRes(res, kind, params)
}

export async function removeAssoc(kind, params, rest = {}) {
  return updateAssoc(kind, params, {...rest, add: false})
}

export async function addAssoc(kind, params = {}, rest = {}) {
  return updateAssoc(kind, params, {...rest, add: true})
}

export async function attach(kind, id, data) {
  const url = `${kind}/${id}/attachment`
  const res = await upload(data, {url})
  return handleRes(res, kind)
}

export async function updateAsset(kind, id, data, {doLoad = true} = {}) {
  const url = `${kind}/${id}`

  const res = await upload(data, {method: 'put', paramName: 'info[pdf_content]', url, doLoad})
  // buildParams: prms => getParams(kind, prms),
  return handleRes(res, kind)
}

export async function removeAttachment(kind, id, idx) {
  const sanitizedKind = sanitizeKind(kind)
  const params = getParams(sanitizedKind, {index: idx})
  const url = `${sanitizedKind}/${id}/remove_attachment`
  const res = await backend.post(url, params)
  return handleRes(res, sanitizedKind)
}

export async function request(url, config = {}) {
  return arbitrary(null, url, config)
}

export async function resourceReq(kind, url, config = {}) {
  let {params, method} = makeArbDefault(config)
  const backendKind = sanitizeKind(kind)
  const isCreate = !params['id']

  const fullUrl = isCreate ? `${backendKind}/${url}` : `${backendKind}/${params['id']}/${url}`
  const resourceParams = getParams(kind, params)
  const meth = isCreate ? backend.post : backend.put

  const res = await meth(fullUrl, resourceParams)
  return handleRes(res, kind, params)
}

const makeArbDefault = (config) => {
  let method = 'POST'
  let params = config

  if (config.params || config.method) {
    // this means the argument is a settings object instead of just params
    params = config.params
    method = config.method || method
  }

  return {method, params}
}

export async function arbitrary(kind, url, config = {}) {
  const {params, method} = makeArbDefault(config)
  const extraParams = config.extraParams || {}
  kind = sanitizeKind(kind)

  const _url = !kind || url.match(/\//) ? url : `${kind}/${url}`
  let finalParams = kind ? getParams(kind, params) : params
  finalParams = {...finalParams, ...extraParams}
  const res = await backend.any({method, url: _url, data: finalParams})
  return handleRes(res, kind, params)
}

export async function toggle(kind, params, {extraParams = {}} = {}) {
  const obj = getParams(kind, params)
  const url = `${kind}/${params.id}/toggle`
  const res = await backend.post(url, obj)
  if (res.ok) {
    const {item} = res.data
    createLocal(kind, item)
  } else {
    handleErrors(res.data)
  }
}

export async function getByIds(kind, ids, extraParams = {}) {
  const url = `${kind}/by_ids`
  const res = await backend.get(url, {ids})
  if (res.ok && res.data) {
    const {items} = res.data
    createMultiLocal(kind, items, extraParams)
  }
}

export async function addMulti(kind, params, {extraParams = {}, showSucc = true} = {}) {
  const obj = {}
  obj[kind] = params
  const res = await backend.post(`${kind}/add_multi`, {...obj, ...extraParams})
  if (res.ok) {
    const json = res.data
    const {items} = json
    config.store.dispatch({type: 'ADD_RECORDS', items: items, kind: utils.snakeToCamel(kind)})
    return true
  }
  return false
}

const getParams = (kind, params) => {
  const sing = pluralize.singular(kind)
  return {[sing]: params}
}

export async function createMultiLocal(kind, items, {localKind} = {}) {
  if (!_.isArray(items)) items = [items].filter(Boolean)
  if (items.length === 0) return
  const actKind = localKind || kind
  config.store.dispatch({type: 'LOCAL_INDEX_RECORDS', items, kind: utils.snakeToCamel(actKind)})
}

export async function createLocal(kind, params) {
  config.store.dispatch({type: 'UPDATE_RECORD', item: params, kind: utils.snakeToCamel(kind)})
}

export async function updateMultiPartial(kind, params) {
  // params is [{id: 3, ...fields}, ..]
  const state = store.getState()
  const items = utils.findAndReplace({oldItems: state.records[kind], newItems: params})
  createMultiLocal(kind, items)
}

export async function updatePartial(kind, id, params) {
  const state = config.store.getState()
  const items = state.records[kind]
  const item = items.find((i) => i.id === id)
  item && createLocal(kind, {...item, ...params})
}

export async function destroyLocal(kind, id, {localKind} = {}) {
  const actKind = localKind || kind
  config.store.dispatch({type: 'DELETE_RECORD', id, kind: utils.snakeToCamel(actKind)})
}

export async function removeRelaton(kind, id, relName, value) {
  const state = config.store.getState()
  const items = state.records[kind]
  const item = items.find((i) => i.id === id)
  item && createLocal(kind, {...item, [relName]: item[relName].filter((v) => v != value)})
}

export const clearCache = (name, deletedKinds = [name]) => {
  const stamps = {}
  deletedKinds.forEach((k) => (stamps[k] = undefined))
  store.dispatch({type: 'CLEAR_CACHE', kind: name, deletedStamps: stamps})
  // utils.toast(t("success"))
}
