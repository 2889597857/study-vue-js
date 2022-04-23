import { trigger } from './effect.js'
const toShallow = value => value
const getProto = v => Reflect.getPrototypeOf(v)
function get (target, key, isReadonly = false, isShallow = false) {
  target = target['__v_raw']
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  if (key !== rawKey) {
    !isReadonly && track(rawTarget, 'get', key)
  }
  !isReadonly && track(rawTarget, 'get', rawKey)
  const { has } = getProto(rawTarget)
  const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
  if (has.call(rawTarget, key)) {
    return wrap(target.get(key))
  } else if (has.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey))
  } else if (target !== rawTarget) {
    target.get(key)
  }
}
function has (key, isReadonly = false) {
  const target = this['__v_raw']
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  if (key !== rawKey) {
    !isReadonly && track(rawTarget, 'has', key)
  }
  !isReadonly && track(rawTarget, 'has', rawKey)
  return key === rawKey
    ? target.has(key)
    : target.has(key) || target.has(rawKey)
}
function size (target, isReadonly = false) {
  target = target['__v_raw']
  !isReadonly && track(toRaw(target), 'iterate', ITERATE_KEY)
  return Reflect.get(target, 'size', target)
}
function add (value) {
  value = toRaw(value)
  const target = toRaw(this)
  const proto = getProto(target)
  const hadKey = proto.has.call(target, value)
  if (!hadKey) {
    target.add(value)
    trigger(target, 'add', value, value)
  }
  return this
}
function set (key, value) {
  value = toRaw(value)
  const target = toRaw(this)
  const { has, get } = getProto(target)
  let hadKey = has.call(target, key)
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)
  }
  const oldValue = get.call(target, key)
  target.set(key, value)
  if (!hadKey) {
    trigger(target, 'add', key, value)
  } else if (hasChanged(value, oldValue)) {
    trigger(target, 'set', key, value, oldValue)
  }
  return this
}
function deleteEntry (key) {
  const target = toRaw(this)
  const { has, get } = getProto(target)
  let hadKey = has.call(target, key)
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)
  }
  const oldValue = get ? get.call(target, key) : undefined
  const result = target.delete(key)
  if (hadKey) {
    trigger(target, 'delete', key, undefined, oldValue)
  }
  return result
}
function clear () {
  const target = toRaw(this)
  const hadItems = target.size !== 0
  const result = target.clear()
  if (hadItems) {
    trigger(target, 'clear', undefined, undefined)
  }
  return result
}
function createForEach (isReadonly, isShallow) {
  return function forEach (callback, thisArg) {
    const observed = this
    const target = observed['__v_raw']
    const rawTarget = toRaw(target)
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    !isReadonly && track(rawTarget, 'iterate', ITERATE_KEY)
    return target.forEach((value, key) => {
      return callback.call(thisArg, wrap(value), wrap(key), observed)
    })
  }
}
function createIterableMethod (method, isReadonly, isShallow) {
  return function (...args) {
    const target = this['__v_raw']
    const rawTarget = toRaw(target)
    const targetIsMap = isMap(rawTarget)
    const isPair =
      method === 'entries' || (method === Symbol.iterator && targetIsMap)
    const isKeyOnly = method === 'keys' && targetIsMap
    const innerIterator = target[method](...args)
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    !isReadonly &&
      track(rawTarget, 'iterate', isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY)
    return {
      next () {
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            }
      },
      [Symbol.iterator] () {
        return this
      }
    }
  }
}
function createReadonlyMethod (type) {
  return function () {
    return type === 'delete' ? false : this
  }
}
function createInstrumentations () {
  const mutableInstrumentations = {
    get (key) {
      return get(this, key)
    },
    get size () {
      return size(this)
    },
    has: has,
    add,
    set: set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false)
  }
  const shallowInstrumentations = {
    get (key) {
      return get(this, key, false, true)
    },
    get size () {
      return size(this)
    },
    has: has,
    add,
    set: set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true)
  }
  const readonlyInstrumentations = {
    get (key) {
      return get(this, key, true)
    },
    get size () {
      return size(this, true)
    },
    has (key) {
      return has.call(this, key, true)
    },
    add: createReadonlyMethod('add'),
    set: createReadonlyMethod('set'),
    delete: createReadonlyMethod('delete'),
    clear: createReadonlyMethod('clear'),
    forEach: createForEach(true, false)
  }
  const shallowReadonlyInstrumentations = {
    get (key) {
      return get(this, key, true, true)
    },
    get size () {
      return size(this, true)
    },
    has (key) {
      return has.call(this, key, true)
    },
    add: createReadonlyMethod('add'),
    set: createReadonlyMethod('set'),
    delete: createReadonlyMethod('delete'),
    clear: createReadonlyMethod('clear'),
    forEach: createForEach(true, true)
  }
  const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
  iteratorMethods.forEach(method => {
    mutableInstrumentations[method] = createIterableMethod(method, false, false)
    readonlyInstrumentations[method] = createIterableMethod(method, true, false)
    shallowInstrumentations[method] = createIterableMethod(method, false, true)
    shallowReadonlyInstrumentations[method] = createIterableMethod(
      method,
      true,
      true
    )
  })
  return [
    mutableInstrumentations,
    readonlyInstrumentations,
    shallowInstrumentations,
    shallowReadonlyInstrumentations
  ]
}
const [
  mutableInstrumentations,
  readonlyInstrumentations,
  shallowInstrumentations,
  shallowReadonlyInstrumentations
] = createInstrumentations()
function createInstrumentationGetter (isReadonly, shallow) {
  const instrumentations = shallow
    ? isReadonly
      ? shallowReadonlyInstrumentations
      : shallowInstrumentations
    : isReadonly
    ? readonlyInstrumentations
    : mutableInstrumentations
  return (target, key, receiver) => {
    if (key === '__v_isReactive') {
      return !isReadonly
    } else if (key === '__v_isReadonly') {
      return isReadonly
    } else if (key === '__v_raw') {
      return target
    }
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    )
  }
}
export const mutableCollectionHandlers = {
  get: createInstrumentationGetter(false, false)
}
export const shallowCollectionHandlers = {
  get: createInstrumentationGetter(false, true)
}
export const readonlyCollectionHandlers = {
  get: createInstrumentationGetter(true, false)
}
export const shallowReadonlyCollectionHandlers = {
  get: createInstrumentationGetter(true, true)
}
function checkIdentityKeys (target, has, key) {
  const rawKey = toRaw(key)
  if (rawKey !== key && has.call(target, rawKey)) {
    const type = toRawType(target)
  }
}
