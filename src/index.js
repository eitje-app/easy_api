import {setup, config} from './config'
import initApi, {api as backend} from './backend'
import * as API from './api'
import reducer from './reducer'

export {setup, initApi, API, backend, config, reducer}
Object.assign(module.exports, require('./selectors'));
Object.assign(module.exports, require('./actions'));
