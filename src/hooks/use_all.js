import React, {useState, useEffect, Fragment} from 'react'
import {useSelector} from 'react-redux'
import {all} from '../index'

export const useAll = (kind) => {
  const items = useSelector(state => all(state, kind ))
  return items;
}

export default useAll