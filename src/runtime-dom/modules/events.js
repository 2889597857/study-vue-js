import { hyphenate, isArray } from '../../shared/index.js'

let _getNow = Date.now

let skipTimestampCheck = false

if (typeof window !== 'undefined') {
  if (_getNow() > document.createEvent('Event').timeStamp) {
    _getNow = () => performance.now()
  }
  const ffMatch = navigator.userAgent.match(/firefox\/(\d+)/i)
  skipTimestampCheck = !!(ffMatch && Number(ffMatch[1]) <= 53)
}

let cachedNow = 0
const p = Promise.resolve()
const reset = () => {
  cachedNow = 0
}
const getNow = () => cachedNow || (p.then(reset), (cachedNow = _getNow()))

export function addEventListener (el, event, handler, options) {
  el.addEventListener(event, handler, options)
}

export function removeEventListener (el, event, handler, options) {
  el.removeEventListener(event, handler, options)
}

export function patchEvent (el, rawName, prevValue, nextValue, instance) {
  // vei = vue event invokers
  const invokers = el._vei || (el._vei = {})
  const existingInvoker = invokers[rawName]
  if (nextValue && existingInvoker) {
    // patch
    existingInvoker.value = nextValue
  } else {
    const [name, options] = parseName(rawName)
    if (nextValue) {
      // add
      const invoker = (invokers[rawName] = createInvoker(nextValue, instance))
      addEventListener(el, name, invoker, options)
    } else if (existingInvoker) {
      // remove
      removeEventListener(el, name, existingInvoker, options)
      invokers[rawName] = undefined
    }
  }
}

const optionsModifierRE = /(?:Once|Passive|Capture)$/

function parseName (name) {
  let options
  if (optionsModifierRE.test(name)) {
    options = {}
    let m
    while ((m = name.match(optionsModifierRE))) {
      name = name.slice(0, name.length - m[0].length)
      options[m[0].toLowerCase()] = true
      options
    }
  }
  return [hyphenate(name.slice(2)), options]
}

function createInvoker (initialValue, instance) {
  const invoker = e => {
    const timeStamp = e.timeStamp || _getNow()
    if (skipTimestampCheck || timeStamp >= invoker.attached - 1) {
      patchStopImmediatePropagation(e, invoker.value)(e)
    }
  }
  invoker.value = initialValue
  invoker.attached = getNow()
  return invoker
}

function patchStopImmediatePropagation (e, value) {
  if (isArray(value)) {
    const originalStop = e.stopImmediatePropagation
    e.stopImmediatePropagation = () => {
      originalStop.call(e)
      e._stopped = true
    }
    return value.map(fn => e => !e._stopped && fn && fn(e))
  } else {
    return value
  }
}
