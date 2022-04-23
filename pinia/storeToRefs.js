import { toRaw, toRef, isRef, isReactive } from '../src/index.js'
export function storeToRefs (store) {
  store = toRaw(store)
  const refs = {}
  for (const key in store) {
    const value = store[key]
    if (isRef(value) || isReactive(value)) {
      refs[key] = toRef(store, key)
    }
  }
  return refs
}
