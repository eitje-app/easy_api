import React, {useState, useEffect, Fragment} from 'react'
import {useAsyncEffect, useIncrementState} from '@eitje/react-hooks'
import {backend} from '../index'

export const useGet = (endPoint) => {
  const [retries, retry] = useIncrementState()
  const [data, setData] = useState({})
  const [error, setError] = useState()
  const [loading, setLoading] = useState(true)
  useAsyncEffect(async () => {
    setLoading(true)
    const res = await backend.get(endPoint)

    if(res.ok) {
      setData(res.data)
    } else {
      setError(true)
    }

    setLoading(false)
  }, [retries])

  return {data, error, loading, retry}
}

export default useGet;
