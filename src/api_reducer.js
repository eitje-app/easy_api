const initialState = {
  loading: false
}

export default function reduce(state = initialState, action) {

  switch(action.type) {
    case 'START_LOADING':
      return {
        ...state,
        loading: true
      }

    case 'END_LOADING':
      return {...state, loading: false}

    default:
      return state;
  }
}