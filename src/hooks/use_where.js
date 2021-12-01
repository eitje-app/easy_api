import React, {useState, useEffect, Fragment} from 'react'
import {useSelector} from 'react-redux'
import {where} from '../index'

export const useWhere = (kind, query, opts) => {
  const items = useSelector((state) => where(state, kind, query, opts))
  return items
}

export default useWhere
