import { isArray, isObject, isString } from '../../shared/index.js';
/**
 * 
 * @param {*} source 需要循环的数据
 * @param {*} renderItem 渲染函数
 * @param {*} cache 缓存
 * @param {*} index 
 * @returns VNode [] 返回值 vnode 数组
 */
export function renderList(source, renderItem, cache, index) {
  console.log(source);
  console.log(renderItem);
  let ret
  const cached = cache && cache[index]
  if (isArray(source) || isString(source)) {
    ret = new Array(source.length)
    for (let i = 0, l = source.length; i < l; i++) {
      ret[i] = renderItem(source[i], i, undefined, cached && cached[i])
    }
  } else if (typeof source === 'number') {
    if (!Number.isInteger(source)) {
      return []
    }
    ret = new Array(source)
    for (let i = 0; i < source; i++) {
      ret[i] = renderItem(i + 1, i, undefined, cached && cached[i])
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator]) {
      ret = Array.from(source, (item, i) =>
        renderItem(item, i, undefined, cached && cached[i])
      )
    } else {
      const keys = Object.keys(source)
      ret = new Array(keys.length)
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        ret[i] = renderItem(source[key], key, i, cached && cached[i])
      }
    }
  } else {
    ret = []
  }
  if (cache) {
    cache[index] = ret
  }
  console.log(ret);
  return ret
}
