export const isKeepAlive = vnode => vnode.type.__isKeepAlive
export const KeepAliveImpl = {
  name: `KeepAlive`,
  __isKeepAlive: true,
  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number]
  },
  setup (props, { slots }) {
    const instance = getCurrentInstance()
    const sharedContext = instance.ctx
    if (!sharedContext.renderer) {
      return slots.default
    }
    const cache = new Map()
    const keys = new Set()
    let current = null
    {
      instance.__v_cache = cache
    }
    const parentSuspense = instance.suspense
    const {
      renderer: {
        p: patch,
        m: move,
        um: _unmount,
        o: { createElement }
      }
    } = sharedContext
    const storageContainer = createElement('div')
    sharedContext.activate = (vnode, container, anchor, isSVG, optimized) => {
      const instance = vnode.component
      move(vnode, container, anchor, 0, parentSuspense)
      patch(
        instance.vnode,
        vnode,
        container,
        anchor,
        instance,
        parentSuspense,
        isSVG,
        vnode.slotScopeIds,
        optimized
      )
      queuePostRenderEffect(() => {
        instance.isDeactivated = false
        if (instance.a) {
          invokeArrayFns(instance.a)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeMounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
      }, parentSuspense)
    }
    sharedContext.deactivate = vnode => {
      const instance = vnode.component
      move(vnode, storageContainer, null, 1, parentSuspense)
      queuePostRenderEffect(() => {
        if (instance.da) {
          invokeArrayFns(instance.da)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
        instance.isDeactivated = true
      }, parentSuspense)
    }
    function unmount (vnode) {
      resetShapeFlag(vnode)
      _unmount(vnode, instance, parentSuspense, true)
    }
    function pruneCache (filter) {
      cache.forEach((vnode, key) => {
        const name = getComponentName(vnode.type)
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key)
        }
      })
    }
    function pruneCacheEntry (key) {
      const cached = cache.get(key)
      if (!current || cached.type !== current.type) {
        unmount(cached)
      } else if (current) {
        resetShapeFlag(current)
      }
      cache.delete(key)
      keys.delete(key)
    }
    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => !matches(exclude, name))
      },
      { flush: 'post', deep: true }
    )
    let pendingCacheKey = null
    const cacheSubtree = () => {
      if (pendingCacheKey != null) {
        cache.set(pendingCacheKey, getInnerChild(instance.subTree))
      }
    }
    onMounted(cacheSubtree)
    onUpdated(cacheSubtree)
    onBeforeUnmount(() => {
      cache.forEach(cached => {
        const { subTree, suspense } = instance
        const vnode = getInnerChild(subTree)
        if (cached.type === vnode.type) {
          resetShapeFlag(vnode)
          const da = vnode.component.da
          da && queuePostRenderEffect(da, suspense)
          return
        }
        unmount(cached)
      })
    })
    return () => {
      pendingCacheKey = null
      if (!slots.default) {
        return null
      }
      const children = slots.default()
      const rawVNode = children[0]
      if (children.length > 1) {
        current = null
        return children
      } else if (
        !isVNode(rawVNode) ||
        (!(rawVNode.shapeFlag & 4) && !(rawVNode.shapeFlag & 128))
      ) {
        current = null
        return rawVNode
      }
      let vnode = getInnerChild(rawVNode)
      const comp = vnode.type
      const name = getComponentName(
        isAsyncWrapper(vnode) ? vnode.type.__asyncResolved || {} : comp
      )
      const { include, exclude, max } = props
      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        current = vnode
        return rawVNode
      }
      const key = vnode.key == null ? comp : vnode.key
      const cachedVNode = cache.get(key)
      if (vnode.el) {
        vnode = cloneVNode(vnode)
        if (rawVNode.shapeFlag & 128) {
          rawVNode.ssContent = vnode
        }
      }
      pendingCacheKey = key
      if (cachedVNode) {
        vnode.el = cachedVNode.el
        vnode.component = cachedVNode.component
        if (vnode.transition) {
          setTransitionHooks(vnode, vnode.transition)
        }
        vnode.shapeFlag |= 512
        keys.delete(key)
        keys.add(key)
      } else {
        keys.add(key)
        if (max && keys.size > parseInt(max, 10)) {
          pruneCacheEntry(keys.values().next().value)
        }
      }
      vnode.shapeFlag |= 256
      current = vnode
      return rawVNode
    }
  }
}
export const KeepAlive = KeepAliveImpl

function matches (pattern, name) {
  if (isArray(pattern)) {
    return pattern.some(p => matches(p, name))
  } else if (isString(pattern)) {
    return pattern.split(',').includes(name)
  } else if (pattern.test) {
    return pattern.test(name)
  }
  return false
}
export function onActivated (hook, target) {
  registerKeepAliveHook(hook, 'a', target)
}
export function onDeactivated (hook, target) {
  registerKeepAliveHook(hook, 'da', target)
}
function registerKeepAliveHook (hook, type, target = currentInstance) {
  const wrappedHook =
    hook.__wdc ||
    (hook.__wdc = () => {
      let current = target
      while (current) {
        if (current.isDeactivated) {
          return
        }
        current = current.parent
      }
      return hook()
    })
  injectHook(type, wrappedHook, target)
  if (target) {
    let current = target.parent
    while (current && current.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        injectToKeepAliveRoot(wrappedHook, type, target, current)
      }
      current = current.parent
    }
  }
}
function injectToKeepAliveRoot (hook, type, target, keepAliveRoot) {
  const injected = injectHook(type, hook, keepAliveRoot, true)
  onUnmounted(() => {
    remove(keepAliveRoot[type], injected)
  }, target)
}
function resetShapeFlag (vnode) {
  let shapeFlag = vnode.shapeFlag
  if (shapeFlag & 256) {
    shapeFlag -= 256
  }
  if (shapeFlag & 512) {
    shapeFlag -= 512
  }
  vnode.shapeFlag = shapeFlag
}
function getInnerChild (vnode) {
  return vnode.shapeFlag & 128 ? vnode.ssContent : vnode
}
