import {config} from './config'
import {create} from 'apisauce'
import utils from '@eitje/utils'
import _ from 'lodash'


const {t, version, store, baseURL, logout, getRefreshToken, alert, apiConfig} = config
let api;

const createApi = () => {
    api = create({ 
    baseURL: config.baseURL,
    headers: {'Content-Type': 'application/json', 
              'credentials': 'same-origin', 
              "Access-Control-Allow-Origin": "*",
             },
   ...config.apiConfig
    })

    api.addAsyncRequestTransform(request => setVersion(request))
    api.addAsyncRequestTransform(request => changeTokenHeader(request))
    api.addRequestTransform(request => startLoad(request))

    api.addMonitor(authMonitor)
    // 
    api.addMonitor(endLoad)
    api.addMonitor(handleErrors)

    return api;
}


async function changeTokenHeader(req) {
  if(req.url !== "oauth/token" && req.url !== 'auth' && req.url !== 'users/sign_up' && req.url !== 'auth/confirmed') {
    const token = await getRefreshToken();
    if(token) {
      if(!req.params) req.params = {}
      if(req.params) req.params['access_token'] = token;
    }
  }
}

async function setVersion(req) {
  if(!req.params) req.params = {}
  req.params['version'] = config.version
}

const authMonitor = res => {
  if( (res.status === 401 || res.status === 400) && !res.config.url.match(/auth/) ) {
    config.logout()
  }
}

const startLoad = req => {
  if(req.method !== 'get' && (!req.data || !req.data.doNotLoad  ) ) {
    config.store && config.store.dispatch({type: 'START_LOADING'})
  }
}

const endLoad = req => {
  if(req.config.method !== 'get' ) {
   config.store.dispatch({type: 'STOP_LOADING'})
  }
}

function setErrors(errors) {
  const hasError = _.isObject(errors) && Object.keys(errors).length > 0
  let err;
  if(hasError) {
    const errs = _.flatten(Object.values(errors))
    err = errs[0]
  } 
  else {
    err = t("unexpectedIssue")
  }
  config.alert(config.t("oops"), err)
  }


function handleErrors(res) {
  if(res.status < 400) return;
  const errs = res.data || res.errors
  if(errs && !errs?.exception) {
    setErrors(errs)
  } else {
    if(res.status < 402) return;
      config.alert(config.t("oops"), config.t("unexpectedIssue"))
  }
  
}




export default createApi;
export {api}


