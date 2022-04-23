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
import { isRef } from '../reactivity/index.js'
import { queuePostRenderEffect } from './renderer.js'

/**
 * Function for handling a template ref
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
  const refValue =
    vnode.shapeFlag & 4
      ? getExposeProxy(vnode.component) || vnode.component.proxy
      : vnode.el
  const value = isUnmount ? null : refValue
  const { i: owner, r: ref } = rawRef
  if (!owner) {
    return
  }
  const oldRef = oldRawRef && oldRawRef.r
  const refs = owner.refs === EMPTY_OBJ ? (owner.refs = {}) : owner.refs
  const setupState = owner.setupState
  if (oldRef != null && oldRef !== ref) {
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
    if (_isString || _isRef) {
      const doSet = () => {
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
            setupState[ref] = value
          }
        } else if (isRef(ref)) {
          ref.value = value
          if (rawRef.k) refs[rawRef.k] = value
        }
      }
      if (value) {
        doSet.id = -1
        queuePostRenderEffect(doSet, parentSuspense)
      } else {
        doSet()
      }
    }
  }
}
