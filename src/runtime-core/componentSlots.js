import { isArray, isFunction, EMPTY_OBJ, extend, def } from '../shared/index.js'
import { normalizeVNode, InternalObjectKey } from './vnode.js'
import { withCtx } from './componentRenderContext.js'
import { toRaw } from '../reactivity/index.js'
const isInternalKey = key => key[0] === '_' || key === '$stable'
const normalizeSlotValue = value =>
  isArray(value) ? value.map(normalizeVNode) : [normalizeVNode(value)]
const normalizeSlot = (key, rawSlot, ctx) => {
  const normalized = withCtx((...args) => {
    return normalizeSlotValue(rawSlot(...args))
  }, ctx)
  normalized._c = false
  return normalized
}
const normalizeObjectSlots = (rawSlots, slots, instance) => {
  const ctx = rawSlots._ctx
  for (const key in rawSlots) {
    if (isInternalKey(key)) continue
    const value = rawSlots[key]
    if (isFunction(value)) {
      slots[key] = normalizeSlot(key, value, ctx)
    } else if (value != null) {
      const normalized = normalizeSlotValue(value)
      slots[key] = () => normalized
    }
  }
}
const normalizeVNodeSlots = (instance, children) => {
  const normalized = normalizeSlotValue(children)
  instance.slots.default = () => normalized
}
export const initSlots = (instance, children) => {
  if (instance.vnode.shapeFlag & 32) {
    const type = children._
    if (type) {
      instance.slots = toRaw(children)
      def(children, '_', type)
    } else {
      normalizeObjectSlots(children, (instance.slots = {}))
    }
  } else {
    instance.slots = {}
    if (children) {
      normalizeVNodeSlots(instance, children)
    }
  }
  def(instance.slots, InternalObjectKey, 1)
}
export const updateSlots = (instance, children, optimized) => {
  const { vnode, slots } = instance
  let needDeletionCheck = true
  let deletionComparisonTarget = EMPTY_OBJ
  if (vnode.shapeFlag & 32) {
    const type = children._
    if (type) {
      extend(slots, children)
      if (!optimized && type === 1) {
        delete slots._
      }
    } else {
      needDeletionCheck = !children.$stable
      normalizeObjectSlots(children, slots)
    }
    deletionComparisonTarget = children
  } else if (children) {
    normalizeVNodeSlots(instance, children)
    deletionComparisonTarget = { default: 1 }
  }
  if (needDeletionCheck) {
    for (const key in slots) {
      if (!isInternalKey(key) && !(key in deletionComparisonTarget)) {
        delete slots[key]
      }
    }
  }
}
