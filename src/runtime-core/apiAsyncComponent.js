export const isAsyncWrapper = i => !!i.type.__asyncLoader

export function defineAsyncComponent (source) {
  if (isFunction(source)) {
    source = { loader: source }
  }
  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout,
    suspensible = true,
    onError: userOnError
  } = source
  let pendingRequest = null
  let resolvedComp
  let retries = 0
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }
  const load = () => {
    let thisRequest
    return (
      pendingRequest ||
      (thisRequest = pendingRequest = loader()
        .catch(err => {
          err = err instanceof Error ? err : new Error(String(err))
          if (userOnError) {
            return new Promise((resolve, reject) => {
              const userRetry = () => resolve(retry())
              const userFail = () => reject(err)
              userOnError(err, userRetry, userFail, retries + 1)
            })
          } else {
            throw err
          }
        })
        .then(comp => {
          if (thisRequest !== pendingRequest && pendingRequest) {
            return pendingRequest
          }

          if (
            comp &&
            (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
          ) {
            comp = comp.default
          }
          if (comp && !isObject(comp) && !isFunction(comp)) {
            throw new Error(`Invalid async component load result: ${comp}`)
          }
          resolvedComp = comp
          return comp
        }))
    )
  }
  return defineComponent({
    name: 'AsyncComponentWrapper',
    __asyncLoader: load,
    get __asyncResolved () {
      return resolvedComp
    },
    setup () {
      const instance = currentInstance
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp, instance)
      }
      const onError = err => {
        pendingRequest = null
        handleError(err, instance, 13, !errorComponent)
      }
      if ((suspensible && instance.suspense) || false) {
        return load()
          .then(comp => {
            return () => createInnerComp(comp, instance)
          })
          .catch(err => {
            onError(err)
            return () =>
              errorComponent
                ? createVNode(errorComponent, { error: err })
                : null
          })
      }
      const loaded = ref(false)
      const error = ref()
      const delayed = ref(!!delay)
      if (delay) {
        setTimeout(() => {
          delayed.value = false
        }, delay)
      }
      if (timeout != null) {
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`
            )
            onError(err)
            error.value = err
          }
        }, timeout)
      }
      load()
        .then(() => {
          loaded.value = true
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            queueJob(instance.parent.update)
          }
        })
        .catch(err => {
          onError(err)
          error.value = err
        })
      return () => {
        if (loaded.value && resolvedComp) {
          return createInnerComp(resolvedComp, instance)
        } else if (error.value && errorComponent) {
          return createVNode(errorComponent, { error: error.value })
        } else if (loadingComponent && !delayed.value) {
          return createVNode(loadingComponent)
        }
      }
    }
  })
}

export function createInnerComp (comp, { vnode: { ref, props, children } }) {
  const vnode = createVNode(comp, props, children)
  vnode.ref = ref
  return vnode
}
