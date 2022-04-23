// compiler should normalize class + :class bindings on the same element
// into a single binding ['staticClass', dynamic]
export function patchClass (el, value, isSVG) {
  const transitionClasses = el._vtc
  if (transitionClasses) {
    value = (value
      ? [value, ...transitionClasses]
      : [...transitionClasses]
    ).join(' ')
  }
  if (value == null) {
    el.removeAttribute('class')
  } else if (isSVG) {
    el.setAttribute('class', value)
  } else {
    el.className = value
  }
}
