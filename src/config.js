import {Fragment} from 'react'

const noop = (i) => i
const emptyFunc = (i) => null
let empty = {}
const translator = (t) => t
const baseURL = 'http://localhost:3000'

const defaultConfig = {
  t: translator,
  baseURL,
  extendReducer: emptyFunc,
  store: null,
  alert: noop,
  afterAdd: noop,
  afterIndex: null,
  getRefreshToken: noop,
  apiConfig: empty,
  createUrls: empty,
  logout: noop,
  stampFields: empty,
  reportSuccess: true,
  ignoreErrors: emptyFunc,
  deleteUrls: empty,
  handleNotFound: empty,
  updateUrls: empty,
  indexUrls: empty,
  enrichRecords: emptyFunc,
  success: noop,
  Association: null,
  ApplicationRecord: null,
  models: {},
}

const createAssociation = (arr) => {
  if (!config.Association) return arr
  return new config.Association(arr)
}

const createApplicationRecord = (item) => {
  if (!config.ApplicationRecord) return item
  return new config.ApplicationRecord(arr)
}

let config = {...defaultConfig, createAssociation, createApplicationRecord}

const setup = (obj) => {
  config = {...config, ...obj}
}

export {setup, config}
