import { isString, isObject, isArray, EMPTY_ARR } from '../../shared/index.js'
export function renderList (source, renderItem, cache, index) {
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
  return ret
}
function createSlots (slots, dynamicSlots) {
  for (let i = 0; i < dynamicSlots.length; i++) {
    const slot = dynamicSlots[i]
    if (isArray(slot)) {
      for (let j = 0; j < slot.length; j++) {
        slots[slot[j].name] = slot[j].fn
      }
    } else if (slot) {
      slots[slot.name] = slot.fn
    }
  }
  return slots
}
function renderSlot (slots, name, props = {}, fallback, noSlotted) {
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
function toHandlers (obj) {
  const ret = {}
  if (!isObject(obj)) {
    return ret
  }
  for (const key in obj) {
    ret[toHandlerKey(key)] = obj[key]
  }
  return ret
}
