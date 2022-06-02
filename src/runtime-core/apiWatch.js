import {
  isRef,
  isShallow,
  ReactiveEffect,
  isReactive
} from '../reactivity/index.js'
import {
  EMPTY_OBJ,
  isObject,
  isArray,
  isFunction,
  isString,
  hasChanged,
  NOOP,
  remove,
  isMap,
  isSet,
  isPlainObject
} from '../shared/index.js'
import { queuePreFlushCb } from './scheduler.js'
import {
  currentInstance,
  setCurrentInstance,
  unsetCurrentInstance
} from './component.js'
import { queuePostRenderEffect } from './renderer.js'

export function watchEffect(effect, options) {
  return doWatch(effect, null, options)
}

export function watchPostEffect(effect, options) {
  return doWatch(effect, null, Object.assign(options || {}, { flush: 'post' }))
}

export function watchSyncEffect(effect, options) {
  return doWatch(effect, null, Object.assign(options || {}, { flush: 'sync' }))
}
const INITIAL_WATCHER_VALUE = {}
/**
 * 
 * @param {*} source 监听数据
 * @param {function} cb 数据变化时执行的函数
 * @param {*} options 配置，immediate：立即执行, deep：深层次监听, flush：pre|post|sync 回调函数的执行时机
 * @returns 
 */
export function watch(source, cb, options) {
  if (!isFunction(cb)) return false
  return doWatch(source, cb, options)
}
/**
 * @param {ref|reactive|Array|Function} source 需要监听的数据
 * @param {function} cb 回调函数
 * @param {*} options 配置
 * @param {Boolean}immediate 立即执行
 * @param {Boolean} deep 深层次监听
 * @param {pre|post|sync} flush 回调函数的执行时机，组件更新前、更新后、更新时
 *
 */
function doWatch(source, cb, { immediate, deep, flush } = EMPTY_OBJ) {
  const instance = currentInstance
  let getter
  let forceTrigger = false
  let isMultiSource = false
  // 处理需要监听的数据
  // ref reactive Function [ref,reactive]
  if (isRef(source)) {
    // ref
    getter = () => source.value
    forceTrigger = isShallow(source)
  } else if (isReactive(source)) {
    // reactive
    getter = () => source
    deep = true
  } else if (isArray(source)) {
    // Array
    isMultiSource = true
    forceTrigger = source.some(isReactive)
    getter = () =>
      source.map(s => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          return traverse(s)
        } else if (isFunction(s)) {
          return s()
        }
      })
  } else if (isFunction(source)) {
    if (cb) {
      // getter with cb
      getter = () => source()
    } else {
      // no cb -> simple effect
      getter = () => {
        if (instance && instance.isUnmounted) {
          return
        }
        if (cleanup) {
          cleanup()
        }
        return source(onCleanup)
      }
    }
  } else {
    getter = NOOP
  }
  // 深层次监听
  if (cb && deep) {
    const baseGetter = getter
    // 递归
    getter = () => traverse(baseGetter())
  }
  let cleanup
  let onCleanup = fn => {
    cleanup = effect.onStop = () => fn()
  }
  let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE
  // 调度任务(监听值改变后执行的任务)
  const job = () => {
    if (!effect.active) {
      return
    }
    if (cb) {
      // watch(source, cb)
      const newValue = effect.run()
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? newValue.some((v, i) => hasChanged(v, oldValue[i]))
          : hasChanged(newValue, oldValue)) ||
        false
      ) {
        // 清理 effect
        if (cleanup) {
          cleanup()
        }
        // 回调函数执行
        cb(
          newValue,
          // pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onCleanup
        )
        oldValue = newValue
      }
    } else {
      // watchEffect
      effect.run()
    }
  }
  // 允许递归
  job.allowRecurse = !!cb // true
  let scheduler
  // 回调函数的执行时机
  // 同步
  if (flush === 'sync') {
    scheduler = job
  } else if (flush === 'post') {
    // 组件更新后调用
    scheduler = () => queuePostRenderEffect(job, instance && instance.suspense)
  } else {
    // 默认组件更新前前回调函数执行
    scheduler = () => {
      // 组件是否挂载
      if (!instance || instance.isMounted) {
        // 组件实例不存在或者组件已经挂载
        // 异步队列
        queuePreFlushCb(job)
      } else {
        // pre 队列必须在组件挂载前同步执行
        job()
      }
    }
  }
  const effect = new ReactiveEffect(getter, scheduler)
  // initial run
  if (cb) {
    // watch 默认当值改变时执行
    if (immediate) {
      // 先执行一次 watch 的回调函数
      job()
    } else {
      oldValue = effect.run()
    }
  } else if (flush === 'post') {
    queuePostRenderEffect(
      effect.run.bind(effect),
      instance && instance.suspense
    )
  } else {
    effect.run()
  }
  return () => {
    // 停止监听
    effect.stop()
    if (instance && instance.scope) {
      remove(instance.scope.effects, effect)
    }
  }
}

export function instanceWatch(source, value, options) {
  const publicThis = this.proxy
  const getter = isString(source)
    ? source.includes('.')
      ? createPathGetter(publicThis, source)
      : () => publicThis[source]
    : source.bind(publicThis, publicThis)
  let cb
  if (isFunction(value)) {
    cb = value
  } else {
    cb = value.handler
    options = value
  }
  const cur = currentInstance
  setCurrentInstance(this)
  const res = doWatch(getter, cb.bind(publicThis), options)
  if (cur) {
    setCurrentInstance(cur)
  } else {
    unsetCurrentInstance()
  }
  return res
}

export function createPathGetter(ctx, path) {
  const segments = path.split('.')
  return () => {
    let cur = ctx
    for (let i = 0; i < segments.length && cur; i++) {
      cur = cur[segments[i]]
    }
    return cur
  }
}
export function traverse(value, seen) {
  if (!isObject(value) || value['__v_skip']) {
    return value
  }
  seen = seen || new Set()
  if (seen.has(value)) {
    return value
  }
  seen.add(value)
  if (isRef(value)) {
    traverse(value.value, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach(v => {
      traverse(v, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
  return value
}
