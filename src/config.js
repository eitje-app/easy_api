const noop = i => i
const emptyFunc = i => null
let empty = {}
const translator = t => t
const baseURL = "http://localhost:3000"


const defaultConfig = {t: translator, baseURL, extendReducer: emptyFunc, store: null, alert: noop, afterAdd: noop, afterIndex: null, getRefreshToken: noop,
                       apiConfig: empty, createUrls: empty, logout: noop, stampFields: empty, reportSuccess: true, ignoreErrors: emptyFunc,
                       deleteUrls: empty, updateUrls: empty, indexUrls: empty, enrichRecords: emptyFunc, success: noop}

let config = defaultConfig;

const setup = (obj) => {
    config = {...config, ...obj}
}



export {setup, config}