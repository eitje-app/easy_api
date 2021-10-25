import {API} from '../index'
import {useEffect} from 'react'
import useAll from './use_all'

export const useIndex = (kind, opts = {}) => {
  useEffect(() => {
    API.index(kind, opts)
  }, [])
  const items = useAll(kind)
  return items;

}

export default useIndex