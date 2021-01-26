import _ from 'lodash'

export const includesRecord = (entities, query) => {
  return entities.filter(e => {
      const keys = Object.keys(query) // [1,2,3,4]
      return keys.every(k => query[k].some(id => e[k] && e[k].includes(id) ) )
  })
}

export const filterByDate  = (entities, {start, end}, {dateField = 'date'} = {} ) => {

  return entities.filter(e => {
    if(start && end) return e[dateField] >= start && e.date <= end;
    if(start) return e[dateField] >= start;
    return e[dateField] <= end;

  })
}

export const findRecord = (entities = [], query) => {
  if(!query) return null

  return entities.find(i => {
    
    if (!_.isObject(query)) {
      return i.id == query
    } else {
      return Object.keys(query).every(k => i[k] === query[k] )
    }

  } )
}

export const filterRecord = (entities = [], query) => {
  if(!query) return []
  return entities.filter(i => {
    
    if (_.isArray(query)) {
      return query.includes(i.id)
    } else {
      return Object.keys(query).every(k => {
        const objVal = i[k]
        const queryVal = query[k]
        if( numberOrString(objVal) && numberOrString(queryVal) ) {
          return queryVal == objVal 
        }
        return _.isEqual(objVal, queryVal)
      })
    }

  } )
}

const numberOrString = val => _.isNumber(val) || _.isString(val)