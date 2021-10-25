import React, {useState, useEffect, Fragment} from 'react'
import {useSelector} from 'react-redux'
import {where} from '../index'

export const useWhere = (kind, query) => {
  const items = useSelector(state => where(state, kind, query ))
  return items;
}

export default useWhere