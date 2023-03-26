import {
  extend, hasChanged, hasOwn, isArray,
  isIntegerKey, isObject, isSymbol, makeMap
} from '../shared/index.js'
import {
  ITERATE_KEY,
  pauseTracking,
  resetTracking, track,
  trigger
} from './effect.js'
import {
  isReadonly,
  isShallow, reactive, reactiveMap, readonly, readonlyMap, shallowReactiveMap, shallowReadonlyMap, toRaw
} from './reactive.js'
import { isRef } from './ref.js'
/**
 * `__proto__,__v_isRef,__isVue` 是不是其中之一
 */
const isNonTrackableKeys = makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(isSymbol)
)
// https://blog.csdn.net/u014125106/article/details/106454329/
const get = createGetter()
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

//
const arrayInstrumentations = createArrayInstrumentations()
function createArrayInstrumentations() {
  const instrumentations = {}
    // 查询遍历方法
    ;[('includes', 'indexOf', 'lastIndexOf')].forEach(key => {
      instrumentations[key] = function (...args) {
        // 获取源数据
        const arr = toRaw(this)
        // 数组每一项都收集依赖
        for (let i = 0, l = this.length; i < l; i++) {
          track(arr, 'get', i + '')
        }
        // [].includes() / [].indexOf / [].lastIndexOf()
        const res = arr[key](...args)

        // 参数有可能是响应式的，函数执行后返回值为 -1 或 false，那就用参数的原始值再试一遍
        if (res === -1 || res === false) {
          // 没有查询到对应的值，有可能是包装后的响应式数据，有wrapper，引用不同所以
          // 有可能查不到，尝试去掉wrapper再查询
          return arr[key](...args.map(toRaw))
        } else {
          return res
        }
      }
    })
    // 改变数组长度的方法
    // 即会读取数组的 length 属性，又会设置数组的 length 属性·1
    ;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
      instrumentations[key] = function (...args) {
        // 执行前禁用依赖收集
        pauseTracking()
        const res = toRaw(this)[key].apply(this, args)
        // 执行后恢复之前track状态
        resetTracking()
        return res
      }
    })
  return instrumentations
}

/**
 * 处理对象 get
 * @param {*} isReadonly 只读
 * @param {*} shallow 浅代理
 * @returns get
 */
function createGetter(isReadonly = false, shallow = false) {
  return function get(target, key, receiver) {
    // 访问对应标志位的处理逻辑 obj['__v_isReactive']
    if (key === '__v_isReactive') {
      return !isReadonly
    } else if (key === '__v_isReadonly') {
      return isReadonly
    } else if (key === '__v_isShallow') {
      return shallow
    } else if (
      // 如果访问的 key 是 原始值，并且在map缓存中，
      key === '__v_raw' &&
      receiver ===
      (isReadonly
        ? shallow
          ? shallowReadonlyMap
          : readonlyMap
        : shallow
          ? shallowReactiveMap
          : reactiveMap
      ).get(target)
      // receiver指向调用者，这里的判断是为了保证触发拦截handler的是proxy对象本身
      // 而非proxy的继承者。触发拦截器的两种途径：1.访问proxy对象本身的属性；2.访问
      // 访问对象原型链上有proxy对象的对象的属性，因为查询属性会沿着原型链向下游依次
      // 查询，因此同样会触发拦截器
    ) {
      // 通过proxy对象本身访问__v_raw属性，返回target本身，即响应式对象的原始值
      return target
    }
    const targetIsArray = isArray(target)
    // 拦截部分数组方法 避免递归死循环
    // 1. 遍历查找的方法（indexOf, lastIndexOf, includes）
    // 2. 改变数组长度的方法（push, pop, shift, unshift, splice）
    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }
    const res = Reflect.get(target, key, receiver)

    // key 是 symbol并且属于 symbol 的内置方法之一或访问的是__proto__属性不做依赖收集和递归响应式转化，直接返回结果
    // isNonTrackableKeys`__proto__,__v_isRef,__isVue` 是不是其中之一
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }
    // 不是只读 收集依赖
    if (!isReadonly) {
      track(target, 'get', key)
    }
    // 浅代理，只代理第一层
    if (shallow) {
      return res
    }
    if (isRef(res)) {
      // 访问属性已经是ref对象，保证访问ref属性时得到的是ref对象的value属性值，数组除外
      const shouldUnwrap = !targetIsArray || !isIntegerKey(key)
      return shouldUnwrap ? res.value : res
    }
    if (isObject(res)) {
      // 递归 代理
      return isReadonly ? readonly(res) : reactive(res)
    }
    return res
  }
}
const set = createSetter()
const shallowSet = createSetter(true)

function createSetter(shallow = false) {
  return function set(target, key, value, receiver) {
    let oldValue = target[key]
    if (isReadonly(oldValue) && isRef(oldValue) && !isRef(value)) {
      return false
    }
    // 不是浅代理 不是只读
    if (!shallow && !isReadonly(value)) {
      // 设置的值不是浅代理
      if (!isShallow(value)) {
        value = toRaw(value)
        oldValue = toRaw(oldValue)
      }
      // 当前对象不是数组 旧值为 ref ，新值不是 ref
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
        return true
      }
    }
    // 当前值为数组
    // 比较修改前后数组长度
    // 当前值为对象
    // 查看对象是否有该属性
    // 判断是添加数据，还是修改数据
    // true 修改数据
    // false 添加数据
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)
    const result = Reflect.set(target, key, value, receiver)
    // 屏蔽由原型引起的更新
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // 添加数据
        trigger(target, 'add', key, value)
      } else if (hasChanged(value, oldValue)) {
        // 比较新值 旧值
        // 不相同 触发依赖
        trigger(target, 'set', key, value, oldValue)
      }
    }
    return result
  }
}
/**
 * 删除属性
 * @param {object} target 
 * @param {string} key 
 * @returns 
 */
function deleteProperty(target, key) {
  const hadKey = hasOwn(target, key)
  const oldValue = target[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    trigger(target, 'delete', key, undefined, oldValue)
  }
  return result
}
function has(target, key) {
  const result = Reflect.has(target, key)
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, 'has', key)
  }
  return result
}
function ownKeys(target) {
  track(target, 'iterate', isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}
// 不同的 reactive 有不同的 baseHandlers 和  collectionHandlers
// baseHandlers
export const mutableHandlers = { get, set, deleteProperty, has, ownKeys }
// readonly
export const readonlyHandlers = {
  get: readonlyGet,
  set(target, key) {
    return true
  },
  deleteProperty(target, key) {
    return true
  }
}
export const shallowReactiveHandlers = extend({}, mutableHandlers, {
  get: shallowGet,
  set: shallowSet
})
export const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
  get: shallowReadonlyGet
})
