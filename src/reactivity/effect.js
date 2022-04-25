import { extend, isMap, isArray } from '../shared/index.js'
import {
  createDep,
  finalizeDepMarkers,
  initDepMarkers,
  newTracked,
  wasTracked
} from './dep.js'
import { recordEffectScope } from './effectScope.js'
/**
 *
 */
const targetMap = new WeakMap()
/**
 * effect 可能会嵌套调用
 * 标记effect层级
 */
let effectTrackDepth = 0
/**
 * effect 位标记
 */
export let trackOpBit = 1
/**
 * effect 最大标记位数
 * 二进制数最多 30 位
 */
const maxMarkerBits = 30
// 当前激活的（栈顶） effect
export let activeEffect
export const ITERATE_KEY = Symbol('iterate')
export const MAP_KEY_ITERATE_KEY = Symbol('Map key iterate')
export class ReactiveEffect {
  constructor (fn, scheduler = null, scope) {
    this.fn = fn
    // scheduler 调度函数，初次挂载不会执行。
    // 组件更新时 scheduler 存在，执行 scheduler
    // 不存在 执行 run
    // 详情见 triggerEffects 函数
    this.scheduler = scheduler
    this.active = true
    this.deps = []
    this.parent = undefined
    recordEffectScope(this, scope)
    // console.log(scope)
  }
  // 函数初次挂载执行 run
  // const update = (instance.update = effect.run.bind(effect))
  // update()
  run () {
    if (!this.active) {
      return this.fn()
    }
    // 第一层 activeEffect = undefined
    // 第二层 activeEffect = 第一层的 activeEffect
    // 依次类推
    let parent = activeEffect
    let lastShouldTrack = shouldTrack
    // 只有一层，parent = undefined ,while不执行。
    // 二层，执行一次。
    console.log(activeEffect)
    while (parent) {
      if (parent === this) {
        console.log('parent === this')
        return
      }

      parent = parent.parent
    }
    try {
      this.parent = activeEffect
      activeEffect = this
      shouldTrack = true
      // 给每一层的 effect 做标记
      // 2 4 8 16 32
      trackOpBit = 1 << ++effectTrackDepth
      console.log(trackOpBit)
      if (effectTrackDepth <= maxMarkerBits) {
        // 给之前收集到的依赖打上旧标记
        initDepMarkers(this)
      } else {
        cleanupEffect(this)
      }
      return this.fn()
    } finally {
      if (effectTrackDepth <= maxMarkerBits) {
        finalizeDepMarkers(this)
      }
      // 恢复到上一级
      trackOpBit = 1 << --effectTrackDepth
      // activeEffect 还原成上一层的 activeEffect
      // 只有一层。activeEffect = undefined
      activeEffect = this.parent
      shouldTrack = lastShouldTrack
      this.parent = undefined
    }
  }
  stop () {
    if (this.active) {
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

function cleanupEffect (effect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}
export function effect (fn, options) {
  if (fn.effect) {
    fn = fn.effect.fn
  }
  const _effect = new ReactiveEffect(fn)

  if (options) {
    extend(_effect, options)
    if (options.scope) recordEffectScope(_effect, options.scope)
  }
  if (!options || !options.lazy) {
    _effect.run()
  }
  const runner = _effect.run.bind(_effect)
  runner.effect = _effect
  return runner
}
export function stop (runner) {
  runner.effect.stop()
}
export let shouldTrack = true
const trackStack = []
/**
 * 暂停收集依赖
 */
export function pauseTracking () {
  trackStack.push(shouldTrack)
  shouldTrack = false
}
/**
 * 重新收集依赖
 */
export function resetTracking () {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}
/**
 * 收集对象哪些值被使用了
 * @param {*} target
 * @param {*} _type
 * @param {*} key
 */
export function track (target, _type, key) {
  if (shouldTrack && activeEffect) {
    console.log(target)
    console.log(key)
    console.log('触发get')
    // 对象建立了 targetMap
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }
    trackEffects(dep)
  }
}
/**
 * 被使用的属性和activeEffect(一般情况下为组件跟新函数)建立联系
 * @param {*} dep
 */
export function trackEffects (dep) {
  let shouldTrack = false
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      // 打上新标记
      dep.n |= trackOpBit
      // 如果依赖已经被收集，则不需要再次收集
      shouldTrack = !wasTracked(dep)
    }
  } else {
    shouldTrack = !dep.has(activeEffect)
  }
  if (shouldTrack) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}
/**
 * 触发依赖
 * @param { object } target
 * @param { string } type
 * @param {*} key
 * @param {*} newValue
 * @param {*} oldValue
 * @param {*} oldTarget
 */
export function trigger (target, type, key, newValue) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  let deps = []
  if (type === 'clear') {
    deps = [...depsMap.values()]
  } else if (key === 'length' && isArray(target)) {
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= newValue) {
        deps.push(dep)
      }
    })
  } else {
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }
    switch (type) {
      case 'add':
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          deps.push(depsMap.get('length'))
        }
        break
      case 'delete':
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case 'set':
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }
  if (deps.length === 1) {
    if (deps[0]) {
      triggerEffects(deps[0])
    }
  } else {
    const effects = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    triggerEffects(createDep(effects))
  }
}
export function triggerEffects (dep) {
  for (const effect of isArray(dep) ? dep : [...dep]) {
    if (effect !== activeEffect || effect.allowRecurse) {
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        effect.run()
      }
    }
  }
}
