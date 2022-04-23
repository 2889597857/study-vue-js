import { patchProp } from './patchProp.js'
import { nodeOps } from './nodeOps.js'
import { extend, isString, isFunction } from '../shared/index.js'
import { createRenderer } from '../runtime-core/index.js'

// 合并对象 Object.assign
// patchProp
// nodeOps
const rendererOptions = extend({ patchProp }, nodeOps)

let renderer
function ensureRenderer () {
  // return renderer
  return renderer || (renderer = createRenderer(rendererOptions))
}

export const createApp = (...args) => {
  const app = ensureRenderer().createApp(...args)
  const { mount } = app // 缓存 mount 函数
  // 重写 mount 函数
  // mount方法是一个跨平台的渲染组件方法
  // 需要根据不同的平台传不同的值
  // 重写mount,完善web平台渲染逻辑
  app.mount = containerOrSelector => {
    // 传入的可能是 class/id (#app .app)
    // 也可能是
    const container = normalizeContainer(containerOrSelector)
    if (!container) return
    const component = app._component
    // 如果组件对象没由定义render函数和template模板,则取容器 innerHTML 作为组件模板内容
    if (!isFunction(component) && !component.render && !component.template) {
      component.template = container.innerHTML
    }
    // 清空容器
    container.innerHTML = ''
    // (根容器 , 是否是SVG)
    const proxy = mount(container, container instanceof SVGElement)
    // 如果跟容器是DOM对象
    if (container instanceof Element) {
      container.removeAttribute('v-cloak')
      container.setAttribute('data-v-app', '')
    }
    return proxy
  }
  return app
}

function normalizeContainer (container) {
  if (isString(container)) {
    // 传入值为字符串 #app .app
    return document.querySelector(container)
  }
  console.log(window.ShadowRoot)
  return container
}
// DOM-only components
export { Transition } from './components/Transition.js'
export { TransitionGroup } from './components/TransitionGroup.js'
export {
  vModelText,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelDynamic
} from './directives/vModel.js'
export { withModifiers, withKeys } from './directives/vOn.js'
export { vShow } from './directives/vShow.js'

export * from '../runtime-core/index.js'
