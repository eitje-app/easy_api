import {config} from './config'
import {create} from 'apisauce'
import utils from '@eitje/utils'
import _ from 'lodash'
import Qs from 'qs'
import moment from 'moment'

let api
const createApi = () => {
	api = create({
		baseURL: config.baseURL,
		headers: {
			'Content-Type': 'application/json',
			credentials: 'same-origin',
			'Access-Control-Allow-Origin': '*',
		},
		paramsSerializer: serializeNestedParams,
		...config.apiConfig,
	})

	api.addAsyncRequestTransform(request => setVersion(request))
	api.addAsyncRequestTransform(request => changeTokenHeader(request))
	api.addRequestTransform(request => startLoad(request))
	api.addRequestTransform(sanitizeParams)

	api.addMonitor(authMonitor)
	//
	api.addMonitor(endLoad)
	api.addMonitor(handleErrors)
	if (config.reportSuccess) api.addMonitor(reportSuccess)

	return api
}

export const sanitizeMoment = v => (v instanceof moment ? v.format('YYYY-MM-DD') : v)

const sanitizeParams = request => {
	const {headers = {}} = request
	const contentType = headers['Content-Type']
	if (contentType == 'multipart/form-data') return

	request.params = _sanitizeParams(request.params)
	request.data = _sanitizeParams(request.data)
}

export function deepTransformValues(obj, mapper) {
	for (let key in obj) {
		if (typeof obj[key] === 'object' && obj[key] !== null) {
			obj[key] = moment.isMoment(obj[key]) ? mapper(obj[key]) : deepTransformValues(obj[key], mapper)
		} else {
			obj[key] = mapper(obj[key])
		}
	}
	return obj
}

const _sanitizeParams = obj => {
	if (!obj) return
	return deepTransformValues(obj, sanitizeMoment)
}

const serializeNestedParams = params => Qs.stringify(params, {arrayFormat: 'brackets'})

async function changeTokenHeader(req) {
	if (req.url !== 'oauth/token' && req.url !== 'auth' && req.url !== 'users/sign_up' && req.url !== 'auth/confirmed') {
		const token = await config.getRefreshToken()
		if (token) {
			if (!req.params) req.params = {}
			if (req.params) req.params['access_token'] = token
		}
	}
}

async function setVersion(req) {
	if (!req.params) req.params = {}
	req.params['version'] = config.version
}

const authMonitor = res => {
	if (res.status === 401 && !res.config.url.match(/auth/)) {
		config.logout()
	}
}

const getData = req => {
	const {params = {}, data = {}} = req
	return {...params, ...data}
}

const indexRegex = /\/index$/

const isIndexUrl = req => {
	const {indexUrls = {}} = config

	const urls = Object.values(indexUrls)
	const url = req.config?.url || req.url
	if (!url) return
	return url.match(indexRegex) || urls.includes(url)
}

const startLoad = req => {
	const data = getData(req)
	const isMultiPart = req.headers['Content-Type'] === 'multipart/form-data'
	if (isIndexUrl(req) && !data['doLoad']) return

	if (
		data.doLoad ||
		req.headers['doLoad'] ||
		(req.method !== 'get' && !isMultiPart && !req.headers['doNotLoad'] && (!data || !data.doNotLoad))
	) {
		config.store && config.store.dispatch({type: 'START_LOADING'})
	}
}

const endLoad = req => {
	const data = getDataForMonitor(req) || {}
	if (isIndexUrl(req) && !data['doLoad']) return
	if (data.doLoad || (req.config.method !== 'get' && !data.doNotLoad)) {
		config.store.dispatch({type: 'STOP_LOADING'})
	}
}

function setErrors(errors) {
	errors = utils.alwaysDefinedArray(errors)
	errors.forEach(reportError)
}

const reportError = errors => {
	const hasError = _.isObject(errors) && Object.keys(errors).length > 0
	let err
	if (hasError) {
		const errs = _.flatten(Object.values(errors))
		err = errs[0]
	} else {
		err = _.isString(errors) ? errors : t('unexpectedIssue')
	}
	if (!_.isString(err)) return
	config.alert(config.t('oops'), err)
}

function reportValidationErrs(errors) {
	const {t, alert} = config
	if (!_.isObject(errors)) return
	const newErrors = Object.values(errors).map(err => err[0])
	newErrors.map(e => alert(t('oops'), e))
}

const restStatusses = [410]

function handleErrors(res) {
	const {t, alert, ignoreErrors} = config
	if (restStatusses.includes(res.status)) return // these errors are resource-specific and thus handled by my higher-level counterpart
	if (ignoreErrors(res)) return

	if (res.problem === 'NETWORK_ERROR') {
		alert(t('oops'), t('networkUnreachable'))
		return
	}

	if (res.status === 403) {
		const msg = res?.data?.message || t('unauthorized')
		alert(t('oops'), msg)
		return
	}

	let errs = res.data?.errors || res.errors
	if (res.status > 400 && !errs) errs = res.data

	if (!config.isProd && errs?.exception) {
		return config.alert(config.t('oops'), errs.exception)
	}

	if (errs && !errs?.exception) {
		setErrors(errs)
		return
	}
	if (res.status <= 401) return
	config.alert(config.t('oops'), config.t('unexpectedIssue'))
}

function reportSuccess(req) {
	if (isIndexUrl(req)) return
	const data = getDataForMonitor(req)
	const heads = req.config.headers || {}
	if (req.config.method != 'get' && req.ok && req.status <= 300 && !data?.doNotLoad && !data?.skipSuccessNotif) {
		config.success()
		console.log(req)
	}
}

const getDataForMonitor = req => {
	let data

	try {
		data = req.config.data ? JSON.parse(req.config.data) : req.config.params
	} catch (e) {
		data = req.config.params
	}

	return data
}

export default createApi
export {api}
