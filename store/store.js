import { createStore } from 'redux'
import reducer from './reducer'

const store = createStore(reducer)

export default store

// For debugging
// setTimeout(() => {
//   console.log(store.getState())
//   console.log(JSON.stringify(store.getState().accountDescriptor))
// }, 7500)