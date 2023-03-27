import { isRef } from '../reactivity/index.js'
import {
  EMPTY_OBJ,
  hasOwn,
  isArray,
  isFunction,
  isString,
  remove
} from '../shared/index.js'
import { isAsyncWrapper } from './apiAsyncComponent.js'
import { getExposeProxy } from './component.js'
import { queuePostRenderEffect } from './renderer.js'

/**
 * 处理模板引用
 * 
 * @param { f:boolean,i:component,k,r} rawRef
 */
export function setRef (
  rawRef,
  oldRawRef,
  parentSuspense,
  vnode,
  isUnmount = false
) {
  if (isArray(rawRef)) {
    rawRef.forEach((r, i) =>
      setRef(
        r,
        oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef),
        parentSuspense,
        vnode,
        isUnmount
      )
    )
    return
  }
  if (isAsyncWrapper(vnode) && !isUnmount) {
    return
  }
  // ref 绑定的值是不是组件
  // 是
  // 不是 refValue 为 dom 节点
  const refValue =
    vnode.shapeFlag & 4
      ? getExposeProxy(vnode.component) || vnode.component.proxy
      : vnode.el
  const value = isUnmount ? null : refValue
  // i 组件对象 r  ref 名称 ‘a’  const a = ref(null)
  const { i: owner, r: ref } = rawRef
  if (!owner) {
    return
  }
  const oldRef = oldRawRef && oldRawRef.r
  const refs = owner.refs === EMPTY_OBJ ? (owner.refs = {}) : owner.refs
  // setup 返回值
  const setupState = owner.setupState
  // oldRef 是 n1.ref ref n1
  // oldRef 不为 null, 并且新旧 ref 不相同
  if (oldRef != null && oldRef !== ref) {
    // oldRef 赋值 null
    if (isString(oldRef)) {
      refs[oldRef] = null
      if (hasOwn(setupState, oldRef)) {
        setupState[oldRef] = null
      }
    } else if (isRef(oldRef)) {
      oldRef.value = null
    }
  }
  if (isFunction(ref)) {
    ref(value, refs)
  } else {
    const _isString = isString(ref)
    const _isRef = isRef(ref)
    // ref 是字符串 或 Ref
    if (_isString || _isRef) {
      const doSet = () => {

        console.log(123)
        if (rawRef.f) {
          const existing = _isString ? refs[ref] : ref.value
          if (isUnmount) {
            isArray(existing) && remove(existing, refValue)
          } else {
            if (!isArray(existing)) {
              if (_isString) {
                refs[ref] = [refValue]
              } else {
                ref.value = [refValue]
                if (rawRef.k) refs[rawRef.k] = ref.value
              }
            } else if (!existing.includes(refValue)) {
              existing.push(refValue)
            }
          }
        } else if (_isString) {
          refs[ref] = value
          if (hasOwn(setupState, ref)) {
            // ref 绑定普通dom 元素
            // dom 上的 ref 和 setup 中定义的 ref 建立联系
            setupState[ref] = value
          }
        } else if (isRef(ref)) {
          ref.value = value
          if (rawRef.k) refs[rawRef.k] = value
        }
      }
      if (value) {
        doSet.id = 1
        queuePostRenderEffect(doSet, parentSuspense)
      } else {
        doSet()
      }
    }
  }
}
