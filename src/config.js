const noop = i => i
let empty = {}
const translator = t => t
const baseURL = "http://localhost:3000"


const defaultConfig = {t: translator, baseURL, store: null, alert: noop, afterAdd: noop, afterIndex: null, getRefreshToken: noop,
                       apiConfig: empty, createUrls: empty, logout: noop, stampFields: empty,
                       deleteUrls: empty, updateUrls: empty, indexUrls: empty, }

let config = defaultConfig;

const setup = (obj) => {
    config = {...config, ...obj}
}



export {setup, config}