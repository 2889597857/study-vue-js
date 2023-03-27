import {
  isArray, isFunction, isMap,
  isObject, isPlainObject,
  isSet, isString, objectToString
} from './index.js';

export const toDisplayString = val => {
  // val 是不是字符串  是,返回 val
  // val 是不是 null  是,返回 ''
  // val 是数组 或者 是对象并且 val.toString == Object.prototype.toString 或 val.toString不是函数
  return isString(val)
    ? val
    : val == null
    ? ''
    : isArray(val) ||
      (isObject(val) &&
        (val.toString === objectToString || !isFunction(val.toString)))
    ? JSON.stringify(val, replacer, 2)
    : String(val)
}

const replacer = (_key, val) => {
  if (val && val.__v_isRef) {
    // 如果是 ref
    return replacer(_key, val.value)
  } else if (isMap(val)) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce((entries, [key, val]) => {
        entries[`${key} =>`] = val
        return entries
      }, {})
    }
  } else if (isSet(val)) {
    return {
      [`Set(${val.size})`]: [...val.values()]
    }
  } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    return String(val)
  }
  return val
}
