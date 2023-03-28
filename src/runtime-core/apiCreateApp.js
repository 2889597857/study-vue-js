import { isFunction, isObject, NO } from '../shared/index.js'
import { getExposeProxy } from './component.js'
import { createVNode } from './vnode.js'

export function createAppContext () {
  return {
    app: null,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap()
  }
}
let uid = 0
export function createAppAPI (render) {
  // 创建根组件(app组件/app实例)
  return function createApp (rootComponent, rootProps = null) {
    // 跟组件属性必须是对象/null
    if (rootProps != null && !isObject(rootProps)) {
      rootProps = null
    }
    // 创建应用上下文对象
    const context = createAppContext()
    const installedPlugins = new Set()
    let isMounted = false
    const app = (context.app = {
      _uid: uid++,
      _component: rootComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,
      get config () {
        return context.config
      },
      set config (v) {
        return false
      },
      use (plugin, ...options) {
        if (installedPlugins.has(plugin)) {
          return app
        } else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin)
          plugin(app, ...options)
        }
        return app
      },
      mixin (mixin) {
        if (!context.mixins.includes(mixin)) {
          context.mixins.push(mixin)
        }
        return app
      },
      component (name, component) {
        if (!component) {
          return context.components[name]
        }
        context.components[name] = component
        return app
      },
      directive (name, directive) {
        if (!directive) {
          return context.directives[name]
        }
        context.directives[name] = directive
        return app
      },

      /**
       * @param {*} rootContainer 挂载节点
       * @param {*} isSVG 是否是SVG
       * @returns
       */
      mount (rootContainer, isSVG) {
        // 根节点只能挂载一次。
        if (!isMounted) {
          // 创建 vnode
          const vnode = createVNode(rootComponent, rootProps)
          // 初次挂载 在根VNode上存储应用程序上下文。
          vnode.appContext = context
          render(vnode, rootContainer, isSVG)
          isMounted = true
          app._container = rootContainer
          rootContainer.__vue_app__ = app
          return getExposeProxy(vnode.component) || vnode.component.proxy
        } else {
          return false
        }
      },
      unmount () {
        // 未挂载节点，不能删除
        if (isMounted) {
          render(null, app._container)
        } else {
          // 源码为告警
          return false
        }
      },
      provide (key, value) {
        if (key in context.provides) return app
        context.provides[key] = value
        return app
      }
    })
    return app
  }
}
