import { isFunction } from '../shared/index.js'
import { currentRenderingInstance } from './componentRenderContext.js'
import { currentInstance } from './component.js'

export function provide (key, value) {
  if (!currentInstance) {
    return false
  } else {
    let provides = currentInstance.provides
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    provides[key] = value
  }
}
export function inject (key, defaultValue, treatDefaultAsFactory = false) {
  const instance = currentInstance || currentRenderingInstance
  if (instance) {
    const provides =
      instance.parent == null
        ? instance.vnode.appContext && instance.vnode.appContext.provides
        : instance.parent.provides
    if (provides && key in provides) {
      return provides[key]
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance.proxy)
        : defaultValue
    }
  }
}
