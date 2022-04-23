import { includeBooleanAttr, isSpecialBooleanAttr } from '../../shared/index.js'

export const xlinkNS = 'http://www.w3.org/1999/xlink'

export function patchAttr (el, key, value, isSVG) {
  if (isSVG && key.startsWith('xlink:')) {
    if (value == null) {
      el.removeAttributeNS(xlinkNS, key.slice(6, key.length))
    } else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  } else {
    const isBoolean = isSpecialBooleanAttr(key)
    if (value == null || (isBoolean && !includeBooleanAttr(value))) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, isBoolean ? '' : value)
    }
  }
}
