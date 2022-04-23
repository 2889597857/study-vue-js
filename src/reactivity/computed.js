import { ReactiveEffect } from './effect.js'
import { trackRefValue, triggerRefValue } from './ref.js'
import { isFunction } from '../shared/index.js'
import { toRaw } from './reactive.js'
export class ComputedRefImpl {
  constructor (getter, _setter, isReadonly) {
    this._setter = _setter
    this.dep = undefined
    this.__v_isRef = true
    this._dirty = true // dirty 依赖是否发生变化。computed重新执行
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
        // 依赖变了，重新求值
        triggerRefValue(this)
      }
    })
    this.effect.computed = this
    this['__v_isReadonly' /* IS_READONLY */] = isReadonly
  }
  get value () {
    // computed 可能会被其他值包装，E.g : readonly
    // 获取原始值
    const self = toRaw(this)
    trackRefValue(self)
    if (self._dirty) {
      self._dirty = false
      // 第一次访问或依赖属性发生变化，重新求值
      self._value = self.effect.run()
    }
    return self._value
  }
  set value (newValue) {
    this._setter(newValue)
  }
}

export function computed (getterOrOptions) {
  let getter
  let setter
  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    getter = getterOrOptions
    setter = () => {
      console.warn('Write operation failed: computed value is readonly')
    }
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  const cRef = new ComputedRefImpl(getter, setter, onlyGetter || !setter)
  return cRef
}
