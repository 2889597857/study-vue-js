import { shallowReactive, toRaw, trigger } from '../reactivity/index.js';
import {
  camelize,
  capitalize,
  def,
  EMPTY_ARR,
  EMPTY_OBJ,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
  isObject,
  isReservedProp,
  makeMap,
  toRawType
} from '../shared/index.js';
import { isEmitListener } from './componentEmits.js';
import { InternalObjectKey } from './vnode.js';

export function initProps(instance, rawProps, isStateful) {
  const props = {};
  const attrs = {};
  // attrs对象 添加不可枚举属性 InternalObjectKey ，属性值为 1
  def(attrs, InternalObjectKey, 1);
  instance.propsDefaults = Object.create(null);
  // 设置 props attrs
  setFullProps(instance, rawProps, props, attrs);
  /**
   * propsOptions [{},[]]
   * [0] props 的属性：默认值 是不是必选 类型验证等
   * hello:{0: false, 1: true, type: ƒ}
   * title: {0: false, 1: true, required: true, default: 'll', type: ƒ}
   */

  // 子组件prop定义了值，父组件未传值的prop给个初始值 undefined
  // 确保每个子组件每个 prop 都有值
  for (const key in instance.propsOptions[0]) {
    if (!(key in props)) {
      props[key] = undefined;
    }
  }
  {
    // 开发环境 验证props
    validateProps(rawProps || {}, props, instance);
  }
  if (isStateful) {
    instance.props = shallowReactive(props);
  } else {
    if (!instance.type.props) {
      instance.props = attrs;
    } else {
      instance.props = props;
    }
  }
  instance.attrs = attrs;
}
export function updateProps(instance, rawProps, rawPrevProps, optimized) {
  const {
    props,
    attrs,
    vnode: { patchFlag },
  } = instance;
  const rawCurrentProps = toRaw(props);
  const [options] = instance.propsOptions;
  let hasAttrsChanged = false;
  if (
    !(
      instance.type.__hmrId ||
      (instance.parent && instance.parent.type.__hmrId)
    ) &&
    (optimized || patchFlag > 0) &&
    !(patchFlag & 16)
  ) {
    if (patchFlag & 8) {
      const propsToUpdate = instance.vnode.dynamicProps;
      for (let i = 0; i < propsToUpdate.length; i++) {
        let key = propsToUpdate[i];
        const value = rawProps[key];
        if (options) {
          if (hasOwn(attrs, key)) {
            if (value !== attrs[key]) {
              attrs[key] = value;
              hasAttrsChanged = true;
            }
          } else {
            const camelizedKey = camelize(key);
            props[camelizedKey] = resolvePropValue(
              options,
              rawCurrentProps,
              camelizedKey,
              value,
              instance,
              false
            );
          }
        } else {
          if (value !== attrs[key]) {
            attrs[key] = value;
            hasAttrsChanged = true;
          }
        }
      }
    }
  } else {
    if (setFullProps(instance, rawProps, props, attrs)) {
      hasAttrsChanged = true;
    }
    let kebabKey;
    for (const key in rawCurrentProps) {
      if (
        !rawProps ||
        (!hasOwn(rawProps, key) &&
          ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey)))
      ) {
        if (options) {
          if (
            rawPrevProps &&
            (rawPrevProps[key] !== undefined ||
              rawPrevProps[kebabKey] !== undefined)
          ) {
            props[key] = resolvePropValue(
              options,
              rawCurrentProps,
              key,
              undefined,
              instance,
              true
            );
          }
        } else {
          delete props[key];
        }
      }
    }
    if (attrs !== rawCurrentProps) {
      for (const key in attrs) {
        if (!rawProps || (!hasOwn(rawProps, key) && !false)) {
          delete attrs[key];
          hasAttrsChanged = true;
        }
      }
    }
  }
  if (hasAttrsChanged) {
    trigger(instance, 'set', '$attrs');
  }
  {
    validateProps(rawProps || {}, props, instance);
  }
}
function setFullProps(instance, rawProps, props, attrs) {
  const [options, needCastKeys] = instance.propsOptions;
  console.log(instance.propsOptions);
  console.log(instance.emitsOptions);

  let hasAttrsChanged = false;
  let rawCastValues;
  if (rawProps) {
    for (let key in rawProps) {
      if (isReservedProp(key)) {
        continue;
      }
      const value = rawProps[key];
      let camelKey;
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        if (!needCastKeys || !needCastKeys.includes(camelKey)) {
          props[camelKey] = value;
        } else {
          (rawCastValues || (rawCastValues = {}))[camelKey] = value;
        }
      } else if (!isEmitListener(instance.emitsOptions, key)) {
        if (!(key in attrs) || value !== attrs[key]) {
          attrs[key] = value;
          hasAttrsChanged = true;
        }
      }
    }
  }
  if (needCastKeys) {
    const rawCurrentProps = toRaw(props);
    const castValues = rawCastValues || EMPTY_OBJ;
    for (let i = 0; i < needCastKeys.length; i++) {
      const key = needCastKeys[i];
      props[key] = resolvePropValue(
        options,
        rawCurrentProps,
        key,
        castValues[key],
        instance,
        !hasOwn(castValues, key)
      );
    }
  }
  return hasAttrsChanged;
}
function resolvePropValue(options, props, key, value, instance, isAbsent) {
  const opt = options[key];
  if (opt != null) {
    const hasDefault = hasOwn(opt, 'default');
    if (hasDefault && value === undefined) {
      const defaultValue = opt.default;
      if (opt.type !== Function && isFunction(defaultValue)) {
        const { propsDefaults } = instance;
        if (key in propsDefaults) {
          value = propsDefaults[key];
        } else {
          setCurrentInstance(instance);
          value = propsDefaults[key] = defaultValue.call(null, props);
          unsetCurrentInstance();
        }
      } else {
        value = defaultValue;
      }
    }
    if (opt[0]) {
      if (isAbsent && !hasDefault) {
        value = false;
      } else if (opt[1] && (value === '' || value === hyphenate(key))) {
        value = true;
      }
    }
  }
  return value;
}
export function normalizePropsOptions(comp, appContext, asMixin = false) {
  const cache = appContext.propsCache;
  const cached = cache.get(comp);
  if (cached) {
    return cached;
  }
  const raw = comp.props;
  const normalized = {};
  const needCastKeys = [];
  let hasExtends = false;
  if (!isFunction(comp)) {
    const extendProps = (raw) => {
      hasExtends = true;
      const [props, keys] = normalizePropsOptions(raw, appContext, true);
      extend(normalized, props);
      if (keys) needCastKeys.push(...keys);
    };
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendProps);
    }
    if (comp.extends) {
      extendProps(comp.extends);
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendProps);
    }
  }
  if (!raw && !hasExtends) {
    cache.set(comp, EMPTY_ARR);
    return EMPTY_ARR;
  }
  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const normalizedKey = camelize(raw[i]);
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ;
      }
    }
  } else if (raw) {
    for (const key in raw) {
      const normalizedKey = camelize(key);
      if (validatePropName(normalizedKey)) {
        const opt = raw[key];
        const prop = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : opt);
        if (prop) {
          const booleanIndex = getTypeIndex(Boolean, prop.type);
          const stringIndex = getTypeIndex(String, prop.type);
          prop[0] = booleanIndex > -1;
          prop[1] = stringIndex < 0 || booleanIndex < stringIndex;
          if (booleanIndex > -1 || hasOwn(prop, 'default')) {
            needCastKeys.push(normalizedKey);
          }
        }
      }
    }
  }
  const res = [normalized, needCastKeys];
  cache.set(comp, res);
  return res;
}
/**
 * 字符串首字母是否是 '$'
 * true or false
 * @param {string} key
 * @returns
 */
