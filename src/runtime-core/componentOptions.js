import { isRef, reactive } from '../reactivity/index.js'
import {
  extend, isArray, isFunction, isObject, isString, NOOP
} from '../shared/index.js'
function createDuplicateChecker () {
  const cache = Object.create(null)
  return (type, key) => {
    if (!cache[key]) {
      cache[key] = type
    }
  }
}
export let shouldCacheAccess = true
export function applyOptions (instance) {
  const options = resolveMergedOptions(instance)
  const publicThis = instance.proxy
  const ctx = instance.ctx
  shouldCacheAccess = false
  if (options.beforeCreate) {
    callHook(options.beforeCreate, instance, 'bc')
  }
  const {
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    activated,
    deactivated,
    beforeDestroy,
    beforeUnmount,
    destroyed,
    unmounted,
    render,
    renderTracked,
    renderTriggered,
    errorCaptured,
    serverPrefetch,
    expose,
    inheritAttrs,
    components,
    directives,
    filters
  } = options
  const checkDuplicateProperties = createDuplicateChecker()
  {
    const [propsOptions] = instance.propsOptions
    if (propsOptions) {
      for (const key in propsOptions) {
        checkDuplicateProperties('Props', key)
      }
    }
  }
  if (injectOptions) {
    resolveInjections(
      injectOptions,
      ctx,
      checkDuplicateProperties,
      instance.appContext.config.unwrapInjectedRef
    )
  }
  if (methods) {
    for (const key in methods) {
      const methodHandler = methods[key]
      if (isFunction(methodHandler)) {
        {
          Object.defineProperty(ctx, key, {
            value: methodHandler.bind(publicThis),
            configurable: true,
            enumerable: true,
            writable: true
          })
        }
        {
          checkDuplicateProperties('Methods', key)
        }
      }
    }
  }
  if (dataOptions) {
    const data = dataOptions.call(publicThis, publicThis)

    if (isObject(data)) {
      instance.data = reactive(data)
      {
        for (const key in data) {
          checkDuplicateProperties('Data', key)
          if (key[0] !== '$' && key[0] !== '_') {
            Object.defineProperty(ctx, key, {
              configurable: true,
              enumerable: true,
              get: () => data[key],
              set: NOOP
            })
          }
        }
      }
    }
  }
  shouldCacheAccess = true
  if (computedOptions) {
    for (const key in computedOptions) {
      const opt = computedOptions[key]
      const get = isFunction(opt)
        ? opt.bind(publicThis, publicThis)
        : isFunction(opt.get)
        ? opt.get.bind(publicThis, publicThis)
        : NOOP

      const set =
        !isFunction(opt) && isFunction(opt.set)
          ? opt.set.bind(publicThis)
          : () => {}
      const c = computed$1({ get, set })
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => c.value,
        set: v => (c.value = v)
      })
      {
        checkDuplicateProperties('Computed', key)
      }
    }
  }
  if (watchOptions) {
    for (const key in watchOptions) {
      createWatcher(watchOptions[key], ctx, publicThis, key)
    }
  }
  if (provideOptions) {
    const provides = isFunction(provideOptions)
      ? provideOptions.call(publicThis)
      : provideOptions
    Reflect.ownKeys(provides).forEach(key => {
      provide(key, provides[key])
    })
  }
  if (created) {
    callHook(created, instance, 'c')
  }
  function registerLifecycleHook (register, hook) {
    if (isArray(hook)) {
      hook.forEach(_hook => register(_hook.bind(publicThis)))
    } else if (hook) {
      register(hook.bind(publicThis))
    }
  }
  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
  registerLifecycleHook(onBeforeUpdate, beforeUpdate)
  registerLifecycleHook(onUpdated, updated)
  registerLifecycleHook(onActivated, activated)
  registerLifecycleHook(onDeactivated, deactivated)
  registerLifecycleHook(onErrorCaptured, errorCaptured)
  registerLifecycleHook(onRenderTracked, renderTracked)
  registerLifecycleHook(onRenderTriggered, renderTriggered)
  registerLifecycleHook(onBeforeUnmount, beforeUnmount)
  registerLifecycleHook(onUnmounted, unmounted)
  registerLifecycleHook(onServerPrefetch, serverPrefetch)
  if (isArray(expose)) {
    if (expose.length) {
      const exposed = instance.exposed || (instance.exposed = {})
      expose.forEach(key => {
        Object.defineProperty(exposed, key, {
          get: () => publicThis[key],
          set: val => (publicThis[key] = val)
        })
      })
    } else if (!instance.exposed) {
      instance.exposed = {}
    }
  }
  if (render && instance.render === NOOP) {
    instance.render = render
  }
  if (inheritAttrs != null) {
    instance.inheritAttrs = inheritAttrs
  }
  if (components) instance.components = components
  if (directives) instance.directives = directives
}
function resolveInjections (
  injectOptions,
  ctx,
  checkDuplicateProperties = NOOP,
  unwrapRef = false
) {
  if (isArray(injectOptions)) {
    injectOptions = normalizeInject(injectOptions)
  }
  for (const key in injectOptions) {
    const opt = injectOptions[key]
    let injected
    if (isObject(opt)) {
      if ('default' in opt) {
        injected = inject(opt.from || key, opt.default, true)
      } else {
        injected = inject(opt.from || key)
      }
    } else {
      injected = inject(opt)
    }
    if (isRef(injected)) {
      if (unwrapRef) {
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          get: () => injected.value,
          set: v => (injected.value = v)
        })
      } else {
        ctx[key] = injected
      }
    } else {
      ctx[key] = injected
    }
    {
      checkDuplicateProperties('Inject', key)
    }
  }
}
function callHook (hook, instance, type) {
  isArray(hook)
    ? hook.map(h => h.bind(instance.proxy))
    : hook.bind(instance.proxy)
}
function createWatcher (raw, ctx, publicThis, key) {
  const getter = key.includes('.')
    ? createPathGetter(publicThis, key)
    : () => publicThis[key]
  if (isString(raw)) {
    const handler = ctx[raw]
    if (isFunction(handler)) {
      watch(getter, handler)
    }
  } else if (isFunction(raw)) {
    watch(getter, raw.bind(publicThis))
  } else if (isObject(raw)) {
    if (isArray(raw)) {
      raw.forEach(r => createWatcher(r, ctx, publicThis, key))
    } else {
      const handler = isFunction(raw.handler)
        ? raw.handler.bind(publicThis)
        : ctx[raw.handler]
      if (isFunction(handler)) {
        watch(getter, handler, raw)
      }
    }
  }
}
export function resolveMergedOptions (instance) {
  const base = instance.type
  const { mixins, extends: extendsOptions } = base
  const {
    mixins: globalMixins,
    optionsCache: cache,
    config: { optionMergeStrategies }
  } = instance.appContext
  const cached = cache.get(base)
  let resolved
  if (cached) {
    resolved = cached
  } else if (!globalMixins.length && !mixins && !extendsOptions) {
    {
      resolved = base
    }
  } else {
    resolved = {}
    if (globalMixins.length) {
      globalMixins.forEach(m =>
        mergeOptions(resolved, m, optionMergeStrategies, true)
      )
    }
    mergeOptions(resolved, base, optionMergeStrategies)
  }
  cache.set(base, resolved)
  return resolved
}
function mergeOptions (to, from, strats, asMixin = false) {
  const { mixins, extends: extendsOptions } = from
  if (extendsOptions) {
    mergeOptions(to, extendsOptions, strats, true)
  }
  if (mixins) {
    mixins.forEach(m => mergeOptions(to, m, strats, true))
  }
  for (const key in from) {
    if (asMixin && key === 'expose') {
    } else {
      const strat = internalOptionMergeStrats[key] || (strats && strats[key])
      to[key] = strat ? strat(to[key], from[key]) : from[key]
    }
  }
  return to
}
const internalOptionMergeStrats = {
  data: mergeDataFn,
  props: mergeObjectOptions,
  emits: mergeObjectOptions,
  methods: mergeObjectOptions,
  computed: mergeObjectOptions,
  beforeCreate: mergeAsArray,
  created: mergeAsArray,
  beforeMount: mergeAsArray,
  mounted: mergeAsArray,
  beforeUpdate: mergeAsArray,
  updated: mergeAsArray,
  beforeDestroy: mergeAsArray,
  beforeUnmount: mergeAsArray,
  destroyed: mergeAsArray,
  unmounted: mergeAsArray,
  activated: mergeAsArray,
  deactivated: mergeAsArray,
  errorCaptured: mergeAsArray,
  serverPrefetch: mergeAsArray,
  components: mergeObjectOptions,
  directives: mergeObjectOptions,
  watch: mergeWatchOptions,
  provide: mergeDataFn,
  inject: mergeInject
}
function mergeDataFn (to, from) {
  if (!from) {
    return to
  }
  if (!to) {
    return from
  }
  return function mergedDataFn () {
    return extend(
      isFunction(to) ? to.call(this, this) : to,
      isFunction(from) ? from.call(this, this) : from
    )
  }
}
function mergeInject (to, from) {
  return mergeObjectOptions(normalizeInject(to), normalizeInject(from))
}
function normalizeInject (raw) {
  if (isArray(raw)) {
    const res = {}
    for (let i = 0; i < raw.length; i++) {
      res[raw[i]] = raw[i]
    }
    return res
  }
  return raw
}
function mergeAsArray (to, from) {
  return to ? [...new Set([].concat(to, from))] : from
}
function mergeObjectOptions (to, from) {
  return to ? extend(extend(Object.create(null), to), from) : from
}
function mergeWatchOptions (to, from) {
  if (!to) return from
  if (!from) return to
  const merged = extend(Object.create(null), to)
  for (const key in from) {
    merged[key] = mergeAsArray(to[key], from[key])
  }
  return merged
}
