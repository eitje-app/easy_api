import {config} from './config'
import {create} from 'apisauce'
import {refreshTokenIfNeeded} from 'actions/auth'
import utils from '@eitje/utils'
import _ from 'lodash'


const {t, version, store, baseURL, logout, getRefreshToken, alert, apiConfig} = config
let api;

const createApi = () => {
    api = create({ 
    baseURL,
    headers: {'Content-Type': 'application/json', 
              'credentials': 'same-origin', 
              "Access-Control-Allow-Origin": "*",
             },
   ...apiConfig
    })
    return api;
}


async function changeTokenHeader(req) {
  if(req.url !== "oauth/token" && req.url !== 'auth' && req.url !== 'users/sign_up' && req.url !== 'auth/confirmed') {
    const token = await getRefreshToken();
    if(token) {
      if(req.data) req.data['access_token'] = token
      if(req.params) req.params['access_token'] = token
      if(!req.data && !req.params) {
        req.data = {access_token: token}
      }
    }
  }
}


async function setVersion(req) {
  if(!req.params) req.params = {}
  req.params['version'] = version
}

const authMonitor = res => {
  if( (res.status === 401 || res.status === 400) && !res.config.url.match(/auth/) ) {
    logout()
  }
}

const startLoad = req => {
  if(req.method !== 'get' && (!req.data || !req.data.doNotLoad  ) ) {
    store && store.dispatch({type: 'START_LOADING'})
  }
}

const endLoad = req => {
  if(req.config.method !== 'get' ) {
    store.dispatch({type: 'STOP_LOADING'})
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
  alert(t("oops"), err)
  }


function handleErrors(res) {
  if(res.status < 400) return;
  const errs = res.data || res.errors
  if(errs && !errs?.exception) {
    setErrors(errs)
  } else {
    if(res.status < 402) return;
      alert(t("oops"), t("unexpectedIssue"))
  }
  
}


api.addAsyncRequestTransform(request => setVersion(request))
api.addAsyncRequestTransform(request => changeTokenHeader(request))
api.addRequestTransform(request => startLoad(request))

api.addMonitor(authMonitor)
// api.addMonitor(Reactotron.apisauce)
api.addMonitor(endLoad)
api.addMonitor(handleErrors)
////


export default createApi;


