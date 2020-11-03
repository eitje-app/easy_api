import {setup, config} from './config'
import initApi, {backend} from './backend'
import * as API from './api'
import reducer from './reducer'
export {setup, initApi, API, backend, config, reducer}

Object.assign(module.exports, require('./selectors'));
