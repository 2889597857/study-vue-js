import { def, isObject, toRawType } from '../shared/index.js';
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers
} from './baseHandlers.js';
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers,
  shallowReadonlyCollectionHandlers
} from './collectionHandlers.js';

// 储存已经代理的对象
export const reactiveMap = new WeakMap();
export const shallowReactiveMap = new WeakMap();
export const readonlyMap = new WeakMap();
export const shallowReadonlyMap = new WeakMap();

function targetTypeMap(rawType) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return 1;
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return 2;
    default:
      return 0;
  }
}
/**
 * Object/Array 返回 1
 * Map/Set/WeakMap/WeakSet 返回 2
 * @param {*} value
 * @returns
 *
 */
function getTargetType(value) {
  return value['__v_skip'] || !Object.isExtensible(value)
    ? 0
    : targetTypeMap(toRawType(value));
}
/**
 * reactive
 * @param {*} target 代理对象
 * @returns
 */
export function reactive(target) {
  if (isReadonly(target)) {
    return target;
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  );
}
/**
 * 只代理第一层
 * @param {*} target 代理对象
 * @returns
 */
export function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  );
}
/**
 * 只读
 * @param {*} target 代理对象
 * @returns
 */
export function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  );
}
/**
 * 只读浅代理
 * @param {*} target 代理对象
 * @returns
 */
export function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  );
}
/**
 * 创建代理对象
 * @param {Object} target 代理对象
 * @param {Boolean} isReadonly 是否可读
 * @param {*} baseHandlers 普通数据,数组对象
 * @param {*} collectionHandlers Map、Set、WeakMap、WeakSet
 * @param {*} proxyMap 已代理对象Map
 * @returns
 */
function createReactiveObject(
  target,
  isReadonly,
  baseHandlers,
  collectionHandlers,
  proxyMap
) {
  if (!isObject(target)) return target;
  // __v_raw' 代表数据永远无需代理
  // __v_isReactive 已经是响应式数据
  if (target['__v_raw'] && !(isReadonly && target['__v_isReactive']))
    return target;

  const existingProxy = proxyMap.get(target);
  // 是否已经代理
  if (existingProxy) return existingProxy;
  // 获取 target 类型 1: Object/Array 2: Map/Set/WeakMap/WeakSet
  const targetType = getTargetType(target);
  // 不是 Object/Array/Map/Set/WeakMap/WeakSet
  if (targetType === 0) return target;

  const proxy = new Proxy(
    target,
    targetType === 2
      ? collectionHandlers /* Map/Set/WeakMap/WeakSet */
      : baseHandlers /* Object/Array */
  );
  proxyMap.set(target, proxy);
  return proxy;
}

export function isReactive(value) {
  if (isReadonly(value)) {
    return isReactive(value['__v_raw']);
  }
  return !!(value && value['__v_isReactive']);
}
export function isReadonly(value) {
  return !!(value && value['__v_isReadonly']);
}
export function isShallow(value) {
  return !!(value && value['__v_isShallow']);
}
export function isProxy(value) {
  return isReactive(value) || isReadonly(value);
}
/**
 * 返回代理对象的原始对象
 * @param {*} observed
 */
export function toRaw(observed) {
  const raw = observed && observed['__v_raw'];
  return raw ? toRaw(raw) : observed;
}
/**
 * 标记一个对象
 * 使其永远不会再成为响应式对象
 * @param {*} value
 * @returns
 */
export function markRaw(value) {
  def(value, '__v_skip', true);
  return value;
}
/**
 * 普通对象/数组转 reactive
 * @param {*} value
 */
export const toReactive = (value) =>
  isObject(value) ? reactive(value) : value;
/**
 * 普通对象转 readonly
 * @param {*} value
 */
export const toReadonly = (value) =>
  isObject(value) ? readonly(value) : value;
