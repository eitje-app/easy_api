import {setup, config} from './config'
import initApi, {api} from './backend'
import * as API from './api'
import reducer from './reducer'
const backend = api;
export {setup, initApi, API, backend, config, reducer}

Object.assign(module.exports, require('./selectors'));
