import { openBlock, createBlock, Fragment, isVNode } from '../vnode.js'
import { createVNode } from '../../runtime-core/index.js'
import { currentRenderingInstance } from '../componentRenderContext.js'
export function renderSlot (slots, name, props = {}, fallback, noSlotted) {
  if (currentRenderingInstance.isCE) {
    return createVNode(
      'slot',
      name === 'default' ? null : { name },
      fallback && fallback()
    )
  }
  let slot = slots[name]
  if (slot && slot.length > 1) {
    slot = () => []
  }
  if (slot && slot._c) {
    slot._d = false
  }
  openBlock()
  const validSlotContent = slot && ensureValidVNode(slot(props))
  const rendered = createBlock(
    Fragment,
    { key: props.key || `_${name}` },
    validSlotContent || (fallback ? fallback() : []),
    validSlotContent && slots._ === 1 ? 64 : -2
  )
  if (!noSlotted && rendered.scopeId) {
    rendered.slotScopeIds = [rendered.scopeId + '-s']
  }
  if (slot && slot._c) {
    slot._d = true
  }
  return rendered
}

function ensureValidVNode (vnodes) {
  return vnodes.some(child => {
    if (!isVNode(child)) return true
    if (child.type === Comment) return false
    if (child.type === Fragment && !ensureValidVNode(child.children))
      return false
    return true
  })
    ? vnodes
    : null
}
