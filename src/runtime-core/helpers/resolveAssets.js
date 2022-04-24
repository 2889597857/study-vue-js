import { currentInstance, getComponentName } from '../component.js'
import { currentRenderingInstance } from '../componentRenderContext.js'
import { camelize, capitalize, isString } from '../../shared/index.js'

export const COMPONENTS = 'components'
export const DIRECTIVES = 'directives'
export const FILTERS = 'filters'

export function resolveComponent (name, maybeSelfReference) {
  return resolveAsset(COMPONENTS, name, true, maybeSelfReference) || name
}

export const NULL_DYNAMIC_COMPONENT = Symbol()

/**
 *
 * @param {*} component 组件名称
 * @returns
 */
export function resolveDynamicComponent (component) {
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, false) || component
  } else {
    return component || NULL_DYNAMIC_COMPONENT
  }
}

/**
 * @private
 */
export function resolveDirective (name) {
  return resolveAsset(DIRECTIVES, name)
}

/**
 * v2 compat only
 * @internal
 */
export function resolveFilter (name) {
  return resolveAsset(FILTERS, name)
}

/**
 * @private
 * overload 1: components
 */
function resolveAsset (type, name) {
  const instance = currentRenderingInstance || currentInstance
  if (instance) {
    const Component = instance.type
    if (type === COMPONENTS) {
      const selfName = getComponentName(Component)
      if (
        selfName &&
        (selfName === name ||
          selfName === camelize(name) ||
          selfName === capitalize(camelize(name)))
      ) {
        return Component
      }
    }
    const res =
      resolve(instance[type] || Component[type], name) ||
      resolve(instance.appContext[type], name)
    if (!res) {
      return Component
    }
    return res
  }
}

function resolve (registry, name) {
  return (
    registry &&
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))])
  )
}
