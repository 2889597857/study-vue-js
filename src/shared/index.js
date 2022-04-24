import { makeMap } from './makeMap.js'

export * from './domTagConfig.js'
export * from './makeMap.js'
export * from './normalizeProp.js'
export * from './toDisplayString.js'
export * from './globalsWhitelist.js'
export * from './domAttrConfig.js'
export * from './looseEqual.js'
export { PatchFlagNames } from './patchFlagNames.js'
/**
 * 是不是 {...} or [...]
 * @param {*} val
 * @return {Boolean} Boolean
 */
export const isObject = val => val !== null && typeof val === 'object'
export const isArray = Array.isArray
export const isPromise = val =>
  isObject(val) && isFunction(val.then) && isFunction(val.catch)
export const isSymbol = val => typeof val === 'symbol'
export const isFunction = val => typeof val === 'function'
export const isString = val => typeof val === 'string'
export const isMap = val => toTypeString(val) === '[object Map]'
export const isSet = val => toTypeString(val) === '[object Set]'
export const isDate = val => val instanceof Date
/**
 * 是不是对象 {...}
 * @param {*} val
 * @return {Boolean} Boolean
 */
export const isPlainObject = val => toTypeString(val) === '[object Object]'

export const objectToString = Object.prototype.toString
export const toTypeString = value => objectToString.call(value)
export const toRawType = value => {
  return toTypeString(value).slice(8, -1)
}
/**
 * key是不是数字型的字符串 Key
 * 数组的 key , 0,1,2...
 * @param {*} key
 * @returns Boolean
 */
export const isIntegerKey = key =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (val, key) => hasOwnProperty.call(val, key)
export const hasChanged = (oldValue, value) => value !== oldValue
export const extend = Object.assign

export const EMPTY_OBJ = Object.freeze({})
export const EMPTY_ARR = Object.freeze([])
/**
 * 空函数 ()=>{}
 */
export const NOOP = () => {}
export const NO = () => false
export const onRE = /^on[^a-z]/
export const isOn = key => onRE.test(key)
/**
 * 判断字符串是不是以 ’onUpdate:‘ 开头
 * @param {*} key
 * @returns
 */
export const isModelListener = key => key.startsWith('onUpdate:')
/**
 * 移除数组的某个元素
 * @param {Array} arr
 * @param {*} el
 */
export const remove = (arr, el) => {
  const i = arr.indexOf(el)
  if (i > -1) {
    arr.splice(i, 1)
  }
}
let _globalThis
/**
 * self 是 Web Worker 全局对象
 * window 是 游览器 全局对象
 * global 是 Node 全局对象
 * @returns 全局对象
 */
export const getGlobalThis = () => {
  return (
    _globalThis ||
    (_globalThis =
      typeof globalThis !== 'undefined'
        ? globalThis
        : typeof self !== 'undefined'
        ? self
        : typeof window !== 'undefined'
        ? window
        : typeof global !== 'undefined'
        ? global
        : {})
  )
}
/**
 * 执行数组内函数
 * @param {Array} fns
 * @param {param} arg
 */
export const invokeArrayFns = (fns, arg) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg)
  }
}
/**
 *
 * @param {*} obj 目标对象
 * @param {*} key 需要添加的属性名
 * @param {*} value 需要添加的属性值
 */
export const def = (obj, key, value) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  })
}
export const toNumber = val => {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}
/**
 * 字符串缓存
 * @param {*} fn
 * @returns
 */
export const cacheStringFunction = fn => {
  const cache = Object.create(null)
  return str => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }
}
/**
 * 正则表达式,
 * 匹配’-‘加任意阿拉伯数字、英文字母大小写和下划线
 * ’-a1‘
 */
export const camelizeRE = /-(\w)/g
/**
 *  连字符 - 转驼峰  on-click => onClick
 */
export const camelize = cacheStringFunction(str => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
})
const hyphenateRE = /\B([A-Z])/g
/**
 * onClick => on-click
 */
export const hyphenate = cacheStringFunction(str =>
  str.replace(hyphenateRE, '-$1').toLowerCase()
)
/**
 * 首字母大写
 */
export const capitalize = cacheStringFunction(
  str => str.charAt(0).toUpperCase() + str.slice(1)
)
/**
 * click => onClick
 */
export const toHandlerKey = cacheStringFunction(str =>
  str ? `on${capitalize(str)}` : ``
)

export const slotFlagsText = { [1]: 'STABLE', [2]: 'DYNAMIC', [3]: 'FORWARDED' }
export const isReservedProp = makeMap(
  ',key,ref,ref_for,ref_key,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted'
)
export const isBuiltInDirective = makeMap(
  'bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo'
)
