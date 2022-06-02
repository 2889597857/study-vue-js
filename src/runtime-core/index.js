export { createRenderer } from './renderer.js'
export { registerRuntimeCompiler } from './component.js'
export { h } from './h.js'
export {
  // core
  reactive,
  ref,
  readonly,
  // utilities
  unref,
  proxyRefs,
  isRef,
  toRef,
  toRefs,
  isProxy,
  isReactive,
  isReadonly,
  isShallow,
  // advanced
  customRef,
  triggerRef,
  shallowRef,
  shallowReactive,
  shallowReadonly,
  markRaw,
  toRaw,
  // effect
  effect,
  stop,
  ReactiveEffect,
  // effect scope
  effectScope,
  EffectScope,
  getCurrentScope,
  onScopeDispose
} from '../reactivity/index.js'
export {
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect
} from './apiWatch.js'
export {
  openBlock,
  createBlock,
  setBlockTracking,
  createTextVNode,
  createCommentVNode,
  createStaticVNode,
  createElementVNode,
  createElementBlock,
  guardReactiveProps
} from './vnode.js'
export { createVNode, cloneVNode, mergeProps, isVNode } from './vnode.js'
export { Fragment, Text, Comment, Static } from './vnode.js'
export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  // onActivated,
  // onDeactivated,
  onRenderTracked,
  onRenderTriggered,
  onErrorCaptured,
  onServerPrefetch
} from './apiLifecycle.js'
export { provide, inject } from './apiInject.js'
export { nextTick } from './scheduler.js'
// export { defineComponent } from './apiDefineComponent.js'
export { defineAsyncComponent } from './apiAsyncComponent.js'
// export { useAttrs, useSlots } from './apiSetupHelpers.js'
export {
  toDisplayString,
  camelize,
  capitalize,
  toHandlerKey,
  normalizeProps,
  normalizeClass,
  normalizeStyle
} from '../shared/index.js'
export {
  withCtx,
  pushScopeId,
  popScopeId,
  withScopeId
} from './componentRenderContext.js'
export {
  resolveComponent,
  resolveDirective,
  resolveDynamicComponent
} from './helpers/resolveAssets.js'
export { renderList } from './helpers/renderList.js'
export { toHandlers } from './helpers/toHandlers.js'
export { renderSlot } from './helpers/renderSlot.js'
export { createSlots } from './helpers/createSlots.js'
export { withMemo, isMemoSame } from './helpers/withMemo.js'
export { withDirectives } from './directives.js'
export { getCurrentInstance } from './component.js'
export {
  BaseTransition,
  getTransitionRawChildren,
  resolveTransitionHooks,
  setTransitionHooks,
  useTransitionState
} from './components/BaseTransition.js'
// export { Teleport, TeleportProps } from './components/Teleport'
// export { Suspense, SuspenseProps } from './components/Suspense'
export { KeepAlive, } from './components/KeepAlive.js'