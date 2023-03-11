import { pauseTracking, resetTracking } from '../reactivity/index.js'
import {
  currentInstance,
  setCurrentInstance,
  unsetCurrentInstance
} from './component.js'
/**
 *
 * @param {Object} type  - 生命周期类型
 * @param {Function} hook - 生命周期函数的回调函数
 * @param {*} target - 组件实例
 * @param {*} prepend
 * @returns {Function}
 */
export function injectHook(type, hook, target = currentInstance, prepend = false) {
  // console.log(type, hook, target, prepend)
  if (target) {
    const hooks = target[type] || (target[type] = [])
    // cache the error handling wrapper for injected hooks so the same hook
    // can be properly deduped by the scheduler. "__weh" stands for "with error
    // handling".】
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args) => {
        if (target.isUnmounted) {
          return
        }
        // 暂停响应式
        pauseTracking()
        // 设置组件实例
        setCurrentInstance(target)
        // 执行生命周期函数
        const res = hook(args)
        unsetCurrentInstance()
        // 恢复收集
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
export function onErrorCaptured(hook, target = currentInstance) {
  injectHook('ec' /* ERROR_CAPTURED */, hook, target)
}
