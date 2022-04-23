import { setActivePinia, piniaSymbol } from './rootStore.js'
import { ref, markRaw, effectScope } from '../src/index.js'

export function createPinia () {
  const scope = effectScope(true)
  const state = scope.run(() => ref({}))
  let _p = []
  let toBeInstalled = []
  const pinia = markRaw({
    install (app) {
      setActivePinia(pinia)
      pinia._a = app
      app.provide(piniaSymbol, pinia)
      app.config.globalProperties.$pinia = pinia
      toBeInstalled.forEach(plugin => _p.push(plugin))
      toBeInstalled = []
    },
    use (plugin) {
      if (!this._a) {
        toBeInstalled.push(plugin)
      } else {
        _p.push(plugin)
      }
      return this
    },
    _p,
    /**
     * app 实例
     */
    _a: null,
    _e: scope,
    /**
     * 储存所有 store, store = defineStore()
     */
    _s: new Map(),
    state
  })
  return pinia
}
