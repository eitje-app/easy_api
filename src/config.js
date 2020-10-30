const noop = i => i
let empty = {}
const translator = t => t
const baseURL = "http://localhost:3000"


const defaultConfig = {store: null, afterAdd: noop, afterIndex: noop, createUrls: empty, logout: noop, 
                       alert: noop, getRefreshToken: noop, apiConfig: empty,
                       deleteUrls: empty, updateUrls: empty, indexUrls: empty, t: translator, baseURL}

let config = defaultConfig;

const setup = (obj) => {
    config = {...config, ...obj}
}

export {setup, config}