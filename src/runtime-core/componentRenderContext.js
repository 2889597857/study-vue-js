import { setBlockTracking } from './vnode.js'

export let currentRenderingInstance = null
export let currentScopeId = null
export function setCurrentRenderingInstance (instance) {
  const prev = currentRenderingInstance
  currentRenderingInstance = instance
  currentScopeId = (instance && instance.type.__scopeId) || null
  return prev
}
export function pushScopeId (id) {
  currentScopeId = id
}
export function popScopeId () {
  currentScopeId = null
}
export const withScopeId = _id => withCtx
export function withCtx (fn, ctx = currentRenderingInstance, isNonScopedSlot) {
  if (!ctx) return fn
  if (fn._n) {
    return fn
  }
  const renderFnWithContext = (...args) => {
    if (renderFnWithContext._d) {
      setBlockTracking(-1)
    }
    const prevInstance = setCurrentRenderingInstance(ctx)
    const res = fn(...args)
    setCurrentRenderingInstance(prevInstance)
    if (renderFnWithContext._d) {
      setBlockTracking(1)
    }
    return res
  }
  renderFnWithContext._n = true
  renderFnWithContext._c = true
  renderFnWithContext._d = true
  return renderFnWithContext
}
