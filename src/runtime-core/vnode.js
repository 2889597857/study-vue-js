import { isProxy } from '../reactivity/index.js';
import {
  EMPTY_ARR,
  extend,
  isArray,
  isFunction,
  isObject,
  isOn,
  isString,
  normalizeClass,
  normalizeStyle
} from '../shared/index.js';
import { isClassComponent } from './component.js';
import {
  currentRenderingInstance,
  currentScopeId
} from './componentRenderContext.js';

const isSuspense = (type) => type.__isSuspense;
const isTeleport = (type) => type.__isTeleport;

export const Fragment = Symbol('Fragment');
export const Text = Symbol('Text');
export const Comment = Symbol('Comment');
export const Static = Symbol('Static');
export { createBaseVNode as createElementVNode };

export const blockStack = [];
export let currentBlock = null;

export function openBlock(disableTracking = false) {
  blockStack.push((currentBlock = disableTracking ? null : []));
}

export function closeBlock() {
  blockStack.pop();
  currentBlock = blockStack[blockStack.length - 1] || null;
}

export let isBlockTreeEnabled = 1;

export function setBlockTracking(value) {
  isBlockTreeEnabled += value;
}
export function setupBlock(vnode) {
  vnode.dynamicChildren =
    isBlockTreeEnabled > 0 ? currentBlock || EMPTY_ARR : null;
  closeBlock();
  if (isBlockTreeEnabled > 0 && currentBlock) {
    currentBlock.push(vnode);
  }
  return vnode;
}
export function createElementBlock(
  type,
  props,
  children,
  patchFlag,
  dynamicProps,
  shapeFlag
) {
  return setupBlock(
    createBaseVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      shapeFlag,
      true
    )
  );
}
export function createBlock(type, props, children, patchFlag, dynamicProps) {
  return setupBlock(
    createVNode(type, props, children, patchFlag, dynamicProps, true)
  );
}
export function isVNode(value) {
  return value ? value.__v_isVNode === true : false;
}
export function isSameVNodeType(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}

export const createVNode = _createVNode;

export const InternalObjectKey = `__vInternal`;
/**
 * 有属性 key 吗？
 * 有返回 key
 * 没有返回 null
 * @param {object} key
 * @returns
 */
const normalizeKey = ({ key }) => (key != null ? key : null);
/**
 * 有属性 ref 吗？
 * 有返回 ref
 * 没有返回 null
 * @param {object} key
 * @returns
 */
const normalizeRef = ({ ref, ref_key, ref_for }) => {
  return ref != null
    ? isString(ref) || isRef(ref) || isFunction(ref)
      ? { i: currentRenderingInstance, r: ref, k: ref_key, f: !!ref_for }
      : ref
    : null;
};
/**
 * 创建 baseVNoe
 * @param {object | string} type
 * @param {object} props
 * @param {object} children
 * @param {number} patchFlag
 * @param {*} dynamicProps
 * @param {*} shapeFlag
 * @param {*} isBlockNode
 * @param {*} needFullChildrenNormalization
 * @returns VNode
 */
export function createBaseVNode(
  type,
  props = null,
  children = null,
  patchFlag = 0,
  dynamicProps = null,
  shapeFlag = type === Fragment ? 0 : 1,
  isBlockNode = false,
  needFullChildrenNormalization = false
) {
  const vnode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props), //props没有key属性返回nul
    ref: props && normalizeRef(props), //props没有ref属性返回null
    scopeId: currentScopeId,
    slotScopeIds: null,
    children,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null,
  };
  if (needFullChildrenNormalization) {
    normalizeChildren(vnode, children);
    if (shapeFlag & 128) {
      type.normalize(vnode);
    }
  } else if (children) {
    vnode.shapeFlag |= isString(children) ? 8 : 16;
  }

  if (
    isBlockTreeEnabled > 0 &&
    !isBlockNode &&
    currentBlock &&
    (vnode.patchFlag > 0 || shapeFlag & 6) &&
    vnode.patchFlag !== 32
  ) {
    currentBlock.push(vnode);
  }
  return vnode;
}
function _createVNode(
  type,
  props = null,
  children = null,
  patchFlag = 0,
  dynamicProps = null,
  isBlockNode = false
) {
  // 初始化
  // type:{template,setup}
  // console.log(type)
  if (!type) {
    type = Comment;
  }
  // 是否是 vnode
  if (isVNode(type)) {
    // 是 vnode，克隆vnode
    const cloned = cloneVNode(type, props, true);
    if (children) {
      // 有 children
      normalizeChildren(cloned, children);
    }
    return cloned;
  }
  // 是否是 函数 ，并且有 ’__vccOpts‘
  // 是不是一个 class 类型的组件
  if (isClassComponent(type)) {
    type = type.__vccOpts;
  }

  // 处理 props
  // 规范化class & style
  if (props) {
    // 如果 props 是 proxy 或有’__vInternal‘  props 转为 普通对象
    props = guardReactiveProps(props);
    // 获取 css
    let { class: klass, style } = props;
    // 拼接 class
    if (klass && !isString(klass)) {
      // 返回值 字符串 'classA classB classC'
      props.class = normalizeClass(klass);
    }
    if (isObject(style)) {
      if (isProxy(style) && !isArray(style)) {
        // style 是 proxy 且不是数组
        // 转为普通对象
        style = extend({}, style);
      }
      props.style = normalizeStyle(style);
    }
  }
  const shapeFlag = isString(type)
    ? 1 /* ELEMENT 标签  */
    : isSuspense(type)
    ? 128 /* SUSPENSE 异步组件？ */
    : isTeleport(type)
    ? 64 /* TELEPORT 可以挂载到任意节点上的组件 */
    : isObject(type)
    ? 4 /* STATEFUL_COMPONENT 有状态组件 */
    : isFunction(type)
    ? 2 /* FUNCTIONAL_COMPONENT 函数组件 */
    : 0;
  return createBaseVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    shapeFlag,
    isBlockNode,
    true
  );
}
/**
 * props 是否是响应式
 * 是转为普通对象
 * @param {*} props 
 * @returns 
 */
