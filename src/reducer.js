import utils from '@eitje/utils';
import _ from 'lodash';
import {config} from './config'

const initialState = {
  deletedStamps: {}
};



const sortFunc = (items, kind) => {
  if (config.sortFuncs && config.sortFuncs[kind]) {
    return sortFuncs[kind](items);
  }
  return items;
};


const mapFetchedKinds = ({combined, old, newItem}) => {
  const fetchedKinds = [
    ...(old.fetchedKinds || []),
    ...(newItem.fetchedKinds || []),
  ];
  return {...combined, fetchedKinds};
};


export default function reduce(state = initialState, action) {
  switch (action.type) {

    case 'RESET_RECORDS':
      return {
        ...initialState,
      }

    case 'CLEAR_CACHE':
      return {
        ...state,
        [action.kind]: [],
        deletedStamps: {...state.deletedStamps, ...action.deletedStamps}
      }


    case 'INDEX_RECORDS':
      let oldItems = state[action.kind];
      const newItems = action.items;
      let indexItems = action.force
        ? newItems
        : utils.findAndReplace({oldItems, newItems, mapFunc: mapFetchedKinds});
      indexItems = _.uniqBy(indexItems, 'id');
      let sorted = sortFunc(indexItems, action.kind).map(i => ({
        ...i,
        indexed: true,
      }));
      const delStamps = state.deletedStamps || {};
      const delKind = action.delKind || action.kind;
      return {
        ...state,
        [action.kind]: sorted,
        deletedStamps: {...state.deletedStamps, [delKind]: action.deletedStamp},
      };

    case 'LOCAL_INDEX_RECORDS':
      let _oldItems = state[action.kind];
      const _newItems = action.items.map(i => ({...i, indexed: false}));
      let _indexItems = utils.findAndReplace({
        oldItems: _oldItems,
        newItems: _newItems,
      });
      _indexItems = _.uniqBy(_indexItems, 'id');
      const _sorted = sortFunc(_indexItems, action.kind);
      return {
        ...state,
        [action.kind]: _sorted,
      };

    case 'CREATE_RECORD':
      return {
        ...state,
        [action.kind]: sortFunc(
          [...state[action.kind], {...action.item, indexed: false}],
          action.kind,
        ),
      };

    case 'UPDATE_RECORD':
      const itemz = [...(state[action.kind] || [])];
      const item = {
        ...(itemz.find(i => i.id === action.item.id) || {}),
        ...action.item,
      };
      item.indexed = false;
      return {
        ...state,
        [action.kind]: sortFunc(
          utils.findAndReplace({oldItems: itemz, newItems: [item]}),
          action.kind,
        ),
      };

    case 'DELETE_RECORD':
      let ids = _.isArray(action.id) ? action.id : [action.id];
      if(!state[action.kind]) return state;
      const delItems = [...state[action.kind]].filter(i => !ids.includes(i.id));
      return {
        ...state,
        [action.kind]: sortFunc(delItems, action.kind),
      };

    case 'ADD_RECORDS':
      let items = [...state[action.kind]];
      action.items.forEach(i => {
        i.indexed = false;
        items = utils.findAndReplace(items, i);
      });
      return {
        ...state,
        [action.kind]: sortFunc(items, action.kind),
      };

    default:
      return state;
  }
}
