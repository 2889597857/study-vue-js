import { includeBooleanAttr } from '../../shared/index.js'

export function patchDOMProp (
  el,
  key,
  value,
  prevChildren,
  parentComponent,
  parentSuspense,
  unmountChildren
) {
  if (key === 'innerHTML' || key === 'textContent') {
    if (prevChildren) {
      unmountChildren(prevChildren, parentComponent, parentSuspense)
    }
    el[key] = value == null ? '' : value
    return
  }
  if (
    key === 'value' &&
    el.tagName !== 'PROGRESS' &&
    !el.tagName.includes('-')
  ) {
    el._value = value
    const newValue = value == null ? '' : value
    if (el.value !== newValue || el.tagName === 'OPTION') {
      el.value = newValue
    }
    if (value == null) {
      el.removeAttribute(key)
    }
    return
  }
  if (value === '' || value == null) {
    const type = typeof el[key]
    if (type === 'boolean') {
      el[key] = includeBooleanAttr(value)
      return
    } else if (value == null && type === 'string') {
      el[key] = ''
      el.removeAttribute(key)
      return
    } else if (type === 'number') {
      try {
        el[key] = 0
      } catch (_a) {}
      el.removeAttribute(key)
      return
    }
  }
  try {
    el[key] = value
  } catch (e) {}
}