function validatePropName(key) {
  if (key[0] !== '$') {
    return true;
  }
  return false;
}
function getType(ctor) {
  const match = ctor && ctor.toString().match(/^\s*function (\w+)/);
  return match ? match[1] : ctor === null ? 'null' : '';
}
function isSameType(a, b) {
  return getType(a) === getType(b);
}
function getTypeIndex(type, expectedTypes) {
  if (isArray(expectedTypes)) {
    return expectedTypes.findIndex((t) => isSameType(t, type));
  } else if (isFunction(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1;
  }
  return -1;
}
/**
 * 验证子组件定义的 props
 * @param {object} rawProps
 * @param {object} props
 * @param {object} instance
 */
function validateProps(rawProps, props, instance) {
  const resolvedValues = toRaw(props);
  const options = instance.propsOptions[0];
  for (const key in options) {
    let opt = options[key];
    if (opt == null) continue;
    validateProp(
      key,
      resolvedValues[key],
      opt,
      !hasOwn(rawProps, key) && !hasOwn(rawProps, hyphenate(key))
    );
  }
}

/**
 * dev only
 * @param {string} name
 * @param {*} value
 * @param {object} prop
 * @param {boolean} isAbsent
 * @returns
 */
function validateProp(name, value, prop, isAbsent) {
  const { type, required, validator } = prop;
  // required!
  if (required && isAbsent) {
    console.log('Missing required prop: "' + name + '"');
    return;
  }
  // missing but optional
  if (value == null && !prop.required) {
    return;
  }
  // type check
  if (type != null && type !== true) {
    let isValid = false;
    const types = isArray(type) ? type : [type];
    const expectedTypes = [];
    // value is valid as long as one of the specified types match
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType(value, types[i]);
      expectedTypes.push(expectedType || '');
      isValid = valid;
    }
    if (!isValid) {
      console.log(getInvalidTypeMessage(name, value, expectedTypes));
      return;
    }
    // custom validator
    if (validator && !validator(value)) {
      console.log(
        'Invalid prop: custom validator check failed for prop "' + name + '".'
      );
    }
  }
}
/**
 * dev only
 */
