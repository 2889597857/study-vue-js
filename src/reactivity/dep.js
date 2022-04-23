import { trackOpBit } from './effect.js'
// https://juejin.cn/post/7005892927389958157#heading-12
export const createDep = effects => {
  const dep = new Set(effects)
  dep.w = 0
  dep.n = 0
  return dep
}
/**
 * 判断原来是否标记过
 * @param {*} dep
 */
export const wasTracked = dep => (dep.w & trackOpBit) > 0
/**
 * 判断本次是否标记过
 * @param {*} dep
 */
export const newTracked = dep => (dep.n & trackOpBit) > 0
/**
 * 标记已经收集的依赖
 * @param {*} deps
 */
export const initDepMarkers = ({ deps }) => {
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].w |= trackOpBit
    }
  }
}
/**
 * 删除不需要dep
 *
 * @param {*} effect
 */
export const finalizeDepMarkers = effect => {
  const { deps } = effect
  if (deps.length) {
    let ptr = 0
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      if (wasTracked(dep) && !newTracked(dep)) {
        // 之前收集到了这次没有
        // 删除依赖
        dep.delete(effect)
      } else {
        deps[ptr++] = dep
      }
      // 重置 .w .n
      dep.w &= ~trackOpBit
      dep.n &= ~trackOpBit
    }
    deps.length = ptr
  }
}
