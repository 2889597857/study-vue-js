import {
  EffectScope,
  markRaw,
  pauseTracking,
  proxyRefs,
  resetTracking,
  shallowReadonly
} from '../reactivity/index.js';
import {
  EMPTY_OBJ,
  extend,
  isFunction,
  isObject,
  NOOP
} from '../shared/index.js';
import { createAppContext } from './apiCreateApp.js';
import { emit, normalizeEmitsOptions } from './componentEmits.js';
import { initProps, normalizePropsOptions } from './componentProps.js';
import { initSlots } from './componentSlots.js';
// 兼容vue2 data
// import { applyOptions } from './componentOptions.js'
import {
  PublicInstanceProxyHandlers,
  publicPropertiesMap,
  RuntimeCompiledPublicInstanceProxyHandlers
} from './componentPublicInstance.js';

const emptyAppContext = createAppContext();
let uid = 0;
// 创建组件实例
export function createComponentInstance(vnode, parent, suspense) {
  const type = vnode.type;
  //  type 数据
  // {
  //   props,
  //   template,
  //   render,
  //   setup
  //   ...
  // }
  console.log('createComponentInstance');
  // 继承父组件appContext
  // 如果是是根组件，从vnode上获取appContext
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
  const instance = {
    // 组件唯一 id
    uid: uid++,
    // 组件vnode
    vnode,
    type,
    // 父组件
    parent,
    appContext,
    root: null,
    // 需要更新的 vnode，用于更新 component 类型的组件
    next: null,
    // 子节点vnode
    subTree: null,
    effect: null,
    // 副作用更新函数
    update: null,
    /**
     * 管理组件内所有响应式数据
     * */
    scope: new EffectScope(true),
    // 渲染函数
    render: null,
    // 上下文对象,和 ctx 相同
    // 开发/生产环境都能使用
    proxy: null,
    exposed: null,
    exposeProxy: null,
    // 带 with 区块的渲染上下文代理
    withProxy: null,
    //  获取 parent 的 provides 作为当前组件的初始化值
    provides: parent ? parent.provides : Object.create(appContext.provides),
    // 渲染代理的属性访问缓存
    // {'key':0,'key':1,...}
    // key 为访问的属性名
    // 访问的属性可能在 setup 中，也可能在 prop 中
    // 1 代表属性在 setup 中
    // 3 代表属性在 prop 中
    accessCache: null,
    // 渲染缓存
    renderCache: [],
    components: null,
    directives: null,
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),
    // 派发事件方法
    emit: null,
    // .once 修饰符,只执行一次
    // { eventName:Boolean }
    emitted: null,
    propsDefaults: EMPTY_OBJ,
    inheritAttrs: type.inheritAttrs,
    // 渲染上下文  content 对象
    // 和 proxy 相同
    // 生产环境为 undefined
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    // setup 返回值
    setupState: EMPTY_OBJ,
    // setup 上下文数据
    setupContext: null,
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    // 异步依赖
    asyncDep: null,
    // suspense 异步依赖是否都已处理
    asyncResolved: false,
    // 是否挂载
    isMounted: false,
    // 是否卸载
    isUnmounted: false,
    // 是否激活
    isDeactivated: false,
    // before created
    bc: null,
    // created
    c: null,
    // before mounted
    bm: null,
    // mounted
    m: null,
    // before update
    bu: null,
    // updated
    u: null,
    // unmount
    um: null,
    // before unmount
    bum: null,
    // deactivated
    da: null,
    // activated
    a: null,
    // render triggered
    rtg: null,
    // render tracked
    rtc: null,
    // error captured
    ec: null,
    sp: null,
  };
  // 初始化渲染上下文
  instance.ctx = { _: instance };
  // 初始化根组件指针
  instance.root = parent ? parent.root : instance;
  // 初始化事件派发方法
  // 使用 bind 把 instance 进行绑定
  // 使用的时候只需要给 event 和参数即可
  instance.emit = emit.bind(null, instance);
  if (vnode.ce) {
    vnode.ce(instance);
  }
  return instance;
}

export let currentInstance = null;
/**
 * 获取当前组件实例
 * @returns
 */
export const getCurrentInstance = () => currentInstance;

export const setCurrentInstance = (instance) => {
  currentInstance = instance;
  instance.scope.on();
};
/**
 * "卸载"组件
 * @returns
 */
export const unsetCurrentInstance = () => {
  // 取消数据响应式效果
  currentInstance && currentInstance.scope.off();
  currentInstance = null;
};
/**
 * 判断是否是一个有状态的组件
 * @param {object} instance
 * @returns
 */
function isStatefulComponent(instance) {
  return instance.vnode.shapeFlag & 4;
}

