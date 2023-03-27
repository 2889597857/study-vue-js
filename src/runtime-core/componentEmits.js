import {
  camelize,
  EMPTY_OBJ,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
  isOn,
  toHandlerKey,
  toNumber
} from '../shared/index.js';
export function emit(instance, event, ...rawArgs) {
  const props = instance.vnode.props || EMPTY_OBJ;

  let args = rawArgs;
  // 处理 v-model
  const isModelListener = event.startsWith('update:');
  // for v-model update:xxx events, apply modifiers on args
  // modelArg xxx 默认值为 modelValue
  const modelArg = isModelListener && event.slice(7);
  if (modelArg && modelArg in props) {
    const modifiersKey = `${
      modelArg === 'modelValue' ? 'model' : modelArg
    }Modifiers`;
    // 修饰符 .lazy .number .trim
    const { number, trim } = props[modifiersKey] || EMPTY_OBJ;
    if (trim) {
      args = rawArgs.map((a) => a.trim());
    } else if (number) {
      args = rawArgs.map(toNumber);
    }
  }

  let handlerName;
  let handler =
    // click => onClick
    props[(handlerName = toHandlerKey(event))] ||
    // on-click => onClick
    props[(handlerName = toHandlerKey(camelize(event)))];
  // for v-model update:xxx events, also trigger kebab-case equivalent
  // for props passed via kebab-case
  if (!handler && isModelListener) {
    // update:modelValue => onUpdate:model-value
    handler = props[(handlerName = toHandlerKey(hyphenate(event)))];
  }
  if (handler) {
    handler([...args]);
  }
  // onClickOnce 只执行一次
  const onceHandler = props[handlerName + `Once`];
  if (onceHandler) {
    // 缓存避免多次执行
    if (!instance.emitted) {
      instance.emitted = {};
    } else if (instance.emitted[handlerName]) {
      return;
    }
    instance.emitted[handlerName] = true;
    onceHandler(args);
  }
}
export function normalizeEmitsOptions(comp, appContext, asMixin = false) {
  const cache = appContext.emitsCache;
  const cached = cache.get(comp);
  if (cached !== undefined) {
    return cached;
  }
  const raw = comp.emits;
  let normalized = {};
  // apply mixin/extends props
  let hasExtends = false;
  if (!isFunction(comp)) {
    const extendEmits = (raw) => {
      const normalizedFromExtend = normalizeEmitsOptions(raw, appContext, true);
      if (normalizedFromExtend) {
        hasExtends = true;
        extend(normalized, normalizedFromExtend);
      }
    };
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendEmits);
    }
    if (comp.extends) {
      extendEmits(comp.extends);
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendEmits);
    }
  }
  if (!raw && !hasExtends) {
    cache.set(comp, null);
    return null;
  }
  if (isArray(raw)) {
    raw.forEach((key) => (normalized[key] = null));
  } else {
    extend(normalized, raw);
  }
  cache.set(comp, normalized);
  return normalized;
}
export function isEmitListener(options, key) {
  if (!options || !isOn(key)) {
    return false;
  }
  key = key.slice(2).replace(/Once$/, '');
  return (
    hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, key)
  );
}
