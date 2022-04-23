import {
  currentInstance,
  setCurrentInstance,
  unsetCurrentInstance
} from './component.js'
import { pauseTracking, resetTracking } from '../reactivity/index.js'
function injectHook (type, hook, target = currentInstance, prepend = false) {
  if (target) {
    const hooks = target[type] || (target[type] = [])
    // cache the error handling wrapper for injected hooks so the same hook
    // can be properly deduped by the scheduler. "__weh" stands for "with error
    // handling".
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args) => {
        if (target.isUnmounted) {
          return
        }
        // disable tracking inside all lifecycle hooks
        // since they can potentially be called inside effects.
        pauseTracking()
        // Set currentInstance during hook invocation.
        // This assumes the hook does not synchronously trigger other hooks, which
        // can only be false when the user does something really funky.
        setCurrentInstance(target)
        const res = hook(args)
        unsetCurrentInstance()
        resetTracking()
        return res
      })
    if (prepend) {
      hooks.unshift(wrappedHook)
    } else {
      hooks.push(wrappedHook)
    }
    return wrappedHook
  }
}
export const createHook = lifecycle => (hook, target = currentInstance) =>
  injectHook(lifecycle, hook, target)
export const onBeforeMount = createHook('bm' /* BEFORE_MOUNT */)
export const onMounted = createHook('m' /* MOUNTED */)
export const onBeforeUpdate = createHook('bu' /* BEFORE_UPDATE */)
export const onUpdated = createHook('u' /* UPDATED */)
export const onBeforeUnmount = createHook('bum' /* BEFORE_UNMOUNT */)
export const onUnmounted = createHook('um' /* UNMOUNTED */)
export const onServerPrefetch = createHook('sp' /* SERVER_PREFETCH */)
export const onRenderTriggered = createHook('rtg' /* RENDER_TRIGGERED */)
export const onRenderTracked = createHook('rtc' /* RENDER_TRACKED */)
export function onErrorCaptured (hook, target = currentInstance) {
  injectHook('ec' /* ERROR_CAPTURED */, hook, target)
}
