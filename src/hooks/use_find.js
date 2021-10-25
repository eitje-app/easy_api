import React, {useState, useEffect, Fragment} from 'react'
import {useSelector} from 'react-redux'
import {find} from '../index'

export const useFind = (kind, id) => {
  const item = useSelector(state => find(state, kind, id ))
  return item;
}

export default useFind