export function setupComponent(instance) {
  const { props, children } = instance.vnode;
  // 判断是否是一个有状态的组件
  const isStateful = isStatefulComponent(instance);
  console.log(instance.propsOptions);
  console.log(props);
  // 初始化 props 绑定事件
  initProps(instance, props, isStateful);
  // 初始化插槽
  initSlots(instance, children);
  // 设置有状态的组件实例
  const setupResult = isStateful ? setupStatefulComponent(instance) : undefined;

  return setupResult;
}

function setupStatefulComponent(instance) {
  const Component = instance.type;
  // 创建渲染代理的属性缓存
  instance.accessCache = Object.create(null);
  // 创建渲染上下问代理对象
  // instance.ctx
  // 标记代理对象为不会成为响应式对象
  instance.proxy = markRaw(
    new Proxy(instance.ctx, PublicInstanceProxyHandlers)
  );
  // 获取组件setup函数
  const { setup } = Component;

  if (setup) {
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null);
    // 设置当前组件实例，在 setup 中执行 getCurrentInstance 时获取当前实例
    setCurrentInstance(instance);
    pauseTracking();
    // 执行 setup
    const setupResult =
      setup && setup(shallowReadonly(instance.props), setupContext);
    resetTracking();
    //
    unsetCurrentInstance();
    // 处理setup返回值
    handleSetupResult(instance, setupResult);
  } else {
    finishComponentSetup(instance);
  }
}

export function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    // setup 返回渲染函数
    instance.render = setupResult;
  } else if (isObject(setupResult)) {
    //实现 proxyRefs  模板{{}}中使用 ref 不用加 value
    instance.setupState = proxyRefs(setupResult);
  }
  finishComponentSetup(instance);
}

let compile;
let installWithProxy;
export function registerRuntimeCompiler(_compile) {
  compile = _compile;
  installWithProxy = (i) => {
    if (i.render._rc) {
      i.withProxy = new Proxy(
        i.ctx,
        RuntimeCompiledPublicInstanceProxyHandlers
      );
    }
  };
}

function finishComponentSetup(instance) {
  const Component = instance.type;
  // 组件实例上是否有 render 函数
  if (!instance.render) {
    // 模板没有 render 函数
    if (compile && !Component.render) {
      const template = Component.template;
      if (template) {
        // 标准化模板/渲染函数
        const { isCustomElement, compilerOptions } = instance.appContext.config;
        const { delimiters, compilerOptions: componentCompilerOptions } =
          Component;
        const finalCompilerOptions = extend(
          extend({ isCustomElement, delimiters }, compilerOptions),
          componentCompilerOptions
        );
        // 运行时编译 编译模板
        Component.render = compile(template, finalCompilerOptions);
        // console.log(Component.render)
      }
    }
    console.log(instance);
    instance.render = Component.render || NOOP;
    if (installWithProxy) {
      installWithProxy(instance);
    }
  }
  //  兼容 vue2 data
  // {
  //   setCurrentInstance(instance)
  //   pauseTracking()
  //   // 兼容 vue2 写法
  //   applyOptions(instance)
  //   resetTracking()
  //   unsetCurrentInstance()
  // }
}

export function createAttrsProxy(instance) {
  return new Proxy(instance.attrs, {
    get(target, key) {
      track(instance, 'get', '$attrs');
      return target[key];
    },
  });
}

export function createSetupContext(instance) {
  const expose = (exposed) => {
    instance.exposed = exposed || {};
  };
  let attrs;
  return {
    get attrs() {
      return attrs || (attrs = createAttrsProxy(instance));
    },
    slots: instance.slots,
    emit: instance.emit,
    expose,
  };
}

export function getExposeProxy(instance) {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key) {
          if (key in target) {
            return target[key];
          } else if (key in publicPropertiesMap) {
            return publicPropertiesMap[key](instance);
          }
        },
      }))
    );
  }
}
const classifyRE = /(?:^|[-_])(\w)/g;
/**
 * 格式化组件名称 aa-bb/aa_bb/AaBb => AaBb
 * @param {*} str
 * @returns
 */
const classify = (str) =>
  str.replace(classifyRE, (c) => c.toUpperCase()).replace(/[-_]/g, '');

export function getComponentName(Component) {
  return isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name;
}
/**
 * 格式组件名称
 * @param {*} instance
 * @param {*} Component
 * @param {*} isRoot
 * @returns
 */
export function formatComponentName(instance, Component, isRoot = false) {
  let name = getComponentName(Component);
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/);
    if (match) {
      name = match[1];
    }
  }
  if (!name && instance && instance.parent) {
    const inferFromRegistry = (registry) => {
      for (const key in registry) {
        if (registry[key] === Component) {
          return key;
        }
      }
    };
    name =
      inferFromRegistry(
        instance.components || instance.parent.type.components
      ) || inferFromRegistry(instance.appContext.components);
  }
  return name ? classify(name) : isRoot ? `App` : `Anonymous`;
}
/**
 *  是不是一个 class 类型的组件
 * @param {*} value
 * @returns
 */
export function isClassComponent(value) {
  return isFunction(value) && '__vccOpts' in value;
}