const isSimpleType = makeMap('String,Number,Boolean,Function,Symbol,BigInt');
function assertType(value, type) {
  let valid;
  const expectedType = getType(type);
  if (isSimpleType(expectedType)) {
    const t = typeof value;
    valid = t === expectedType.toLowerCase();
    if (!valid && t === 'object') {
      valid = value instanceof type;
    }
  } else if (expectedType === 'Object') {
    valid = isObject(value);
  } else if (expectedType === 'Array') {
    valid = isArray(value);
  } else if (expectedType === 'null') {
    valid = value === null;
  } else {
    valid = value instanceof type;
  }
  return { valid, expectedType };
}
/**
 * dev only
 */
function getInvalidTypeMessage(name, value, expectedTypes) {
  let message =
    `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(' | ')}`;
  const expectedType = expectedTypes[0];
  const receivedType = toRawType(value);
  const expectedValue = styleValue(value, expectedType);
  const receivedValue = styleValue(value, receivedType);
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${expectedValue}`;
  }
  message += `, got ${receivedType} `;
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`;
  }
  return message;
}
/**
 * dev only
 */
function styleValue(value, type) {
  if (type === 'String') {
    return `"${value}"`;
  } else if (type === 'Number') {
    return `${Number(value)}`;
  } else {
    return `${value}`;
  }
}
/**
 * dev only
 */
function isExplicable(type) {
  const explicitTypes = ['string', 'number', 'boolean'];
  return explicitTypes.some((elem) => type.toLowerCase() === elem);
}
/**
 * dev only
 */
function isBoolean(...args) {
  return args.some((elem) => elem.toLowerCase() === 'boolean');
}