export function guardReactiveProps(props) {
  if (!props) return null;
  return isProxy(props) || InternalObjectKey in props
    ? extend({}, props)
    : props;
}
export function cloneVNode(vnode, extraProps, mergeRef = false) {
  const { props, ref, patchFlag, children } = vnode;
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
  const cloned = {
    __v_isVNode: true,
    __v_skip: true,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    ref:
      extraProps && extraProps.ref
        ? mergeRef && ref
          ? isArray(ref)
            ? ref.concat(normalizeRef(extraProps))
            : [ref, normalizeRef(extraProps)]
          : normalizeRef(extraProps)
        : ref,
    scopeId: vnode.scopeId,
    slotScopeIds: vnode.slotScopeIds,
    children: children,
    target: vnode.target,
    targetAnchor: vnode.targetAnchor,
    staticCount: vnode.staticCount,
    shapeFlag: vnode.shapeFlag,
    patchFlag:
      extraProps && vnode.type !== Fragment
        ? patchFlag === -1
          ? 16
          : patchFlag | 16
        : patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,
    transition: vnode.transition,
    component: vnode.component,
    suspense: vnode.suspense,
    ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
    ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
    el: vnode.el,
    anchor: vnode.anchor,
  };
  return cloned;
}
export function deepCloneVNode(vnode) {
  const cloned = cloneVNode(vnode);
  if (isArray(vnode.children)) {
    cloned.children = vnode.children.map(deepCloneVNode);
  }
  return cloned;
}
export function createTextVNode(text = ' ', flag = 0) {
  return createVNode(Text, null, text, flag);
}
export function createStaticVNode(content, numberOfNodes) {
  const vnode = createVNode(Static, null, content);
  vnode.staticCount = numberOfNodes;
  return vnode;
}
/**
 * 创建注释 vndoe
 * @param {*} text
 * @param {*} asBlock
 * @returns VNode
 */
export function createCommentVNode(text = '', asBlock = false) {
  return asBlock
    ? (openBlock(), createBlock(Comment, null, text))
    : createVNode(Comment, null, text);
}
export function normalizeVNode(child) {
  if (child == null || typeof child === 'boolean') {
    return createVNode(Comment);
  } else if (isArray(child)) {
    return createVNode(Fragment, null, child.slice());
  } else if (typeof child === 'object') {
    return cloneIfMounted(child);
  } else {
    return createVNode(Text, null, String(child));
  }
}
export function cloneIfMounted(child) {
  return child.el === null || child.memo ? child : cloneVNode(child);
}
export function normalizeChildren(vnode, children) {
  let type = 0;
  const { shapeFlag } = vnode;
  if (children == null) {
    children = null;
  } else if (isArray(children)) {
    type = 16;
  } else if (typeof children === 'object') {
    // shapeFlag = 1 or 64
    if (shapeFlag & (1 | 64)) {
      const slot = children.default;
      if (slot) {
        slot._c && (slot._d = false);
        normalizeChildren(vnode, slot());
        slot._c && (slot._d = true);
      }
      return;
    } else {
      type = 32;
      const slotFlag = children._;
      if (!slotFlag && !(InternalObjectKey in children)) {
        children._ctx = currentRenderingInstance;
      } else if (slotFlag === 3 && currentRenderingInstance) {
        if (currentRenderingInstance.slots._ === 1) {
          children._ = 1;
        } else {
          children._ = 2;
          vnode.patchFlag |= 1024;
        }
      }
    }
  } else if (isFunction(children)) {
    children = { default: children, _ctx: currentRenderingInstance };
    type = 32;
  } else {
    children = String(children);
    if (shapeFlag & 64) {
      type = 16;
      children = [createTextVNode(children)];
    } else {
      type = 8;
    }
  }
  vnode.children = children;
  vnode.shapeFlag |= type;
}
export function mergeProps(...args) {
  const ret = {};
  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i];
    for (const key in toMerge) {
      if (key === 'class') {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class]);
        }
      } else if (key === 'style') {
        ret.style = normalizeStyle([ret.style, toMerge.style]);
      } else if (isOn(key)) {
        const existing = ret[key];
        const incoming = toMerge[key];
        if (
          incoming &&
          existing !== incoming &&
          !(isArray(existing) && existing.includes(incoming))
        ) {
          ret[key] = existing ? [].concat(existing, incoming) : incoming;
        }
      } else if (key !== '') {
        ret[key] = toMerge[key];
      }
    }
  }
  return ret;
}
export function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
  hook(vnode, prevVNode);
}
