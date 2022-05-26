import {
  normalizeVNode,
  createVNode,
  Comment,
  cloneVNode,
  isVNode,
  blockStack
} from './vnode.js'
import { isOn, isModelListener } from '../shared/index.js'
import { isEmitListener } from './componentEmits.js'
import { setCurrentRenderingInstance } from './componentRenderContext.js'
window.a = new Map()
export function renderComponentRoot (instance) {
  const {
    type: Component,
    vnode,
    proxy,
    withProxy,
    props,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit,
    render,
    renderCache,
    data,
    setupState,
    ctx,
    inheritAttrs
  } = instance
  let result
  let fallthroughAttrs
  const prev = setCurrentRenderingInstance(instance)
  try {
    if (vnode.shapeFlag & 4) {
      const proxyToUse = withProxy || proxy
      result = normalizeVNode(
        render.call(
          proxyToUse,
          proxyToUse,
          renderCache,
          props,
          setupState,
          data,
          ctx
        )
      )
      // console.log(proxyToUse)
      // window.a.set(result)
      
      console.log(render)
      console.log(result)
      fallthroughAttrs = attrs
    } else {
      const render = Component
      result = normalizeVNode(
        render.length > 1
          ? render(props, { attrs, slots, emit })
          : render(props, null)
      )
      fallthroughAttrs = Component.props
        ? attrs
        : getFunctionalFallthrough(attrs)
    }
  } catch (err) {
    blockStack.length = 0
    result = createVNode(Comment)
  }
  let root = result

  if (fallthroughAttrs && inheritAttrs !== false) {
    const keys = Object.keys(fallthroughAttrs)
    const { shapeFlag } = root
    if (keys.length) {
      if (shapeFlag & (1 | 6)) {
        if (propsOptions && keys.some(isModelListener)) {
          fallthroughAttrs = filterModelListeners(
            fallthroughAttrs,
            propsOptions
          )
        }
        root = cloneVNode(root, fallthroughAttrs)
      }
    }
  }
  if (vnode.dirs) {
    root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs
  }
  if (vnode.transition) {
    root.transition = vnode.transition
  }

  result = root
  setCurrentRenderingInstance(prev)
  return result
}

export function filterSingleRoot (children) {
  let singleRoot
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isVNode(child)) {
      if (child.type !== Comment || child.children === 'v-if') {
        if (singleRoot) {
          return
        } else {
          singleRoot = child
        }
      }
    } else {
      return
    }
  }
  return singleRoot
}

const getFunctionalFallthrough = attrs => {
  let res
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      ;(res || (res = {}))[key] = attrs[key]
    }
  }
  return res
}
const filterModelListeners = (attrs, props) => {
  const res = {}
  for (const key in attrs) {
    if (!isModelListener(key) || !(key.slice(9) in props)) {
      res[key] = attrs[key]
    }
  }
  return res
}
const isElementRoot = vnode => {
  return vnode.shapeFlag & (6 | 1) || vnode.type === Comment
}

export function shouldUpdateComponent (prevVNode, nextVNode, optimized) {
  const { props: prevProps, children: prevChildren, component } = prevVNode
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode
  const emits = component.emitsOptions

  if (nextVNode.dirs || nextVNode.transition) {
    return true
  }
  if (optimized && patchFlag >= 0) {
    if (patchFlag & 1024) {
      return true
    }
    if (patchFlag & 16) {
      if (!prevProps) {
        return !!nextProps
      }
      return hasPropsChanged(prevProps, nextProps, emits)
    } else if (patchFlag & 8) {
      const dynamicProps = nextVNode.dynamicProps
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i]
        if (nextProps[key] !== prevProps[key] && !isEmitListener(emits, key)) {
          return true
        }
      }
    }
  } else {
    if (prevChildren || nextChildren) {
      if (!nextChildren || !nextChildren.$stable) {
        return true
      }
    }
    if (prevProps === nextProps) {
      return false
    }
    if (!prevProps) {
      return !!nextProps
    }
    if (!nextProps) {
      return true
    }
    return hasPropsChanged(prevProps, nextProps, emits)
  }
  return false
}

function hasPropsChanged (prevProps, nextProps, emitsOptions) {
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (
      nextProps[key] !== prevProps[key] &&
      !isEmitListener(emitsOptions, key)
    ) {
      return true
    }
  }
  return false
}

export function updateHOCHostEl ({ vnode, parent }, el) {
  while (parent && parent.subTree === vnode) {
    ;(vnode = parent.vnode).el = el
    parent = parent.parent
  }
}
