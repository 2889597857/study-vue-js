let activeEffectScope
export class EffectScope {
  constructor (detached = false) {
    this.active = true
    this.effects = []
    this.cleanups = []

    if (!detached && activeEffectScope) {
      this.parent = activeEffectScope
      /**
       * 记录在上一层 scopes 中自己位置的索引
       */
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1
    }
  }
  /**
   * 执行传入的函数
   * 收集fn中的响应式效果
   * @param {*} fn
   */
  run (fn) {
    if (this.active) {
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = this.parent
      }
    }
  }
  on () {
    activeEffectScope = this
  }
  off () {
    activeEffectScope = this.parent
  }
  /**
   * 关闭 scope
   * 清理 run 中收集的响应式效果
   * @param {*} fromParent
   */
  stop (fromParent) {
    if (this.active) {
      let i, l
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop()
      }
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true)
        }
      }
      // nested scope, dereference from parent to avoid memory leaks
      if (this.parent && !fromParent) {
        // optimized O(1) removal
        const last = this.parent.scopes.pop()
        if (last && last !== this) {
          this.parent.scopes[this.index] = last
          last.index = this.index
        }
      }
      this.active = false
    }
  }
}
export function effectScope (detached) {
  return new EffectScope(detached)
}
export function recordEffectScope (effect, scope) {
  if (scope && scope.active) {
    // console.log(scope)
    scope.effects.push(effect)
  }
}
/**
 * 获取当前的 EffectScope
 */
export function getCurrentScope () {
  return activeEffectScope
}
/**
 * 添加 scope 关闭时的回调函数
 * @param {*} fn
 */
export function onScopeDispose (fn) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  }
}
