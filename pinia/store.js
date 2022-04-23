import {
  watch,
  computed,
  inject,
  getCurrentInstance,
  reactive,
  markRaw,
  isRef,
  isReactive,
  effectScope,
  toRaw,
  toRefs,
  nextTick
} from '../src/index.js'

import { setActivePinia, piniaSymbol, activePinia } from './rootStore.js'

import { addSubscription, triggerSubscriptions, noop } from './subscriptions.js'

function isPlainObject (o) {
  return (
    o &&
    typeof o === 'object' &&
    Object.prototype.toString.call(o) === '[object Object]' &&
    typeof o.toJSON !== 'function'
  )
}
function mergeReactiveObjects (target, patchToApply) {
  // no need to go through symbols because they cannot be serialized anyway
  for (const key in patchToApply) {
    const subPatch = patchToApply[key]
    const targetValue = target[key]
    if (
      isPlainObject(targetValue) &&
      isPlainObject(subPatch) &&
      !isRef(subPatch) &&
      !isReactive(subPatch)
    ) {
      target[key] = mergeReactiveObjects(targetValue, subPatch)
    } else {
      // @ts-expect-error: subPatch is a valid value
      target[key] = subPatch
    }
  }
  return target
}

const skipHydrateSymbol = Symbol('pinia:skipHydration')

export function skipHydrate (obj) {
  return Object.defineProperty(obj, skipHydrateSymbol, {})
}
function shouldHydrate (obj) {
  return !isPlainObject(obj) || !obj.hasOwnProperty(skipHydrateSymbol)
}

const { assign } = Object

function isComputed (o) {
  return !!(isRef(o) && o.effect)
}
/**
 *
 * @param {string} id store 名称
 * @param {*} options
 * @param {*} pinia
 */
