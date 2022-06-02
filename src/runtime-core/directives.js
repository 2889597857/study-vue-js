import { isFunction, EMPTY_OBJ } from '../shared/index.js'
import { currentRenderingInstance } from './componentRenderContext.js'
import { pauseTracking, resetTracking } from '../reactivity/index.js'
import { traverse } from './apiWatch.js'

export function withDirectives(vnode, directives) {
  const internalInstance = currentRenderingInstance
  if (internalInstance === null) {
    return vnode
  }
  const instance = internalInstance.proxy
  const bindings = vnode.dirs || (vnode.dirs = [])
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i]
    if (isFunction(dir)) {
      dir = { mounted: dir, updated: dir }
    }
    if (dir.deep) {
      traverse(value)
    }
    bindings.push({ dir, instance, value, oldValue: void 0, arg, modifiers })
  }
  return vnode
}
export function invokeDirectiveHook(vnode, prevVNode, instance, name) {
  const bindings = vnode.dirs
  const oldBindings = prevVNode && prevVNode.dirs
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]
    if (oldBindings) {
      binding.oldValue = oldBindings[i].value
    }
    let hook = binding.dir[name]
    if (hook) {
      pauseTracking()
      hook(vnode.el, binding, vnode, prevVNode)
      resetTracking()
    }
  }
}
