import {api as backend} from './backend'
import utils from '@eitje/utils'
import {config} from './config'
import _ from 'lodash'
import pluralize from 'pluralize'
import {getStamp, getDelStamp, afterIndex} from './helpers'

const {store, indexUrls, createUrls, updateUrls, deleteUrls,
       afterAdd} = config


const handleErrors = data => {
  return null;
}


export async function index(kind, {ignoreStamp, inverted, localKind, refresh, localForce, ignoreDelStamp, userFilter, filters, params = {} } = {}) {
  const url = config.indexUrls[kind] ? config.indexUrls[kind]() : kind
  const camelKind = utils.snakeToCamel(kind)
  const createKind = localKind || camelKind
  const lastUpdatedStamp = (ignoreStamp || refresh) ? null : getStamp(camelKind, createKind, params, inverted)
  const deletedStamp = (ignoreDelStamp || refresh) ? null : getDelStamp(camelKind)


  const res = await backend.get(url, {new_web: true, ...params, lastUpdatedStamp, deletedStamp, direction: inverted && 'older'})
 
  if(res.ok && res.data && res.data.items) {
    const {items, force, deleted_stamp} = res.data
    let mappedItems = items;
    const hasForce = force || localForce || refresh
    if(items.length > 0 || hasForce) {
      mappedItems = afterIndex(kind, items, {localKind: camelKind})
      config.store.dispatch({type: 'INDEX_RECORDS', force: hasForce, items: mappedItems, 
                      deletedStamp: deleted_stamp, kind: createKind, delKind: camelKind })
    }
    return {...res, items: mappedItems};
  } else {

  }
    return res;
  
}

export async function updateMulti(kind, params, {localKind, extraParams, saveLocal = true}) {
  const res = await backend.post(`${kind}/multi_update`, {items: params, ...extraParams})
  if(res.ok && res.items) {
    const {items} = res.data
    saveLocal && createMultiLocal(kind, items)
    return {ok: true, items}
  }
  else if(res.ok) {
    return {ok: true}
  }
   else {
    return {ok: false}
  }

}


export async function add(kind, params, {localKind, extraParams = {}, local = true} = {}) {
  
  const isCreate = !params["id"]
  const meth = isCreate ? backend.post : backend.put
  const standardUrl = isCreate ? kind : `${kind}/${params.id}`
  const obj = getParams(kind, params)

  const urls = isCreate ? config.createUrls : config.updateUrls
  const url = urls[kind] ? urls[kind](params["id"]) : standardUrl
  
  const finalParams = {...obj, ...extraParams}
  
  const res = await meth(url, finalParams)
  if(!local) return res;
  if(res.ok && res.data && res.data.item) {
    const {item} = res.data
    const createKind = localKind || kind
    config.afterAdd(kind, item, params)
    createLocal(createKind, item)
    return {ok: true, item}
  } else {
    return {ok: false, errors: res.errors || res.data}
  }
}

export const create = add;
export const update = add;

export async function destroy(kind, id, extraParams = {}) {
  const url = config.deleteUrls[kind] ? config.deleteUrls[kind](id) : `${kind}/${id}`
  const res = await backend.delete(url)
  if(res.ok) {
    destroyLocal(kind, id, extraParams)
    return {ok: true}
  }
  return res;
}

export async function addManyToMany(kind, params = {}, {extraParams = {}} = {} ) {
  const obj = getParams(kind, params)
  const url = `${kind}/${params.id}/add_relation`
  const res = await backend.post(url, obj)
  if(res.ok) {
    const {item} = res.data
    createLocal(kind, item)
  }
  return res;
}

export async function toggle(kind, params, {extraParams = {}} = {}) {
  const obj = getParams(kind, params)
  const url = `${kind}/${params.id}/toggle`
  const res = await backend.post(url, obj)
  if(res.ok) {
    const {item} = res.data
    createLocal(kind, item)
  } else {
    handleErrors(res.data)
  }
}


export async function getByIds(kind, ids, extraParams = {}) {
  const url = `${kind}/by_ids`
  const res = await backend.get(url, {ids})
  if (res.ok) {
    const {items} = res.data
    createMultiLocal(kind, items, extraParams)
  }
}

export async function addMulti(kind, params, {extraParams = {}, showSucc = true} = {}) {
  const obj = {}
  obj[kind] = params
  const res = await backend.post(`${kind}/add_multi`, {...obj, ...extraParams})
  if(res.ok) {
    const json = res.data
    const {items} = json
    config.store.dispatch({type: 'ADD_RECORDS', items: items, kind: utils.snakeToCamel(kind)})
    return true
  }
  return false;
}



const getParams = (kind, params) => {
  const sing = pluralize.singular(kind)
  return {[sing]: params}
}

export async function createMultiLocal(kind, items, {localKind} = {}) {
  if(items.length === 0) return;
  const actKind = localKind || kind
  config.store.dispatch({type: 'LOCAL_INDEX_RECORDS', items, kind: utils.snakeToCamel(actKind)})
}

export async function createLocal(kind, params) {
  config.store.dispatch({type: 'UPDATE_RECORD', item: {...params, indexed: false}, kind: utils.snakeToCamel(kind)})
}

export async function updateMultiPartial(kind, params) { // params is [{id: 3, ...fields}, ..]
  const state = store.getState()
  const items = utils.findAndReplace({oldItems: state.records[kind], newItems: params})
  createMultiLocal(kind, items)
}

export async function updatePartial(kind, id, params) {
  const state = config.store.getState()
  const items = state.records[kind]
  const item = items.find(i => i.id === id)
  item && createLocal(kind, {...item, ...params})
}



export async function destroyLocal(kind, id, {localKind} = {}) {
  const actKind = localKind || kind
  config.store.dispatch({type: 'DELETE_RECORD', id, kind: utils.snakeToCamel(actKind)})
}



export async function removeRelaton(kind, id, relName, value) {
  const state = config.store.getState()
  const items = state.records[kind]
  const item = items.find(i => i.id === id)
  item && createLocal(kind, {...item, [relName]: item[relName].filter(v => v != value)  })
}

export const clearCache = (name, deletedKinds = [name]) => {
  const stamps = {}
  deletedKinds.forEach(k => stamps[k] = undefined)
  store.dispatch({type: 'CLEAR_CACHE', kind: name, deletedStamps: stamps})
  // utils.toast(t("success"))
}