function createOptionsStore (id, options, pinia) {
  const { state, actions, getters } = options
  /**
   * 初始值 undefined
   */
  const initialState = pinia.state.value[id]
  let store
  /**
   * 初始化 store
   * 把 store 的 state 添加到 pinia 的 state 的上面
   * @returns
   */
  function setup () {
    if (!initialState) {
      // 初始化,执行 state() , 获取 state 值添加到 pinia的state上面
      pinia.state.value[id] = state ? state() : {}
    }
    // 添加响应式
    const localState = toRefs(pinia.state.value[id])
    return assign(
      localState,
      actions,
      // 把 getter 里面的值转为 computed 计算属性
      Object.keys(getters || {}).reduce((computedGetters, name) => {
        computedGetters[name] = markRaw(
          computed(() => {
            setActivePinia(pinia)
            const store = pinia._s.get(id)
            // allow cross using stores
            // return getters![name].call(context, context)
            // TODO: avoid reading the getter while assigning with a global variable
            return getters[name].call(store, store)
          })
        )
        return computedGetters
      }, {})
    )
  }
  store = createSetupStore(id, setup, options, pinia)
  /**
   * 重置 所有 store 状态
   */
  store.$reset = function $reset () {
    /**
     * state 原始值
     */
    const newState = state ? state() : {}
    // we use a patch to group all changes into one single subscription
    // $state 最新的(改变后) state
    this.$patch($state => assign($state, newState))
  }
  return store
}
function createSetupStore ($id, setup, options = {}, pinia) {
  let scope
  /**
   * state Function
   */
  const buildState = options.state
  const optionsForPlugin = assign({ actions: {} }, options)
  // watcher options for $subscribe
  const $subscribeOptions = {
    deep: true
    // flush: 'post',
  }
  // internal state
  let isListening // set to true at the end
  let isSyncListening // set to true at the end
  let subscriptions = markRaw([])
  let actionSubscriptions = markRaw([])
  /**
   * 初始值 undefined
   * setup 函数调用后，才有值
   * scope.run(() => setup())
   */
  const initialState = pinia.state.value[$id]
  if (!buildState && !initialState) {
    pinia.state.value[$id] = {}
  }
  /**
   *
   * @param {*} partialStateOrMutator
   */
  function $patch (partialStateOrMutator) {
    let subscriptionMutation
    isListening = isSyncListening = false
    if (typeof partialStateOrMutator === 'function') {
      partialStateOrMutator(pinia.state.value[$id])
      subscriptionMutation = {
        type: 'patch function',
        storeId: $id
      }
    } else {
      mergeReactiveObjects(pinia.state.value[$id], partialStateOrMutator)
      subscriptionMutation = {
        type: 'patch object',
        payload: partialStateOrMutator,
        storeId: $id
      }
    }
    nextTick().then(() => {
      isListening = true
    })
    isSyncListening = true
    // because we paused the watcher, we need to manually call the subscriptions
    triggerSubscriptions(
      subscriptions,
      subscriptionMutation,
      pinia.state.value[$id]
    )
  }

  const $reset = noop
  function $dispose () {
    // 清除 store 数据响应效果
    scope.stop()
    subscriptions = []
    actionSubscriptions = []
    // 删除 store
    pinia._s.delete($id)
  }
  /**
   * Wraps an action to handle subscriptions.
   *
   * @param name - name of the action
   * @param action - action to wrap
   * @returns a wrapped action to handle subscriptions
   */
  function wrapAction (name, action) {
    return function () {
      setActivePinia(pinia)
      const args = Array.from(arguments)
      const afterCallbackList = []
      function after (callback) {
        afterCallbackList.push(callback)
      }
      // triggerSubscriptions(actionSubscriptions, {
      //   args,
      //   name,
      //   store,
      //   after
      // })
      /**
       * actions 函数返回值
       */
      let ret
      try {
        ret = action.apply(this && this.$id === $id ? this : store, args)
        // handle sync errors
      } catch (error) {
        triggerSubscriptions(onErrorCallbackList, error)
        throw error
      }
      /**
       * 返回值是否是 Promise (异步)
       */
      if (ret instanceof Promise) {
        return ret
          .then(value => {
            triggerSubscriptions(afterCallbackList, value)
            return value
          })
          .catch(error => {
            triggerSubscriptions(onErrorCallbackList, error)
            return Promise.reject(error)
          })
      }
      // allow the afterCallback to override the return value
      triggerSubscriptions(afterCallbackList, ret)
      return ret
    }
  }
  const partialStore = {
    _p: pinia,
    // _s: scope,
    $id,
    $onAction: addSubscription.bind(null, actionSubscriptions),
    $patch,
    $reset,
    $subscribe (callback, options = {}) {
      const removeSubscription = addSubscription(
        subscriptions,
        callback,
        options.detached,
        () => stopWatcher()
      )
      const stopWatcher = scope.run(() =>
        watch(
          () => pinia.state.value[$id],
          state => {
            if (options.flush === 'sync' ? isSyncListening : isListening) {
              callback(
                {
                  storeId: $id,
                  type: 'direct'
                },
                state
              )
            }
          },
          assign({}, $subscribeOptions, options)
        )
      )
      return removeSubscription
    },
    $dispose
  }
  const store = reactive(assign({}, partialStore))
  pinia._s.set($id, store)
  const setupStore = pinia._e.run(() => {
    scope = effectScope()
    return scope.run(() => setup())
  })
  // setupStore：{state actions getters}
  for (const key in setupStore) {
    const prop = setupStore[key]
    if ((isRef(prop) && !isComputed(prop)) || isReactive(prop)) {
      // state
      if (!buildState) {
        // store 没有 state
        if (initialState && shouldHydrate(prop)) {
          if (isRef(prop)) {
            prop.value = initialState[key]
          } else {
            // probably a reactive object, lets recursively assign
            mergeReactiveObjects(prop, initialState[key])
          }
        }
        // transfer the ref to the pinia state to keep everything in sync
        pinia.state.value[$id][key] = prop
      }
      // action
    } else if (typeof prop === 'function') {
      const actionValue = wrapAction(key, prop)
      setupStore[key] = actionValue
      // list actions so they can be used in plugins
      optionsForPlugin.actions[key] = prop
    }
  }
  // add the state, getters, and action properties
  assign(store, setupStore)
  // storeToRefs() 能找到原始值
  assign(toRaw(store), setupStore)
  // use this instead of a computed with setter to be able to create it anywhere
  // without linking the computed lifespan to wherever the store is first
  // created.
  Object.defineProperty(store, '$state', {
    get: () => pinia.state.value[$id],
    set: state => {
      $patch($state => {
        console.log(123)
        assign($state, state)
      })
    }
  })
  // apply all plugins
  pinia._p.forEach(extender => {
    {
      assign(
        store,
        scope.run(() =>
          extender({
            store,
            app: pinia._a,
            pinia,
            options: optionsForPlugin
          })
        )
      )
    }
  })

  isListening = true
  isSyncListening = true
  return store
}

export function defineStore (idOrOptions, setup, setupOptions) {
  let id
  let options
  /**
   * setup 是函数吗
   */
  const isSetupStore = typeof setup === 'function'
  if (typeof idOrOptions === 'string') {
    id = idOrOptions
    options = isSetupStore ? setupOptions : setup
  } else {
    id = idOrOptions.id
    options = idOrOptions
  }
  function useStore (pinia) {
    const currentInstance = getCurrentInstance()
    pinia = pinia || (currentInstance && inject(piniaSymbol))
    if (pinia) setActivePinia(pinia)
    pinia = activePinia
    if (!pinia._s.has(id)) {
      if (isSetupStore) {
        createSetupStore(id, setup, options, pinia)
      } else {
        createOptionsStore(id, options, pinia)
      }
    }
    const store = pinia._s.get(id)
    return store
  }
  useStore.$id = id
  return useStore
}
