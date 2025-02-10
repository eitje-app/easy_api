import {API} from '../index'
import {useEffect} from 'react'
import useAll from './use_all'

export const useIndex = (kind, opts = {}, {watch = []} = {}) => {
	useEffect(() => {
		API.index(kind, opts)
	}, watch)
	const items = useAll(kind)
	return items
}

export default useIndex
