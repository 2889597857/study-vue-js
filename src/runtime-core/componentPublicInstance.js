import { shallowReadonly, track } from '../reactivity/index.js'
import {
  EMPTY_OBJ, extend, hasOwn,
  isGloballyWhitelisted
} from '../shared/index.js'
import { resolveMergedOptions, shouldCacheAccess } from './componentOptions.js'
import { nextTick, queueJob } from './scheduler.js'
export const getPublicInstance = i => {
  if (!i) return null
  if (isStatefulComponent(i)) return getExposeProxy(i) || i.proxy
  return getPublicInstance(i.parent)
}
export const PublicInstanceProxyHandlers = {
  get ({ _: instance }, key) {
    const {
      ctx,
      setupState,
      data,
      props,
      accessCache,
      type,
      appContext
    } = instance
    let normalizedProps
    if (key[0] !== '$') {
      const n = accessCache[key]
      if (n !== undefined) {
        switch (n) {
          case 1:
            return setupState[key]
          case 2:
            return data[key]
          case 4:
            return ctx[key]
          case 3:
            return props[key]
        }
      } else if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
        accessCache[key] = 1
        return setupState[key]
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache[key] = 2
        return data[key]
      } else if (
        (normalizedProps = instance.propsOptions[0]) &&
        hasOwn(normalizedProps, key)
      ) {
        accessCache[key] = 3
        return props[key]
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache[key] = 4
        return ctx[key]
      } else if (shouldCacheAccess) {
        accessCache[key] = 0
      }
    }
    const publicGetter = publicPropertiesMap[key]
    let cssModule, globalProperties
    if (publicGetter) {
      if (key === '$attrs') {
        track(instance, 'get', key)
      }
      return publicGetter(instance)
    } else if (
      (cssModule = type.__cssModules) &&
      (cssModule = cssModule[key])
    ) {
      return cssModule
    } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
      accessCache[key] = 4
      return ctx[key]
    } else if (
      ((globalProperties = appContext.config.globalProperties),
      hasOwn(globalProperties, key))
    ) {
      {
        return globalProperties[key]
      }
    }
  },
  set ({ _: instance }, key, value) {
    const { data, setupState, ctx } = instance
    if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
      setupState[key] = value
      return true
    } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value
      return true
    } else if (hasOwn(instance.props, key)) {
      return false
    }
    if (key[0] === '$' && key.slice(1) in instance) {
      return false
    } else {
      if (key in instance.appContext.config.globalProperties) {
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          value
        })
      } else {
        ctx[key] = value
      }
    }
    return true
  },
  has (
    { _: { data, setupState, accessCache, ctx, appContext, propsOptions } },
    key
  ) {
    let normalizedProps
    return (
      !!accessCache[key] ||
      (data !== EMPTY_OBJ && hasOwn(data, key)) ||
      (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) ||
      ((normalizedProps = propsOptions[0]) && hasOwn(normalizedProps, key)) ||
      hasOwn(ctx, key) ||
      hasOwn(publicPropertiesMap, key) ||
      hasOwn(appContext.config.globalProperties, key)
    )
  },
  defineProperty (target, key, descriptor) {
    if (descriptor.get != null) {
      this.set(target, key, descriptor.get(), null)
    } else if (descriptor.value != null) {
      this.set(target, key, descriptor.value, null)
    }
    return Reflect.defineProperty(target, key, descriptor)
  }
}
export const RuntimeCompiledPublicInstanceProxyHandlers = extend(
  {},
  PublicInstanceProxyHandlers,
  {
    get (target, key) {
      if (key === Symbol.unscopables) {
        return
      }
      return PublicInstanceProxyHandlers.get(target, key, target)
    },
    has (_, key) {
      const has = key[0] !== '_' && !isGloballyWhitelisted(key)
      return has
    }
  }
)
export const publicPropertiesMap = extend(Object.create(null), {
  $: i => i,
  $el: i => i.vnode.el,
  $data: i => i.data,
  $props: i => shallowReadonly(i.props),
  $attrs: i => shallowReadonly(i.attrs),
  $slots: i => shallowReadonly(i.slots),
  $refs: i => shallowReadonly(i.refs),
  $parent: i => getPublicInstance(i.parent),
  $root: i => getPublicInstance(i.root),
  $emit: i => i.emit,
  $options: i => resolveMergedOptions(i),
  $forceUpdate: i => () => queueJob(i.update),
  $nextTick: i => nextTick.bind(i.proxy),
  $watch: i => instanceWatch.bind(i)
})
